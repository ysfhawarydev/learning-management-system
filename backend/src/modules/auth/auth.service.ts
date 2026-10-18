import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';

import { DatabaseService } from '../../database/database.service.js';
import {
  departments,
  roles,
  students,
  userRoles,
  users,
} from '../../database/schema.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';

function getPostgresErrorCode(error: unknown): string | undefined {
  const visited = new Set<object>();
  let current: unknown = error;

  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) break;
    visited.add(current);

    if ('code' in current && typeof current.code === 'string') {
      return current.code;
    }

    current = 'cause' in current ? current.cause : undefined;
  }

  return undefined;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async getRegistrationDepartments() {
    return this.database.db
      .select({
        id: departments.id,
        name: departments.name,
        code: departments.code,
      })
      .from(departments);
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const number = dto.number.trim();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();

    if (!number || !firstName || !lastName) {
      throw new ConflictException(
        'Student number and name fields cannot be empty',
      );
    }

    const passwordHash = await argon2.hash(dto.password);

    try {
      const user = await this.database.db.transaction(async (tx) => {
        const [department] = await tx
          .select({ id: departments.id })
          .from(departments)
          .where(eq(departments.id, dto.departmentId))
          .limit(1);

        if (!department) {
          throw new NotFoundException('Department not found');
        }

        const [studentRole] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.name, 'student'))
          .limit(1);

        if (!studentRole) {
          throw new InternalServerErrorException(
            'Default student role is not configured',
          );
        }

        const [createdUser] = await tx
          .insert(users)
          .values({
            email,
            passwordHash,
            status: 'pending',
          })
          .returning({
            id: users.id,
            email: users.email,
            status: users.status,
            createdAt: users.createdAt,
          });

        if (!createdUser) {
          throw new InternalServerErrorException(
            'Failed to create user account',
          );
        }

        await tx.insert(userRoles).values({
          userId: createdUser.id,
          roleId: studentRole.id,
        });

        await tx.insert(students).values({
          userId: createdUser.id,
          departmentId: dto.departmentId,
          number,
          firstName,
          lastName,
          birth: dto.birth,
          status: 'applicant',
        });

        return createdUser;
      });

      return {
        message:
          'Registration submitted successfully. Your account is awaiting administrator approval.',
        user,
      };
    } catch (error: unknown) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'The email or student number is already registered',
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new ForbiddenException('Your account is not active');
    }

    const assignedRoles = await this.database.db
      .select({ name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));

    const roleNames = assignedRoles.map((role) => role.name);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      roles: roleNames,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        roles: roleNames,
      },
    };
  }
}

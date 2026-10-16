import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { DatabaseService } from '../../database/database.service.js';
import { roles, userRoles, users } from '../../database/schema.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      throw new ConflictException('Email is already registered');
    }

    const studentRole = await this.database.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, 'student'))
      .limit(1);

    if (studentRole.length === 0) {
      throw new InternalServerErrorException(
        'Default student role is not configured',
      );
    }

    const passwordHash = await argon2.hash(dto.password);

    try {
      const user = await this.database.db.transaction(async (tx) => {
        const [createdUser] = await tx
          .insert(users)
          .values({
            email,
            passwordHash,
          })
          .returning({
            id: users.id,
            email: users.email,
            status: users.status,
            createdAt: users.createdAt,
          });

        if (!createdUser) {
          throw new InternalServerErrorException('Failed to create user');
        }

        await tx.insert(userRoles).values({
          userId: createdUser.id,
          roleId: studentRole[0].id,
        });

        return createdUser;
      });

      return {
        message: 'Registration successful. Your account is pending activation.',
        user,
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException('Email is already registered');
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

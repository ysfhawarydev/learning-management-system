import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../types/authenticated-user.js';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;
    const [scheme, token, ...extra] = authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token || extra.length > 0) {
      throw new UnauthorizedException('Missing or invalid access token');
    }

    try {
      request.user =
        await this.jwtService.verifyAsync<AuthenticatedUser>(token);

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}

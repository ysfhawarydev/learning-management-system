import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthenticatedUser } from '../types/authenticated-user.js';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  const mockUser: AuthenticatedUser = {
    sub: 'user-123',
    email: 'student@example.com',
    roles: ['student'],
  };

  const mockJwtService = {
    verifyAsync: vi.fn(),
  };

  let request: {
    headers: {
      authorization?: string;
    };
    user?: AuthenticatedUser;
  };

  let context: ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();

    guard = new JwtAuthGuard(mockJwtService as unknown as JwtService);

    request = {
      headers: {},
    };

    context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  });

  it('should allow a valid Bearer token and attach the user to the request', async () => {
    request.headers.authorization = 'Bearer valid-token';
    mockJwtService.verifyAsync.mockResolvedValue(mockUser);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token');
    expect(request.user).toEqual(mockUser);
  });

  it('should reject a request without an authorization header', async () => {
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should reject an authorization header using the wrong scheme', async () => {
    request.headers.authorization = 'Basic token123';

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should reject a Bearer header without a token', async () => {
    request.headers.authorization = 'Bearer';

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should reject an authorization header containing extra parts', async () => {
    request.headers.authorization = 'Bearer token123 extra';

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should reject an invalid or expired token', async () => {
    request.headers.authorization = 'Bearer invalid-token';

    mockJwtService.verifyAsync.mockRejectedValue(
      new Error('Invalid or expired token'),
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('invalid-token');
  });
});

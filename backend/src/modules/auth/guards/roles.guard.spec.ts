import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { RolesGuard } from './roles.guard.js';
import type { AuthenticatedUser } from '../types/authenticated-user.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const mockReflector = {
    getAllAndOverride: vi.fn(),
  };

  let request: {
    user?: AuthenticatedUser;
  };

  let context: ExecutionContext;

  const mockUser: AuthenticatedUser = {
    sub: 'user-123',
    email: 'student@example.com',
    roles: ['student'],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    guard = new RolesGuard(mockReflector as unknown as Reflector);

    request = {};

    context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  });

  it('should allow access when no roles are required', () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('should allow access when the required roles list is empty', () => {
    mockReflector.getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow a user who has a required role', () => {
    request.user = mockUser;
    mockReflector.getAllAndOverride.mockReturnValue(['student']);

    expect(guard.canActivate(context)).toBe(true);

    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('should allow a user when they have one of multiple required roles', () => {
    request.user = mockUser;
    mockReflector.getAllAndOverride.mockReturnValue(['admin', 'student']);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject a request when user information is missing', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['student']);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should reject a user who does not have the required role', () => {
    request.user = mockUser;
    mockReflector.getAllAndOverride.mockReturnValue(['admin']);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should reject a user whose roles do not match any required role', () => {
    request.user = mockUser;
    mockReflector.getAllAndOverride.mockReturnValue(['admin', 'instructor']);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

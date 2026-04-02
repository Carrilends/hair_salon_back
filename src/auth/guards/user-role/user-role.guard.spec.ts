import { UserRoleGuard } from './user-role.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('UserRoleGuard', () => {
  const makeContext = (user?: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
    }) as any;

  it('allows when user has required role', async () => {
    const reflector = {
      get: jest.fn().mockReturnValue(['admin']),
    } as unknown as Reflector;

    const guard = new UserRoleGuard(reflector);
    const canActivate = await guard.canActivate(
      makeContext({ roles: ['admin'], fullName: 'Admin User' }),
    );

    expect(canActivate).toBe(true);
    expect(reflector.get).toHaveBeenCalled();
  });

  it('denies when user lacks required role', async () => {
    const reflector = {
      get: jest.fn().mockReturnValue(['admin']),
    } as unknown as Reflector;

    const guard = new UserRoleGuard(reflector);

    expect(() =>
      guard.canActivate(makeContext({ roles: ['user'], fullName: 'Test User' })),
    ).toThrow(ForbiddenException);
  });
});

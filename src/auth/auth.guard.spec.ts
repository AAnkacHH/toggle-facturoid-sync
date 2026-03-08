import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard, IS_PUBLIC_KEY } from './auth.guard';
import { AuthService } from './auth.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authService: { validateSecret: jest.Mock; isSetupComplete: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    authService = {
      validateSecret: jest.fn(),
      isSetupComplete: jest.fn(),
    };

    reflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: authService },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  function createMockContext(authHeader?: string): ExecutionContext {
    const headers: Record<string, string> = {};
    if (authHeader !== undefined) {
      headers['authorization'] = authHeader;
    }

    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  it('should allow access for @Public() routes', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createMockContext();

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow access when setup is not complete', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    authService.isSetupComplete.mockResolvedValue(false);
    const context = createMockContext();

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw when no Authorization header is provided', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    authService.isSetupComplete.mockResolvedValue(true);
    const context = createMockContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw when Authorization header is not Basic', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    authService.isSetupComplete.mockResolvedValue(true);
    const context = createMockContext('Bearer some-token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw when base64 decoding reveals no colon separator', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    authService.isSetupComplete.mockResolvedValue(true);
    const base64 = Buffer.from('nocolon').toString('base64');
    const context = createMockContext(`Basic ${base64}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw when secret is invalid', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    authService.isSetupComplete.mockResolvedValue(true);
    authService.validateSecret.mockResolvedValue(false);
    const base64 = Buffer.from('admin:wrong-secret').toString('base64');
    const context = createMockContext(`Basic ${base64}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should allow access when secret is valid', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    authService.isSetupComplete.mockResolvedValue(true);
    authService.validateSecret.mockResolvedValue(true);
    const base64 = Buffer.from('admin:correct-secret').toString('base64');
    const context = createMockContext(`Basic ${base64}`);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(authService.validateSecret).toHaveBeenCalledWith('correct-secret');
  });

  it('should extract secret correctly when password contains colons', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    authService.isSetupComplete.mockResolvedValue(true);
    authService.validateSecret.mockResolvedValue(true);
    const base64 = Buffer.from('admin:secret:with:colons').toString('base64');
    const context = createMockContext(`Basic ${base64}`);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(authService.validateSecret).toHaveBeenCalledWith(
      'secret:with:colons',
    );
  });

  it('should use IS_PUBLIC_KEY for reflector lookup', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const handler = jest.fn();
    const cls = jest.fn();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
      getHandler: () => handler,
      getClass: () => cls,
    } as unknown as ExecutionContext;

    await guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      handler,
      cls,
    ]);
  });
});

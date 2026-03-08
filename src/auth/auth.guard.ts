import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import { AuthService } from './auth.service';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if the route is marked as @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // If setup is not yet complete, allow all requests (initial setup mode)
    const setupComplete = await this.authService.isSetupComplete();
    if (!setupComplete) {
      return true;
    }

    // Extract and validate Authorization header
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;

    if (!authHeader) {
      throw new UnauthorizedException(
        'Missing Authorization header. Use Basic auth with base64(username:secret).',
      );
    }

    if (!authHeader.startsWith('Basic ')) {
      throw new UnauthorizedException(
        'Invalid Authorization format. Expected: Basic <base64(username:secret)>',
      );
    }

    const base64 = authHeader.substring(6);
    let decoded: string;
    try {
      decoded = Buffer.from(base64, 'base64').toString('utf8');
    } catch {
      throw new UnauthorizedException(
        'Invalid base64 in Authorization header.',
      );
    }

    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
      throw new UnauthorizedException(
        'Invalid Basic auth format. Expected base64(username:secret).',
      );
    }

    const secret = decoded.substring(colonIndex + 1);

    const valid = await this.authService.validateSecret(secret);
    if (!valid) {
      throw new UnauthorizedException('Invalid API secret.');
    }

    return true;
  }
}

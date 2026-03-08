import { Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('setup')
  async setup() {
    const secret = await this.authService.setup();
    return {
      secret,
      message:
        'Save this secret — it will not be shown again. ' +
        'Use it in Authorization: Basic base64(username:secret) header.',
    };
  }

  @Public()
  @Get('status')
  async status() {
    const configured = await this.authService.isSetupComplete();
    return { configured };
  }
}

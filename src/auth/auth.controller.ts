import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from './auth.guard';
import {
  AuthSetupResponseDto,
  AuthStatusResponseDto,
} from './dto/auth-response.dto';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('setup')
  @ApiOperation({
    summary: 'Initial auth setup',
    description:
      'Creates the initial API secret for HTTP Basic authentication. Can only be called once. Public endpoint -- no auth required.',
  })
  @ApiResponse({
    status: 201,
    description: 'Auth secret created successfully',
    type: AuthSetupResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Auth has already been configured',
  })
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
  @ApiOperation({
    summary: 'Check auth setup status',
    description:
      'Returns whether the initial auth setup has been completed. Public endpoint -- no auth required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Auth status retrieved',
    type: AuthStatusResponseDto,
  })
  async status() {
    const configured = await this.authService.isSetupComplete();
    return { configured };
  }
}

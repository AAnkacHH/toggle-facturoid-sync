import { ApiProperty } from '@nestjs/swagger';

export class AuthSetupResponseDto {
  @ApiProperty({
    description: 'Generated API secret. Save it -- it will not be shown again.',
    example: 'a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5',
  })
  secret!: string;

  @ApiProperty({
    description: 'Instructions for using the secret',
    example:
      'Save this secret -- it will not be shown again. Use it in Authorization: Basic base64(username:secret) header.',
  })
  message!: string;
}

export class AuthStatusResponseDto {
  @ApiProperty({
    description: 'Whether the initial auth setup has been completed',
    example: true,
  })
  configured!: boolean;
}

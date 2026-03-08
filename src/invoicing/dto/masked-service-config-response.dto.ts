import { ApiProperty } from '@nestjs/swagger';

export class MaskedServiceConfigResponseDto {
  @ApiProperty({
    description: 'Unique identifier (UUID)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id!: string;

  @ApiProperty({
    description: 'Name of the external service (e.g. toggl, fakturoid)',
    example: 'toggl',
  })
  serviceName!: string;

  @ApiProperty({
    description: 'Configuration key name',
    example: 'api_token',
  })
  configKey!: string;

  @ApiProperty({
    description: 'Whether the value is stored encrypted',
    example: true,
  })
  isSecret!: boolean;

  @ApiProperty({
    description:
      'Config value. Masked as "******" for secret configs, actual value for plain configs.',
    example: '******',
  })
  value!: string;

  @ApiProperty({
    description: 'Record creation timestamp',
    example: '2026-03-01T12:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Record last update timestamp',
    example: '2026-03-01T12:00:00.000Z',
  })
  updatedAt!: Date;
}

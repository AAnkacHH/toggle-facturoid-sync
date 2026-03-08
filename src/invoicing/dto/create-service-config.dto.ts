import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, Length } from 'class-validator';

export class CreateServiceConfigDto {
  @ApiProperty({
    description: 'Name of the external service (e.g. toggl, fakturoid)',
    example: 'toggl',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @Length(1, 100)
  serviceName!: string;

  @ApiProperty({
    description: 'Configuration key name',
    example: 'api_token',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @Length(1, 100)
  configKey!: string;

  @ApiProperty({
    description: 'Configuration value (will be encrypted if isSecret is true)',
    example: 'my-secret-api-token-value',
  })
  @IsString()
  value!: string;

  @ApiProperty({
    description: 'Whether this value should be stored encrypted',
    example: true,
  })
  @IsBoolean()
  isSecret!: boolean;
}

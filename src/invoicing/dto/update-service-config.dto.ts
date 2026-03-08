import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateServiceConfigDto {
  @ApiPropertyOptional({
    description: 'Name of the external service',
    example: 'fakturoid',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  serviceName?: string;

  @ApiPropertyOptional({
    description: 'Configuration key name',
    example: 'slug',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  configKey?: string;

  @ApiPropertyOptional({
    description: 'Configuration value',
    example: 'new-value',
  })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({
    description: 'Whether this value should be stored encrypted',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;
}

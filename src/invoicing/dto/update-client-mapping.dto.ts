import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';

export class UpdateClientMappingDto {
  @ApiPropertyOptional({
    description: 'Display name for the client mapping',
    example: 'Acme Corp Updated',
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Toggl client ID',
    example: 12345678,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  togglClientId?: number;

  @ApiPropertyOptional({
    description: 'Toggl workspace ID',
    example: 9876543,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  togglWorkspaceId?: number;

  @ApiPropertyOptional({
    description: 'Fakturoid subject ID',
    example: 456,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  fakturoidSubjectId?: number;

  @ApiPropertyOptional({
    description: 'Hourly rate for this client',
    example: 175,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  hourlyRate?: number;

  @ApiPropertyOptional({
    description: 'Currency code (ISO 4217, 3 characters)',
    example: 'EUR',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Whether this mapping is active',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

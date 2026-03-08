import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';

export class CreateClientMappingDto {
  @ApiProperty({
    description: 'Display name for the client mapping',
    example: 'Acme Corp',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiProperty({
    description: 'Toggl client ID',
    example: 12345678,
  })
  @IsNumber()
  @IsPositive()
  togglClientId!: number;

  @ApiProperty({
    description: 'Toggl workspace ID',
    example: 9876543,
  })
  @IsNumber()
  @IsPositive()
  togglWorkspaceId!: number;

  @ApiProperty({
    description: 'Fakturoid subject ID to map to',
    example: 123,
  })
  @IsNumber()
  @IsPositive()
  fakturoidSubjectId!: number;

  @ApiProperty({
    description: 'Hourly rate for this client',
    example: 150,
  })
  @IsNumber()
  @IsPositive()
  hourlyRate!: number;

  @ApiPropertyOptional({
    description: 'Currency code (ISO 4217, 3 characters)',
    example: 'CZK',
    default: 'CZK',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Whether this mapping is active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

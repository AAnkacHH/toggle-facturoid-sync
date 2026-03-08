import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';

export class UpdateClientMappingDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  togglClientId?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  togglWorkspaceId?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  fakturoidSubjectId?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  hourlyRate?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

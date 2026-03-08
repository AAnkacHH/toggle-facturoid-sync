import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';

export class CreateClientMappingDto {
  @IsString()
  @Length(1, 255)
  name: string;

  @IsNumber()
  @IsPositive()
  togglClientId: number;

  @IsNumber()
  @IsPositive()
  togglWorkspaceId: number;

  @IsNumber()
  @IsPositive()
  fakturoidSubjectId: number;

  @IsNumber()
  @IsPositive()
  hourlyRate: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateServiceConfigDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  serviceName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  configKey?: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;
}

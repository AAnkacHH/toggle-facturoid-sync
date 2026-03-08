import { IsBoolean, IsString, Length } from 'class-validator';

export class CreateServiceConfigDto {
  @IsString()
  @Length(1, 100)
  serviceName!: string;

  @IsString()
  @Length(1, 100)
  configKey!: string;

  @IsString()
  value!: string;

  @IsBoolean()
  isSecret!: boolean;
}

import { IsNumber, Max, Min } from 'class-validator';

export class GenerateInvoicesDto {
  @IsNumber()
  @Min(2020)
  @Max(2100)
  year!: number;

  @IsNumber()
  @Min(1)
  @Max(12)
  month!: number;
}

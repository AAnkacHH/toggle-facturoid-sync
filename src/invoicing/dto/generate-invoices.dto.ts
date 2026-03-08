import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class GenerateInvoicesDto {
  @ApiProperty({
    description: 'Year for invoice generation',
    example: 2026,
    minimum: 2020,
    maximum: 2100,
  })
  @IsNumber()
  @Min(2020)
  @Max(2100)
  year!: number;

  @ApiProperty({
    description: 'Month for invoice generation (1-12)',
    example: 3,
    minimum: 1,
    maximum: 12,
  })
  @IsNumber()
  @Min(1)
  @Max(12)
  month!: number;
}

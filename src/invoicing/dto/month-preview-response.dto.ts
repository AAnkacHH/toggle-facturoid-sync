import { ApiProperty } from '@nestjs/swagger';

export class ProjectPreviewDto {
  @ApiProperty({
    description: 'Toggl project name',
    example: 'Website Redesign',
  })
  projectName!: string;

  @ApiProperty({ description: 'Hours tracked for this project', example: 40.5 })
  hours!: number;

  @ApiProperty({ description: 'Amount for this project', example: 6075.0 })
  amount!: number;
}

export class ClientPreviewDto {
  @ApiProperty({ description: 'Client name', example: 'Acme Corp' })
  clientName!: string;

  @ApiProperty({ description: 'Toggl client ID', example: 12345678 })
  togglClientId!: number;

  @ApiProperty({
    description: 'Breakdown by project',
    type: [ProjectPreviewDto],
  })
  projects!: ProjectPreviewDto[];

  @ApiProperty({
    description: 'Total hours across all projects',
    example: 160.5,
  })
  totalHours!: number;

  @ApiProperty({
    description: 'Total amount across all projects',
    example: 24075.0,
  })
  totalAmount!: number;

  @ApiProperty({
    description: 'Whether an invoice already exists for this client/period',
    example: false,
  })
  hasExistingInvoice!: boolean;
}

export class GrandTotalDto {
  @ApiProperty({ description: 'Total hours for the month', example: 320.0 })
  hours!: number;

  @ApiProperty({ description: 'Total amount for the month', example: 48000.0 })
  amount!: number;
}

export class MonthPreviewResponseDto {
  @ApiProperty({ description: 'Year of the preview', example: 2026 })
  year!: number;

  @ApiProperty({ description: 'Month of the preview (1-12)', example: 3 })
  month!: number;

  @ApiProperty({
    description: 'Per-client breakdown',
    type: [ClientPreviewDto],
  })
  clients!: ClientPreviewDto[];

  @ApiProperty({
    description: 'Grand total for the month',
    type: GrandTotalDto,
  })
  grandTotal!: GrandTotalDto;
}

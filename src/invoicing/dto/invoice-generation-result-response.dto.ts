import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvoiceGenerationResultResponseDto {
  @ApiProperty({
    description: 'Client name from the mapping',
    example: 'Acme Corp',
  })
  clientName!: string;

  @ApiProperty({
    description: 'UUID of the client mapping',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  clientMappingId!: string;

  @ApiProperty({
    description: 'Result status of the invoice generation',
    enum: ['created', 'skipped_zero_hours', 'skipped_duplicate', 'error'],
    example: 'created',
  })
  status!: 'created' | 'skipped_zero_hours' | 'skipped_duplicate' | 'error';

  @ApiPropertyOptional({
    description: 'Fakturoid invoice ID (if created)',
    example: 12345,
  })
  fakturoidInvoiceId?: number;

  @ApiPropertyOptional({
    description: 'Fakturoid invoice number (if created)',
    example: '2026-0001',
  })
  fakturoidNumber?: string;

  @ApiPropertyOptional({
    description: 'Total hours billed',
    example: 160.5,
  })
  totalHours?: number;

  @ApiPropertyOptional({
    description: 'Total amount in currency',
    example: 24075.0,
  })
  totalAmount?: number;

  @ApiPropertyOptional({
    description: 'Error message (if status is error)',
    example: 'Failed to create invoice in Fakturoid',
  })
  errorMessage?: string;
}

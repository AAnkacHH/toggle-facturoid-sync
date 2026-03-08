/**
 * DTOs for invoicing orchestration results.
 */

export interface InvoiceGenerationResult {
  clientName: string;
  clientMappingId: string;
  status: 'created' | 'skipped_zero_hours' | 'skipped_duplicate' | 'error';
  fakturoidInvoiceId?: number;
  fakturoidNumber?: string;
  totalHours?: number;
  totalAmount?: number;
  errorMessage?: string;
}

export interface ClientPreview {
  clientName: string;
  togglClientId: number;
  projects: { projectName: string; hours: number; amount: number }[];
  totalHours: number;
  totalAmount: number;
  hasExistingInvoice: boolean;
}

export interface MonthPreview {
  year: number;
  month: number;
  clients: ClientPreview[];
}

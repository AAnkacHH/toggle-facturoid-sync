/**
 * Fakturoid API v3 — request/response shape interfaces
 * Base URL: https://app.fakturoid.cz/api/v3
 */

export interface FakturoidInvoiceLine {
  name: string; // project name
  quantity: number; // hours
  unit_name: string; // 'hod' (Czech for hours)
  unit_price: number; // hourly rate
  vat_rate?: number; // VAT rate percentage, e.g. 21
}

export interface FakturoidInvoicePayload {
  subject_id: number;
  payment_method: string; // 'bank'
  currency: string; // 'CZK'
  lines: FakturoidInvoiceLine[];
  // Optional fields per Fakturoid API v3
  issued_on?: string; // ISO date string, e.g. '2026-03-01'
  taxable_fulfillment_due?: string; // ISO date string
  due?: number; // payment due days
  note?: string; // invoice note
}

export interface FakturoidInvoiceResponse {
  id: number;
  number: string;
  total: string;
  status: string;
  subject_id: number;
  html_url: string;
}

export interface FakturoidSubject {
  id: number;
  name: string;
  email: string | null;
  street: string | null;
  city: string | null;
  country: string | null;
  registration_no: string | null; // ICO
}

export interface FakturoidTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

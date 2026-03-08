/**
 * Fakturoid API v3 — request/response shape interfaces
 * Base URL: https://app.fakturoid.cz/api/v3
 */

export interface FakturoidInvoiceLine {
  name: string; // project name
  quantity: number; // hours
  unit_name: string; // 'hod' (Czech for hours)
  unit_price: number; // hourly rate
}

export interface FakturoidInvoicePayload {
  subject_id: number;
  payment_method: string; // 'bank'
  currency: string; // 'CZK'
  lines: FakturoidInvoiceLine[];
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
}

export interface FakturoidTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

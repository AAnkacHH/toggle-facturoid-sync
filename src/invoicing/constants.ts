/** Service names used in service_config table */
export const SERVICE_NAMES = {
  TOGGL: 'toggl',
  FAKTUROID: 'fakturoid',
  SYSTEM: 'system',
} as const;

/** Config keys for Toggl service */
export const TOGGL_CONFIG_KEYS = {
  API_TOKEN: 'api_token',
  WORKSPACE_ID: 'workspace_id',
} as const;

/** Config keys for Fakturoid service */
export const FAKTUROID_CONFIG_KEYS = {
  CLIENT_ID: 'client_id',
  CLIENT_SECRET: 'client_secret',
  SLUG: 'slug',
  USER_AGENT_EMAIL: 'user_agent_email',
} as const;

/** Invoice line defaults */
export const INVOICE_DEFAULTS = {
  UNIT_NAME: 'hod',
  PAYMENT_METHOD: 'bank',
  DEFAULT_CURRENCY: 'CZK',
} as const;

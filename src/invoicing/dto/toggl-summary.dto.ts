/**
 * Toggl Track Reports API v3 — response shape interfaces
 * POST /workspace/{id}/summary/time_entries
 */

export interface TogglProjectGroup {
  id: number | null;
  title: string;
  seconds: number;
}

export interface TogglClientGroup {
  id: number | null;
  sub_groups: TogglProjectGroup[];
}

export interface TogglSummaryResponse {
  groups: TogglClientGroup[];
}

/**
 * Processed DTOs — internal application shape
 */

export interface TogglProjectSummary {
  projectId: number;
  projectName: string;
  totalSeconds: number;
  totalHours: number;
}

export interface TogglMonthSummary {
  clientId: number;
  projects: TogglProjectSummary[];
}

/** Toggl API v9 — GET /workspaces/{id}/clients */
export interface TogglClient {
  id: number;
  name: string;
  wid: number;
  archived: boolean;
}

/** Toggl API v9 — GET /workspaces/{id}/projects */
export interface TogglProject {
  id: number;
  name: string;
  wid: number;
  cid: number | null;
  client_id: number | null;
  active: boolean;
  color: string;
}

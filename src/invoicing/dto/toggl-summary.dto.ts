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

export class TogglProjectSummary {
  projectId: number;
  projectName: string;
  totalSeconds: number;
  totalHours: number;
}

export class TogglMonthSummary {
  clientId: number;
  projects: TogglProjectSummary[];
}

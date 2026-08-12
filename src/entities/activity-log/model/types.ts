// Mirrors the api-gateway audit feed (GET /activity-logs), which merges each
// service's activity-log rows and enriches them with resolved actor/entity
// objects. See Elchi-Backend audit-gateway.controller + audit-enrichment.service.

export const ACTIVITY_SERVICES = [
  "identity",
  "order",
  "finance",
  "branch",
  "integration",
  "logistics",
  "catalog",
  "investor",
  "notification",
] as const;
export type ActivityService = (typeof ACTIVITY_SERVICES)[number];

/** Resolved actor (the user who performed the action). */
export interface ActivityActor {
  id: string | null;
  name: string | null;
  username?: string | null;
  phone_number?: string | null;
  role: string | null;
  status?: string | null;
}

export interface ActivityLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  service: string | null;
  trace_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // Enrichment (added by the gateway):
  actor: ActivityActor | null;
  /** Resolved primary subject; shape varies by entity_type (loose summary). */
  entity: Record<string, unknown> | null;
  references: Record<string, unknown> | null;
}

export interface ActivityLogParams {
  page?: number;
  limit?: number;
  service?: string;
  entity_type?: string;
  entity_id?: string;
  action?: string;
  user_id?: string;
  user_role?: string;
  trace_id?: string;
  /** ISO date/datetime lower bound. */
  from?: string;
  /** ISO date/datetime upper bound. */
  to?: string;
  /** Free-text across type/id/action/actor name. */
  search?: string;
}

export interface ActivityLogListResult {
  items: ActivityLog[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

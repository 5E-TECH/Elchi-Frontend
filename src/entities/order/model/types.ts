export interface TrackingEventOldNew {
  status?: string;
  [key: string]: unknown;
}

export interface TrackingEventActor {
  id?: string | number | null;
  name?: string | null;
  username?: string | null;
  phone_number?: string | null;
  phoneNumber?: string | null;
  role?: string | null;
  status?: string | null;
}

export interface TrackingEvent {
  id: string;
  order_id: string;
  action: "created" | "status_change" | "sold" | "cancelled" | "rollback" | "paid" | "closed" | string;
  old_value: TrackingEventOldNew | null;
  new_value: TrackingEventOldNew | null;
  from_status?: string | null;
  to_status?: string | null;
  changed_by: string | number;
  changed_by_role: string;
  actor?: TrackingEventActor | null;
  user_name?: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  note?: string;
  created_at: string;
  [key: string]: unknown;
}

export interface ActivityLogResponse {
  data: TrackingEvent[];
  total?: number;
  page?: number;
  limit?: number;
}

export interface TrackingEventOldNew {
  status?: string;
  [key: string]: unknown;
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
  user_name?: string;
  note?: string;
  created_at: string;
}

export interface ActivityLogResponse {
  data: TrackingEvent[];
  total?: number;
  page?: number;
  limit?: number;
}

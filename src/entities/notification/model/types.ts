export interface Notification {
  id: string;
  market_id: string;
  market_name: string;
  group_id: string;
  group_type: "cancel" | "create";
  created_at: string;
}

export interface NotificationParams {
  page?: number;
  limit?: number;
}

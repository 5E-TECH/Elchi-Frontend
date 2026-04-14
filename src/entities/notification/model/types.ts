export interface Notification {
  id: string;
  user: { id: string; fullName: string; username: string };
  chat_id: string;
  status: "active" | "inactive";
  created_at: string;
}

export interface NotificationParams {
  page?: number;
  limit?: number;
}

export interface UpdateNotificationDto {
  user_id: string;
  chat_id: string;
  status: "active" | "inactive";
}

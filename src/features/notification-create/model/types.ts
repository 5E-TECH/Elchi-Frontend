export interface CreateNotificationDto {
  user_id: string;
  chat_id: string;
  status: "active" | "inactive";
}

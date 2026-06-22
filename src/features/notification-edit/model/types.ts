export interface UpdateNotificationDto {
  market_id: string;
  group_id: string;
  group_type: "cancel" | "create";
}

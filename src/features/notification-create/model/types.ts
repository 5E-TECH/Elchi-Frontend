export interface CreateNotificationDto {
  market_id: string;
  group_id: string;
  group_type: "cancel" | "create";
}

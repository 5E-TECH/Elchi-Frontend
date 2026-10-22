/** Guruhga qaysi xabarlar boradi: yangi buyurtmalar (`create`) yoki bekor qilinganlar (`cancel`). */
export type NotificationGroupType = "cancel" | "create";

/** Marketning Telegram guruhi ulanishi (`GET /notifications` qatori). */
export interface Notification {
  id: string;
  market_id: string;
  /** Javobda market obyekti bo'lsa — uning nomi; bo'lmasa `null` (nom marketlar ro'yxatidan olinadi). */
  market_name: string | null;
  group_id: string;
  group_type: NotificationGroupType;
  /**
   * `false` — bot guruhdan chiqarilgan yoki guruhga yetib bo'lmaydi (backend 9HIaV80X: adminlarga
   * «Telegram guruhi nofaol» bildirishnomasi ham keladi). Qayta ulash — tahrirlash yoki o'chirib qayta ulash.
   */
  is_active: boolean;
  /** Ulangan sana; javobda bo'lmasa `null`. */
  created_at: string | null;
}

/** `GET /notifications` query (OpenAPI: market_id, group_type, is_active, page, limit). */
export interface NotificationParams {
  page?: number;
  limit?: number;
  market_id?: string;
  group_type?: NotificationGroupType;
  is_active?: boolean;
}

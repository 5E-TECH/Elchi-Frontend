import type { NotificationInactiveReason } from "../lib/inactiveReason";

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
   * `false` — bot guruhga yetolmaydi (backend 9HIaV80X: adminlarga «Telegram guruhi nofaol» bildirishnomasi ham keladi)
   * yoki admin qo'lda nofaol qilgan (`PATCH {is_active: false}`). Sababi — `inactive_reason`.
   */
  is_active: boolean;
  /**
   * Nofaollik sababi (G085w5Qr): `kicked` / `left` / `blocked_on_send` / `chat_not_found` / `manual`. Faol qatorda,
   * migratsiyadan oldingi nofaol qatorda va frontend bilmagan yangi qiymatda — `null` (umumiy izoh).
   */
  inactive_reason: NotificationInactiveReason | null;
  /** Qachon nofaol bo'ldi (ISO); faol qatorda yoki noma'lum bo'lsa — `null`. */
  inactive_at: string | null;
  /** Ulangan sana; javobda bo'lmasa `null`. */
  created_at: string | null;
}

/**
 * Market o'z guruhi holati (`GET /notifications/me/telegram-groups`, KJNHAlGW; market va market_operator, market
 * tokendan). Javobda har doim ikkala tur; guruh ID'si va bot nomi qaytmaydi.
 */
export interface MyTelegramGroupStatus {
  group_type: NotificationGroupType;
  /** Shu tur uchun guruh ulanganmi. */
  linked: boolean;
  /** Ulangan guruh faolmi; ulanmagan bo'lsa `false` (javobdagi `null`). */
  is_active: boolean;
  /** Qachon ulangan (ISO); ulanmagan yoki sana kelmasa — `null`. */
  linked_at: string | null;
  /** Nofaol sababi (G085w5Qr); faol, ulanmagan yoki sababi noma'lum bo'lsa — `null`. */
  inactive_reason: NotificationInactiveReason | null;
}

/** `GET /notifications` query (OpenAPI: market_id, group_type, is_active, page, limit). */
export interface NotificationParams {
  page?: number;
  limit?: number;
  market_id?: string;
  group_type?: NotificationGroupType;
  is_active?: boolean;
}

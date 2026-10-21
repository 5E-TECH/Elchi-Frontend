import type { NotificationGroupType } from "../../../entities/notification";

/** `POST /users/me/telegram/link-code` javobi (normallashtirilgan). */
export type TelegramLinkCode = {
  /** Bir martalik kod. */
  token: string;
  /** `https://t.me/<bot>?start=<kod>`; bot nomi serverda sozlanmagan bo'lsa `null`. */
  deepLink: string | null;
  /** Havola bo'lmasa botga yuboriladigan buyruq: `/start <kod>`. */
  command: string | null;
  /** ISO vaqt (10 daqiqa). */
  expiresAt: string | null;
};

/**
 * `POST /telegram/link-code` tanasi — market guruhi (`purpose: "market_group"`). `market_id` superadmin/admin
 * uchun majburiy; market va uning operatori yubormaydi (server o'z marketini yechadi).
 */
export interface GroupLinkCodeRequest {
  purpose: "market_group";
  group_type: NotificationGroupType;
  market_id?: string;
}

/**
 * Bir martalik guruh ulash kodi (10 daqiqa). `deep_link` — `https://t.me/<bot>?startgroup=<kod>`;
 * backendda bot nomi sozlanmagan bo'lsa `null` — unda `command` (`/start <kod>`) guruhga qo'lda yuboriladi.
 */
export interface GroupLinkCode {
  token: string;
  purpose: "market_group";
  group_type: NotificationGroupType;
  expires_at: string;
  deep_link: string | null;
  command: string;
}

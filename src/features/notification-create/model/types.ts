import type { NotificationGroupType } from "../../../entities/notification";

/** `POST /telegram/link-code` tanasi (market guruhi; superadmin/admin uchun `market_id` majburiy). */
export interface GroupLinkCodeRequest {
  purpose: "market_group";
  group_type: NotificationGroupType;
  market_id: string;
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

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

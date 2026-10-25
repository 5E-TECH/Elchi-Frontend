import type { Tone } from "../../../shared/ui/primitives";

/**
 * Telegram guruhi nofaollik sababi (backend G085w5Qr, `telegram_markets.inactive_reason`): bot aniqlagan `kicked`
 * (guruhdan chiqarilgan), `left` (o'zi chiqib ketgan), `blocked_on_send` (yuborishda Telegram rad etdi),
 * `chat_not_found` (guruh topilmadi) yoki admin qo'lda nofaol qilgan `manual`. Faol qatorda va migratsiyadan oldingi
 * nofaol qatorlarda `null`.
 */
export const NOTIFICATION_INACTIVE_REASONS = [
  "kicked",
  "left",
  "blocked_on_send",
  "chat_not_found",
  "manual",
] as const;

export type NotificationInactiveReason = (typeof NOTIFICATION_INACTIVE_REASONS)[number];

/**
 * Matn guruhi (`notificationGroups:status.reason.*`, `toggle.activate.reason.*`, `create.existsInactiveReason.*`):
 * `kicked` va `left` — bitta matn («Bot guruhdan chiqarilgan»), `unknown` — sabab `null` yoki yangi (frontend
 * bilmagan) qiymat: umumiy neytral izoh (D1, «Xabarlar bu guruhga yuborilmayapti»).
 */
export type InactiveReasonKey = "botRemoved" | "sendBlocked" | "chatNotFound" | "manual" | "unknown";

const isInactiveReason = (value: unknown): value is NotificationInactiveReason =>
  typeof value === "string" && (NOTIFICATION_INACTIVE_REASONS as readonly string[]).includes(value);

/** API qiymati → ma'lum sabab; `null`, bo'sh yoki noma'lum satr — `null` (umumiy izoh chiziladi). */
export const parseInactiveReason = (value: unknown): NotificationInactiveReason | null =>
  isInactiveReason(value) ? value : null;

export const inactiveReasonKey = (reason: NotificationInactiveReason | null | undefined): InactiveReasonKey => {
  switch (reason) {
    case "kicked":
    case "left":
      return "botRemoved";
    case "blocked_on_send":
      return "sendBlocked";
    case "chat_not_found":
      return "chatNotFound";
    case "manual":
      return "manual";
    default:
      return "unknown";
  }
};

/**
 * «Nofaol» belgisi toni (DESIGN_SYSTEM §8, maket `*-notifications-telegram-groups`): bot guruhga yetolmaydi — `danger`
 * (amal kerak: botni qayta qo'shish yoki qayta ulash); qo'lda nofaol qilingan yoki sabab noma'lum — `neutral` (D1).
 * Rang har doim «Nofaol» so'zi va sabab matni bilan birga.
 */
export const inactiveReasonTone = (reason: NotificationInactiveReason | null | undefined): Extract<Tone, "danger" | "neutral"> => {
  const key = inactiveReasonKey(reason);
  return key === "manual" || key === "unknown" ? "neutral" : "danger";
};

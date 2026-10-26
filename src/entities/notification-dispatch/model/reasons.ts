/**
 * YETMAGANLIK SABABI — faqat kod xaritasi orqali (ega S4: «faqat tushunarli o'zbekcha xato matni, texnik matn
 * ko'rsatilmaydi»). Backend `delivery[`${kanal}_reason`]` (kod) yoki `_error` (xom matn, 200 belgigacha) beradi —
 * xaritada yo'q satr HECH QACHON chiqmaydi: o'rniga holat va kanalga qarab umumiy matn.
 *
 * Kodlar manbasi (backend `origin/main`): `telegram-dm.service.ts` (`no_telegram_id`, `not_private_chat`,
 * `bot_blocked`, `contacts_unavailable`), `notification-inbox.service.ts` (`telegram_target_missing`,
 * `no_telegram_group`), `sms-dispatch.service.ts` (`sms_disabled`, `provider_not_configured`, `no_phone`,
 * `duplicate`, darvoza `daily_cap_exceeded`), `channel-planner.service.ts` (`push_disabled`, `no_phone`),
 * `resolve-channels.ts` (`muted`), `push-delivery.service.ts` (`online`, `quiet_hours`, `push_disabled`).
 * N9 (lkQiuyQu): kampaniya hisobotidagi `failures[].reason_code` — push xatosi tasnifi `campaign-report.service.ts`
 * `pushReasonCode` (`subscription_expired`, `payload_too_large`, `rate_limited`, `push_rejected`,
 * `push_service_error`, `network_error`, `push_failed`); SMS darvozasi `sms-dispatch.service.ts` / `sms-gate.service.ts`
 * (`no_consent`, `fanout_exceeded`, `opt_out_not_configured`), bekor qilingan kampaniya — `campaign_cancelled`.
 */

/** Kod → `notifications:dispatch.reason.*` kaliti. */
const REASON_KEYS: Record<string, string> = {
  muted: "muted",
  no_telegram_id: "noTelegram",
  not_private_chat: "noTelegram",
  bot_blocked: "botBlocked",
  telegram_target_missing: "noTelegramGroup",
  no_telegram_group: "noTelegramGroup",
  no_phone: "noPhone",
  sms_disabled: "smsDisabled",
  provider_not_configured: "noProvider",
  daily_cap_exceeded: "smsDailyCap",
  duplicate: "duplicate",
  push_disabled: "pushDisabled",
  online: "appOpen",
  quiet_hours: "quietHours",
  no_subscription: "noSubscription",
  subscription_expired: "pushExpired",
  payload_too_large: "pushTooLarge",
  rate_limited: "pushRateLimited",
  push_rejected: "pushRejected",
  push_service_error: "pushServiceError",
  network_error: "networkError",
  push_failed: "failedPush",
  no_consent: "smsNoConsent",
  fanout_exceeded: "smsFanout",
  opt_out_not_configured: "smsOptOut",
  campaign_cancelled: "campaignCancelled",
};

/** Kod bo'lmasa — holat bo'yicha (kanaldan qat'i nazar). */
const STATUS_KEYS: Record<string, string> = {
  no_provider: "noProvider",
  no_subscription: "noSubscription",
  not_eligible: "notEligible",
  blocked: "smsLimit",
  // SMS operator hisoboti (DLR) yakuniy xatolari — SMS kampaniyasi «Yetkazilmaganlar»ida holat shu bo'ladi.
  not_delivered: "failedSms",
  rejected: "smsRejected",
  expired: "smsExpired",
};

/** SMS operator hisoboti (DLR) yakuniy xato holatlari — «xato» guruhi (`failed` bilan bir qatorda). */
export const SMS_DLR_FAILED_STATUSES: readonly string[] = ["not_delivered", "rejected", "expired"];

/** `failed` + noma'lum sabab — kanal bo'yicha (maket: «Telegram xatosi», «SMS yetkazilmadi»). */
const FAILED_KEYS: Record<string, string> = {
  telegram: "failedTelegram",
  sms: "failedSms",
  push: "failedPush",
};

/**
 * Sabab matni kaliti (`dispatch.reason.<kalit>`) yoki `null` — aytadigan tushunarli sabab yo'q (masalan
 * kodsiz `skipped`): badge'ning o'zi yetarli.
 */
export const failureReasonKey = (channel: string, status: string, reason: string | null | undefined) => {
  const code = typeof reason === "string" ? reason.trim() : "";
  const key = REASON_KEYS[code] ?? STATUS_KEYS[status] ?? (status === "failed" ? (FAILED_KEYS[channel] ?? "failed") : null);
  return key ? `dispatch.reason.${key}` : null;
};

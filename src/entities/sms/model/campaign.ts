/**
 * SMS kampaniyasi — sof yordamchilar (KM-1): kunlik limit, reklama tungi taqiqi, xato turlari.
 * Hammasi backend shartnomasiga tayanadi (`notification-service` `sms-gate.service.ts`, `sms-campaign.service.ts`).
 */

/** O'zbekiston doimiy UTC+5 (yozgi vaqt yo'q) — backend `tashkentMinuteOfDay` bilan bir xil qoida. */
const TASHKENT_OFFSET_MINUTES = 5 * 60;
const DAY_MINUTES = 24 * 60;

/** Toshkent devor soati — kun boshidan daqiqa. */
export const tashkentMinuteOfDay = (now: Date | number = Date.now()): number => {
  const ms = typeof now === "number" ? now : now.getTime();
  return Math.floor(((Math.floor(ms / 60_000) + TASHKENT_OFFSET_MINUTES) % DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES);
};

/** Daqiqa → «HH:MM». */
export const minutesToHhmm = (minutes: number) => {
  const value = ((Math.round(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
};

export interface QuietHours {
  start: number;
  end: number;
}

export interface QuietNotice {
  /** Hozir (Toshkent), daqiqa. */
  now: number;
  /** Yuborish boshlanadigan vaqt (taqiq oxiri), daqiqa. */
  sendAt: number;
  /** Taqiq oxiri bugunmi yoki ertagami (Toshkent kuni bo'yicha). */
  day: "today" | "tomorrow";
}

/**
 * «Darhol» uchun tungi taqiq izohi (sVByLMnt #3): hozir reklama taqiqi ichida bo'lsa — qachon yuborilishi, aks holda
 * `null`. Oyna yarim tundan o'tishi mumkin (sukut 18:00–09:00): kechqurun — «ertaga», tunda/ertalab — «bugun».
 * `start === end` — taqiq o'chiq (backend `scheduleFor` kabi).
 */
export const quietHoursNotice = (quiet: QuietHours | null | undefined, now: Date | number = Date.now()): QuietNotice | null => {
  if (!quiet || !Number.isFinite(quiet.start) || !Number.isFinite(quiet.end) || quiet.start === quiet.end) return null;
  const minute = tashkentMinuteOfDay(now);
  const wraps = quiet.start > quiet.end;
  const inQuiet = wraps ? minute >= quiet.start || minute < quiet.end : minute >= quiet.start && minute < quiet.end;
  if (!inQuiet) return null;
  const day = wraps && minute >= quiet.start ? "tomorrow" : "today";
  return { now: minute, sendAt: quiet.end, day };
};

export interface SmsDailyQuota {
  used: number;
  cap: number;
  /** Bugun yana navbatga qo'yish mumkin (≥ 0). */
  remaining: number;
}

/**
 * Umumiy oqim kvotasi (`SMS_DAILY_CAP`, Toshkent kuni — reklama + xizmat; OTP alohida). Holat javobida son bo'lmasa
 * — `null` (limit noma'lum, UI cheklamaydi).
 */
export const smsDailyQuota = (status: { used_today?: unknown; daily_cap?: unknown } | null | undefined): SmsDailyQuota | null => {
  const used = Number(status?.used_today);
  const cap = Number(status?.daily_cap);
  if (!Number.isFinite(used) || !Number.isFinite(cap) || cap <= 0 || used < 0) return null;
  return { used, cap, remaining: Math.max(0, cap - used) };
};

/**
 * Kampaniya so'rovi xatosi turi — foydalanuvchiga faqat i18n matn ko'rsatiladi (xom backend matni emas). Gateway
 * javobida faqat `statusCode` + `message` bor (`reason` yo'qoladi), shuning uchun HTTP holati bo'yicha:
 *  - 400 — matn/o'zgaruvchi/segment rad etildi (shu jumladan `campaign_promo_only`, PII, chegara);
 *  - 409 — takroriy `Idempotency-Key`, kunlik kvota tugagan yoki bekor qilish havolasi sozlanmagan;
 *  - 504 / taymaut — javob kelmadi (yuborilgan bo'lishi mumkin — tarixni tekshirish);
 *  - 401 / 403 — ruxsat yo'q.
 */
export type SmsCampaignErrorKind = "badRequest" | "conflict" | "timeout" | "forbidden" | "unknown";

export const smsCampaignErrorKind = (error: unknown): SmsCampaignErrorKind => {
  const source = (error ?? {}) as { response?: { status?: unknown }; code?: unknown };
  const status = Number(source.response?.status);
  if (status === 400 || status === 422) return "badRequest";
  if (status === 409) return "conflict";
  if (status === 504 || source.code === "ECONNABORTED") return "timeout";
  if (status === 401 || status === 403) return "forbidden";
  return "unknown";
};

/** Qayta urinish natijani o'zgartira oladigan xatolar (tarmoq, server); 400 / 409 / 403 — o'zgarmaydi. */
export const isRetryableSmsCampaignError = (kind: SmsCampaignErrorKind = "unknown") =>
  kind === "timeout" || kind === "unknown";

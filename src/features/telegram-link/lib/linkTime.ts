import { toValidDate } from "../../../shared/lib/formatDateTime";

/** Bir martalik havola muddati (backend: `POST …/link-code` — 10 daqiqa). */
export const LINK_TTL_MS = 10 * 60_000;

/** Guruh havolasi olingach ulanishni tekshirish oralig'i, ms (`GET /notifications?market_id&group_type`). */
export const GROUP_LINK_POLL_MS = 4_000;

/** Server muddati bundan uzoq yoki o'tib ketgan bo'lsa — kompyuter soati noto'g'ri, 10 daqiqa olinadi. */
const MAX_TRUSTED_TTL_MS = 15 * 60_000;

/** Qolgan vaqt «m:ss» (9:41, 0:07) — raqamlar har tilda bir xil. */
export const formatLinkTimeLeft = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

/** Qolgan vaqt qismlari (ekran o'quvchi matni uchun: «9 daqiqa 41 soniya»). */
export const splitLinkTimeLeft = (ms: number): { minutes: number; seconds: number } => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 };
};

/**
 * Havola muddati mahalliy soat bo'yicha: serverning `expires_at` i qolgan vaqtga aylantiriladi (soat farqi bo'lsa
 * havola «eskirgan» bo'lib ochilmasin). `totalMs` — sanoq va progressning to'liq muddati (server 10 daqiqadan uzoq
 * bersa — shuncha, sanoq qotib qolmasin).
 */
export const toLinkWindow = (
  expiresAt: string | null | undefined,
  now = Date.now(),
): { expiresAtMs: number; totalMs: number } => {
  const serverExpiry = toValidDate(expiresAt ?? null)?.getTime();
  const ttl = serverExpiry == null ? Number.NaN : serverExpiry - now;
  const trusted = Number.isFinite(ttl) && ttl > 0 && ttl <= MAX_TRUSTED_TTL_MS;
  const total = trusted ? ttl : LINK_TTL_MS;
  return { expiresAtMs: now + total, totalMs: Math.max(LINK_TTL_MS, total) };
};

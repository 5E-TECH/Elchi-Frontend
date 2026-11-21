import axios, { type AxiosError } from "axios";
import { isBrowserOffline } from "../shared/lib/chunkError";
import { probeAppOrigin } from "../shared/lib/connectivityProbe";
import { isRequestAborted, isRequestTimeout } from "../shared/lib/errorKind";

/** Javob umuman kelmagan (tarmoq uzilgan, vaqt tugagan) — server "yo'q" demagan. */
export const isNetworkError = (error: AxiosError) =>
  error.code !== "ERR_CANCELED" &&
  (!error.response || error.code === "ERR_NETWORK" || error.code === "ECONNABORTED");

export const isNetworkFailure = (error: unknown): error is AxiosError =>
  axios.isAxiosError(error) && isNetworkError(error);

/**
 * Token yangilash (refresh) ning VAQTINCHALIK xatosi — foydalanuvchi tizimdan
 * CHIQARILMAYDI (fix3 RBAC-11 / C10):
 *   - 429 — so'rov cheklovi: ofisda (HQ Wi-Fi) yoki mobil operator NAT'ida
 *     bitta IP dan smena boshida ko'p qurilma bir vaqtda yangilaydi;
 *   - 5xx — server muammosi, foydalanuvchining aybi emas;
 *   - javob umuman kelmadi (tarmoq uzildi / vaqt tugadi).
 * 401/403 (refresh token yaroqsiz, qayta ishlatilgan, muddati o'tgan) va
 * boshqa xatolar — sessiya haqiqatan tugagan, chiqish to'g'ri.
 */
export const isTransientAuthFailure = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) return false;
  if (isNetworkError(error)) return true;
  const status = error.response?.status ?? 0;
  return status === 429 || status >= 500;
};

/**
 * TARMOQ HOLATI (G6F68ti6, 1-band). Uzilish turi: `offline` — javob umuman kelmadi («Internet aloqasi yo'q»),
 * `timeout` — vaqt chegarasi («Server javob bermadi»), `null` — aloqa joyida. Uzilishdan keyingi birinchi
 * muvaffaqiyatli javob `elchi:network-restored` ni BIR MARTA chiqaradi (`NotificationProvider` — «Aloqa tiklandi»,
 * xatoda qolgan so'rovlar qayta so'raladi). `online` brauzer hodisasiga tayanilmaydi: «Wi-Fi bor, internet yo'q»
 * (captive portal) holatida u kelmaydi — signal faqat haqiqiy javobdan.
 */
export type NetworkDownKind = "offline" | "timeout";

/**
 * Javobsiz xato (`offline`) kimda (2026-11-20): `internet` — foydalanuvchi interneti yo'q (yoki aniqlab bo'lmadi) —
 * «Internet aloqasi yo'q»; `server` — ilovaning o'z sayti ochildi, faqat API javob bermadi
 * (`shared/lib/connectivityProbe.ts`) — «Server javob bermadi». Holat (`downKind`) ikkalasida ham `offline`: birinchi
 * javob xabarni yopadi va «Aloqa tiklandi» chiqadi.
 */
export type NetworkDownCause = "internet" | "server";

export type NetworkErrorDetail = {
  message?: string;
  url?: string;
  code?: string;
  kind: NetworkDownKind;
  cause?: NetworkDownCause;
};
export type NetworkRestoredDetail = { kind: NetworkDownKind };

export const NETWORK_ERROR_EVENT = "elchi:network-error";
export const NETWORK_RESTORED_EVENT = "elchi:network-restored";

let downKind: NetworkDownKind | null = null;

/** Joriy uzilish turi (test va «Qayta urinish» uchun). */
export const getNetworkDownKind = (): NetworkDownKind | null => downKind;

/** Uzilish turini belgilaydi (xabarsiz) — `emitNetworkError` va fon so'rovlari (`silentNetworkError`) uchun. */
export const markNetworkDown = (kind: NetworkDownKind) => {
  // Oflayn kuchliroq holat: «Server javob bermadi» dan keyingi ERR_NETWORK uni almashtiradi, aksi emas.
  if (downKind === "offline" && kind === "timeout") return;
  downKind = kind;
};

/** Uzilishdan keyingi birinchi muvaffaqiyatli javob — `elchi:network-restored` (bir marta). */
export const emitNetworkRestored = () => {
  if (!downKind) return;
  const kind = downKind;
  downKind = null;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NetworkRestoredDetail>(NETWORK_RESTORED_EVENT, { detail: { kind } }));
};

const dispatchNetworkError = (detail: NetworkErrorDetail) =>
  window.dispatchEvent(new CustomEvent<NetworkErrorDetail>(NETWORK_ERROR_EVENT, { detail }));

/** Javobsiz xatoga yozilgan sabab (`classifyNetworkFailure`). */
export type NetworkCauseCarrier = { networkCause?: NetworkDownCause };

/**
 * Javobsiz xato (`ERR_NETWORK`; vaqt tugashi va bekor qilish emas) sababini aniqlab, XATONING O'ZIGA yozadi
 * (`error.networkCause`, 2026-11-20): brauzer oflayn — `internet`; aks holda ilova sayti tekshiriladi
 * (`probeAppOrigin`, 5 s ichida bitta so'rov) — javob berdi: `server`, yo'q: `internet`. Interceptor xatoni shundan
 * KEYIN rad etadi — global xabar (`emitNetworkError`), sahifa ichidagi holat (`getErrorKind` → `ErrorState`) va
 * chaqiruvchining `onError` i bir xil sababni ko'radi. Natija xato bilan birga yuradi: tekshiruv paytida boshqa
 * so'rov javob olsa ham yiqilgan amalning xabari yo'qolmaydi.
 */
export const classifyNetworkFailure = async (error: unknown): Promise<void> => {
  if (!isNetworkFailure(error) || isRequestAborted(error) || isRequestTimeout(error)) return;
  const carrier = error as AxiosError & NetworkCauseCarrier;
  if (carrier.networkCause) return;
  if (isBrowserOffline()) {
    carrier.networkCause = "internet";
    return;
  }
  carrier.networkCause = (await probeAppOrigin()) ? "server" : "internet";
};

/**
 * NotificationProvider "Tarmoq xatosi" bildirishnomasini ko'rsatadi. Faqat axios tarmoq xatosi (13-band: oddiy
 * `Error` — masalan «Refresh token expired» — chiqishda «Internet aloqasi yo'q» chaqnamasin); bekor qilingan
 * so'rov — xabarsiz (12-band). `silent` — fon so'rovi: holat belgilanadi, xabar ochilmaydi (9-band).
 * Javobsiz xatoning sababi (`cause`) — `classifyNetworkFailure` yozgani; aniqlanmagan bo'lsa — `internet` (avvalgidek).
 */
export const emitNetworkError = (error: unknown, options?: { silent?: boolean }) => {
  if (typeof window === "undefined" || !isNetworkFailure(error) || isRequestAborted(error)) {
    return;
  }

  const kind: NetworkDownKind = isRequestTimeout(error) ? "timeout" : "offline";
  markNetworkDown(kind);
  if (options?.silent) return;

  dispatchNetworkError({
    message: error.message,
    url: error.config?.url,
    // Xabar matni uchun: vaqt tugadi — «Server javob bermadi», javobsiz — `cause` bo'yicha.
    code: error.code,
    kind,
    ...(kind === "offline" ? { cause: (error as NetworkCauseCarrier).networkCause ?? "internet" } : {}),
  });
};

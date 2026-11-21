/**
 * ILOVA SAYTI OCHILADIMI (2026-11-20). API so'rovi javobsiz yiqilganda (`ERR_NETWORK`) sababi ikki xil bo'lishi mumkin:
 *
 *   - foydalanuvchi interneti yo'q — «Internet aloqasi yo'q»;
 *   - internet bor, lekin API javob bermadi: Cloudflare/tunnel xatosi (502/1033 — CORS sarlavhasisiz, brauzer uni JS'ga
 *     bermaydi), server qayta ishga tushmoqda va h.k. — «Server javob bermadi». Ilgari bu holat ham «Internet aloqasi
 *     yo'q» deb ko'rsatilardi va foydalanuvchi o'z internetini ayblardi.
 *
 * Ajratish uchun ilovaning O'Z saytidan kichik statik fayl so'raladi (`HEAD /robots.txt`, keshsiz): istalgan HTTP javob
 * (hatto 404) — internet ishlayapti. Service worker'da `fetch` ishlovchisi yo'q (`public/sw.js`) — javob keshdan
 * kelmaydi. Bir vaqtdagi ko'p xato uchun bitta so'rov: natija `PROBE_REUSE_MS` davomida qayta ishlatiladi.
 */
export const CONNECTIVITY_PROBE_PATH = "/robots.txt";
/** Javobsiz xato shu tekshiruvdan keyin rad etiladi — kutish qisqa (bunchalik sekin liniya — «internet» muammosi). */
export const PROBE_TIMEOUT_MS = 3_000;
export const PROBE_REUSE_MS = 5_000;

let lastProbe: { at: number; result: Promise<boolean> } | null = null;

const runProbe = async (): Promise<boolean> => {
  if (typeof fetch !== "function") return false;
  const controller = typeof AbortController === "function" ? new AbortController() : undefined;
  const timer = setTimeout(() => controller?.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(CONNECTIVITY_PROBE_PATH, {
      method: "HEAD",
      cache: "no-store",
      credentials: "omit",
      signal: controller?.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

/** `true` — ilova sayti javob berdi (internet bor); `false` — javob yo'q yoki `PROBE_TIMEOUT_MS` ichida kelmadi. */
export const probeAppOrigin = (): Promise<boolean> => {
  const now = Date.now();
  if (lastProbe && now - lastProbe.at < PROBE_REUSE_MS) return lastProbe.result;
  const result = runProbe();
  lastProbe = { at: now, result };
  return result;
};

/** Test uchun: oldingi natija qayta ishlatilmasin. */
export const resetConnectivityProbe = () => {
  lastProbe = null;
};

import { SCANNER_KEY_GAP_MS } from "../../../shared/lib/useKeyboardScanner";

/**
 * SARLAVHANING HARFLI TEZKOR TUGMALARI — `?` (tezkor tugmalar ro'yxati), G → O (buyurtmalar), G → B (paketlar).
 *
 * ⚠️ SKANER BILAN TO'QNASHMASIN. USB/Bluetooth skaner kodni klaviatura kabi «yozadi» va sahifa skaneri
 * (`useKeyboardScanner`) harflarni to'xtatmaydi (maydonga ham yozilishi kerak). Ilgari G dan keyin 900 ms ichida
 * istalgan joyda kelgan O ham hisoblanardi: market QR'i (`MCR-` + 43 ta base64url belgi) ko'pincha «…g…o…» ni
 * o'z ichiga oladi va «Bekor qilinganlar → marketga topshirish» da market QR skani sahifani `/orders` ga otib
 * yuborardi (buyurtma QR'i faqat `0-9a-f` — unda G yo'q, shuning uchun sezilmagan). Endi:
 *  - skaner tezligida kelgan belgi (oldingisidan `SCANNER_KEY_GAP_MS` dan tez) — tezkor tugma emas, G kutish ham
 *    bekor bo'ladi;
 *  - G → O / G → B — G dan keyin AYNAN keyingi belgi (oradagi boshqa belgi ketma-ketlikni uzadi);
 *  - vaqt faqat bitta belgili tugmalar bo'yicha (Shift, CapsLock, Enter hisobga olinmaydi — `?` uchun Shift
 *    bosish uni «tez» qilib qo'ymasin). Belgisini chaqiruvchi tekshiradi;
 *  - bosib turilgan tugmaning avtotakrori (`event.repeat`, ~30 ms oraliq) skan emas: u vaqtga kirmaydi, tezkor
 *    tugma bermaydi, faqat bosib turilgan G kutishni yangilaydi (G ni ushlab, keyin O — ilgarigidek buyurtmalar).
 *    Skaner avtotakror yubormaydi.
 */

export const GO_SHORTCUT_WINDOW_MS = 900;

export type HeaderShortcut = "help" | "orders" | "batches";

export type HeaderShortcutState = {
  /** Oxirgi belgili tugma vaqti (`scannerKeyTime`). */
  lastCharAt: number;
  /** Kutilayotgan G vaqti; `null` — kutilmayapti. */
  goAt: number | null;
};

export const createHeaderShortcutState = (): HeaderShortcutState => ({
  lastCharAt: Number.NEGATIVE_INFINITY,
  goAt: null,
});

/**
 * Bitta belgili tugma (`event.key`, `at` — hodisa vaqti) → tezkor tugma yoki `null`. `state` joyida yangilanadi
 * (sarlavhadagi `useRef`). Ruxsat (`allowed`) — rol bo'yicha: G → O buyurtmalar ochiladigan rolda, G → B menejerda.
 * `repeat` — `event.repeat` (bosib turilgan tugmaning avtotakrori).
 */
export const nextHeaderShortcut = (
  state: HeaderShortcutState,
  key: string,
  at: number,
  allowed: { orders: boolean; batches: boolean },
  repeat = false,
): HeaderShortcut | null => {
  if (repeat) {
    if (state.goAt !== null && key.toLowerCase() === "g") state.goAt = at;
    return null;
  }

  const scannerBurst = at - state.lastCharAt < SCANNER_KEY_GAP_MS;
  state.lastCharAt = at;
  const goPending = state.goAt !== null && at - state.goAt <= GO_SHORTCUT_WINDOW_MS;
  state.goAt = null;

  if (scannerBurst) return null;
  if (key === "?") return "help";

  const lower = key.toLowerCase();
  if (goPending && lower === "o" && allowed.orders) return "orders";
  if (goPending && lower === "b" && allowed.batches) return "batches";
  if (lower === "g") state.goAt = at;
  return null;
};

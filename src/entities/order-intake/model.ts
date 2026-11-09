import { getErrorStatus } from "../../shared/lib/errorKind";

/**
 * BUGUNGI QABUL VAQTI (2026-11-08) — superadmin bugun uchun qabul tugash vaqtini qo'yadi (masalan 10:00): shundan
 * keyin kun almashguncha HECH QANDAY yangi buyurtma yaratilmaydi (qo'lda, AI bilan, integratsiya va hamkor API orqali).
 *
 * Backend kontrakti (Elchi-Backend `bahodir`, 2026-11-09, backend `docs/frontend/FRONTEND_CHANGELOG.md`):
 *   GET   `orders/intake-settings` (har rol) →
 *         `{ data: { cutoff_time: "10:00" | null, date: "YYYY-MM-DD", is_open: boolean,
 *                    closes_at: ISO | null, reopens_at: ISO | null,
 *                    day_change_time: "HH:MM", day_started_at: ISO, next_day_change_at: ISO } }`
 *   PATCH `orders/intake-settings` `{ cutoff_time?: "HH:MM" | null, day_change_time?: "HH:MM" | null }` — FAQAT
 *         SUPERADMIN (admin — 403); cheklov faqat joriy (ish) kun uchun, kun almashganda o'zi bekor bo'ladi;
 *         activity log'ga yoziladi. Javob — GET bilan bir xil.
 *   Qabul yopiq paytda buyurtma yaratadigan barcha endpointlar (POST orders, tashqi / hamkor) →
 *         `409 { code: "ORDER_INTAKE_CLOSED", message, reopens_at, cutoff_time }`; AI confirm — har buyurtma
 *         natijasida `code: "intake_closed"`.
 *   «Kun almashishi» — `day_change_time` (Toshkent, sukut 00:00; Trello #756 — sozlash UI'si hali yo'q).
 *
 * Backend javob bermaguncha (404 / 405 / 501 — backend deploy bo'lmagan muhit) funksiya YO'Q deb olinadi:
 * boshqaruv ko'rinmaydi va hech narsa to'silmaydi.
 */
export type OrderIntakeState = {
  /** Backend shu funksiyani beradimi (endpoint bor). `false` — UI ko'rsatilmaydi, hech narsa to'silmaydi. */
  supported: boolean;
  /** Bugungi qabul tugash vaqti («10:00») yoki `null` — cheklovsiz. */
  cutoffTime: string | null;
  /** Server hisobidagi holat (yo'q bo'lsa — vaqtlardan hisoblanadi). */
  isOpen: boolean | null;
  closesAt: string | null;
  reopensAt: string | null;
};

export const UNSUPPORTED_INTAKE: OrderIntakeState = {
  supported: false,
  cutoffTime: null,
  isOpen: null,
  closesAt: null,
  reopensAt: null,
};

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const isoOrNull = (value: unknown) =>
  typeof value === "string" && value.trim() && Number.isFinite(Date.parse(value)) ? value : null;

/** `{ data: {...} }` yoki to'g'ridan-to'g'ri obyekt; `cutoff_time` «10:00:00» ham bo'lishi mumkin. */
export const normalizeOrderIntake = (payload: unknown): OrderIntakeState => {
  const root = asRecord(payload);
  const data = asRecord(root.data ?? root);
  const rawCutoff = typeof data.cutoff_time === "string" ? data.cutoff_time.trim().slice(0, 5) : "";
  return {
    supported: true,
    cutoffTime: CLOCK.test(rawCutoff) ? rawCutoff : null,
    isOpen: typeof data.is_open === "boolean" ? data.is_open : null,
    closesAt: isoOrNull(data.closes_at),
    reopensAt: isoOrNull(data.reopens_at),
  };
};

/** Endpoint yo'q (backend hali chiqmagan) — funksiya o'chiq. */
export const isIntakeUnsupportedError = (error: unknown) => {
  const status = getErrorStatus(error);
  return status === 404 || status === 405 || status === 501;
};

/**
 * Hozir qabul yopiqmi. Kun almashgan (`reopens_at` o'tgan) bo'lsa — eski javobga qaramay ochiq (yangisi so'raladi);
 * aks holda server `is_open` i, u bo'lmasa — `closes_at` o'tganmi.
 */
export const isOrderIntakeClosed = (
  state: OrderIntakeState | null | undefined,
  now: number = Date.now(),
) => {
  if (!state?.supported) return false;
  const reopens = state.reopensAt ? Date.parse(state.reopensAt) : null;
  if (reopens !== null && now >= reopens) return false;
  if (state.isOpen === false) return true;
  const closes = state.closesAt ? Date.parse(state.closesAt) : null;
  return closes !== null && now >= closes;
};

/** Buyurtma yaratish javobi: qabul yopiq (`409 ORDER_INTAKE_CLOSED`). */
export const isOrderIntakeClosedError = (error: unknown) => {
  const data = asRecord(asRecord(asRecord(error).response).data);
  const code = data.code ?? asRecord(data.data).code;
  return code === "ORDER_INTAKE_CLOSED";
};

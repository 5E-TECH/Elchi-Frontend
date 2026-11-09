import { tashkentClockNow } from "../../shared/lib/clockTime";
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
 *   «Kun almashishi» — `day_change_time` (Toshkent, sukut 00:00; Trello #756): FAQAT buyurtma qabuli oynasiga ta'sir
 *         qiladi (hisobotlar, kunlik pochtalar, smenalar — 00:00 bo'yicha). `PATCH { day_change_time }` — superadmin;
 *         `null` → 00:00; noto'g'ri — 400. Soat o'zgarsa joriy ish kuni siljiydi: bugungi cheklov yangi oynaga faqat
 *         ish kuni sanasi (`date`) o'zgarmasa ko'chadi.
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
  /** Kun almashish soati (Toshkent, `HH:MM`) — yo'q yoki buzuq bo'lsa `00:00`. */
  dayChangeTime: string;
  /** Joriy ish kuni boshlangan lahza (ISO). */
  dayStartedAt: string | null;
  /** Keyingi kun almashish lahzasi (ISO). */
  nextDayChangeAt: string | null;
};

export const DEFAULT_DAY_CHANGE_TIME = "00:00";

export const UNSUPPORTED_INTAKE: OrderIntakeState = {
  supported: false,
  cutoffTime: null,
  isOpen: null,
  closesAt: null,
  reopensAt: null,
  dayChangeTime: DEFAULT_DAY_CHANGE_TIME,
  dayStartedAt: null,
  nextDayChangeAt: null,
};

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const isoOrNull = (value: unknown) =>
  typeof value === "string" && value.trim() && Number.isFinite(Date.parse(value)) ? value : null;
/** «10:00» / «10:00:00» → «10:00»; boshqasi — `null`. */
const clockOrNull = (value: unknown) => {
  const clock = typeof value === "string" ? value.trim().slice(0, 5) : "";
  return CLOCK.test(clock) ? clock : null;
};
const minutesOf = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

/** `{ data: {...} }` yoki to'g'ridan-to'g'ri obyekt; `cutoff_time` «10:00:00» ham bo'lishi mumkin. */
export const normalizeOrderIntake = (payload: unknown): OrderIntakeState => {
  const root = asRecord(payload);
  const data = asRecord(root.data ?? root);
  return {
    supported: true,
    cutoffTime: clockOrNull(data.cutoff_time),
    isOpen: typeof data.is_open === "boolean" ? data.is_open : null,
    closesAt: isoOrNull(data.closes_at),
    reopensAt: isoOrNull(data.reopens_at),
    dayChangeTime: clockOrNull(data.day_change_time) ?? DEFAULT_DAY_CHANGE_TIME,
    dayStartedAt: isoOrNull(data.day_started_at),
    nextDayChangeAt: isoOrNull(data.next_day_change_at),
  };
};

/**
 * Joriy ish kunida `cutoff` soati qaysi lahzaga to'g'ri keladi (ms). Ish kuni `day_started_at` dan boshlanadi va
 * `day_change_time` dan keyingi kun shu soatgacha davom etadi: kun 18:00 da almashsa, `10:00` — ertangi tong
 * (`(10:00 − 18:00 + 24 soat) mod 24 soat` = 16 soat kun boshidan). `day_started_at` bo'lmasa — `null`.
 */
export const cutoffClosesAt = (
  cutoff: string,
  state: Pick<OrderIntakeState, "dayStartedAt" | "dayChangeTime">,
): number | null => {
  const dayStart = state.dayStartedAt ? Date.parse(state.dayStartedAt) : Number.NaN;
  if (!CLOCK.test(cutoff) || !Number.isFinite(dayStart)) return null;
  const offset = (minutesOf(cutoff) - minutesOf(state.dayChangeTime) + 1440) % 1440;
  return dayStart + offset * 60_000;
};

/**
 * Shu soat saqlansa qabul darhol yopiladimi — soat joriy ISH KUNI oynasida o'tganmi (kun 18:00 da almashsa, 20:00 da
 * «10:00» — ertangi tong, o'tmagan). `day_started_at` kelmasa — eski qoida: Toshkent kalendar kunida o'tganmi.
 */
export const isCutoffPassed = (
  cutoff: string,
  state: Pick<OrderIntakeState, "dayStartedAt" | "dayChangeTime">,
  now: number = Date.now(),
) => {
  const closes = cutoffClosesAt(cutoff, state);
  return closes !== null ? closes <= now : cutoff <= tashkentClockNow(new Date(now));
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

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
 *
 * «KUN TARTIBI» (Ops, 2026-11-10; backend vazifasi — Dilshodga prompt, `entities/order-intake` shartnomasi kengayadi):
 *   - `cutoff_time` — DOIMIY (har ish kuni), kun almashganda o'chmaydi;
 *   - yangi `receive_cutoff_time` — yaratilgan buyurtmalarni QABUL QILISH chegarasi (doimiy): o'tgach, kun almashguncha
 *     `POST orders/receive`, `orders/external/receive`, `orders/external/receive-by-scan` →
 *     `409 { code: "ORDER_RECEIVE_CLOSED", message, receive_cutoff_time, reopens_at }`; GET da `receive_is_open`,
 *     `receive_closes_at`, `receive_reopens_at` (`is_open` / `closes_at` / `reopens_at` bilan bir xil ma'noda);
 *   - `PATCH` bir nechta maydonni birga oladi (`cutoff_time`, `receive_cutoff_time`, `day_change_time`).
 * Javobda `receive_cutoff_time` kaliti (qiymati `null` ham) bo'lsa — yangi backend (`receiveSupported`): yaratish
 * chegarasi har kungi deb ko'rsatiladi. Kalit yo'q (eski backend) — qabul chegarasi chizilmaydi, yaratish chegarasi
 * «faqat bugun».
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
  /**
   * Yangi backend («Kun tartibi»): javobda `receive_cutoff_time` kaliti bor — qabul chegarasi ishlaydi va yaratish
   * chegarasi doimiy (har kuni). `false` — eski backend.
   */
  receiveSupported: boolean;
  /** Yaratilgan buyurtmalarni qabul qilish chegarasi («16:00») yoki `null` — cheklovsiz. */
  receiveCutoffTime: string | null;
  receiveIsOpen: boolean | null;
  receiveClosesAt: string | null;
  receiveReopensAt: string | null;
};

/** `PATCH orders/intake-settings` tanasi — faqat o'zgargan maydonlar (`null` — cheklovni olib tashlash). */
export type OrderIntakeSettingsPatch = {
  cutoff_time?: string | null;
  receive_cutoff_time?: string | null;
  day_change_time?: string | null;
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
  receiveSupported: false,
  receiveCutoffTime: null,
  receiveIsOpen: null,
  receiveClosesAt: null,
  receiveReopensAt: null,
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
    receiveSupported: Object.hasOwn(data, "receive_cutoff_time"),
    receiveCutoffTime: clockOrNull(data.receive_cutoff_time),
    receiveIsOpen: typeof data.receive_is_open === "boolean" ? data.receive_is_open : null,
    receiveClosesAt: isoOrNull(data.receive_closes_at),
    receiveReopensAt: isoOrNull(data.receive_reopens_at),
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
const windowClosed = (
  isOpen: boolean | null,
  closesAt: string | null,
  reopensAt: string | null,
  now: number,
) => {
  const reopens = reopensAt ? Date.parse(reopensAt) : null;
  if (reopens !== null && now >= reopens) return false;
  if (isOpen === false) return true;
  const closes = closesAt ? Date.parse(closesAt) : null;
  return closes !== null && now >= closes;
};

export const isOrderIntakeClosed = (
  state: OrderIntakeState | null | undefined,
  now: number = Date.now(),
) => {
  if (!state?.supported) return false;
  return windowClosed(state.isOpen, state.closesAt, state.reopensAt, now);
};

/**
 * Hozir yaratilgan buyurtmalarni QABUL QILISH yopiqmi («Kun tartibi») — `isOrderIntakeClosed` qoidasi `receive_*`
 * maydonlari bilan. Eski backend (`receiveSupported: false`) — hech qachon yopiq emas.
 */
export const isOrderReceiveClosed = (
  state: OrderIntakeState | null | undefined,
  now: number = Date.now(),
) => {
  if (!state?.supported || !state.receiveSupported) return false;
  return windowClosed(state.receiveIsOpen, state.receiveClosesAt, state.receiveReopensAt, now);
};

const errorCode = (error: unknown) => {
  const data = asRecord(asRecord(asRecord(error).response).data);
  return data.code ?? asRecord(data.data).code;
};

/** Buyurtma yaratish javobi: qabul yopiq (`409 ORDER_INTAKE_CLOSED`). */
export const isOrderIntakeClosedError = (error: unknown) => errorCode(error) === "ORDER_INTAKE_CLOSED";

/** Buyurtmani qabul qilish javobi: qabul vaqti tugagan (`409 ORDER_RECEIVE_CLOSED`, «Kun tartibi»). */
export const isOrderReceiveClosedError = (error: unknown) => errorCode(error) === "ORDER_RECEIVE_CLOSED";

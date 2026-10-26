/**
 * INVESTOR KABINETI (IN-1, vpKijXce) — `GET investors/me/*` javoblari va ularning normalizatori.
 *
 * Backend (`investor-service`, `getMyDashboard` / `getMyInvestments` / `getMyProfits`) javobni konvertda beradi:
 * `{ statusCode, message, data }`. Investor faqat O'Z yozuvlarini ko'radi (doira JWT'dan), maydonlar — oq ro'yxat
 * (`SelfInvestorProfile`, `SelfInvestment`, `SelfProfitShare`). Pul — so'm (tiyinlarda yig'ilib, so'mga qaytgan),
 * sanalar — ISO satr (`Z` yoki `+05:00` bilan; `formatDateLocalized` ikkalasini to'g'ri o'qiydi).
 *
 * Normalizator har qanday shaklga chidamli: maydon yo'q yoki noto'g'ri bo'lsa — 0 / `null`, sahifa yiqilmaydi.
 */

export type InvestorSelfProfile = {
  id: string;
  name: string;
  status: string;
};

export type InvestorSummary = {
  totalInvested: number;
  investmentsCount: number;
  lastInvestedAt: string | null;
  totalPaidProfit: number;
  totalUnpaidProfit: number;
  profitSharesCount: number;
  /** Oxirgi foyda davrining stavkasi (%), davr bo'lmasa `null` — KPI «Ulush» (ega IN-S4). */
  currentPercentage: number | null;
  lastPaidAt: string | null;
};

/** Oylik foyda nuqtasi: oy — foyda DAVRINING tugagan oyi (Toshkent), `YYYY-MM`. */
export type InvestorMonthlyPoint = {
  month: string;
  paid: number;
  unpaid: number;
  total: number;
};

export type InvestorDashboard = {
  investor: InvestorSelfProfile | null;
  summary: InvestorSummary;
  /** Backendda obyekt: `{ months, items }` (eski massiv shakli ham qabul qilinadi). */
  monthly: { months: number; items: InvestorMonthlyPoint[] };
};

/** `GET investors/me` — profil va yig'indi (grafiksiz). */
export type InvestorMe = {
  investor: InvestorSelfProfile | null;
  summary: InvestorSummary;
};

export type InvestorInvestment = {
  id: string;
  amount: number;
  investedAt: string | null;
};

export type InvestorProfit = {
  id: string;
  amount: number;
  percentage: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  isPaid: boolean;
  paidAt: string | null;
};

export type InvestorPageMeta = { page: number; limit: number; total: number; totalPages: number };

export type InvestorInvestmentsPage = {
  items: InvestorInvestment[];
  meta: InvestorPageMeta;
  /** Barcha investitsiyalar yig'indisi (sahifa emas). */
  totalAmount: number;
  /**
   * Tanlangan oraliq (`from_date`/`to_date`) yig'indisi — barcha sahifalar (`summary.range_amount`, su4IYGCN / IN-3);
   * oraliqsiz — `total_amount` ga teng. Eski javobda maydon yo'q — `null`.
   */
  rangeAmount: number | null;
};

export type InvestorProfitsPage = {
  items: InvestorProfit[];
  meta: InvestorPageMeta;
  totalPaid: number;
  totalUnpaid: number;
};

type Json = Record<string, unknown>;

const asRecord = (value: unknown): Json =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : {};

/** Konvert (`{ data }`) bo'lsa — ichi, aks holda o'zi. */
const unwrap = (payload: unknown): Json => {
  const record = asRecord(payload);
  return "data" in record && typeof record.data === "object" && record.data !== null ? asRecord(record.data) : record;
};

const toNumber = (value: unknown): number => {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : 0;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toText = (value: unknown): string =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : "";

const toDateText = (value: unknown): string | null => {
  const text = toText(value).trim();
  return text ? text : null;
};

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

const toMeta = (value: unknown, count: number): InvestorPageMeta => {
  const meta = asRecord(value);
  const limit = toNumber(meta.limit) || count || 10;
  const total = toNumber(meta.total) || count;
  return {
    page: toNumber(meta.page) || 1,
    limit,
    total,
    totalPages: toNumber(meta.totalPages) || Math.max(1, Math.ceil(total / limit)),
  };
};

const toProfile = (value: unknown): InvestorSelfProfile | null => {
  const record = asRecord(value);
  const id = toText(record.id);
  if (!id) return null;
  return { id, name: toText(record.name).trim(), status: toText(record.status) };
};

const toSummary = (value: unknown): InvestorSummary => {
  const record = asRecord(value);
  return {
    totalInvested: toNumber(record.total_invested),
    investmentsCount: toNumber(record.investments_count),
    lastInvestedAt: toDateText(record.last_invested_at),
    totalPaidProfit: toNumber(record.total_paid_profit),
    totalUnpaidProfit: toNumber(record.total_unpaid_profit),
    profitSharesCount: toNumber(record.profit_shares_count),
    currentPercentage: toNumberOrNull(record.current_percentage),
    lastPaidAt: toDateText(record.last_paid_at),
  };
};

const toMonthlyPoint = (value: unknown): InvestorMonthlyPoint | null => {
  const record = asRecord(value);
  const month = toText(record.month);
  if (!MONTH_KEY.test(month)) return null;
  const paid = toNumber(record.paid_amount);
  const unpaid = toNumber(record.unpaid_amount);
  const total = record.total_amount === undefined ? paid + unpaid : toNumber(record.total_amount);
  return { month, paid, unpaid, total };
};

export const toInvestorDashboard = (payload: unknown): InvestorDashboard => {
  const body = unwrap(payload);
  const monthlyRaw = body.monthly;
  const monthlyRecord = asRecord(monthlyRaw);
  const rawItems = Array.isArray(monthlyRaw) ? monthlyRaw : Array.isArray(monthlyRecord.items) ? monthlyRecord.items : [];
  const items = rawItems
    .map(toMonthlyPoint)
    .filter((point): point is InvestorMonthlyPoint => point !== null)
    .sort((a, b) => a.month.localeCompare(b.month));
  return {
    investor: toProfile(body.investor),
    summary: toSummary(body.summary),
    monthly: { months: toNumber(monthlyRecord.months) || items.length, items },
  };
};

export const toInvestorMe = (payload: unknown): InvestorMe => {
  const body = unwrap(payload);
  return { investor: toProfile(body.investor), summary: toSummary(body.summary) };
};

const toInvestment = (value: unknown): InvestorInvestment => {
  const record = asRecord(value);
  return {
    id: toText(record.id),
    amount: toNumber(record.amount),
    investedAt: toDateText(record.invested_at),
  };
};

/** Ixtiyoriy summa: son (yoki son-matn) — o'zi, yo'q / noto'g'ri — `null` (0 — haqiqiy qiymat). */
const optionalAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const toInvestorInvestmentsPage = (payload: unknown): InvestorInvestmentsPage => {
  const body = unwrap(payload);
  const items = (Array.isArray(body.items) ? body.items : []).map(toInvestment);
  return {
    items,
    meta: toMeta(body.meta, items.length),
    totalAmount: toNumber(asRecord(body.summary).total_amount),
    rangeAmount: optionalAmount(asRecord(body.summary).range_amount),
  };
};

const toProfit = (value: unknown): InvestorProfit => {
  const record = asRecord(value);
  return {
    id: toText(record.id),
    amount: toNumber(record.amount),
    percentage: toNumberOrNull(record.percentage),
    periodStart: toDateText(record.period_start),
    periodEnd: toDateText(record.period_end),
    isPaid: record.is_paid === true || record.is_paid === "true",
    paidAt: toDateText(record.paid_at),
  };
};

export const toInvestorProfitsPage = (payload: unknown): InvestorProfitsPage => {
  const body = unwrap(payload);
  const items = (Array.isArray(body.items) ? body.items : []).map(toProfit);
  const summary = asRecord(body.summary);
  return {
    items,
    meta: toMeta(body.meta, items.length),
    totalPaid: toNumber(summary.total_paid_amount),
    totalUnpaid: toNumber(summary.total_unpaid_amount),
  };
};

/**
 * Investor kabineti xatosining turi (sahifa holatini tanlash uchun; xom backend matni ishlatilmaydi):
 * 403 — profil nofaol, 404 — login investor yozuviga bog'lanmagan, 409 — bitta loginga bir nechta yozuv,
 * qolgani — oddiy yuklash xatosi.
 */
export type InvestorAccessProblem = "inactive" | "notLinked" | "multiple";

export const investorAccessProblem = (error: unknown): InvestorAccessProblem | null => {
  const record = asRecord(error);
  const status = toNumber(asRecord(record.response).status) || toNumber(record.status);
  if (status === 403) return "inactive";
  if (status === 404) return "notLinked";
  if (status === 409) return "multiple";
  return null;
};

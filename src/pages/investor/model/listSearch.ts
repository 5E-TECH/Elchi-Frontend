import type { InvestorListParams, InvestorProfitParams } from "../../../entities/investors";

/**
 * Investor ro'yxat sahifalarining URL holati (IN-2): `/investments?from&to&page&limit`, `/profits?status&page&limit`.
 * Filtr, sahifa va sahifa hajmi URL'da — havola ulashiladi, «Orqaga» filtrni tiklaydi. Noto'g'ri qiymat jim
 * tashlanadi (sukutga qaytadi), so'rov 400 bilan yiqilmaydi.
 */

/** Sahifa hajmi (maket «10 ta»); backend `limit` ≤ 100 (`normalizePagination`) — `Pagination` sukut tanlovi. */
export const INVESTOR_PAGE_SIZE = 10;
export const INVESTOR_PAGE_SIZES = [10, 25, 50, 100] as const;

/** «To'lov holati» (`is_paid`): Barchasi · To'langan · Kutilmoqda. */
export type ProfitStatusFilter = "all" | "paid" | "pending";
export const PROFIT_STATUS_FILTERS: readonly ProfitStatusFilter[] = ["all", "paid", "pending"];

export type InvestmentsSearch = { from: string; to: string; page: number; limit: number };
export type ProfitsSearch = { status: ProfitStatusFilter; page: number; limit: number };

export type InvestorListPatch = Partial<{
  from: string;
  to: string;
  status: ProfitStatusFilter;
  page: number;
  limit: number;
}>;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Haqiqiy kalendar kuni (`2026-02-30` emas) — aks holda bo'sh. */
const toIsoDay = (value: string | null): string => {
  const match = value ? ISO_DAY.exec(value.trim()) : null;
  if (!match) return "";
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? match[0]
    : "";
};

const toPositiveInt = (value: string | null): number | null => {
  if (!value) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : null;
};

const toLimit = (value: string | null): number => {
  const number = toPositiveInt(value);
  return number != null && (INVESTOR_PAGE_SIZES as readonly number[]).includes(number) ? number : INVESTOR_PAGE_SIZE;
};

export const parseInvestmentsSearch = (params: URLSearchParams): InvestmentsSearch => {
  let from = toIsoDay(params.get("from"));
  let to = toIsoDay(params.get("to"));
  // Teskari oraliq (qo'lda yozilgan havola) — joylari almashadi (backend aks holda 400 qaytaradi).
  if (from && to && from > to) [from, to] = [to, from];
  return { from, to, page: toPositiveInt(params.get("page")) ?? 1, limit: toLimit(params.get("limit")) };
};

export const parseProfitsSearch = (params: URLSearchParams): ProfitsSearch => {
  const raw = params.get("status");
  const status = raw === "paid" || raw === "pending" ? raw : "all";
  return { status, page: toPositiveInt(params.get("page")) ?? 1, limit: toLimit(params.get("limit")) };
};

/**
 * URL'ga o'zgarish: filtr (sana, holat) yoki sahifa hajmi almashsa — 1-sahifaga qaytadi; sukut qiymatlar
 * (`page=1`, `limit=10`, `status=all`, bo'sh sana) URL'dan olib tashlanadi. Boshqa parametrlar saqlanadi.
 */
export const applyInvestorListSearch = (current: URLSearchParams, patch: InvestorListPatch): URLSearchParams => {
  const next = new URLSearchParams(current);
  const set = (key: string, value: string | null) => (value ? next.set(key, value) : next.delete(key));

  const resetsPage = "from" in patch || "to" in patch || "status" in patch || "limit" in patch;
  if ("from" in patch) set("from", toIsoDay(patch.from ?? null) || null);
  if ("to" in patch) set("to", toIsoDay(patch.to ?? null) || null);
  if ("status" in patch) set("status", patch.status && patch.status !== "all" ? patch.status : null);
  if ("limit" in patch) set("limit", patch.limit && patch.limit !== INVESTOR_PAGE_SIZE ? String(patch.limit) : null);
  if ("page" in patch) set("page", patch.page && patch.page > 1 ? String(Math.floor(patch.page)) : null);
  else if (resetsPage) next.delete("page");
  return next;
};

/** Toshkent vaqti (UTC+5, yozgi vaqtsiz): backend `new Date(value)` — sanasiz yarim tun UTC bo'lib qolmasin. */
const TASHKENT_OFFSET = "+05:00";

/**
 * `GET investors/me/investments` parametrlari. Oraliq — kun boshidan kun oxirigacha Toshkent vaqtida
 * («01.09 – 30.09» → `2026-09-01T00:00:00+05:00` … `2026-09-30T23:59:59.999+05:00`; backend `Between` — ikki
 * chekka ham ichida).
 */
export const toInvestmentsParams = ({ from, to, page, limit }: InvestmentsSearch): InvestorListParams => ({
  page,
  limit,
  ...(from ? { from_date: `${from}T00:00:00${TASHKENT_OFFSET}` } : {}),
  ...(to ? { to_date: `${to}T23:59:59.999${TASHKENT_OFFSET}` } : {}),
});

/** `GET investors/me/profits` parametrlari: `is_paid` faqat filtr tanlanganda. */
export const toProfitsParams = ({ status, page, limit }: ProfitsSearch): InvestorProfitParams => ({
  page,
  limit,
  ...(status === "all" ? {} : { is_paid: status === "paid" }),
});

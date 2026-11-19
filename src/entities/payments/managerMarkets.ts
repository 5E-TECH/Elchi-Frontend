import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

/**
 * 63HO6cBU (P0, BE PR-C) — MENEJERNING O'Z FILIALI MARKETLARI (`GET /finance/cashbox/manager/markets`, faqat MANAGER).
 *
 * Filial marketi — o'chirilmagan buyurtmasida `orders.home_branch_id` = menejer filiali bo'lgan market. Har qatorda:
 *  - `branch_share` — filial ulushi (pul filialda, filial hali to'lamagan qism);
 *  - `payable` — «To'lash mumkin» = min(ulush, max(marketga qarz, 0)). Menejer to'lovining chegarasi AYNAN shu
 *    (ulush emas — undan oshgan summa 400 oladi).
 * Ulushi 0 market ham ro'yxatda (to'lab bo'lmaydi). Tartib — ulush bo'yicha kamayib. Order-service / finance javob
 * bermasa — 503 (bo'sh ro'yxat emas: chaqiruvchi xato holatini «Qayta urinish» bilan chizadi).
 *
 * Server sahifalaydi (`limit` ≤ 100): «Berilishi kerak» oynasi butun ro'yxatni oladi — 1-sahifa, keyin qolganlari
 * parallel (`MANAGER_MARKETS_MAX_PAGES` gacha). So'rov `silentError`: xatoni oyna o'zi ko'rsatadi. Kalit `cashbox`
 * prefiksi ostida — to'lovdan keyin `refreshCashboxQueries` ro'yxatni ham yangilaydi.
 */

/** `entities/payments` dagi `cashbox` kaliti bilan bir xil (import — test mock'lari modulni butunlay almashtiradi). */
const CASHBOX_QUERY_KEY = "cashbox";

/** Backend cheklovi: `limit` ≤ 100. */
export const MANAGER_MARKETS_PAGE_LIMIT = 100;
/** Ko'pi bilan shuncha sahifa (2000 market) — cheksiz sikl bo'lmasin. */
export const MANAGER_MARKETS_MAX_PAGES = 20;

export type ManagerMarketShare = {
  marketId: string;
  name: string;
  status: string;
  /** Filial ulushi — faqat ma'lumot uchun, to'lov chegarasi EMAS. */
  branchShare: number;
  /** «To'lash mumkin» — to'lov chegarasi. Noma'lum yoki buzuq qiymat — 0 (to'lab bo'lmaydi). */
  payable: number;
};

export type ManagerMarkets = {
  branchId: string | null;
  items: ManagerMarketShare[];
  /** Server jamlari (`total_share`, `total_payable`); kelmasa — `null`. */
  totalShare: number | null;
  totalPayable: number | null;
  /** Serverdagi marketlar soni (`pagination.total`). */
  total: number;
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIdString = (value: unknown) =>
  typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";

/** Javob `{ statusCode, data: { … } }` yoki to'g'ridan-to'g'ri `{ … }`. */
const unwrap = (response: unknown): UnknownRecord => {
  const record = asRecord(response);
  return Array.isArray(record.items) ? record : asRecord(record.data);
};

type ManagerMarketsPage = ManagerMarkets & { totalPages: number };

/** Bitta sahifa javobi → normal shakl (buzuq qatorlar — `market_id` siz — tashlanadi). */
export const normalizeManagerMarketsPage = (response: unknown): ManagerMarketsPage => {
  const data = unwrap(response);
  const items = (Array.isArray(data.items) ? data.items : [])
    .map((item): ManagerMarketShare => {
      const row = asRecord(item);
      return {
        marketId: toIdString(row.market_id ?? row.id),
        name: typeof row.name === "string" ? row.name : "",
        status: typeof row.status === "string" ? row.status : "",
        branchShare: toFiniteNumber(row.branch_share) ?? 0,
        payable: toFiniteNumber(row.payable) ?? 0,
      };
    })
    .filter((row) => row.marketId !== "");
  const pagination = asRecord(data.pagination);
  const total = toFiniteNumber(pagination.total) ?? items.length;
  const totalPages = toFiniteNumber(pagination.totalPages) ?? 1;
  return {
    branchId: toIdString(data.branch_id) || null,
    items,
    totalShare: toFiniteNumber(data.total_share),
    totalPayable: toFiniteNumber(data.total_payable),
    total,
    totalPages,
  };
};

const fetchPage = (page: number) =>
  api
    .get(API_ENDPOINTS.FINANCE.MANAGER_MARKETS, { params: { page, limit: MANAGER_MARKETS_PAGE_LIMIT } })
    .then((res) => normalizeManagerMarketsPage(res.data));

/** Butun ro'yxat: 1-sahifa, so'ng qolgan sahifalar parallel (tartib — server tartibi, sahifa raqami bo'yicha). */
export const fetchManagerMarkets = async (): Promise<ManagerMarkets> => {
  const first = await fetchPage(1);
  const lastPage = Math.min(Math.max(Math.floor(first.totalPages), 1), MANAGER_MARKETS_MAX_PAGES);
  const rest =
    lastPage > 1 ? await Promise.all(Array.from({ length: lastPage - 1 }, (_, index) => fetchPage(index + 2))) : [];
  const seen = new Set<string>();
  const items = [first, ...rest]
    .flatMap((page) => page.items)
    // Sahifalar orasida ulush o'zgarsa bitta market ikki sahifaga tushishi mumkin — birinchisi qoladi.
    .filter((row) => (seen.has(row.marketId) ? false : (seen.add(row.marketId), true)));
  return {
    branchId: first.branchId,
    items,
    totalShare: first.totalShare,
    totalPayable: first.totalPayable,
    total: first.total,
  };
};

/** «Berilishi kerak» (menejer) — o'z filiali marketlari, faqat oyna ochiqligida (`enabled`). */
export const useManagerMarkets = (enabled: boolean) =>
  useQuery<ManagerMarkets>({
    queryKey: [CASHBOX_QUERY_KEY, "manager-markets"],
    queryFn: fetchManagerMarkets,
    enabled,
    meta: { silentError: true },
  });

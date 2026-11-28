import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { businessToday } from "../../shared/lib/businessDay";
import { shouldRetryQuery } from "../../shared/lib/queryRetry";

/**
 * TIZIM P&L — `GET /finance/pnl?granularity=month` (ega 2026-11-28, faqat superadmin/admin): har oy
 *   • `gross` — daromad: sotuv foydasi (market tarifi − kuryer va hamkor filial ulushi), uning qaytarilishi, pickup haqi;
 *   • `opex` — xarajat: qo'lda chiqim, ish haqi, hisoblar (buyurtma qo'shimcha xarajati kirmaydi — marketdan ayriladi);
 *   • `net` — sof foyda = daromad − xarajat (manfiy — zarar);
 *   • `other_income` — qo'lda kirim, ALOHIDA: sof foydaga kirmaydi (ko'pincha egasi qo'ygan pul).
 * Qoidalar backend'da (`pnlSql`, investor ulushi bilan bir manba) — frontend hech narsani qayta hisoblamaydi. Backend
 * oraliqdagi HAR oyni qaytaradi (qatori yo'g'i 0). Normalizator qat'iy: bitta qator buzuq bo'lsa — `null` (yarim
 * grafik yolg'on xulosa beradi).
 */

/** Grafik davri — investor «Oylik foyda» bilan bir xil: 6 · 12 · 24 oy (joriy oy bilan). */
export type PnlMonthsWindow = 6 | 12 | 24;

export const PNL_MONTH_WINDOWS: readonly PnlMonthsWindow[] = [6, 12, 24];

export const DEFAULT_PNL_MONTHS: PnlMonthsWindow = 12;

export type PnlValues = {
  gross: number;
  opex: number;
  net: number;
  otherIncome: number;
};

export type PnlMonth = PnlValues & {
  /** `YYYY-MM` (Toshkent ish kuni bo'yicha). */
  month: string;
};

export type FinancePnl = {
  /** `YYYY-MM-DD` — oraliq boshi va oxiri (oxirgi oy — bugungacha, chala). */
  from: string;
  to: string;
  months: PnlMonth[];
  totals: PnlValues;
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" ? (value as UnknownRecord) : {};

const finite = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

const parseValues = (row: UnknownRecord): PnlValues | null => {
  const gross = finite(row.gross);
  const opex = finite(row.opex);
  if (gross === null || opex === null) return null;
  return {
    gross,
    opex,
    net: finite(row.net) ?? gross - opex,
    otherIncome: finite(row.other_income) ?? 0,
  };
};

const sum = (months: readonly PnlMonth[], key: keyof PnlValues) =>
  months.reduce((total, month) => total + month[key], 0);

export const normalizeFinancePnl = (response: unknown): FinancePnl | null => {
  const data = asRecord(asRecord(response).data);
  if (!Array.isArray(data.items)) return null;
  const months: PnlMonth[] = [];
  for (const value of data.items) {
    const row = asRecord(value);
    const month = text(row.period);
    const values = parseValues(row);
    if (!MONTH_KEY.test(month) || !values) return null;
    months.push({ month, ...values });
  }
  const totals = asRecord(data.totals);
  const gross = finite(totals.gross) ?? sum(months, "gross");
  const opex = finite(totals.opex) ?? sum(months, "opex");
  return {
    from: text(data.from_day),
    to: text(data.to_day),
    months,
    totals: {
      gross,
      opex,
      net: finite(totals.net) ?? gross - opex,
      otherIncome: finite(totals.other_income) ?? sum(months, "otherIncome"),
    },
  };
};

/**
 * Oyna boshi: `today` oyidan `months − 1` oy oldingi oyning 1-kuni (`("2026-11-28", 12)` → `"2025-12-01"`) —
 * backend sukuti bilan bir xil qoida.
 */
export const pnlFromDay = (months: number, today: string = businessToday()): string => {
  const [year, month] = today.split("-").map(Number);
  const index = year * 12 + (month - 1) - (Math.max(1, months) - 1);
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
};

const isForbidden = (error: unknown) => asRecord(asRecord(error).response).status === 403;

/** 403 da qayta urinilmaydi (ruxsat o'zgarmaydi), qolgani — ilova qoidasi. */
const retryOnce = (failures: number, error: unknown) => !isForbidden(error) && shouldRetryQuery(failures, error);

/** Karta ruxsat yo'q rolda jim yashirinadi (xato kartasi chizilmaydi). */
export const isFinancePnlForbidden = isForbidden;

/**
 * Oylik P&L. Kalit `cashbox` prefiksi ostida — kassa amalidan keyin `refreshCashboxQueries` yangilaydi. Oyna
 * almashganda eski grafik turadi (`keepPreviousData`), karta uni xira ko'rsatadi.
 */
export const useFinancePnl = (months: PnlMonthsWindow, enabled: boolean = true) => {
  const params = { from_day: pnlFromDay(months), granularity: "month" as const };
  return useQuery({
    queryKey: ["cashbox", "finance-pnl", params],
    queryFn: () => api.get(API_ENDPOINTS.FINANCE.FINANCE_PNL, { params }).then((res) => res.data as unknown),
    select: normalizeFinancePnl,
    enabled,
    retry: retryOnce,
    placeholderData: keepPreviousData,
    meta: { silentError: true },
  });
};

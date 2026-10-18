import { HISTORY_PARAM_PREFIX } from "./financialBalance";

/**
 * Balans → Tarix filtrlari URL'da yashaydi (F5 yoki havola filtrni ham, sahifani ham tiklaydi).
 * Sarlavhadagi «Excelga yuklash» ham aynan shu o'quvchidan foydalanadi — jadval va eksport bir xil.
 */
export const HISTORY_PAGE_PARAM = `${HISTORY_PARAM_PREFIX}Page`;
export const HISTORY_LIMIT_PARAM = `${HISTORY_PARAM_PREFIX}Limit`;
export const HISTORY_FROM_PARAM = `${HISTORY_PARAM_PREFIX}From`;
export const HISTORY_TO_PARAM = `${HISTORY_PARAM_PREFIX}To`;
export const HISTORY_SOURCE_PARAM = `${HISTORY_PARAM_PREFIX}Source`;

/**
 * Backend `FinancialSource_type` enum qiymatlari. URL'dan kelgan boshqa qiymat (eski yoki qo'lda
 * tahrirlangan havola, masalan "sell") backend'da 500 berardi — u «barcha manbalar» deb o'qiladi.
 */
export const LEDGER_SOURCE_TYPES = [
  "sell_profit",
  "sell_extra_cost",
  "cancel_extra_cost",
  "manual_income",
  "manual_expense",
  "salary",
  "correction",
  "bills",
] as const;
export type LedgerSourceType = (typeof LEDGER_SOURCE_TYPES)[number];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const readDateParam = (value: string | null) => (value && DATE_PATTERN.test(value) ? value : "");

export const isLedgerSourceType = (value: string | null | undefined): value is LedgerSourceType =>
  Boolean(value) && (LEDGER_SOURCE_TYPES as readonly string[]).includes(value as string);

export const readSourceParam = (value: string | null) => (isLedgerSourceType(value) ? value : "");

export interface HistoryFilters {
  fromDate: string;
  toDate: string;
  sourceType: LedgerSourceType | "";
}

export const readHistoryFilters = (params: URLSearchParams): HistoryFilters => ({
  fromDate: readDateParam(params.get(HISTORY_FROM_PARAM)),
  toDate: readDateParam(params.get(HISTORY_TO_PARAM)),
  sourceType: readSourceParam(params.get(HISTORY_SOURCE_PARAM)),
});

/** `export/financial-balance.xlsx` paramlari — jadvaldagi AYNAN o'sha filtrlar (qator soni `total` ga teng). */
export const buildHistoryExportParams = ({ fromDate, toDate, sourceType }: HistoryFilters) => ({
  ...(sourceType && { source_type: sourceType }),
  ...(fromDate && { from_date: fromDate }),
  ...(toDate && { to_date: toDate }),
});

/** Tahlil davri bo'yicha eksport (manba filtrsiz). Bo'sh davr — butun daftar. */
export const buildRangeExportParams = ({ from, to }: { from: string; to: string }) => ({
  ...(from && { from_date: from }),
  ...(to && { to_date: to }),
});

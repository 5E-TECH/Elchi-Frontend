import type { RankingMeta, TopBranch, TopMarket } from "../../../entities/dashboard";
import { getAllTimeRange } from "../../../shared/lib/dateRange";
import { formatRangeShort } from "../../../shared/ui/primitives/date/calendarMath";

/** Reyting qatori (9zbSDkUI) — marketlar va filiallar uchun bitta ko'rinish. */
export type RankingRow = {
  id: string;
  name: string;
  /** Sotuv foizi, 0–100. */
  rate: number;
  successful: number;
  total: number;
};

const toFinite = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toRow = (id: string, name: string | null, total: unknown, successful: unknown, rate: unknown): RankingRow => ({
  id,
  name: name?.trim() || "—",
  rate: Math.min(100, Math.max(0, toFinite(rate))),
  successful: toFinite(successful),
  total: toFinite(total),
});

/** Backend tartibi saqlanadi. */
export const toMarketRankingRows = (markets: readonly TopMarket[]): RankingRow[] =>
  markets.map((market, index) =>
    toRow(market.market_id || `market-${index}`, market.market_name, market.total_orders, market.successful_orders, market.success_rate),
  );

export const toBranchRankingRows = (branches: readonly TopBranch[]): RankingRow[] =>
  branches.map((branch, index) =>
    toRow(branch.branch_id || `branch-${index}`, branch.branch_name, branch.total_orders, branch.successful_orders, branch.success_rate),
  );

/** `YYYY-MM-DD` Toshkent bo'yicha (`en-CA` — ISO tartibi). */
const TASHKENT_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Backend chegarasi — Toshkent kuni (`from` = `2026-10-11T19:00:00Z` → 12.10). Brauzer zonasi emas: UTC'dagi
 * qurilmada boshlanish kuni bir kun oldin chiqardi. Sana-only qiymat o'zgarmaydi.
 */
const toTashkentDay = (value: string | null) => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : TASHKENT_DAY.format(date);
};

/**
 * Izohdagi davr (taxta `tizim-charts`: «izoh — hisob formulasi va davr»): qisqa davrda backend reytingni
 * oxirgi 30 kun bo'yicha beradi (`last_30_days`) — «oxirgi 30 kun»; aks holda tanlangan oraliq
 * («12.10 – 15.10.2026»). Meta yo'q yoki sanasiz — davr yozilmaydi. «Barchasi» (sana filtri
 * `1970-01-01` dan) — oraliq emas: «01.01.1970 – …» yozilmaydi.
 */
export const rankingPeriodLabel = (
  meta: RankingMeta | null | undefined,
  lastDaysLabel: (count: number) => string,
): string | null => {
  if (!meta) return null;
  if (meta.periodRule === "last_30_days") return lastDaysLabel(meta.periodDays ?? 30);
  const from = toTashkentDay(meta.from);
  const to = toTashkentDay(meta.to);
  if (!from || !to || from <= getAllTimeRange().from) return null;
  return formatRangeShort({ from, to });
};

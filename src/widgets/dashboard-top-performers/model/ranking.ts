import type { RankingMeta } from "../../../entities/dashboard";
import { getAllTimeRange } from "../../../shared/lib/dateRange";
import { formatRangeShort } from "../../../shared/ui/primitives/date/calendarMath";
import type { PerformerRow } from "../lib/rankItems";

/** Taxta `tizim-charts` «Kam ma'lumot»: shundan kam buyurtmali qator bo'lsa, reyting taxminiy ekani aytiladi. */
export const LOW_DATA_ORDERS = 30;

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
 * Izohdagi davr (9zbSDkUI, taxta `tizim-charts`: «izoh — hisob formulasi va davr»): qisqa davrda backend
 * reytingni oxirgi 30 kun bo'yicha beradi (`last_30_days`) — «oxirgi 30 kun»; aks holda tanlangan oraliq
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

/** Reyting kartasi izohi: formula + davr («Sotuv foizi · sotilgan / jami · oxirgi 30 kun»). */
export const rankingDescription = (
  formula: string,
  meta: RankingMeta | null | undefined,
  lastDaysLabel: (count: number) => string,
): string => [formula, rankingPeriodLabel(meta, lastDaysLabel)].filter(Boolean).join(" · ");

/**
 * «Ma'lumot hali kam» izohi kerakmi: backend chegaradan o'tmaganlarni chetga qoldirgan (`filteredOut`)
 * yoki ko'rinayotgan qatorlardan birida 30 dan kam buyurtma (taxta «Kam ma'lumot»).
 */
export const isLowDataRanking = (rows: readonly PerformerRow[], meta: RankingMeta | null | undefined): boolean =>
  (meta?.filteredOut ?? 0) > 0 || rows.some((row) => row.total < LOW_DATA_ORDERS);

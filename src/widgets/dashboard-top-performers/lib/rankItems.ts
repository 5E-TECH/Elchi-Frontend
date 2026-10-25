import type { TFunction } from "i18next";
import type { TopBranch, TopCourier, TopMarket, TopOperator } from "../../../entities/dashboard";
import { formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { clampPercent, type RankItem } from "../../../shared/ui/charts";

/** Reyting qatori (market, filial, kuryer, operator — bir xil shakl). */
export interface PerformerRow {
  id: string;
  name: string;
  total: number;
  successful: number;
  rate: number;
}

const toFinite = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const row = (id: string, name: string | null, total: unknown, successful: unknown, rate: unknown): PerformerRow => ({
  id,
  name: name || "—",
  total: toFinite(total),
  successful: toFinite(successful),
  rate: clampPercent(toFinite(rate)),
});

export const marketRows = (items: readonly TopMarket[] | undefined): PerformerRow[] =>
  (items ?? []).map((m) => row(m.market_id, m.market_name, m.total_orders, m.successful_orders, m.success_rate));

export const branchRows = (items: readonly TopBranch[] | undefined): PerformerRow[] =>
  (items ?? []).map((b) => row(b.branch_id, b.branch_name, b.total_orders, b.successful_orders, b.success_rate));

export const courierRows = (items: readonly TopCourier[] | undefined): PerformerRow[] =>
  (items ?? []).map((c) => row(c.courier_id, c.courier_name, c.total_orders, c.successful_orders, c.success_rate));

export const operatorRows = (items: readonly TopOperator[] | undefined): PerformerRow[] =>
  (items ?? []).map((o) => row(o.operator_id, o.operator_name, o.total_orders, o.successful_orders, o.success_rate));

/** Sotuv foizi bo'yicha kamayish tartibida (teng bo'lsa — ko'p buyurtmali oldin). Asl massiv o'zgarmaydi. */
export const sortByRate = (rows: readonly PerformerRow[]): PerformerRow[] =>
  [...rows].sort((a, b) => b.rate - a.rate || b.total - a.total);

export interface RankItemOptions {
  t: TFunction;
  language?: string;
  /** O'z qatori («Siz» / «Sizning filial»). */
  selfId?: string | number | null;
  selfBadge?: RankItem["badge"];
  /** O'z qatori meter rangi (kuryer: boshqalar kulrang, o'zi — `action`). */
  selfMeterTone?: RankItem["meterTone"];
  othersMeterTone?: RankItem["meterTone"];
  /** Qatorning o'z rangi (masalan past sotuv foizi — `lowRateTone`); `undefined` — `othersMeterTone`. */
  meterToneFor?: (row: PerformerRow) => RankItem["meterTone"] | undefined;
  /** O'rin raqami boshlanishi (pinned qator uchun). */
  startRank?: number;
}

/** Sotuv foizi shundan past qator ajralib turadi (PMa5dgYQ; market rolidagi «Past · 50% dan kam» bilan bir xil). */
export const LOW_RATE_THRESHOLD = 50;

/**
 * Past sotuv foizi — qizil (`danger`) meter; qolganlari o'z rangida (maket superadmin-dashboard-main — ko'k).
 * Foiz matni qatorda yozilgan — rang yolg'iz ma'no tashimaydi.
 */
export const lowRateTone = (row: PerformerRow): RankItem["meterTone"] | undefined =>
  row.rate < LOW_RATE_THRESHOLD ? "danger" : undefined;

/** Reyting qatori → `RankItem`: «84,4%» + «38 / 45 ta» + meter. */
export const toRankItems = (rows: readonly PerformerRow[], options: RankItemOptions): RankItem[] => {
  const { t, language, selfId, selfBadge, selfMeterTone, othersMeterTone, meterToneFor, startRank } = options;
  const self = selfId == null || selfId === "" ? null : String(selfId);
  return rows.map((item, index) => {
    const isSelf = self != null && item.id === self;
    return {
      id: item.id || `row-${index}`,
      name: item.name,
      value: formatPercentLocalized(item.rate, { language }),
      sub: t("dashboard:v2Dashboard.partOfTotal", {
        part: formatNumberLocalized(item.successful, { language }),
        total: formatNumberLocalized(item.total, { language }),
      }),
      share: item.rate,
      highlight: isSelf,
      badge: isSelf && selfBadge ? selfBadge : undefined,
      meterTone: isSelf ? selfMeterTone : (meterToneFor?.(item) ?? othersMeterTone),
      rank: startRank != null ? startRank + index : undefined,
      ariaLabel: isSelf && selfBadge ? `${(startRank ?? 1) + index}. ${item.name} (${selfBadge.label})` : undefined,
    };
  });
};

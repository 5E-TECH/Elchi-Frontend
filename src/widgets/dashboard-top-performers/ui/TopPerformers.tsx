import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Store, Building2, Trophy, Inbox, UsersRound } from "lucide-react";
import type { TopMarket, TopBranch, TopCourier, TopOperator } from "../../../entities/dashboard";
import {
  toneAccent,
  toneSoftBg,
  formatNumber,
  formatPercent,
  TYPO,
  TEXT,
} from "../../../shared/config/designSystem";

/**
 * Dashboard reytinglari. Backend yuborgan tartib saqlanadi.
 */

interface LeaderboardRow {
  id: string;
  entityId: string;
  name: string;
  rate: number; // success_rate
  total: number; // total_orders
  successful: number; // successful_orders
}

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#b45309"]; // oltin / kumush / bronza
const MAX_ROWS = 5;
const MIN_ORDERS = 30;

const toFiniteNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

interface LeaderboardProps {
  title: string;
  icon: React.ReactNode;
  accentTone: "info" | "warning";
  rows: LeaderboardRow[];
  emptyText: string;
  rateLabel: string;
  ordersLabel: string;
  currentUserId?: string | number | null;
  youLabel: string;
  limitedText: string;
  compact?: boolean;
}

const Leaderboard = memo(
  ({ title, icon, accentTone, rows, emptyText, rateLabel, ordersLabel, currentUserId, youLabel, limitedText, compact = false }: LeaderboardProps) => {
    const accent = toneAccent(accentTone);
    const isSelf = (row: LeaderboardRow) =>
      Boolean(currentUserId != null && row.entityId && row.entityId === String(currentUserId));
    const podium = [rows[1], rows[0], rows[2]];
    const remaining = rows.slice(3);
    return (
      <section className={`el-card flex h-full min-w-0 flex-col overflow-hidden rounded-2xl p-3 sm:p-5 ${rows.length === 0 ? "min-h-[130px]" : compact ? "min-h-[170px]" : "min-h-[300px]"}`}>
        <div className={`${compact ? "mb-3" : "mb-4"} flex items-center gap-2`}>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: toneSoftBg(accentTone, 16), color: accent }}
          >
            {icon}
          </span>
          <h3 className={`${TYPO.sectionTitle} text-maindark dark:text-primary`}>{title}</h3>
        </div>

        {rows.length === 0 ? (
          <div className={`flex flex-1 flex-col items-center justify-center gap-2 text-center ${compact ? "py-4" : "py-8"}`}>
            <Inbox size={28} style={{ color: TEXT.soft, opacity: 0.5 }} />
            <p className="text-[12px] font-medium" style={{ color: TEXT.soft }}>
              {emptyText}
            </p>
          </div>
        ) : (
          <>
            {rows.some((row) => row.total < MIN_ORDERS) && (
              <p className="mb-3 text-xs font-medium" style={{ color: TEXT.soft }}>{limitedText}</p>
            )}
            <ol className="grid min-w-0 max-w-full grid-cols-3 items-end gap-1.5 sm:gap-2" aria-label={title}>
              {podium.map((row, position) => {
                const rank = position === 0 ? 2 : position === 1 ? 1 : 3;
                if (!row) return <li key={rank} aria-hidden="true" />;
                const self = isSelf(row);
                return (
                  <li
                    key={row.id}
                    aria-label={`${rank}. ${row.name}`}
                    className={`min-w-0 overflow-hidden rounded-xl border p-2 text-center sm:p-3 ${rank === 1 ? "min-h-[138px]" : "min-h-[118px]"} ${self ? "border-main bg-main/10 ring-2 ring-main/50" : "border-transparent bg-main/5 dark:bg-white/5"}`}
                  >
                    <span className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold" style={{ background: `color-mix(in srgb, ${RANK_COLORS[rank - 1]} 20%, transparent)`, color: RANK_COLORS[rank - 1] }}>
                      {rank}
                    </span>
                    <span className={`block truncate text-xs text-maindark dark:text-primary ${self ? "font-extrabold" : "font-semibold"}`} title={row.name}>{row.name}</span>
                    {self && <span className="mt-1 inline-block rounded-full bg-main px-1.5 py-0.5 text-[10px] font-bold text-white">{youLabel}</span>}
                    <span className="mt-1 block text-xs font-bold" style={{ color: accent }}>{formatPercent(row.rate)}</span>
                    <span className="block text-[10px]" style={{ color: TEXT.soft }}>{formatNumber(row.successful)}/{formatNumber(row.total)} {ordersLabel}</span>
                  </li>
                );
              })}
            </ol>
            {remaining.length > 0 && (
              <ol start={4} className="mt-3 flex flex-col gap-2">
                {remaining.map((row, index) => {
                  const self = isSelf(row);
                  return (
                    <li key={row.id} className={`flex min-w-0 items-center gap-2 rounded-xl border p-2 ${self ? "border-main bg-main/10" : "border-transparent"}`}>
                      <span className="w-6 shrink-0 text-center text-xs font-bold" style={{ color: accent }}>{index + 4}</span>
                      <span className={`min-w-0 flex-1 truncate text-xs text-maindark dark:text-primary ${self ? "font-extrabold" : "font-semibold"}`} title={row.name}>{row.name}</span>
                      {self && <span className="shrink-0 rounded-full bg-main px-1.5 py-0.5 text-[10px] font-bold text-white">{youLabel}</span>}
                      <span className="shrink-0 text-xs font-bold" style={{ color: accent }}>{formatPercent(row.rate)}</span>
                    </li>
                  );
                })}
              </ol>
            )}
            <span className="sr-only">{rateLabel}</span>
          </>
        )}
      </section>
    );
  },
);

Leaderboard.displayName = "Leaderboard";

export interface TopPerformersProps {
  markets?: TopMarket[];
  branches?: TopBranch[];
  couriers?: TopCourier[];
  operators?: TopOperator[];
  currentUserId?: string | number | null;
  compact?: boolean;
}

const TopPerformers = memo(({ markets, branches, couriers, operators, currentUserId, compact = false }: TopPerformersProps) => {
  const { t } = useTranslation("dashboard");

  const marketRows: LeaderboardRow[] = useMemo(
    () =>
      (markets ?? []).slice(0, MAX_ROWS).map((m, i) => ({
        id: `market-${m.market_id || "unknown"}-${i}`,
        entityId: m.market_id,
        name: m.market_name || "—",
        rate: clampPercent(toFiniteNumber(m.success_rate)),
        total: toFiniteNumber(m.total_orders),
        successful: toFiniteNumber(m.successful_orders),
      })),
    [markets],
  );

  const branchRows: LeaderboardRow[] = useMemo(
    () =>
      (branches ?? []).slice(0, MAX_ROWS).map((branch, i) => ({
        id: `branch-${branch.branch_id || "unknown"}-${i}`,
        entityId: branch.branch_id,
        name: branch.branch_name || "—",
        rate: clampPercent(toFiniteNumber(branch.success_rate)),
        total: toFiniteNumber(branch.total_orders),
        successful: toFiniteNumber(branch.successful_orders),
      })),
    [branches],
  );

  const courierRows: LeaderboardRow[] = useMemo(
    () =>
      (couriers ?? []).slice(0, MAX_ROWS).map((courier, i) => ({
        id: `courier-${courier.courier_id || "unknown"}-${i}`,
        entityId: courier.courier_id,
        name: courier.courier_name || "—",
        rate: clampPercent(toFiniteNumber(courier.success_rate)),
        total: toFiniteNumber(courier.total_orders),
        successful: toFiniteNumber(courier.successful_orders),
      })),
    [couriers],
  );

  const operatorRows: LeaderboardRow[] = useMemo(
    () =>
      (operators ?? []).slice(0, MAX_ROWS).map((operator, i) => ({
        id: `operator-${operator.operator_id || "unknown"}-${i}`,
        entityId: operator.operator_id,
        name: operator.operator_name || "—",
        rate: clampPercent(toFiniteNumber(operator.success_rate)),
        total: toFiniteNumber(operator.total_orders),
        successful: toFiniteNumber(operator.successful_orders),
      })),
    [operators],
  );

  const showMarkets = markets !== undefined;
  const showBranches = branches !== undefined;
  const showCouriers = couriers !== undefined;
  const showOperators = operatorRows.length > 0;
  const sectionCount = Number(showMarkets) + Number(showBranches) + Number(showCouriers) + Number(showOperators);

  if (sectionCount === 0) return null;

  return (
    <div className={`grid min-w-0 grid-cols-1 gap-4 ${sectionCount > 1 ? "md:grid-cols-2" : ""}`}>
      {showMarkets ? (
        <Leaderboard
          title={t("top.markets_title")}
          icon={<Store size={16} />}
          accentTone="info"
          rows={marketRows}
          currentUserId={currentUserId}
          youLabel={t("top.you")}
          limitedText={t("top.limited")}
          emptyText={t("top.empty")}
          rateLabel={t("cards.success_rate")}
          ordersLabel={t("unit.orders")}
          compact={compact}
        />
      ) : null}
      {showBranches ? (
        <Leaderboard
          title={t("top.branches_title")}
          icon={<Building2 size={16} />}
          accentTone="warning"
          rows={branchRows}
          currentUserId={currentUserId}
          youLabel={t("top.you")}
          limitedText={t("top.limited")}
          emptyText={t("top.empty")}
          rateLabel={t("cards.success_rate")}
          ordersLabel={t("unit.orders")}
          compact={compact}
        />
      ) : null}
      {showCouriers ? (
        <Leaderboard
          title={t("top.couriers_title")}
          icon={<Trophy size={16} />}
          accentTone="info"
          rows={courierRows}
          currentUserId={currentUserId}
          youLabel={t("top.you")}
          limitedText={t("top.limited")}
          emptyText={t("top.empty")}
          rateLabel={t("cards.success_rate")}
          ordersLabel={t("unit.orders")}
          compact={compact}
        />
      ) : null}
      {showOperators ? (
        <Leaderboard
          title={t("top.operators_title")}
          icon={<UsersRound size={16} />}
          accentTone="warning"
          rows={operatorRows}
          currentUserId={currentUserId}
          youLabel={t("top.you")}
          limitedText={t("top.limited")}
          emptyText={t("top.empty")}
          rateLabel={t("cards.success_rate")}
          ordersLabel={t("unit.orders")}
          compact={compact}
        />
      ) : null}
    </div>
  );
});

TopPerformers.displayName = "TopPerformers";

export default TopPerformers;

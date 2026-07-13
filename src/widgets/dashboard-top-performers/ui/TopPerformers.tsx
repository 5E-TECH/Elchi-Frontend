import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Store, Building2, Trophy, Inbox } from "lucide-react";
import type { TopMarket, TopBranch } from "../../../entities/dashboard";
import {
  toneAccent,
  toneSoftBg,
  formatNumber,
  formatPercent,
  TYPO,
  TEXT,
} from "../../../shared/config/designSystem";

/**
 * TopPerformers — eng yaxshi marketlar va filiallar reytingi (leaderboard).
 * Ma'lumot `analytics/dashboard` javobida tayyor keladi (topMarkets/topBranches),
 * oxirgi 30 kun, kamida 30 buyurtmali, sotuv (success rate) bo'yicha saralangan.
 */

interface LeaderboardRow {
  id: string;
  name: string;
  rate: number; // success_rate
  total: number; // total_orders
  successful: number; // successful_orders
}

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#b45309"]; // oltin / kumush / bronza
const MAX_ROWS = 5;

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
  compact?: boolean;
}

const Leaderboard = memo(
  ({ title, icon, accentTone, rows, emptyText, rateLabel, ordersLabel, compact = false }: LeaderboardProps) => {
    const accent = toneAccent(accentTone);
    return (
      <div className={`el-card flex h-full flex-col rounded-2xl p-5 ${compact ? "min-h-[170px]" : "min-h-[300px]"}`}>
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
          <ul className="flex flex-1 flex-col gap-2.5">
            {rows.map((row, i) => {
              const medal = RANK_COLORS[i];
              const progress = clampPercent(row.rate);
              return (
                <li key={row.id} className="flex items-center gap-3">
                  {/* Reyting raqami */}
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold"
                    style={
                      medal
                        ? { background: `color-mix(in srgb, ${medal} 18%, transparent)`, color: medal }
                        : { background: "var(--color-main-soft)", color: "var(--color-main)" }
                    }
                  >
                    {i < 3 ? <Trophy size={13} /> : i + 1}
                  </span>

                  {/* Nomi + progress */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-maindark dark:text-primary">
                        {row.name}
                      </span>
                      <span className="shrink-0 text-[13px] font-bold" style={{ color: accent }}>
                        {formatPercent(row.rate)}
                      </span>
                    </div>
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full"
                      style={{ background: toneSoftBg(accentTone, 14) }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${progress}%`, background: accent }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] font-medium" style={{ color: TEXT.soft }}>
                      {formatNumber(row.successful)}/{formatNumber(row.total)} {ordersLabel} · {rateLabel}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  },
);

Leaderboard.displayName = "Leaderboard";

export interface TopPerformersProps {
  markets?: TopMarket[];
  branches?: TopBranch[];
  compact?: boolean;
}

const TopPerformers = memo(({ markets, branches, compact = false }: TopPerformersProps) => {
  const { t } = useTranslation("dashboard");

  const marketRows: LeaderboardRow[] = useMemo(
    () =>
      (markets ?? []).slice(0, MAX_ROWS).map((m, i) => ({
        id: `market-${m.market_id || "unknown"}-${i}`,
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
        name: branch.branch_name || "—",
        rate: clampPercent(toFiniteNumber(branch.success_rate)),
        total: toFiniteNumber(branch.total_orders),
        successful: toFiniteNumber(branch.successful_orders),
      })),
    [branches],
  );

  const showMarkets = markets !== undefined;
  const showBranches = branches !== undefined;
  const sectionCount = Number(showMarkets) + Number(showBranches);

  if (sectionCount === 0) return null;

  return (
    <div className={`grid grid-cols-1 gap-4 ${sectionCount > 1 ? "md:grid-cols-2" : ""}`}>
      {showMarkets ? (
        <Leaderboard
          title={t("top.markets_title")}
          icon={<Store size={16} />}
          accentTone="info"
          rows={marketRows}
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

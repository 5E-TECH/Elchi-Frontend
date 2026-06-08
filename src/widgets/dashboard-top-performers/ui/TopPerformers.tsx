import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Store, Bike, Trophy, Inbox } from "lucide-react";
import type { TopMarket, TopCourier } from "../../../entities/dashboard";
import {
  toneAccent,
  toneSoftBg,
  formatNumber,
  formatPercent,
  TYPO,
  TEXT,
} from "../../../shared/config/designSystem";

/**
 * TopPerformers — eng yaxshi marketlar va kuryerlar reytingi (leaderboard).
 * Ma'lumot `analytics/dashboard` javobida tayyor keladi (topMarkets/topCouriers),
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

interface LeaderboardProps {
  title: string;
  icon: React.ReactNode;
  accentTone: "info" | "warning";
  rows: LeaderboardRow[];
  emptyText: string;
  rateLabel: string;
  ordersLabel: string;
}

const Leaderboard = memo(
  ({ title, icon, accentTone, rows, emptyText, rateLabel, ordersLabel }: LeaderboardProps) => {
    const accent = toneAccent(accentTone);
    return (
      <div className="el-card flex h-full min-h-[300px] flex-col rounded-2xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: toneSoftBg(accentTone, 16), color: accent }}
          >
            {icon}
          </span>
          <h3 className={`${TYPO.sectionTitle} text-maindark dark:text-primary`}>{title}</h3>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <Inbox size={28} style={{ color: TEXT.soft, opacity: 0.5 }} />
            <p className="text-[12px] font-medium" style={{ color: TEXT.soft }}>
              {emptyText}
            </p>
          </div>
        ) : (
          <ul className="flex flex-1 flex-col gap-2.5">
            {rows.map((row, i) => {
              const medal = RANK_COLORS[i];
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
                        style={{ width: `${Math.min(100, row.rate)}%`, background: accent }}
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
  markets: TopMarket[];
  couriers: TopCourier[];
}

const TopPerformers = memo(({ markets, couriers }: TopPerformersProps) => {
  const { t } = useTranslation("dashboard");

  const marketRows: LeaderboardRow[] = (markets ?? []).slice(0, 5).map((m, i) => ({
    id: String(m.market_id ?? i),
    name: m.market_name ?? "—",
    rate: Number(m.success_rate ?? 0),
    total: Number(m.total_orders ?? 0),
    successful: Number(m.successful_orders ?? 0),
  }));

  const courierRows: LeaderboardRow[] = (couriers ?? []).slice(0, 5).map((c, i) => ({
    id: String(c.courier_id ?? i),
    name: c.courier_name ?? "—",
    rate: Number(c.success_rate ?? 0),
    total: Number(c.total_orders ?? 0),
    successful: Number(c.successful_orders ?? 0),
  }));

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Leaderboard
        title={t("top.markets_title")}
        icon={<Store size={16} />}
        accentTone="info"
        rows={marketRows}
        emptyText={t("top.empty")}
        rateLabel={t("cards.success_rate")}
        ordersLabel={t("unit.orders")}
      />
      <Leaderboard
        title={t("top.couriers_title")}
        icon={<Bike size={16} />}
        accentTone="warning"
        rows={courierRows}
        emptyText={t("top.empty")}
        rateLabel={t("cards.success_rate")}
        ordersLabel={t("unit.orders")}
      />
    </div>
  );
});

TopPerformers.displayName = "TopPerformers";

export default TopPerformers;

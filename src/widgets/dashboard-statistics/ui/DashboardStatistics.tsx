import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  XCircle,
  Truck,
  Wallet,
  Receipt,
  Send,
  ArrowUpRight,
  TrendingDown,
} from "lucide-react";
import MetricCard, { MetricCardSkeleton } from "../../../shared/ui/MetricCard";
import OrderStatusDonut from "./OrderStatusDonut";
import SuccessGauge from "./SuccessGauge";
import {
  formatCompactMoney,
  formatPercent,
  formatNumber,
  ratio,
  type Tone,
} from "../../../shared/config/designSystem";

/**
 * DashboardStatistics — bento-uslubdagi asosiy ko'rsatkichlar bo'limi.
 *
 * Bir xil kartalar o'rniga vizual iyerarxiya: katta donut (buyurtma holati),
 * gauge (muvaffaqiyat darajasi), ajralib turuvchi "yetkazib berilgan" featured
 * karta, va kichikroq yordamchi metrikalar. Har bir ko'rsatkich faqat bir marta.
 */
export interface DashboardStatisticsProps {
  accepted: number;
  sold: number;
  cancelled: number;
  profit: number;
  totalRevenue: number;
  avgOrderValue: number;
  avgFulfillmentHours: number;
  onTimeRate: number; // 24 soat ichida yetkazilganlar % (SLA)
  showFinancialMetrics?: boolean;
  loading?: boolean;
}

const DashboardStatistics = memo(
  ({
    accepted,
    sold,
    cancelled,
    profit,
    totalRevenue,
    avgOrderValue,
    showFinancialMetrics = true,
    loading = false,
  }: DashboardStatisticsProps) => {
    const { t } = useTranslation("dashboard");

    const gridClass =
      "grid grid-cols-2 gap-4 lg:grid-cols-12 lg:auto-rows-[142px]";

    if (loading) {
      return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
      );
    }

    const successRate = ratio(sold, accepted);
    const cancelRate = ratio(cancelled, accepted);
    const inProgress = Math.max(0, accepted - sold - cancelled);
    const profitTone: Tone = profit < 0 ? "danger" : "success";
    // Yo'qotilgan daromad: bekor qilingan buyurtmalarning taxminiy qiymati
    const lostRevenue = cancelled * avgOrderValue;

    return (
      <div className="space-y-4">
        <div className={gridClass}>
          {/* ── Donut: buyurtma holati (katta, chap) ── */}
          <div className="col-span-2 lg:col-span-4 lg:row-span-2">
            <OrderStatusDonut
              accepted={accepted}
              sold={sold}
              inProgress={inProgress}
              cancelled={cancelled}
              title={t("status.title")}
              centerLabel={t("status.center")}
              legend={{
                sold: t("cards.sold"),
                inProgress: t("cards.in_progress"),
                cancelled: t("cards.cancelled"),
              }}
            />
          </div>

          {/* ── Gauge: muvaffaqiyat darajasi (katta, markaz) ── */}
          <div className="col-span-2 lg:col-span-4 lg:row-span-2">
            <SuccessGauge
              successRate={successRate}
              sold={sold}
              cancelled={cancelled}
              title={t("cards.success_rate")}
              soldLabel={t("cards.sold")}
              cancelledLabel={t("cards.cancelled")}
            />
          </div>

          {/* ── Featured: yetkazib berilgan (ajralib turadi) ── */}
          <div className="col-span-2 lg:col-span-4 lg:row-span-1">
            <FeaturedDeliveredCard
              sold={sold}
              successRate={successRate}
              title={t("featured.delivered")}
              hint={t("featured.delivered_hint")}
              unit={t("unit.orders")}
              rateLabel={t("cards.success_rate")}
            />
          </div>

          {/* ── Bekor qilingan ── */}
          <div className="col-span-1 lg:col-span-2 lg:row-span-1">
            <MetricCard
              title={t("cards.cancelled")}
              value={formatNumber(cancelled)}
              suffix={t("unit.orders")}
              icon={<XCircle size={20} />}
              tone="danger"
              badge={formatPercent(cancelRate)}
              badgeUp={false}
            />
          </div>

          {/* ── Jarayonda ── */}
          <div className="col-span-1 lg:col-span-2 lg:row-span-1">
            <MetricCard
              title={t("cards.in_progress")}
              value={formatNumber(inProgress)}
              suffix={t("unit.orders")}
              icon={<Truck size={20} />}
              tone="warning"
            />
          </div>
        </div>

        {/* ── Ikkilamchi metrikalar qatori ── */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {showFinancialMetrics ? (
            <>
              <MetricCard
                title={t("cards.total_revenue")}
                value={formatCompactMoney(totalRevenue)}
                suffix={t("currency_sum")}
                icon={<Receipt size={20} />}
                tone="brand"
                compact
                hint={t("cards.total_revenue_hint")}
              />
              <MetricCard
                title={t("cards.profit")}
                value={formatCompactMoney(profit)}
                suffix={t("currency_sum")}
                icon={<Wallet size={20} />}
                tone={profitTone}
                compact
                hint={t("cards.profit_hint")}
              />
              <MetricCard
                title={t("cards.avg_order_value")}
                value={formatCompactMoney(avgOrderValue)}
                suffix={t("currency_sum")}
                icon={<Receipt size={20} />}
                tone="brand"
                compact
                hint={t("cards.avg_order_value_hint")}
              />
            </>
          ) : null}
          {/* Yo'qotilgan daromad */}
          {showFinancialMetrics ? (
            <MetricCard
              title={t("cards.lost_revenue")}
              value={formatCompactMoney(lostRevenue)}
              suffix={t("currency_sum")}
              icon={<TrendingDown size={20} />}
              tone="danger"
              compact
              hint={t("cards.lost_revenue_hint")}
            />
          ) : null}
        </div>
      </div>
    );
  },
);

DashboardStatistics.displayName = "DashboardStatistics";

// ─── FeaturedDeliveredCard ────────────────────────────────────────────────────
// Asosiy "yetkazib berilgan" ko'rsatkichi — gradient fon bilan keskin ajralib turadi.

interface FeaturedDeliveredCardProps {
  sold: number;
  successRate: number;
  title: string;
  hint: string;
  unit: string;
  rateLabel: string;
}

const FeaturedDeliveredCard = memo(
  ({ sold, successRate, title, hint, unit, rateLabel }: FeaturedDeliveredCardProps) => (
    <div
      className="relative flex h-full min-h-[132px] flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-lg"
      style={{
        background:
          "linear-gradient(135deg, var(--color-main) 0%, var(--color-purple-dark) 100%)",
      }}
    >
      {/* dekorativ halqa */}
      <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -bottom-12 -right-2 h-24 w-24 rounded-full bg-white/5" />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/25">
            <Send size={20} />
          </div>
          <span className="text-[13px] font-semibold text-white/90">{title}</span>
        </div>
        <span className="flex items-center gap-1 rounded-lg bg-white/20 px-2 py-0.5 text-[11px] font-bold">
          <ArrowUpRight size={12} strokeWidth={3} />
          {formatPercent(successRate)} {rateLabel}
        </span>
      </div>

      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[40px] font-bold leading-none tracking-tight">
            {formatNumber(sold)}
          </span>
          <span className="text-[12px] font-semibold uppercase text-white/70">
            {unit}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-white/70">{hint}</p>
      </div>
    </div>
  ),
);

FeaturedDeliveredCard.displayName = "FeaturedDeliveredCard";

export default DashboardStatistics;

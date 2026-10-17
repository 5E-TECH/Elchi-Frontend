// dizayn-v2: superadmin-dashboard-main, admin-dashboard-main
import { ChevronRight, Wallet } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { RevenueResponse } from "../../../entities/dashboard";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  CURRENCY_LABEL,
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatSignedMoneyLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import { LegendKey, Waterfall } from "../../../shared/ui/charts";
import { Badge, buttonClasses, Card, EmptyState, QueryBoundary, type QueryLike } from "../../../shared/ui/primitives";

/** Kassa balansi — `GET analytics/revenue` javobidagi `finance` (o'sha so'rov, qayta so'ralmaydi). */
export interface CashFinance {
  main: number;
  transit: number;
  markets: number;
  current: number;
}

/**
 * Hozirgi xarita (eski `FinancialAnalysis.tsx:411-433`) AYNAN saqlanadi: pochta kassasi = `main.balance`,
 * yo'ldagi pul = `branchReceivable ?? couriersTotalBalanse`, marketlar = `marketsTotalBalans`,
 * joriy holat = `currentSituation`.
 */
const toCashFinance = (finance: NonNullable<RevenueResponse["data"]["finance"]>): CashFinance => ({
  main: Number(finance.main?.balance ?? 0),
  transit: Number(finance.branches?.branchReceivable ?? finance.couriers?.couriersTotalBalanse ?? 0),
  markets: Number(finance.markets?.marketsTotalBalans ?? 0),
  current: Number(finance.currentSituation ?? 0),
});

export interface CashBalanceCardProps {
  query: QueryLike<RevenueResponse> & { dataUpdatedAt?: number };
  className?: string;
}

/**
 * «KASSA BALANSI» (faqat SA/admin): joriy holat (to'liq), sharshara «Pochta kassasi + Yo'ldagi pul −
 * Marketlar = Joriy holat», ostida legenda-jadval va «Balansni ochish ›» → `/financial-balance`.
 */
const CashBalanceCard = ({ query, className }: CashBalanceCardProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const lang = resolveMoneyLanguage(language);
  const finance = query.data?.data?.finance;
  const cash = finance ? toCashFinance(finance) : null;
  const positive = (cash?.current ?? 0) >= 0;
  const asOf = query.dataUpdatedAt ? formatDateTimeLocalized(query.dataUpdatedAt) : null;
  const compact = (value: number) => formatCompactMoneyLocalized(value, { language, withCurrency: false });

  return (
    <Card
      divided={false}
      className={className}
      title={t("v2Dashboard.cash.title")}
      description={asOf ? t("v2Dashboard.cash.asOf", { time: asOf }) : undefined}
      actions={
        cash ? (
          <Badge tone={positive ? "success" : "danger"} dot>
            {positive ? t("v2Dashboard.cash.positive") : t("v2Dashboard.cash.negative")}
          </Badge>
        ) : undefined
      }
      bodyClassName="flex flex-1 flex-col"
    >
      <QueryBoundary
        query={query}
        skeleton="chart"
        size="chart"
        isEmpty={(data) => !data.data?.finance}
        empty={<EmptyState size="chart" icon={Wallet} title={t("v2Dashboard.cash.empty")} />}
        className="flex flex-1 flex-col"
      >
        {() =>
          cash ? (
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">{t("v2Dashboard.cash.formula")}</span>
                <span
                  className={cx(
                    "whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] proportional-nums max-md:text-[22px] max-md:leading-[30px]",
                    positive ? "text-text" : "text-danger-fg",
                  )}
                >
                  {formatMoneyLocalized(cash.current, { language, withCurrency: false })}
                  <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted">{CURRENCY_LABEL[lang]}</span>
                </span>
              </div>
              <Waterfall
                ariaLabel={t("v2Dashboard.cash.aria", {
                  current: compact(cash.current),
                  main: compact(cash.main),
                  transit: compact(cash.transit),
                  markets: compact(cash.markets),
                })}
                steps={[
                  { key: "main", label: t("v2Dashboard.cash.main"), value: cash.main, kind: "start" },
                  { key: "transit", label: t("v2Dashboard.cash.transit"), value: cash.transit, kind: "up" },
                  { key: "markets", label: t("v2Dashboard.cash.markets"), value: cash.markets, kind: "down" },
                  { key: "current", label: t("v2Dashboard.cash.current"), value: cash.current, kind: "total" },
                ]}
              />
              <ul className="m-0 flex list-none flex-col p-0">
                {[
                  { key: "main", label: t("v2Dashboard.cash.main"), value: formatMoneyLocalized(cash.main, { language }), keyClass: "bg-text-muted" },
                  { key: "transit", label: t("v2Dashboard.cash.transit"), value: formatSignedMoneyLocalized(Math.abs(cash.transit), { language }), keyClass: "bg-chart-1" },
                  {
                    key: "markets",
                    label: t("v2Dashboard.cash.marketsBalance"),
                    value: formatSignedMoneyLocalized(-Math.abs(cash.markets), { language }),
                    keyClass: "bg-chart-8",
                    negative: true,
                  },
                ].map((row) => (
                  <li
                    key={row.key}
                    className="grid min-h-10 grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-border py-1.5 text-sm text-text first:border-t-0"
                  >
                    <LegendKey tone="neutral" className={row.keyClass} />
                    <span className="truncate">{row.label}</span>
                    <span className={cx("whitespace-nowrap text-right font-bold", row.negative && cash.markets !== 0 && "text-danger-fg")}>
                      {row.value}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to="/financial-balance"
                className={cx(buttonClasses({ variant: "secondary", size: "sm" }), "mt-auto self-start max-md:self-stretch")}
              >
                {t("v2Dashboard.cash.open")}
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ) : null
        }
      </QueryBoundary>
    </Card>
  );
};

export default memo(CashBalanceCard);

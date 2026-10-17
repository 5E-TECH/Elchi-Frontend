// dizayn-v2: courier-dashboard-home
import { ChevronRight, Wallet } from "lucide-react";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useCashBox } from "../../../entities/payments";
import { cx } from "../../../shared/lib/cx";
import { getTodayRange } from "../../../shared/lib/dateRange";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  CURRENCY_LABEL,
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatSignedMoneyLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import { LegendKey, Waterfall, type WaterfallStep } from "../../../shared/ui/charts";
import { buttonClasses, Card, EmptyState, QueryBoundary } from "../../../shared/ui/primitives";
import { toCourierCash } from "../lib/courierCash";

/**
 * «KASSA» (kuryer, ega savoli 5 sukuti): qo'lingizdagi pul (`my-cashbox` balansi) va bugungi sharshara
 * «Kun boshida · Sotuvlar · Topshirildi · Qo'lingizda» — faqat bugungi tarix to'liq kelsa (`courierCash.ts`).
 * «Kassani ochish ›» → `/cash-box`.
 */
const CourierCashCard = () => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const lang = resolveMoneyLanguage(language);
  const { useGetCashboxMyCashbox } = useCashBox();
  const params = useMemo(() => {
    const today = getTodayRange();
    return { fromDate: today.from, toDate: today.to };
  }, []);
  const query = useGetCashboxMyCashbox(params);
  const cash = useMemo(() => toCourierCash(query.data), [query.data]);
  const asOf = query.dataUpdatedAt ? formatDateTimeLocalized(query.dataUpdatedAt) : null;
  const compact = (value: number) => formatCompactMoneyLocalized(value, { language, withCurrency: false });

  const steps: WaterfallStep[] = [];
  if (cash?.flow) {
    steps.push({ key: "start", label: t("v2Dashboard.courierCash.start"), value: cash.flow.start, kind: "start" });
    steps.push({ key: "sales", label: t("v2Dashboard.courierCash.sales"), value: cash.flow.sales, kind: "up" });
    steps.push({ key: "handed", label: t("v2Dashboard.courierCash.handed"), value: cash.flow.handedOver, kind: "down" });
    if (Math.round(cash.flow.other) !== 0) {
      steps.push({
        key: "other",
        label: t("v2Dashboard.courierCash.other"),
        value: Math.abs(cash.flow.other),
        kind: cash.flow.other > 0 ? "up" : "down",
      });
    }
    steps.push({ key: "balance", label: t("v2Dashboard.courierCash.balance"), value: cash.balance, kind: "total" });
  }

  return (
    <Card
      divided={false}
      title={t("v2Dashboard.courierCash.title")}
      description={asOf ? t("v2Dashboard.cash.asOf", { time: asOf }) : undefined}
      actions={
        <Link to="/cash-box" className={buttonClasses({ variant: "link", size: "sm" })}>
          {t("v2Dashboard.courierCash.open")}
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      }
      bodyClassName="flex flex-1 flex-col"
    >
      <QueryBoundary
        query={query}
        skeleton="chart"
        size="chart"
        isEmpty={() => cash === null}
        empty={<EmptyState size="chart" icon={Wallet} title={t("v2Dashboard.courierCash.empty")} />}
        className="flex flex-1 flex-col"
      >
        {() =>
          cash ? (
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">{t("v2Dashboard.courierCash.inHand")}</span>
                <span className={cx("whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] proportional-nums max-md:text-[22px] max-md:leading-[30px]", cash.balance < 0 ? "text-danger-fg" : "text-text")}>
                  {formatMoneyLocalized(cash.balance, { language, withCurrency: false })}
                  <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted">{CURRENCY_LABEL[lang]}</span>
                </span>
              </div>
              {cash.flow ? (
                <>
                  <Waterfall
                    steps={steps}
                    ariaLabel={t("v2Dashboard.courierCash.aria", {
                      start: compact(cash.flow.start),
                      sales: compact(cash.flow.sales),
                      handed: compact(cash.flow.handedOver),
                      balance: compact(cash.balance),
                    })}
                  />
                  <ul className="m-0 flex list-none flex-col p-0">
                    {[
                      { key: "start", label: t("v2Dashboard.courierCash.startRow"), value: formatMoneyLocalized(cash.flow.start, { language }), keyClass: "bg-text-muted" },
                      { key: "sales", label: t("v2Dashboard.courierCash.salesRow"), value: formatSignedMoneyLocalized(cash.flow.sales, { language }), keyClass: "bg-chart-1" },
                      { key: "handed", label: t("v2Dashboard.courierCash.handedRow"), value: formatSignedMoneyLocalized(-cash.flow.handedOver, { language }), keyClass: "bg-chart-8" },
                      ...(Math.round(cash.flow.other) !== 0
                        ? [{ key: "other", label: t("v2Dashboard.courierCash.otherRow"), value: formatSignedMoneyLocalized(cash.flow.other, { language }), keyClass: cash.flow.other > 0 ? "bg-chart-1" : "bg-chart-8" }]
                        : []),
                    ].map((row) => (
                      <li
                        key={row.key}
                        className="grid min-h-10 grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-border py-1.5 text-sm text-text first:border-t-0"
                      >
                        <LegendKey tone="neutral" className={row.keyClass} />
                        <span className="truncate">{row.label}</span>
                        <span className="whitespace-nowrap text-right font-bold">{row.value}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null
        }
      </QueryBoundary>
    </Card>
  );
};

export default memo(CourierCashCard);

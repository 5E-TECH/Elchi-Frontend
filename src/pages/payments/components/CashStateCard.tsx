// dizayn-v2: superadmin-payments-overview, admin-payments-overview
import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  CURRENCY_LABEL,
  formatMoneyLocalized,
  formatSignedMoneyLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import { Waterfall } from "../../../shared/ui/charts";
import { Badge, Card, ErrorState, SkeletonLines } from "../../../shared/ui/primitives";

type CashStateCardProps = {
  cash: number;
  receive: number;
  give: number;
  loading: boolean;
  /** all-info javob bermadi: raqamlar noma'lum — 0 deb chizilmaydi. */
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Ma'lumot olingan payt (React Query `dataUpdatedAt`). */
  updatedAt?: number;
  className?: string;
};

/**
 * «KASSA HOLATI» (maket `superadmin-payments-overview`): sof holat = kassa + qabul qilinishi kerak − berilishi kerak.
 * Qiymatlar KPI kartalari bilan bir manbadan (`GET /finance/cashbox/all-info`) — alohida so'rov yo'q.
 */
const CashStateCard = ({ cash, receive, give, loading, isError, error, onRetry, updatedAt, className }: CashStateCardProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const currency = CURRENCY_LABEL[resolveMoneyLanguage(language)];
  const titleId = useId();
  const net = cash + receive - give;
  const isPositive = net >= 0;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const signed = (value: number) => formatSignedMoneyLocalized(value, { language });
  const ready = !loading && !isError;

  return (
    <Card as="section" divided={false} aria-labelledby={titleId} bodyClassName="flex flex-col gap-4" className={cx("min-w-0", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-0.5">
          <h2 id={titleId} className="text-base font-bold text-text">
            {t("v2Daily.state.title")}
          </h2>
          <p className="text-[13px] leading-[18px] text-text-muted">
            {updatedAt
              ? t("v2Daily.state.subtitle", { time: formatDateTimeLocalized(updatedAt, { language }) })
              : t("v2Daily.state.subtitleNow")}
          </p>
        </div>
        {ready ? (
          <Badge tone={isPositive ? "success" : "danger"} dot>
            {t(isPositive ? "v2Daily.state.positive" : "v2Daily.state.negative")}
          </Badge>
        ) : null}
      </div>

      {loading ? (
        <SkeletonLines lines={5} />
      ) : isError ? (
        <ErrorState size="chart" error={error} title={t("v2Daily.state.loadError")} onRetry={onRetry} />
      ) : (
        <>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-muted">{t("v2Daily.state.formula")}</span>
            <span
              className={cx(
                "whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] proportional-nums max-md:text-[22px] max-md:leading-[30px]",
                isPositive ? "text-text" : "text-danger-fg",
              )}
            >
              {formatMoneyLocalized(net, { language, withCurrency: false })}
              <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted max-md:text-[13px]">{currency}</span>
            </span>
          </div>
          <Waterfall
            ariaLabel={t("v2Daily.state.aria", {
              net: money(net),
              cash: money(cash),
              receive: money(receive),
              give: money(give),
            })}
            steps={[
              { key: "cash", label: t("v2Daily.state.cash"), value: cash, kind: "start" },
              { key: "receive", label: t("v2Daily.state.receive"), value: receive, kind: "up" },
              { key: "give", label: t("v2Daily.state.give"), value: give, kind: "down" },
              { key: "net", label: t("v2Daily.state.net"), value: net, kind: "total" },
            ]}
          />
          <dl className="m-0 flex flex-col border-t border-border text-sm">
            {[
              { key: "cash", label: t("v2Daily.state.cashFull"), value: money(cash), color: "bg-text-muted", tone: "text-text" },
              { key: "receive", label: t("v2Daily.state.receiveFull"), value: signed(receive), color: "bg-chart-1", tone: "text-text" },
              {
                key: "give",
                label: t("v2Daily.state.giveFull"),
                value: signed(-give),
                color: "bg-chart-8",
                tone: give > 0 ? "text-danger-fg" : "text-text",
              },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
                <dt className="flex min-w-0 items-center gap-2 text-text">
                  <span aria-hidden="true" className={cx("size-2.5 shrink-0 rounded-[3px]", row.color)} />
                  {row.label}
                </dt>
                <dd className={cx("m-0 whitespace-nowrap font-semibold", row.tone)}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </Card>
  );
};

export default memo(CashStateCard);

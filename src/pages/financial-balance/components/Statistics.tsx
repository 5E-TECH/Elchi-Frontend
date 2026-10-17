// dizayn-v2: superadmin-balance-overview, admin-balance-overview
import { memo, useMemo, useState } from "react";
import { Info, Scale, Store, Truck, Wallet, Warehouse, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatPercentLocalized,
} from "../../../shared/lib/formatMoney";
import { Badge, Card, TONE_FG } from "../../../shared/ui/primitives";
import { sharePercent } from "../lib/balanceFormat";
import type { FinancialBalanceData } from "../lib/financialBalance";

interface StatisticsProps {
  data: FinancialBalanceData;
  /** Ma'lumot olingan payt (React Query `dataUpdatedAt`); bo'lmasa — hozir. */
  updatedAt?: number;
}

interface Segment {
  key: string;
  name: string;
  icon: LucideIcon;
  /** Chiziq rangi — `chart-*` tokenlari (tizim-charts). */
  colorClass: string;
  value: number;
  tone?: "danger";
}

/**
 * «Balans tarkibi» (maket `superadmin-balance-overview`): ikki teng chiziq —
 * «Pul qayerda» (kassa + yo'ldagi pul: zanjir va kargo) va «Kimga tegishli» (marketlar qarzi + umumiy balans).
 * Ikkalasining jami bir xil: kassa + yo'ldagi pul = marketlar qarzi + umumiy balans. Umumiy balans manfiy
 * bo'lsa ikkinchi chiziq chizilmaydi (manfiy bo'lakni chiziqqa joylab bo'lmaydi) — o'rnida izoh.
 */
const Statistics = ({ data, updatedAt }: StatisticsProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const compact = (value: number) => formatCompactMoneyLocalized(value, { language });
  const percent = (value: number) => formatPercentLocalized(value, { language });
  // `dataUpdatedAt` bo'lmasa (eski mock, kesh) — karta birinchi chizilgan payt.
  const [shownAt] = useState(() => Date.now());

  const total = data.currentSituation;
  const isNegative = total < 0;
  const marketsDebt = Math.abs(data.markets.marketsTotalBalans);

  const where = useMemo<Segment[]>(() => {
    const cash: Segment = {
      key: "cash",
      name: t("v2Balance.composition.cash"),
      icon: Wallet,
      colorClass: "bg-chart-1",
      value: data.main.balance,
    };
    if (data.chain) {
      return [
        cash,
        {
          key: "chain",
          name: t("v2Balance.composition.chain"),
          icon: Truck,
          colorClass: "bg-chart-2",
          value: data.chain.chainReceivable,
        },
        {
          key: "provider",
          name: t("v2Balance.composition.provider"),
          icon: Warehouse,
          colorClass: "bg-chart-3",
          value: data.chain.providerReceivable,
        },
      ];
    }
    return [
      cash,
      {
        key: "receivable",
        name: t("v2Balance.composition.inTransit"),
        icon: Truck,
        colorClass: "bg-chart-2",
        value: data.receivable,
      },
    ];
  }, [data, t]);

  const owner = useMemo<Segment[]>(
    () => [
      {
        key: "markets",
        name: t("v2Balance.composition.marketsDebt"),
        icon: Store,
        colorClass: "bg-chart-8",
        value: -marketsDebt,
        tone: "danger",
      },
      // `--chart-total` tokeni ilovada yo'q (CODE-MAP 0.1) — jami rangi `text-muted`.
      { key: "total", name: t("v2Balance.composition.total"), icon: Scale, colorClass: "bg-text-muted", value: total },
    ],
    [marketsDebt, t, total],
  );

  const whereTotal = where.reduce((sum, segment) => sum + segment.value, 0);
  const whereBase = where.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const ownerBase = marketsDebt + Math.max(0, total);
  const time = formatDateTimeLocalized(updatedAt ?? shownAt, { language });

  const segmentAria = (title: string, segments: Segment[], base: number) =>
    `${title}: ${segments
      .map((segment) =>
        t("v2Balance.composition.segment", {
          name: segment.name,
          value: money(segment.value),
          percent: percent(sharePercent(Math.abs(segment.value), base)),
        }),
      )
      .join(", ")}`;

  const renderBlock = (key: string, title: string, sub: string, segments: Segment[], base: number) => (
    <div key={key} className="flex min-w-0 flex-[1_1_340px] flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="m-0 text-sm font-semibold text-text">{title}</h3>
          <span className="text-xs text-text-muted">{sub}</span>
        </div>
        <span className="whitespace-nowrap text-base font-bold text-text">{money(whereTotal)}</span>
      </div>
      <div role="img" aria-label={segmentAria(title, segments, base)} className="flex h-4 min-w-0 gap-0.5">
        {segments.map((segment) =>
          Math.abs(segment.value) > 0 ? (
            <span
              key={segment.key}
              className={cx("block min-w-1 first:rounded-l-[4px] last:rounded-r-[4px]", segment.colorClass)}
              style={{ flex: `${Math.abs(segment.value)} 1 0` }}
            />
          ) : null,
        )}
      </div>
      <ul className="m-0 flex w-full min-w-0 list-none flex-col p-0">
        {segments.map((segment) => {
          const Icon = segment.icon;
          return (
            <li
              key={segment.key}
              className="grid min-h-10 grid-cols-[12px_minmax(0,1fr)_auto_52px] items-center gap-2.5 border-t border-border py-1.5 text-sm text-text first:border-t-0"
            >
              <span aria-hidden="true" className={cx("size-3 rounded-[3px]", segment.colorClass)} />
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                <Icon aria-hidden="true" size={16} className="shrink-0 text-text-subtle" />
                <span className="truncate">{segment.name}</span>
              </span>
              <span
                className={cx(
                  "whitespace-nowrap text-right font-bold",
                  segment.tone === "danger" ? TONE_FG.danger : "text-text",
                )}
              >
                <span className="max-md:hidden">{money(segment.value)}</span>
                <span className="md:hidden">{compact(segment.value)}</span>
              </span>
              <span className="whitespace-nowrap text-right text-[13px] text-text-muted">
                {percent(sharePercent(Math.abs(segment.value), base))}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <Card
      divided={false}
      title={t("v2Balance.composition.title")}
      description={t("v2Balance.composition.subtitle", { time })}
      actions={
        <Badge tone={isNegative ? "danger" : "success"} dot>
          {isNegative ? t("v2Balance.composition.negative") : t("v2Balance.composition.positive")}
        </Badge>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-10 gap-y-6">
          {renderBlock("where", t("v2Balance.composition.where"), t("v2Balance.composition.whereSub"), where, whereBase)}
          {isNegative ? (
            <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="m-0 text-sm font-semibold text-text">{t("v2Balance.composition.owner")}</h3>
                <span className="text-xs text-text-muted">{t("v2Balance.composition.ownerSub")}</span>
              </div>
              <p className="m-0 flex items-start gap-2 text-[13px] text-text-muted">
                <Info aria-hidden="true" size={16} className="mt-px shrink-0" />
                <span>{t("v2Balance.composition.debtExceeds")}</span>
              </p>
            </div>
          ) : (
            renderBlock("owner", t("v2Balance.composition.owner"), t("v2Balance.composition.ownerSub"), owner, ownerBase)
          )}
        </div>
        <p className="m-0 flex items-start gap-2 text-xs leading-[18px] text-text-subtle">
          <Info aria-hidden="true" size={16} className="mt-px shrink-0" />
          <span>{t("v2Balance.composition.note", { total: money(whereTotal) })}</span>
        </p>
      </div>
    </Card>
  );
};

export default memo(Statistics);

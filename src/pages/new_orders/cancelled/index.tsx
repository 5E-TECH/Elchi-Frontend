// dizayn-v2: superadmin-neworders-cancelled-markets, admin-neworders-cancelled, registrator-new-orders-cancelled
import { memo, useCallback, useMemo, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useOrders } from "../../../entities/orders";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { EmptyState } from "../../../shared/ui/primitives";
import type { TodayMarketsTotals } from "../model/todayMarkets";
import { SourceListCard, type SourceListRow } from "../ui/SourceListCard";
import { extractCancelledMarkets } from "./utils";

const STRONG = <strong className="font-semibold text-text" />;

/**
 * «QABUL VA YARATISH» → «Bekor qilinganlar» (`/new-orders/cancelled`; superadmin, admin, HQ registratori).
 *
 * Bekor qilingan (HQ omboriga qaytgan) buyurtmasi bor marketlar — `SourceListCard` (qobiq tablari, qidiruv +
 * xulosa «9 ta market · 21 ta bekor qilingan buyurtma · jami …», jadval / telefonda kartalar). Qator →
 * `/new-orders/cancelled/:marketId` (marketga topshirish).
 *
 * Qidiruv mijoz tomonida: `GET orders/markets/cancelled` qidiruv parametrini qabul qilmaydi (openapi'da yo'q,
 * gateway e'tiborsiz qoldiradi) — v1 dagi `?search=` hech narsani filtrlamasdi. So'rov parametrsiz: kalit
 * tabdagi son bilan bir xil (`useNewOrdersTabs`), kesh umumiy.
 */
const CancelledMarkets = () => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { useCancelledMarkets } = useOrders();
  const query = useCancelledMarkets();

  const rows = useMemo<SourceListRow[]>(
    () =>
      extractCancelledMarkets(query.data).map((row) => ({
        id: row.market_id,
        name: row.name,
        phone_number: row.phone_number === "—" ? "" : row.phone_number,
        orders_count: row.orders_count,
        total_price_sum: row.total_price_sum,
      })),
    [query.data],
  );

  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);

  const summaryPart = useCallback(
    (key: string, value: number, extra?: Record<string, unknown>): ReactNode => (
      <span className="whitespace-nowrap">
        <Trans
          t={t}
          i18nKey={key}
          count={extra ? undefined : value}
          values={extra ?? { value: count(value) }}
          components={{ strong: STRONG }}
        />
      </span>
    ),
    [count, t],
  );

  const summary = useCallback(
    (totals: TodayMarketsTotals) => (
      <p className="text-[13px] leading-[18px] text-text-muted">
        {summaryPart("markets.summaryMarkets", totals.markets)}
        {" · "}
        {summaryPart("cancelled.markets.summaryOrders", totals.orders)}
        {" · "}
        {summaryPart("markets.summaryTotal", totals.amount, {
          amount: formatMoneyLocalized(totals.amount, { language }),
        })}
      </p>
    ),
    [language, summaryPart],
  );

  return (
    <SourceListCard
      rows={rows}
      query={query}
      ariaLabel={t("cancelled.markets.cardLabel")}
      searchPlaceholder={t("markets.searchPlaceholder")}
      searchLabel={t("markets.searchLabel")}
      listLabel={t("markets.listLabel")}
      loadingLabel={t("markets.loading")}
      columns={{
        name: t("markets.columns.market"),
        phone: t("markets.columns.phone"),
        count: t("markets.columns.orders"),
        amount: t("markets.columns.amount"),
        actions: t("markets.columns.actions"),
      }}
      sortTitles={{
        name: t("markets.sortByName"),
        count: t("markets.sortByOrders"),
        amount: t("markets.sortByAmount"),
      }}
      countCell={(value) => t("markets.ordersCell", { value: count(value) })}
      cardSub={(row) =>
        `${formatPhone(row.phone_number) || "—"} · ${t("markets.ordersSub", {
          count: row.orders_count,
          value: count(row.orders_count),
        })}`
      }
      openLabel={(row) => t("cancelled.markets.open", { name: row.name })}
      hrefOf={(row) => `/new-orders/cancelled/${row.id}`}
      summary={summary}
      empty={
        <EmptyState
          icon={RotateCcw}
          title={t("cancelled.markets.emptyTitle")}
          description={t("cancelled.markets.emptyDescription")}
        />
      }
      noMatch={{
        title: t("markets.noMatchTitle"),
        description: t("markets.noMatchDescription"),
        clear: t("markets.clearSearch"),
      }}
    />
  );
};

export default memo(CancelledMarkets);

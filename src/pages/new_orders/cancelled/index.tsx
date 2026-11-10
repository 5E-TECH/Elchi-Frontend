// dizayn-v2: superadmin-neworders-cancelled-markets, admin-neworders-cancelled, registrator-new-orders-cancelled
import { memo, useCallback, useMemo, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useOrders } from "../../../entities/orders";
import { useCancelledHandovers } from "../../../entities/orders/cancelledHandovers";
import { cx } from "../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { EmptyState, SegmentedControl } from "../../../shared/ui/primitives";
import type { TodayMarketsTotals } from "../model/todayMarkets";
import { SourceListCard, type SourceListRow } from "../ui/SourceListCard";
import { CANCELLED_TAB_PARAM, readCancelledTab, useHandedFilters, type CancelledTab } from "./handedModel";
import { HandoverBatches } from "./ui/HandoverBatches";
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
 *
 * Ichki tablar (2026-11-10, BeePost «Market kutilmoqda» kabi) — butun enni ikkiga bo'luvchi katta segment:
 *  - «Kutilmoqda» — yuqoridagi marketlar ro'yxati (HQ'da turgan, hali marketga berilmagan bekorlar);
 *  - «Topshirilgan» (`?tab=handed`) — har «Marketga jo'natish» bitta karta (`HandoverBatches`).
 * Tab sonlari: marketlar soni va joriy filtr (sukut — joriy oy) bo'yicha topshirishlar soni.
 */
const CancelledMarkets = () => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { useCancelledMarkets } = useOrders();
  const query = useCancelledMarkets();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = readCancelledTab(searchParams);
  const handedFilters = useHandedFilters();
  const handedQuery = useCancelledHandovers(handedFilters.params);

  const setTab = useCallback(
    (next: CancelledTab) =>
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === "handed") params.set(CANCELLED_TAB_PARAM, "handed");
          else params.delete(CANCELLED_TAB_PARAM);
          return params;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

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

  const tabLabel = (label: string, value: number | null, active: boolean) => (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2.5 max-md:gap-1.5">
      <span className="truncate">{label}</span>
      {value === null ? null : (
        <span
          className={cx(
            "inline-flex h-6 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-[13px] font-bold tabular-nums",
            active ? "bg-action-soft text-action-fg" : "bg-border text-text-muted",
          )}
        >
          {count(value)}
        </span>
      )}
    </span>
  );

  const pendingCount = query.status === "success" ? rows.length : null;
  const handedCount = handedQuery.status === "success" ? handedQuery.data.totals.batches : null;

  const tabs = (
    <div className="px-5 pt-4 max-md:px-4">
      <SegmentedControl<CancelledTab>
        ariaLabel={t("cancelled.tabs.label")}
        size="lg"
        fullWidth
        value={tab}
        onValueChange={setTab}
        options={[
          { value: "pending", label: tabLabel(t("cancelled.tabs.pending"), pendingCount, tab === "pending") },
          { value: "handed", label: tabLabel(t("cancelled.tabs.handed"), handedCount, tab === "handed") },
        ]}
      />
    </div>
  );

  // Karta har ikki tabda bitta (`SourceListCard`): faqat tablar ostidagi qism almashadi — tanlangan radio fokusda
  // qoladi (← → bilan almashtirish), «Kutilmoqda» qidiruvi saqlanadi.
  return (
    <SourceListCard
      subheader={tabs}
      body={tab === "handed" ? <HandoverBatches query={handedQuery} filters={handedFilters} /> : undefined}
      rows={rows}
      query={query}
      ariaLabel={t(tab === "handed" ? "cancelled.handed.cardLabel" : "cancelled.markets.cardLabel")}
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

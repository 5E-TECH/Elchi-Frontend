// dizayn-v2: market-new-orders-cancelled, market-new-orders-cancelled-transit, market-new-orders-cancelled-received
import { useCallback, useMemo, useState } from "react";
import { PackageCheck, RotateCcw } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import {
  OrderStatusBadge,
  formatOrderRef,
  resolveCancelReturnPlace,
  useCancelReturnPlaceText,
} from "../../../../entities/order";
import type { OrderListItem } from "../../../../entities/order/types/order";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import {
  DataTable,
  DateRange,
  EmptyState,
  Pagination,
  Pressable,
  QueryBoundary,
  type DataTableColumn,
  type QueryLike,
} from "../../../../shared/ui/primitives";

import {
  readOrderDistrict,
  readOrderRegion,
  readProductLines,
  sumTotalPrice,
} from "../../components/marketOrders/marketOrdersModel";
import { toOrderCardData } from "../cancelledModel";
import type { MarketReturnsRange, MarketReturnsView } from "../useMarketReturns";
import { MARKET_RETURNS_VIEWS } from "../useMarketReturns";

/** `.el-chip` (`aria-pressed`) — CODE-MAP 2.2; ichida `.el-tab-count` (faol chipda — `surface` + `action-fg`). */
const CHIP =
  "group inline-flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-3 " +
  "text-[13px] font-medium text-text transition-[background-color,border-color,color,box-shadow] duration-150 " +
  "motion-reduce:transition-none hover:border-text-subtle aria-pressed:border-action aria-pressed:bg-action-soft " +
  "aria-pressed:font-semibold aria-pressed:text-action-fg max-md:h-11";
const COUNT =
  "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-sunken px-1.5 text-xs font-semibold " +
  "text-text-muted group-aria-pressed:bg-surface group-aria-pressed:text-action-fg";

const PAGE_SIZE = 25;

type ChipsProps = {
  value: MarketReturnsView;
  /** Tab sonlari; `null` — hali kelmagan (son chizilmaydi). */
  counts: Record<MarketReturnsView, number | null>;
  onChange: (view: MarketReturnsView) => void;
};

/** «Olib ketishga tayyor N · Yo'lda N · Olganlarim N» (maket — bosqich chiplari; telefonda qator suriladi). */
export const MarketReturnsChips = ({ value, counts, onChange }: ChipsProps) => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  return (
    <div className="flex min-w-0 px-4 pt-4">
      <div
        role="group"
        aria-label={t("cancelled.returns.tabsLabel")}
        data-testid="market-returns-tabs"
        className="flex min-w-0 max-w-full gap-2 max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
      >
        {MARKET_RETURNS_VIEWS.map((view) => {
          const count = counts[view];
          return (
            <Pressable
              key={view}
              aria-pressed={value === view}
              data-view={view}
              className={CHIP}
              onClick={() => onChange(view)}
            >
              {t(`cancelled.returns.${view}`)}
              {count !== null ? <span className={COUNT}>{formatNumberLocalized(count, { language })}</span> : null}
            </Pressable>
          );
        })}
      </div>
    </div>
  );
};

type PanelProps = {
  view: Exclude<MarketReturnsView, "ready">;
  query: QueryLike<unknown>;
  rows: readonly OrderListItem[];
  truncated: boolean;
  /** Faqat «Olganlarim» — topshirish sanasi oralig'i. */
  range?: MarketReturnsRange;
  onRangeChange?: (range: MarketReturnsRange) => void;
};

/**
 * «Yo'lda» (maket `market-new-orders-cancelled-transit`: Buyurtma · Mijoz · Tuman / viloyat · Qayerda · Mahsulotlar ·
 * Summa) va «Olganlarim» (`…-received`: Buyurtma · Mijoz · Olingan · Joy va usul · Summa + sana oralig'i). Maketdagi
 * «Topshirgan xodim» ustuni yo'q — backend xodim nomini bermaydi (faqat `market_handover_by` id). Ro'yxat ≤ 5000 —
 * sahifalash brauzerda.
 */
export const MarketReturnsPanel = ({ view, query, rows, truncated, range, onRangeChange }: PanelProps) => {
  const { t, i18n } = useTranslation(["newOrders", "orders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const placeText = useCancelReturnPlaceText();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const isTransit = view === "transit";

  const money = useCallback((value: unknown) => formatMoneyLocalized(value, { language }), [language]);
  const number = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);
  const dateTime = useCallback(
    (value: unknown) => (value ? formatDateTimeLocalized(value as string, { language }) : "—"),
    [language],
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, pageSize, rows],
  );

  const marketPlace = useCallback(
    (order: OrderListItem) => placeText(resolveCancelReturnPlace(order, "market")),
    [placeText],
  );
  const productsText = useCallback(
    (order: OrderListItem) =>
      readProductLines(toOrderCardData(order))
        .map((line) => `${line.name} · ${t("marketOrders.itemsQty", { value: number(line.quantity) })}`)
        .join(", "),
    [number, t],
  );

  const columns = useMemo<DataTableColumn<OrderListItem>[]>(() => {
    const orderRef: DataTableColumn<OrderListItem> = {
      id: "order",
      header: t("cancelled.table.columns.order"),
      cell: (order) => (
        <>
          <div className="whitespace-nowrap font-semibold text-text">{formatOrderRef(order)}</div>
          <div className="whitespace-nowrap text-[13px] text-text-muted">
            {isTransit ? dateTime(order.createdAt) : (readOrderDistrict(toOrderCardData(order)) ?? "—")}
          </div>
        </>
      ),
    };
    const amount: DataTableColumn<OrderListItem> = {
      id: "amount",
      header: t("cancelled.table.columns.amount"),
      align: "end",
      cell: (order) => <span className="font-semibold text-text">{money(order.total_price)}</span>,
    };
    if (isTransit) {
      return [
        orderRef,
        {
          id: "customer",
          header: t("cancelled.table.columns.customer"),
          cell: (order) => (
            <>
              <div className="whitespace-nowrap font-semibold text-text">{order.customer?.name ?? "—"}</div>
              <div className="whitespace-nowrap text-[13px] text-text-muted">
                {formatPhone(order.customer?.phone_number) || "—"}
              </div>
            </>
          ),
        },
        {
          id: "location",
          header: t("cancelled.table.columns.location"),
          hideBelow: "lg",
          cell: (order) => {
            const view = toOrderCardData(order);
            return (
              <>
                <div className="whitespace-nowrap">{readOrderDistrict(view) ?? "—"}</div>
                {readOrderRegion(view) ? (
                  <div className="whitespace-nowrap text-[13px] text-text-muted">{readOrderRegion(view)}</div>
                ) : null}
              </>
            );
          },
        },
        {
          id: "where",
          header: t("cancelled.returns.columns.where"),
          cell: (order) => <OrderStatusBadge status={order.status} order={order} withPlace />,
        },
        {
          id: "products",
          header: t("cancelled.table.columns.products"),
          hideBelow: "lg",
          cell: (order) => <span className="text-[13px]">{productsText(order) || "—"}</span>,
        },
        amount,
      ];
    }
    return [
      orderRef,
      {
        id: "customer",
        header: t("cancelled.table.columns.customer"),
        cell: (order) => <span className="whitespace-nowrap font-semibold text-text">{order.customer?.name ?? "—"}</span>,
      },
      {
        id: "receivedAt",
        header: t("cancelled.returns.columns.receivedAt"),
        cell: (order) => <span className="whitespace-nowrap">{marketPlace(order)?.time ?? "—"}</span>,
      },
      {
        id: "placeMethod",
        header: t("cancelled.returns.columns.placeMethod"),
        cell: (order) => {
          const place = marketPlace(order);
          return (
            <>
              <div className="whitespace-nowrap">{place?.name ?? "—"}</div>
              {place?.method ? (
                <div className="whitespace-nowrap text-[13px] text-text-muted">{place.method}</div>
              ) : null}
            </>
          );
        },
      },
      amount,
    ];
  }, [dateTime, isTransit, marketPlace, money, productsText, t]);

  const renderCard = useCallback(
    (order: OrderListItem) => {
      const district = readOrderDistrict(toOrderCardData(order));
      const place = isTransit ? null : marketPlace(order);
      return (
        <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
          <span className="flex min-w-0 justify-between gap-2">
            <span className="min-w-0 font-semibold text-text">{order.customer?.name ?? "—"}</span>
            <span className="whitespace-nowrap font-semibold text-text">{money(order.total_price)}</span>
          </span>
          <span className="text-[13px] text-text-muted">
            {formatOrderRef(order)}
            {district ? ` · ${district}` : null}
            {isTransit ? (
              <>
                {" · "}
                <span className="whitespace-nowrap">{dateTime(order.createdAt)}</span>
              </>
            ) : null}
          </span>
          {isTransit ? (
            <OrderStatusBadge status={order.status} order={order} withPlace />
          ) : (
            <>
              <span className="text-[13px] text-text">
                {[place?.name, place?.time].filter(Boolean).join(" · ") || "—"}
              </span>
              {place?.method ? <span className="text-[13px] text-text-muted">{place.method}</span> : null}
            </>
          )}
        </div>
      );
    },
    [dateTime, isTransit, marketPlace, money],
  );

  const titleKey = isTransit ? "cancelled.returns.transitTitle" : "cancelled.returns.receivedTitle";
  const isLoaded = query.data !== undefined;
  const listQuery = { ...query, data: isLoaded ? rows : undefined };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pt-4 pb-4 max-md:px-4">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-text">{t(titleKey)}</h3>
          {isTransit ? <p className="text-[13px] text-text-muted">{t("cancelled.returns.transitHint")}</p> : null}
          {!isTransit && isLoaded && rows.length > 0 ? (
            <Summary count={rows.length} sum={money(sumTotalPrice(rows.map(toOrderCardData)))} />
          ) : null}
        </div>
        {isTransit && isLoaded && rows.length > 0 ? (
          <Summary count={rows.length} sum={money(sumTotalPrice(rows.map(toOrderCardData)))} />
        ) : null}
        {!isTransit && range && onRangeChange ? (
          <DateRange
            value={range}
            onChange={(next) => {
              setPage(1);
              onRangeChange({ from: next.from, to: next.to });
            }}
            aria-label={t("cancelled.returns.rangeLabel")}
            className="w-full max-w-[260px] max-md:max-w-none"
          />
        ) : null}
      </div>
      {truncated ? (
        <p role="note" className="mx-5 mb-3 rounded-xl bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning-fg max-md:mx-4">
          {t("cancelled.returns.truncated")}
        </p>
      ) : null}
      <QueryBoundary
        query={listQuery}
        skeleton="table"
        loadingLabel={t("cancelled.table.loading")}
        empty={
          <EmptyState
            icon={isTransit ? RotateCcw : PackageCheck}
            title={t(isTransit ? "cancelled.returns.transitEmptyTitle" : "cancelled.returns.receivedEmptyTitle")}
            description={t(
              isTransit ? "cancelled.returns.transitEmptyDescription" : "cancelled.returns.receivedEmptyDescription",
            )}
          />
        }
        className="border-t border-border"
      >
        {(_list, { isRefetching }) => (
          <div data-testid={`market-returns-${view}`}>
            <DataTable
              rows={pageRows}
              columns={columns}
              getRowKey={(order) => String(order.id)}
              label={t(titleKey)}
              density="tablet-tight"
              renderCard={renderCard}
              busy={isRefetching}
            />
            {rows.length > pageSize ? (
              <div className="border-t border-border px-5 py-3 max-md:px-4">
                <Pagination
                  page={currentPage}
                  pageSize={pageSize}
                  total={rows.length}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  summary={(r) => t("orders:paginationSummary", r)}
                />
              </div>
            ) : null}
          </div>
        )}
      </QueryBoundary>
    </>
  );
};

const Summary = ({ count, sum }: { count: number; sum: string }) => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  return (
    <p className="text-[13px] text-text-muted">
      <span className="whitespace-nowrap">
        <Trans
          t={t}
          i18nKey="cancelled.returns.summary"
          count={count}
          values={{ value: formatNumberLocalized(count, { language }) }}
          components={{ strong: <strong className="font-semibold text-text" /> }}
        />
      </span>
      {" · "}
      <span className="whitespace-nowrap">
        <Trans
          t={t}
          i18nKey="cancelled.market.summaryTotal"
          values={{ sum }}
          components={{ strong: <strong className="font-semibold text-text" /> }}
        />
      </span>
    </p>
  );
};

// dizayn-v2: superadmin-neworders-markets, admin-neworders-markets, manager-new-orders-markets, registrator-new-orders-markets
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronRight, Inbox, SearchX } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { useOrders } from "../../../entities/orders";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  QueryBoundary,
  Skeleton,
  SkeletonTable,
  TextInput,
  type DataTableColumn,
  type DataTableSort,
} from "../../../shared/ui/primitives";
import {
  extractTodayMarkets,
  filterTodayMarkets,
  sortTodayMarkets,
  sumTodayMarkets,
  type TodayMarketRow,
} from "../model/todayMarkets";
import NewOrdersTabs from "../ui/NewOrdersTabs";

/** Maketdagidek: buyurtmasi ko'p market tepada (`aria-sort="descending"`). */
const DEFAULT_SORT: DataTableSort = { key: "orders", direction: "desc" };

/**
 * Qatordagi «ochish» havolasi — `IconButton size="sm"` (ghost) ko'rinishida, lekin `<a>`: route'ga olib boradi
 * (yangi oynada ham ochiladi). Telefonda 44 px (jadval telefonda kartaga aylanadi, bu yerda faqat moslik uchun).
 */
const ICON_LINK =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-text-muted " +
  "transition-[background-color,border-color,color,box-shadow] duration-150 hover:bg-sunken hover:text-text " +
  "motion-reduce:transition-none max-md:size-11";

const STRONG = <strong className="font-semibold text-text" />;

/**
 * «QABUL VA YARATISH» → «Marketlar» (`/new-orders`, xodimlar uchun).
 *
 * Bugun qabul kutayotgan buyurtmasi bor marketlar: kartaning boshida qobiq tablari (`NewOrdersTabs`), ostida
 * qidiruv + kunlik xulosa, jadval (telefonda — kartalar ro'yxati). Qobiqqa kiradigan har xodimda tablar kamida
 * ikkita («Marketlar · Kiruvchi posilkalar», maket `manager-new-orders-markets`).
 * Qidiruv va saralash mijoz tomonida (ro'yxat to'liq keladi). Market roli o'z buyurtmalariga yo'naltiriladi.
 */
const Markets = () => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const role = useSelector((state: RootState) => state.role.role);
  const marketId = useSelector((state: RootState) => state.role.id);
  const isMarketRole = role === "market";
  // Maketlarda matn rolga qarab: superadmin/admin — xulosa «Bugun:» siz, havola «{nom} ni ochish»;
  // menejer va registrator (har filial turida) — «Bugun: …» va «{nom} buyurtmalarini ochish».
  const isAdmin = role === "superadmin" || role === "admin";
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<DataTableSort | null>(DEFAULT_SORT);

  useEffect(() => {
    if (!isMarketRole || !marketId) return;
    navigate(`/new-orders/${marketId}`, { replace: true });
  }, [isMarketRole, marketId, navigate]);

  const { useGetTodayOrders } = useOrders();
  // Kalit tab sonidagi bilan bir xil (`NewOrdersTabs`) — kesh umumiy.
  const query = useGetTodayOrders(undefined, !isMarketRole);

  const allRows = useMemo(() => extractTodayMarkets(query.data), [query.data]);
  // Xulosa — kunlik jami (qidiruvdan qat'i nazar: «Bugun: …»), v1 dagi uchta StatCard o'rnida.
  const totals = useMemo(() => sumTodayMarkets(allRows), [allRows]);
  const rows = useMemo(
    () => sortTodayMarkets(filterTodayMarkets(allRows, search), sort, language),
    [allRows, language, search, sort],
  );

  const money = useCallback((value: number) => formatMoneyLocalized(value, { language }), [language]);
  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);
  const marketHref = (row: TodayMarketRow) => `/new-orders/${row.market_id}`;

  const columns = useMemo<DataTableColumn<TodayMarketRow>[]>(
    () => [
      {
        id: "name",
        header: t("markets.columns.market"),
        sortable: true,
        sortTitle: t("markets.sortByName"),
        className: "w-[30%]",
        cell: (row) => (
          <Link
            to={`/new-orders/${row.market_id}`}
            className="font-semibold text-text hover:text-action-fg hover:underline"
          >
            {row.name}
          </Link>
        ),
      },
      {
        id: "phone",
        header: t("markets.columns.phone"),
        className: "w-[22%] whitespace-nowrap",
        cell: (row) => formatPhone(row.phone_number) || "—",
      },
      {
        id: "orders",
        header: t("markets.columns.orders"),
        align: "end",
        sortable: true,
        firstDirection: "desc",
        sortTitle: t("markets.sortByOrders"),
        className: "w-[16%]",
        cell: (row) => t("markets.ordersCell", { value: count(row.orders_count) }),
      },
      {
        id: "amount",
        header: t("markets.columns.amount"),
        align: "end",
        sortable: true,
        firstDirection: "desc",
        sortTitle: t("markets.sortByAmount"),
        className: "w-[22%]",
        cell: (row) => <span className="font-semibold text-text">{money(row.total_price_sum)}</span>,
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("markets.columns.actions")}</span>,
        className: "w-14",
        cellClassName: "text-right",
        cell: (row) => {
          const label = t(isAdmin ? "markets.open" : "markets.openOrders", { name: row.name });
          return (
            <Link to={`/new-orders/${row.market_id}`} aria-label={label} title={label} className={ICON_LINK}>
              <ChevronRight aria-hidden="true" size={16} strokeWidth={2} />
            </Link>
          );
        },
      },
    ],
    [count, isAdmin, money, t],
  );

  const renderCard = useCallback(
    (row: TodayMarketRow) => {
      const phone = formatPhone(row.phone_number) || "—";
      const orders = t("markets.ordersSub", { count: row.orders_count, value: count(row.orders_count) });
      return (
        <Link to={`/new-orders/${row.market_id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm text-text">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 justify-between gap-2">
              <span className="min-w-0 font-semibold">{row.name}</span>
              <span className="whitespace-nowrap font-semibold">{money(row.total_price_sum)}</span>
            </span>
            <span className="text-[13px] text-text-muted">
              {phone} · {orders}
            </span>
          </span>
          <ChevronRight aria-hidden="true" size={18} strokeWidth={2} className="shrink-0 text-text-subtle" />
        </Link>
      );
    },
    [count, money, t],
  );

  if (isMarketRole) {
    // Market o'z «Yangi buyurtmalar» tabiga yo'naltirilmoqda — bir lahza skelet.
    return <SkeletonTable rows={4} columns={3} />;
  }

  const isLoading = query.isLoading;
  const isError = query.isError;

  const summaryPart = (key: string, value: number, extra?: Record<string, unknown>): ReactNode => (
    <span className="whitespace-nowrap">
      <Trans
        t={t}
        i18nKey={key}
        count={extra ? undefined : value}
        values={extra ?? { value: count(value) }}
        components={{ strong: STRONG }}
      />
    </span>
  );

  // Xulosa: yuklanishda skelet, xatoda yo'q (noma'lum son «0» deb yozilmaydi), bo'sh kunda ham yo'q —
  // «Bugun buyurtma yo'q» holati o'zi aytadi.
  const summary =
    query.status === "success" && allRows.length > 0 ? (
      <p className="text-[13px] leading-[18px] text-text-muted">
        {isAdmin ? null : <>{t("markets.summaryToday")} </>}
        {summaryPart("markets.summaryMarkets", totals.markets)}
        {" · "}
        {summaryPart("markets.summaryOrders", totals.orders)}
        {" · "}
        {summaryPart("markets.summaryTotal", totals.amount, { amount: money(totals.amount) })}
      </p>
    ) : isLoading ? (
      <Skeleton width={260} height={14} />
    ) : null;

  const skeletonColumns = [
    t("markets.columns.market"),
    t("markets.columns.phone"),
    t("markets.columns.orders"),
    t("markets.columns.amount"),
  ];

  const empty =
    allRows.length === 0 ? (
      <EmptyState icon={Inbox} title={t("noOrdersToday")} description={t("markets.emptyDescription")} />
    ) : (
      <EmptyState
        icon={SearchX}
        title={t("markets.noMatchTitle")}
        description={t("markets.noMatchDescription")}
        action={
          <Button variant="secondary" onClick={() => setSearch("")}>
            {t("markets.clearSearch")}
          </Button>
        }
      />
    );

  return (
    <Card padding="none" aria-label={t("markets.cardLabel")}>
      <NewOrdersTabs />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
        <TextInput
          mode="search"
          value={search}
          onValueChange={setSearch}
          placeholder={t("markets.searchPlaceholder")}
          aria-label={t("markets.searchLabel")}
          className="max-w-[480px] flex-[1_1_320px]"
        />
        {summary}
      </div>

      <QueryBoundary
        query={{
          data: isLoading || (isError && allRows.length === 0) ? undefined : rows,
          isLoading,
          isError,
          error: query.error,
          refetch: query.refetch,
        }}
        keepPreviousData={false}
        loadingLabel={t("markets.loading")}
        loading={<SkeletonTable framed={false} columns={skeletonColumns} rows={6} />}
        empty={empty}
      >
        {(list, { isRefetching }) => (
          <DataTable
            rows={list}
            columns={columns}
            getRowKey={(row) => row.market_id}
            label={t("markets.listLabel")}
            sort={sort}
            onSortChange={setSort}
            onRowClick={(row) => navigate(marketHref(row))}
            renderCard={renderCard}
            busy={isRefetching}
            className="max-md:border-t max-md:border-border"
          />
        )}
      </QueryBoundary>
    </Card>
  );
};

export default memo(Markets);

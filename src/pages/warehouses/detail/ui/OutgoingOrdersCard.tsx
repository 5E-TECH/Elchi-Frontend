// dizayn-v2: manager-warehouse-detail
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { PackageOpen, SearchX, Truck } from "lucide-react";
import { canViewDispatchPage } from "../../../../app/lib/access";
import { useOrders } from "../../../../entities/order/api/orderApi";
import type { OrderListItem, OrderListParams, OrderStatus } from "../../../../entities/order/types/order";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Pagination,
  Pressable,
  QueryBoundary,
  SkeletonTable,
  TextInput,
  type DataTableColumn,
} from "../../../../shared/ui/primitives";
import { CHIP, CHIP_COUNT } from "../../model/classes";
import { useWarehouseText } from "../../model/useWarehouseText";

/** Backend `GET /orders` qabul qiladigan sahifa hajmlari (`DEFAULT_ALLOWED_LIMITS`). */
const PAGE_SIZES = [10, 25, 50] as const;
const SEARCH_DEBOUNCE_MS = 400;

/**
 * Chiplar (maket): «Barchasi» — filialda turgan («Qabul qilindi») va kuryerdagi («Kutilmoqda») buyurtmalar;
 * «Kuryerga berilmagan» — `received`; «Kuryerda» — `waiting` (`received → waiting` — kuryerga berish).
 */
type Chip = "all" | "pending" | "courier";
const CHIP_STATUSES: Record<Chip, OrderStatus[]> = {
  all: ["received", "waiting"],
  pending: ["received"],
  courier: ["waiting"],
};

const BASE_PARAMS: OrderListParams = { fulfillment_source: "WAREHOUSE" };

/** `GET /orders` javobidagi umumiy son (`total` yoki `meta.total`); bo'lmasa — `null`. */
const totalOf = (payload: unknown): number | null => {
  const response = payload as { total?: unknown; meta?: { total?: unknown }; data?: { total?: unknown } } | undefined;
  const raw = response?.total ?? response?.meta?.total ?? response?.data?.total;
  const total = Number(raw);
  return raw !== undefined && raw !== null && Number.isFinite(total) && total >= 0 ? Math.floor(total) : null;
};

const itemsText = (order: OrderListItem, line: (name: string, qty: number) => string) =>
  (order.items ?? [])
    .map((item) => line(item.product?.name ?? item.product_name ?? `#${item.product_id ?? "?"}`, item.quantity))
    .join(", ");

/**
 * «OMBORDAN KETADIGAN BUYURTMALAR» — filial menejeri ombor tafsilotida (maket `manager-warehouse-detail`; 6kHnNH9j,
 * ega qarori 6 va 10: buyurtma HQ va pochtasiz darhol filialda «qabul qilingan», menejer ko'radi, terib kuryerga
 * beradi). `GET /orders?fulfillment_source=WAREHOUSE&status=…` — backend menejer ro'yxatini o'z filialiga cheklaydi
 * (filialda bitta ombor). Sarlavha yonida «Kuryerga biriktirish» (`/dispatch`, `canViewDispatchPage`); qidiruv
 * (raqam, mijoz, telefon — `search`), chiplar «Barchasi · Kuryerga berilmagan · Kuryerda» (sonlari — alohida
 * `limit=10` so'rovlar `total` i); jadval «№ · Mijoz · Mahsulot · Tuman · Yaratilgan · Holat» (planshetda tuman va
 * sana yashirin), telefonda kartalar; pastda «N ta buyurtma · N tasi kuryerga berilmagan» yoki sahifalash.
 * Maketdagi kuryer qatoridagi vaqt («· 11:20») chizilmagan — ro'yxat javobida kuryerga berilgan vaqt yo'q.
 */
export const OutgoingOrdersCard = () => {
  const text = useWarehouseText();
  const { t } = text;
  const canDispatch = useSelector(canViewDispatchPage);
  const titleId = useId();
  const { useGetOrders } = useOrders();
  const [chip, setChip] = useState<Chip>("all");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(PAGE_SIZES[0]);
  const searchTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  const commitSearch = (value: string) => {
    window.clearTimeout(searchTimer.current);
    const next = value.trim().replace(/^[№#]+\s*/u, "");
    if (next !== search) {
      setSearch(next);
      setPage(1);
    }
  };

  const searchPart = search ? { search } : {};
  const query = useGetOrders({ ...BASE_PARAMS, ...searchPart, status: CHIP_STATUSES[chip], page, limit }, true, undefined, {
    silentError: true,
  });
  // Chip sonlari — qidiruv bilan bir xil doirada, faqat `total` kerak.
  const pendingQuery = useGetOrders({ ...BASE_PARAMS, ...searchPart, status: CHIP_STATUSES.pending, page: 1, limit: 10 }, true, undefined, {
    silentError: true,
  });
  const courierQuery = useGetOrders({ ...BASE_PARAMS, ...searchPart, status: CHIP_STATUSES.courier, page: 1, limit: 10 }, true, undefined, {
    silentError: true,
  });
  const pendingTotal = totalOf(pendingQuery.data);
  const courierTotal = totalOf(courierQuery.data);
  const counts: Record<Chip, number | null> = {
    all: pendingTotal !== null && courierTotal !== null ? pendingTotal + courierTotal : null,
    pending: pendingTotal,
    courier: courierTotal,
  };

  const rows = useMemo(() => query.data?.data ?? [], [query.data?.data]);
  const total = totalOf(query.data) ?? rows.length;
  const filtersActive = Boolean(search) || chip !== "all";

  const statusBadge = (order: OrderListItem) =>
    order.status === "waiting" ? (
      <Badge tone="success" dot>
        {t("outgoing.chips.courier")}
      </Badge>
    ) : (
      <Badge tone="warning" dot>
        {t("outgoing.chips.pending")}
      </Badge>
    );
  const itemLine = (name: string, qty: number) => t("outgoing.itemLine", { name, qty: text.number(qty) });
  const orderHref = (order: OrderListItem) => `/orders/edit/${encodeURIComponent(order.id)}`;

  const columns: DataTableColumn<OrderListItem>[] = [
    {
      id: "id",
      header: t("outgoing.columns.id"),
      cellClassName: "whitespace-nowrap",
      cell: (order) => (
        <Link to={orderHref(order)} className="font-semibold text-text hover:text-action-fg">
          {t("outgoing.orderNumber", { id: order.id })}
        </Link>
      ),
    },
    {
      id: "customer",
      header: t("outgoing.columns.customer"),
      cell: (order) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="whitespace-nowrap text-text">{order.customer?.name ?? "—"}</span>
          {order.customer?.phone_number ? (
            <span className="whitespace-nowrap text-[13px] text-text-muted tabular-nums">
              {formatPhone(order.customer.phone_number)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "product",
      header: t("outgoing.columns.product"),
      cell: (order) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-text">{itemsText(order, itemLine) || "—"}</span>
          {order.market?.name ? <span className="text-[13px] text-text-muted">{order.market.name}</span> : null}
        </span>
      ),
    },
    {
      id: "district",
      header: t("outgoing.columns.district"),
      hideBelow: "lg",
      cellClassName: "whitespace-nowrap",
      cell: (order) => order.district?.name ?? "—",
    },
    {
      id: "created",
      header: t("outgoing.columns.created"),
      hideBelow: "lg",
      cellClassName: "whitespace-nowrap text-text-muted",
      cell: (order) => text.dateTime(order.createdAt),
    },
    {
      id: "status",
      header: t("outgoing.columns.status"),
      cell: (order) => (
        <span className="flex flex-col items-start gap-1">
          {statusBadge(order)}
          {order.status === "waiting" && order.courier?.name ? (
            <span className="whitespace-nowrap text-[13px] text-text-muted">{order.courier.name}</span>
          ) : null}
        </span>
      ),
    },
  ];

  const renderCard = (order: OrderListItem) => (
    <Link to={orderHref(order)} className="flex min-w-0 flex-col gap-1.5 px-4 py-3 text-text">
      <span className="flex items-start justify-between gap-2">
        <span className="font-semibold">{t("outgoing.orderNumber", { id: order.id })}</span>
        {statusBadge(order)}
      </span>
      <span className="text-sm">{itemsText(order, itemLine) || "—"}</span>
      <span className="text-[13px] text-text-muted">
        {[order.customer?.name, order.customer?.phone_number ? formatPhone(order.customer.phone_number) : null, order.district?.name]
          .filter(Boolean)
          .join(" · ")}
      </span>
      <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-text-muted">
        <span>{order.market?.name ?? ""}</span>
        <span className="whitespace-nowrap">
          {order.status === "waiting" && order.courier?.name
            ? t("outgoing.courierLine", { name: order.courier.name })
            : text.dateTime(order.createdAt)}
        </span>
      </span>
    </Link>
  );

  const footer =
    query.data && total > 0 ? (
      total > limit ? (
        <Pagination
          page={page}
          pageSize={limit}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
          pageSizeOptions={PAGE_SIZES}
          disabled={query.isFetching}
          summary={(range) => t("outgoing.pagination", range)}
        />
      ) : (
        <span className="text-[13px] text-text-muted">
          {pendingTotal !== null && chip === "all"
            ? t("outgoing.footer", {
                total: t("outgoing.count", { count: total, value: text.number(total) }),
                pending: t("outgoing.pendingCount", { count: pendingTotal, value: text.number(pendingTotal) }),
              })
            : t("outgoing.count", { count: total, value: text.number(total) })}
        </span>
      )
    ) : undefined;

  const chips: { value: Chip; label: string }[] = [
    { value: "all", label: t("outgoing.chips.all") },
    { value: "pending", label: t("outgoing.chips.pending") },
    { value: "courier", label: t("outgoing.chips.courier") },
  ];

  const clearFilters = () => {
    window.clearTimeout(searchTimer.current);
    setSearchText("");
    setSearch("");
    setChip("all");
    setPage(1);
  };

  return (
    <Card padding="none" aria-labelledby={titleId} footer={footer}>
      {/* `.el-card-head` maketdagidek: sarlavha bloki `flex: 1 1 320px` — telefonda «Kuryerga biriktirish» pastga o'tadi
          (`Card title/actions` sarlavhani tor ustunga siqardi). */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-4">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
          <h2 id={titleId} className="text-base font-bold text-text">
            {t("outgoing.title")}
          </h2>
          <p className="text-[13px] leading-[18px] text-text-muted">{t("outgoing.description")}</p>
        </div>
        {canDispatch ? (
          <Link to="/dispatch" className={buttonClasses({ variant: "secondary", size: "sm", className: "flex-none" })}>
            <Truck size={16} aria-hidden="true" />
            {t("outgoing.assign")}
          </Link>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 max-md:px-4">
        <TextInput
          mode="search"
          value={searchText}
          onValueChange={(value) => {
            setSearchText(value);
            window.clearTimeout(searchTimer.current);
            searchTimer.current = window.setTimeout(() => commitSearch(value), SEARCH_DEBOUNCE_MS);
          }}
          onClear={() => commitSearch("")}
          onSearch={commitSearch}
          placeholder={t("outgoing.searchPlaceholder")}
          aria-label={t("outgoing.searchLabel")}
          className="min-w-0 flex-[6_1_260px]"
        />
        <div role="group" aria-label={t("outgoing.filtersLabel")} className="flex flex-[0_1_auto] flex-wrap gap-2">
          {chips.map((item) => (
            <Pressable
              key={item.value}
              aria-pressed={chip === item.value}
              className={CHIP}
              onClick={() => {
                setChip(item.value);
                setPage(1);
              }}
            >
              {item.label}
              {counts[item.value] !== null ? (
                <span className={CHIP_COUNT}>{text.number(counts[item.value] as number)}</span>
              ) : null}
            </Pressable>
          ))}
        </div>
      </div>
      <QueryBoundary
        query={{ ...query, data: query.data ? rows : undefined }}
        loadingLabel={t("outgoing.loading")}
        loading={
          <SkeletonTable
            framed={false}
            columns={[t("outgoing.columns.id"), t("outgoing.columns.customer"), t("outgoing.columns.status")]}
            rows={3}
          />
        }
        empty={
          filtersActive ? (
            <EmptyState
              icon={SearchX}
              title={t("outgoing.notFoundTitle")}
              description={t("outgoing.notFoundDescription")}
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  {t("outgoing.clearFilters")}
                </Button>
              }
            />
          ) : (
            <EmptyState icon={PackageOpen} title={t("outgoing.emptyTitle")} description={t("outgoing.emptyDescription")} />
          )
        }
        error={(error, retry) => <ErrorState error={error} title={t("outgoing.loadFailed")} onRetry={retry} />}
      >
        {(list) => (
          <DataTable
            rows={list}
            columns={columns}
            getRowKey={(order) => order.id}
            label={t("outgoing.tableLabel")}
            cardsLabel={t("outgoing.tableLabel")}
            renderCard={renderCard}
            busy={query.isFetching && query.isPlaceholderData}
            className="border-t border-border"
          />
        )}
      </QueryBoundary>
    </Card>
  );
};

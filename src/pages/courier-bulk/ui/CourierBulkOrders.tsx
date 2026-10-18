// dizayn-v2: courier-courier-bulk-main, manager-courier-bulk-main
import { useMemo, useState, type ReactNode } from "react";
import { Inbox, RotateCcw, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { getBackendErrorMessage } from "../../scan/lib/scanResource";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  QueryBoundary,
  Select,
  SkeletonTable,
  Spinner,
  TextInput,
  type DataTableColumn,
  type DataTableSort,
  type QueryLike,
  type SelectOption,
} from "../../../shared/ui/primitives";
import {
  filterCourierBulkOrders,
  getCourierBulkOrderAction,
  isCourierBulkOrderMarked,
  sortCourierBulkOrders,
  type CourierBulkAction,
  type CourierBulkOrder,
  type CourierBulkResultFilter,
  type CourierBulkSort,
} from "../model/courierBulk";
import { ResultControl } from "./ResultControl";

type CourierBulkOrdersProps = {
  query: QueryLike<CourierBulkOrder[]>;
  orders: CourierBulkOrder[];
  actions: Record<string, CourierBulkAction>;
  onSetAction: (order: CourierBulkOrder, action: CourierBulkAction) => void;
  busy: boolean;
  /** Fonda yangilanmoqda (birinchi yuklanish emas) — «Yangilanmoqda...». */
  refreshing: boolean;
  isPhone: boolean;
  /** < 1024 — jadval o'rnida kartalar ro'yxati (maket `el-show-tablet`). */
  isBelowLg: boolean;
  /** Telefonda sarlavhadagi «Tozalash» (≥ 768 da u sahifa sarlavhasida). */
  onClearMarks: () => void;
  clearDisabled: boolean;
};

const DEFAULT_SORT: CourierBulkSort = { key: "createdAt", direction: "desc" };

/** «Natija» filtri variantlari; `""` — «Barchasi». */
type ResultOption = Exclude<CourierBulkResultFilter, "all"> | "";

const COUNT_PILL =
  "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-sunken px-1.5 text-xs font-semibold text-text-muted";

const districtOf = (order: CourierBulkOrder) => order.district?.name ?? order.region?.name ?? null;
const regionOf = (order: CourierBulkOrder) =>
  (order.district?.name ? (order.district.region?.name ?? order.region?.name) : null) ?? null;

/**
 * «Kutilayotgan buyurtmalar» kartasi (maket `courier-courier-bulk-main`): qidiruv (ism, telefon, raqam) va «Natija»
 * filtri, sana / summa bo'yicha saralash — hammasi mijoz tomonida (yangi API parametri yo'q). ≥ 1024 — jadval,
 * < 1024 — kartalar (planshetda natija o'ngda, telefonda pastda to'liq enli).
 *
 * «№…» oddiy matn (havola emas): belgilar faqat shu sahifa xotirasida — tafsilotga o'tilsa yo'qoladi va qaytgach
 * hamma buyurtma sukut bo'yicha «sotildi» bo'lib qolardi.
 */
export const CourierBulkOrders = ({
  query,
  orders,
  actions,
  onSetAction,
  busy,
  refreshing,
  isPhone,
  isBelowLg,
  onClearMarks,
  clearDisabled,
}: CourierBulkOrdersProps) => {
  const { t, i18n } = useTranslation("courierBulk");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<CourierBulkResultFilter>("all");
  const [sort, setSort] = useState<CourierBulkSort | null>(DEFAULT_SORT);

  const money = (value: unknown) => formatMoneyLocalized(value, { language });
  const dateTime = (order: CourierBulkOrder) =>
    formatDateTimeLocalized(order.created_at ?? order.createdAt ?? null, { language });

  // Telefonda qidiruv va filtr yo'q (maket) — ular ro'yxatni toraytirmaydi.
  const visible = useMemo(
    () =>
      sortCourierBulkOrders(
        filterCourierBulkOrders(orders, actions, isPhone ? { query: "", result: "all" } : { query: search, result }),
        sort,
      ),
    [actions, isPhone, orders, result, search, sort],
  );

  // «Barchasi» — bo'sh qiymatli variant: filtr tanlangach maydonda × chiqadi (ega qarori 2026-10-16).
  const resultOptions: SelectOption<ResultOption>[] = [
    { value: "", label: t("list.filterAll") },
    { value: "sold", label: t("list.filterSold") },
    { value: "cancel", label: t("list.filterCancel") },
    { value: "tomorrow", label: t("list.filterTomorrow") },
    { value: "unmarked", label: t("list.filterUnmarked") },
  ];

  const resultCell = (order: CourierBulkOrder, layout: "table" | "list"): ReactNode => (
    <ResultControl
      layout={layout}
      value={getCourierBulkOrderAction(order.id, actions)}
      marked={isCourierBulkOrderMarked(order.id, actions)}
      name={order.customer?.name ?? `№${order.id}`}
      disabled={busy}
      onChange={(action) => onSetAction(order, action)}
    />
  );
  const unmarkedBadge = (order: CourierBulkOrder) =>
    isCourierBulkOrderMarked(order.id, actions) ? null : <Badge className="shrink-0">{t("list.unmarked")}</Badge>;

  const columns: DataTableColumn<CourierBulkOrder>[] = [
    {
      id: "createdAt",
      header: t("list.order"),
      sortable: true,
      firstDirection: "desc",
      sortTitle: t("list.sortByDate"),
      cell: (order) => (
        <>
          <div className="whitespace-nowrap font-semibold text-text">№{order.id}</div>
          <div className="whitespace-nowrap text-[13px] text-text-muted">{dateTime(order)}</div>
        </>
      ),
    },
    {
      id: "customer",
      header: t("list.customer"),
      cell: (order) => (
        <>
          <div className="whitespace-nowrap font-semibold text-text">{order.customer?.name ?? "—"}</div>
          <div className="whitespace-nowrap text-[13px] text-text-muted">{formatPhone(order.customer?.phone_number)}</div>
        </>
      ),
    },
    {
      id: "location",
      header: t("list.location"),
      cell: (order) => (
        <>
          <div className="whitespace-nowrap">{districtOf(order) ?? "—"}</div>
          {regionOf(order) ? <div className="whitespace-nowrap text-[13px] text-text-muted">{regionOf(order)}</div> : null}
        </>
      ),
    },
    {
      id: "market",
      header: t("list.market"),
      cellClassName: "whitespace-nowrap",
      cell: (order) => order.market?.name ?? "—",
    },
    {
      id: "amount",
      header: t("list.amount"),
      align: "end",
      sortable: true,
      firstDirection: "desc",
      sortTitle: t("list.sortByAmount"),
      cellClassName: "font-semibold",
      cell: (order) => money(order.total_price),
    },
    {
      id: "result",
      header: t("list.result"),
      align: "end",
      cell: (order) => (
        <div className="flex items-center justify-end gap-3">
          {unmarkedBadge(order)}
          {resultCell(order, "table")}
        </div>
      ),
    },
  ];

  const list = (
    <ul aria-label={t("list.label")} aria-busy={refreshing || undefined} className="flex min-w-0 flex-col">
      {visible.map((order) => {
        const place = districtOf(order);
        const meta = [`№${order.id}`, order.customer?.phone_number ? formatPhone(order.customer.phone_number) : null, dateTime(order)]
          .filter(Boolean)
          .join(" · ");
        return (
          <li
            key={order.id}
            className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
              <span className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-semibold text-text">{order.customer?.name ?? "—"}</span>
                <span className="whitespace-nowrap font-semibold text-text">{money(order.total_price)}</span>
              </span>
              <span className="flex min-h-6 min-w-0 items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[13px] text-text-muted">
                  {place ? `${place} · ` : null}
                  <span className="font-semibold text-text">{order.market?.name ?? "—"}</span>
                </span>
                {unmarkedBadge(order)}
              </span>
              <span className="truncate text-[13px] text-text-muted">{meta}</span>
            </div>
            <div className="min-w-0 flex-[1_1_300px] md:max-w-[380px]">{resultCell(order, "list")}</div>
          </li>
        );
      })}
    </ul>
  );

  const tools = isPhone ? (
    <Button variant="ghost" leftIcon={RotateCcw} disabled={clearDisabled} onClick={onClearMarks}>
      {t("clear")}
    </Button>
  ) : (
    <div className="flex w-[420px] min-w-0 max-w-full gap-3 lg:w-[500px]">
      <TextInput
        mode="search"
        value={search}
        onValueChange={setSearch}
        placeholder={t("list.search")}
        aria-label={t("list.searchLabel")}
        className="min-w-0 flex-1"
      />
      <Select<ResultOption>
        options={resultOptions}
        value={result === "all" ? "" : result}
        onChange={(value) => setResult(value ? value : "all")}
        inlineLabel={t("list.filterInline")}
        aria-label={t("list.filterLabel")}
        className="w-[190px] shrink-0"
      />
    </div>
  );

  return (
    <Card
      padding="none"
      className="overflow-hidden"
      title={isPhone ? t("list.titleShort") : t("list.title")}
      titleAddon={<span className={COUNT_PILL}>{formatNumberLocalized(orders.length, { language })}</span>}
      description={
        <>
          {t("list.description")}
          {refreshing ? (
            <span role="status" className="ml-3 inline-flex items-center gap-1.5 align-middle">
              <Spinner size="sm" />
              {t("refreshing")}
            </span>
          ) : null}
        </>
      }
      actions={tools}
    >
      <QueryBoundary
        query={query}
        loadingLabel={t("loading")}
        loading={
          <SkeletonTable
            framed={false}
            columns={[t("list.order"), t("list.customer"), t("list.location"), t("list.market"), t("list.amount"), t("list.result")]}
          />
        }
        empty={<EmptyState icon={Inbox} title={t("empty")} description={t("states.emptyHint")} />}
        error={(error, retry) => {
          const backendMessage = getBackendErrorMessage(error);
          return (
            <ErrorState
              error={error}
              title={t("loadError")}
              description={
                backendMessage ? (
                  <>
                    <span className="block">{backendMessage}</span>
                    <span className="block">{t("states.errorHint")}</span>
                  </>
                ) : (
                  t("states.errorHint")
                )
              }
              onRetry={retry}
              retryLabel={t("retry")}
            />
          );
        }}
      >
        {() =>
          visible.length === 0 ? (
            <EmptyState icon={SearchX} title={t("list.noMatchTitle")} description={t("list.noMatchHint")} />
          ) : isBelowLg ? (
            list
          ) : (
            <DataTable
              rows={visible}
              columns={columns}
              getRowKey={(order) => String(order.id)}
              label={t("list.label")}
              sort={sort as DataTableSort | null}
              onSortChange={(next) => setSort(next as CourierBulkSort | null)}
              busy={refreshing}
            />
          )
        }
      </QueryBoundary>
    </Card>
  );
};

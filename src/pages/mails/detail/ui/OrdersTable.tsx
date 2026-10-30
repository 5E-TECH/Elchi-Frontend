// dizayn-v2: superadmin-mails-detail, superadmin-mails-detail-duplicates, superadmin-mails-detail-search, superadmin-mails-detail-search-empty, admin-mails-detail-duplicates, admin-mails-detail-search, admin-mails-detail-search-empty, registrator-mails-detail-duplicates, registrator-mails-detail-search, registrator-mails-detail-search-empty, manager-mails-detail-receive-duplicates, manager-mails-detail-receive-search, manager-mails-detail-receive-search-empty, superadmin-mails-detail-refused, superadmin-mails-detail-old, admin-mails-detail, admin-mails-refused-detail, admin-mails-old-detail, manager-mails-detail-receive, manager-mails-detail-refused-receive, manager-mails-detail-old, registrator-mails-detail, registrator-mails-detail-refused, registrator-mails-detail-old, courier-mails-detail-receive, courier-mails-detail-refused, courier-mails-detail-old
import { memo, useCallback, useMemo, useState, type ReactNode, type RefObject } from "react";
import { Link } from "react-router-dom";
import { EyeOff, ListChecks, Phone, ScanLine, SearchX, Trash2, X } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import type { PostOrder } from "../../../../entities/mails";
import { OrderStatusBadge } from "../../../../entities/order";
import { cx } from "../../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  IconButton,
  TextInput,
  type DataTableColumn,
  type DataTableSelection,
  type DataTableSort,
} from "../../../../shared/ui/primitives";
import { useIsPhone } from "../../../../shared/ui/primitives/date/useIsPhone";
import { SelectionRegion } from "../../../../shared/ui/SelectionRegion";
import type { OrderPrintMode } from "../lib/printMode";
import { orderRowDate, useOrderRowView } from "../model/useOrderRowView";
import OrderRow, { RowPrintButton } from "./OrderRow";

/**
 * POCHTADAGI BUYURTMALAR KARTASI — dizayn v2 (`.el-card` + `.el-table` / telefonda `.el-list`).
 *
 *   sarlavha («Buyurtmalar» ⟨N ta⟩) · skaner izohi (`ScanLine`) · o'ngda «USB skaner tayyor» / `headerExtra`
 *   tanlov paneli (`SelectionRegion`: «6 ta buyurtma tanlandi / 9 ta», «Barchasini tanlash», «Tanlovni bekor qilish»)
 *   jadval (`DataTable`, tanlov belgilari, qator chop etish va o'chirish) — telefonda kartalar (`OrderRow`)
 *   pastda «N ta buyurtma» · «Jami: X»
 *
 * Qidiruv va takroriy telefonlar (MD-1, opt-in `search` / `alert` / `duplicateNote`; maketlar
 * `*-mails-detail-search`, `-search-empty`, `-duplicates`, menejerda `manager-mails-detail-receive-*`):
 *   sarlavha qatorida qidiruv maydoni → holat qatori ««…» bo'yicha N ta buyurtma topildi [· market nomi bo'yicha]» →
 *   banner (`alert`) → tanlov paneli (tanlov BUTUN ro'yxatda: «N tasi qidiruvda yashirin…», «Ko'rinayotganlarni
 *   tanlash», sarlavha belgisi faqat ko'rinadiganlarga) → jadval (ko'rinadiganlar; takroriy raqamli qatorda
 *   «Takroriy raqam» belgisi va chapda 3 px ogohlantirish chizig'i) yoki «… topilmadi» (`EmptyState` +
 *   «Qidiruvni tozalash») → pastda «N ta ko'rsatilmoqda · M tadan» · «Pochta jami: X».
 *
 * Maketlar: `superadmin-mails-detail` (jo'natish), `*-refused` (qabul), `*-old` / `admin-mails-old-detail`
 * (tarix: belgi va «Holat» yo'q), `manager-mails-detail-receive`, `courier-mails-detail-*`. Paket tafsiloti
 * (`pages/batches/ui/BatchDetailPage.tsx`) ham shu kartani ishlatadi — mavjud prop nomlari muzlatilgan,
 * yangilari ixtiyoriy va sukut qiymati pochta tafsilotini beradi.
 *
 * `readOnly` — tanlov yo'q (belgi ustuni, panel); `variant="history"` — eski pochta (sana faqat kun, «Holat» yo'q,
 * telefonda butun karta havola). `cardVariant="courier"` — kuryer maketi: telefonda tanlov paneli o'rnida
 * «Barchasini tanlash» qatori, kartada telefon raqami va vaqt, chegarali 44 px chop etish tugmasi.
 */
export type OrdersTableColumn =
  | "order"
  | "customer"
  | "districtAddress"
  | "district"
  | "address"
  | "market"
  | "status"
  | "delivery"
  | "amount";

/** Pochta tafsiloti (jo'natish / qabul / rad etilgan) — maket `superadmin-mails-detail`. */
const MAIL_ORDER_COLUMNS: readonly OrdersTableColumn[] = [
  "order",
  "customer",
  "districtAddress",
  "market",
  "status",
  "delivery",
  "amount",
];

/** Eski pochta (tarix) — belgi va «Holat» yo'q (maket `admin-mails-old-detail`). */
const MAIL_HISTORY_COLUMNS: readonly OrdersTableColumn[] = [
  "order",
  "customer",
  "districtAddress",
  "market",
  "delivery",
  "amount",
];

/** Planshetda (< 1024) yashirinadigan ustunlar — sukut (maket `superadmin-mails-detail` planshet). */
const DEFAULT_TABLET_HIDDEN: readonly OrdersTableColumn[] = ["districtAddress", "district", "address", "market", "delivery"];
/** Eski pochta planshetda: faqat «Market» yashirin, u «Summa» ostiga tushadi (maket `admin-mails-old-detail`). */
const HISTORY_TABLET_HIDDEN: readonly OrdersTableColumn[] = ["district", "address", "market"];

interface OrdersTableProps {
  orders: PostOrder[];
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onPrintOne?: (order: PostOrder, mode: OrderPrintMode) => void;
  /** Cheki tayyorlanayotgan qator — uning chop etish tugmasi `loading`. */
  printingOrderId?: string | null;
  onDeleteOne?: (orderId: string) => void;
  canDelete?: boolean;
  variant?: "default" | "history";
  readOnly?: boolean;
  /** Karta sarlavhasi (sukut «Buyurtmalar»). */
  title?: ReactNode;
  /** Karta nomi (`aria-label`, sukut «Pochtadagi buyurtmalar»). */
  ariaLabel?: string;
  /** Sarlavha qatori o'ngida (masalan «Faqat o'qish»). */
  headerExtra?: ReactNode;
  /** Sarlavha ostidagi skaner izohi (`ScanLine` bilan). */
  scanHint?: ReactNode;
  /** USB skaner tinglayapti — «USB skaner tayyor» belgisi. */
  scannerReady?: boolean;
  /** Skaner belgisi matni (sukut «USB skaner tayyor»; rad etilganda «Skaner tayyor»). */
  scannerReadyLabel?: ReactNode;
  /** Tanlov paneli izohi (`readOnly` da panel yo'q). */
  selectionHint?: ReactNode;
  /** «Tanlovni bekor qilish» (berilmasa tugma yo'q). */
  onClearSelection?: () => void;
  /** Ustunlar tartibi; belgi — `readOnly=false` da, chop etish — `onPrintOne` bilan, savat — `canDelete` bilan. */
  columns?: readonly OrdersTableColumn[];
  /** < 1024 da yashirinadigan ustunlar (sukut — maket `superadmin-mails-detail`). */
  tabletHidden?: readonly OrdersTableColumn[];
  /** Buyurtma raqami havolasi (sukut `/orders/edit/:id`); `null` — oddiy matn (kuryer). */
  orderHref?: ((order: PostOrder) => string) | null;
  /** Bo'sh holat (sukut — «Buyurtmalar topilmadi»). */
  empty?: ReactNode;
  /** Pastki qism «N ta buyurtma» · «Jami: X» (sukut `true`). */
  footer?: boolean;
  /** Faqat telefonda (< 768), pastki qism ostida — masalan «HQ'ga yuborish — n ta». */
  footerAction?: ReactNode;
  /** Mijoz tomonida saralash: «Buyurtma» (sana) va «Summa» (kuryer maketlari). */
  sortable?: boolean;
  /** Telefon kartasi va tanlov qatori ko'rinishi (sukut — xodim maketi). */
  cardVariant?: "default" | "courier";
  /** Sarlavha ostidagi izoh qatori (kuryer: «Rad etilgan pochtani filial qabul qiladi.»). */
  notice?: ReactNode;
  /** Faqat telefonda, sarlavha ostida (kuryer: «Barchasini chop etish»). */
  phoneHeaderAction?: ReactNode;
  /** Kuryer telefonidagi «Barchasini tanlash» qatori o'ngida (chop etish menyusi). */
  phoneSelectionAction?: ReactNode;
  /** Qator chop etish tugmasi nomi (sukut «№X ni chop etish»). */
  printLabel?: (order: PostOrder) => string;
  /**
   * Paket tafsiloti ko'rinishi (`pages/batches`): telefon kartasida «№X · [market ·] telefon» + manzil (market —
   * faqat `columns` da «market» bo'lsa), pastki qism «Jami N ta buyurtma» · summa (maket `*-batches-detail*`).
   * Sukut `"mail"` — pochta tafsiloti.
   */
  appearance?: "mail" | "batch";
  /** «USB skaner tayyor» belgisi telefonda ham (maket `manager-returns-batch-detail`); sukut — faqat ≥ 768. */
  scannerReadyOnPhone?: boolean;
  /**
   * Qidiruv (MD-1, opt-in; paket tafsilotida yo'q). `orders` — BUTUN ro'yxat (sanoq, summa, tanlov), jadvalda
   * `visible`. Sarlavha belgisi va «Ko'rinayotganlarni tanlash» — `onSelectRows` (faqat ko'rinadiganlar).
   */
  search?: OrdersTableSearch;
  /**
   * Qidiruv maydoni (`search` bilan) — USB skandan keyin `q` ni tiklash uchun fokus tekshiruvi; «Qidiruvni
   * tozalash» (bo'sh holat) dan keyin fokus shu maydonga qaytadi.
   */
  searchInputRef?: RefObject<HTMLInputElement | null>;
  /** Sarlavha (va qidiruv holati) ostidagi banner — takroriy telefonlar. */
  alert?: ReactNode;
  /** Takroriy raqamli qator: belgi maslahati («Shu raqamga yana: №…») yoki `null` — belgi va chiziq yo'q. */
  duplicateNote?: (order: PostOrder) => string | null;
}

export type OrdersTableSearch = {
  /** Maydondagi matn (mahalliy qoralama). */
  value: string;
  /** Jadvalga qo'llangan so'rov (holat qatori va bo'sh holat matni; berilmasa — `value`). */
  query?: string;
  onValueChange: (value: string) => void;
  /** Qidiruv faol (bo'sh bo'lmagan so'rov). */
  active: boolean;
  /** Ko'rinadigan buyurtmalar (`active=false` da — hammasi). */
  visible: PostOrder[];
  /** Hammasi market nomi bo'yicha topildi — holat qatorida qo'shimcha. */
  byMarket?: boolean;
  /** Tanlash / tanlovdan chiqarish (sarlavha belgisi va «Ko'rinayotganlarni tanlash»). */
  onSelectRows: (ids: string[], selected: boolean) => void;
};

/** Takroriy raqamli qator: chapda 3 px ogohlantirish chizig'i (jadvalda belgi katagida, telefonda kartada). */
const DUPLICATE_ROW =
  "[&>td:first-child]:shadow-[inset_3px_0_0_var(--color-warning)] [li&]:shadow-[inset_3px_0_0_var(--color-warning)]";

const defaultOrderHref = (order: PostOrder) => `/orders/edit/${order.id}`;

/** Mijoz tomonidagi saralash qiymati (sana — ko'rsatilgan sana, summa — `total_price`). */
const sortValue = (order: PostOrder, key: string) =>
  key === "amount" ? Number(order.total_price) || 0 : new Date(orderRowDate(order) ?? 0).getTime() || 0;

// ─── Asosiy komponent ─────────────────────────────────────────────────────────
const OrdersTable = memo(
  ({
    orders,
    selectedIds,
    allSelected,
    someSelected,
    onToggleAll,
    onToggleOne,
    onPrintOne,
    printingOrderId = null,
    onDeleteOne,
    canDelete = false,
    variant = "default",
    readOnly = false,
    title,
    ariaLabel,
    headerExtra,
    scanHint,
    scannerReady = false,
    scannerReadyLabel,
    selectionHint,
    onClearSelection,
    columns,
    tabletHidden,
    orderHref = defaultOrderHref,
    empty,
    footer = true,
    footerAction,
    sortable = false,
    cardVariant = "default",
    notice,
    phoneHeaderAction,
    phoneSelectionAction,
    printLabel,
    appearance = "mail",
    scannerReadyOnPhone = false,
    search,
    searchInputRef,
    alert,
    duplicateNote,
  }: OrdersTableProps) => {
    const { t, i18n } = useTranslation(["mails", "orders"]);
    const language = i18n.resolvedLanguage ?? i18n.language;
    const isPhone = useIsPhone();
    const isHistory = variant === "history";
    const isCourierCard = cardVariant === "courier";
    const selectable = !readOnly && !isHistory;
    const [sort, setSort] = useState<DataTableSort | null>(sortable ? { key: "order", direction: "desc" } : null);

    const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);
    const money = useCallback((value: unknown) => formatMoneyLocalized(value, { language }), [language]);
    const view = useOrderRowView({ history: isHistory });
    const rowPrintLabel = useCallback(
      (order: PostOrder) => printLabel?.(order) ?? t("detailPage.printRow", { id: order.id }),
      [printLabel, t],
    );

    const columnIds = columns ?? (isHistory ? MAIL_HISTORY_COLUMNS : MAIL_ORDER_COLUMNS);
    const hiddenOnTablet = useMemo(
      () => new Set(tabletHidden ?? (isHistory ? HISTORY_TABLET_HIDDEN : DEFAULT_TABLET_HIDDEN)),
      [isHistory, tabletHidden],
    );
    // Planshetda yashirin ustun ma'lumoti qo'shni katakka tushadi (maket `.el-show-tablet`).
    const tabletPlaceUnderCustomer =
      columnIds.some((id) => (id === "districtAddress" || id === "district" || id === "address") && hiddenOnTablet.has(id));
    const tabletMarketUnderAmount = columnIds.includes("market") && hiddenOnTablet.has("market");
    const isBatch = appearance === "batch";
    const showsMarket = columnIds.includes("market");

    const searching = Boolean(search?.active);
    const shownOrders = search?.active ? search.visible : orders;
    const rows = useMemo(() => {
      if (!sort) return shownOrders;
      const direction = sort.direction === "asc" ? 1 : -1;
      return [...shownOrders].sort((a, b) => (sortValue(a, sort.key) - sortValue(b, sort.key)) * direction);
    }, [shownOrders, sort]);

    const selectedOrders = useMemo(() => orders.filter((order) => selectedIds.has(order.id)), [orders, selectedIds]);
    const totalSum = useMemo(() => orders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0), [orders]);
    const hasActions = Boolean(onPrintOne) || (canDelete && Boolean(onDeleteOne));

    const deleteButton = useCallback(
      (order: PostOrder) =>
        canDelete && onDeleteOne ? (
          <IconButton
            size="sm"
            variant="danger"
            icon={Trash2}
            label={t("deleteFromPostAction", { id: order.id })}
            aria-haspopup="dialog"
            onClick={() => onDeleteOne(order.id)}
          />
        ) : null,
      [canDelete, onDeleteOne, t],
    );

    const rowActions = useCallback(
      (order: PostOrder) => (
        <>
          {onPrintOne ? (
            <RowPrintButton
              label={rowPrintLabel(order)}
              onSelect={(mode) => onPrintOne(order, mode)}
              bordered={isCourierCard && isPhone}
              loading={printingOrderId === order.id}
            />
          ) : null}
          {deleteButton(order)}
        </>
      ),
      [deleteButton, isCourierCard, isPhone, onPrintOne, printingOrderId, rowPrintLabel],
    );

    const duplicateBadge = useCallback(
      (note: string) => (
        <Badge tone="warning" icon={Phone} title={note}>
          {t("detailPage.duplicates.rowBadge")}
        </Badge>
      ),
      [t],
    );

    const cell = useCallback(
      (id: OrdersTableColumn): DataTableColumn<PostOrder> => {
        const header = t(`detailPage.columns.${id}`);
        const hideBelow = hiddenOnTablet.has(id) ? ("lg" as const) : undefined;
        switch (id) {
          case "order":
            return {
              id,
              header,
              sortable,
              firstDirection: "desc",
              sortTitle: t("detailPage.sortByDate"),
              cell: (order) => (
                <>
                  {orderHref ? (
                    <Link
                      to={orderHref(order)}
                      className="whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline"
                    >
                      №{order.id}
                    </Link>
                  ) : (
                    <div className="whitespace-nowrap font-semibold text-text">№{order.id}</div>
                  )}
                  <div className="whitespace-nowrap text-[13px] text-text-muted">{view.date(order)}</div>
                </>
              ),
            };
          case "customer":
            return {
              id,
              header,
              cell: (order) => {
                const place = view.place(order);
                const duplicate = duplicateNote?.(order) ?? null;
                return (
                  <>
                    <div className="whitespace-nowrap font-semibold text-text">{view.customerName(order)}</div>
                    <div className="whitespace-nowrap text-[13px] text-text-muted">{view.customerPhone(order)}</div>
                    {duplicate ? <div className="mt-1">{duplicateBadge(duplicate)}</div> : null}
                    {tabletPlaceUnderCustomer && place ? (
                      <div className="hidden whitespace-nowrap text-[13px] text-text-muted max-lg:block">{place}</div>
                    ) : null}
                  </>
                );
              },
            };
          case "districtAddress":
            return {
              id,
              header,
              hideBelow,
              cell: (order) => (
                <>
                  <div className="whitespace-nowrap">{view.district(order) ?? view.address(order) ?? "—"}</div>
                  {view.district(order) && view.address(order) ? (
                    <div className="max-w-[240px] truncate text-[13px] text-text-muted">{view.address(order)}</div>
                  ) : null}
                </>
              ),
            };
          case "district":
            return {
              id,
              header,
              hideBelow,
              cell: (order) => <span className="whitespace-nowrap">{view.district(order) ?? "—"}</span>,
            };
          case "address":
            return {
              id,
              header,
              hideBelow,
              cell: (order) => (
                <>
                  <div className="max-w-[260px] truncate">{view.address(order) ?? view.district(order) ?? "—"}</div>
                  {view.address(order) && view.district(order) ? (
                    <div className="whitespace-nowrap text-[13px] text-text-muted">{view.district(order)}</div>
                  ) : null}
                </>
              ),
            };
          case "market":
            return {
              id,
              header,
              hideBelow,
              cell: (order) => <span className="whitespace-nowrap">{view.market(order) ?? "—"}</span>,
            };
          case "status":
            // Bekor buyurtma (qaytarish pochtasi) — joy bosqichi va ostida joy qatori (`tizim-states-data` §09).
            return {
              id,
              header,
              hideBelow,
              cell: (order) => <OrderStatusBadge status={order.status} order={order} withPlace />,
            };
          case "delivery":
            return { id, header, hideBelow, cell: (order) => view.deliveryBadge(order) };
          case "amount":
            return {
              id,
              header,
              align: "end",
              sortable,
              firstDirection: "desc",
              sortTitle: t("detailPage.sortByAmount"),
              cell: (order) => (
                <>
                  <div className="font-semibold text-text">{money(order.total_price)}</div>
                  {tabletMarketUnderAmount && view.market(order) ? (
                    <div className="hidden text-[13px] font-normal text-text-muted max-lg:block">{view.market(order)}</div>
                  ) : null}
                </>
              ),
            };
          default:
            return { id, header, cell: () => null };
        }
      },
      [
        duplicateBadge,
        duplicateNote,
        hiddenOnTablet,
        money,
        orderHref,
        sortable,
        t,
        tabletMarketUnderAmount,
        tabletPlaceUnderCustomer,
        view,
      ],
    );

    const tableColumns = useMemo<DataTableColumn<PostOrder>[]>(() => {
      const list = columnIds.map(cell);
      if (hasActions) {
        list.push({
          id: "actions",
          header: <span className="sr-only">{t("detailPage.columns.actions")}</span>,
          className: canDelete ? "w-[88px]" : "w-14",
          cellClassName: "text-right whitespace-nowrap",
          cell: (order) => <div className="inline-flex items-center gap-0.5">{rowActions(order)}</div>,
        });
      }
      return list;
    }, [canDelete, cell, columnIds, hasActions, rowActions, t]);

    const selection = useMemo<DataTableSelection<PostOrder> | undefined>(
      () =>
        selectable
          ? {
              isSelected: (order) => selectedIds.has(order.id),
              onToggle: (order) => onToggleOne(order.id),
              // Qidiruvda sarlavha belgisi faqat ko'rinadigan qatorlarga (yashirin tanlov o'zgarmaydi).
              onToggleAll: (checked) =>
                search ? search.onSelectRows(rows.map((order) => order.id), checked) : onToggleAll(),
              headerLabel: t("detailPage.selectAllRows"),
              rowLabel: (order) => t("detailPage.selectRow", { id: order.id }),
            }
          : undefined,
      [onToggleAll, onToggleOne, rows, search, selectable, selectedIds, t],
    );

    const renderCard = useCallback(
      (order: PostOrder) => (
        <OrderRow
          order={order}
          view={view}
          selectable={selectable}
          history={isHistory}
          courier={isCourierCard}
          href={orderHref && !isCourierCard ? orderHref(order) : null}
          actions={hasActions ? rowActions(order) : null}
          meta={isBatch ? "contact" : "place"}
          showMarket={showsMarket}
          flag={(() => {
            const note = duplicateNote?.(order) ?? null;
            return note ? duplicateBadge(note) : null;
          })()}
        />
      ),
      [
        duplicateBadge,
        duplicateNote,
        hasActions,
        isBatch,
        isCourierCard,
        isHistory,
        orderHref,
        rowActions,
        selectable,
        showsMarket,
        view,
      ],
    );

    // «Barchasini tanlash» — barchasini tanlaydi (hammasi tanlangan bo'lsa o'chiq); bekor qilish — alohida tugma.
    const selectAll = () => {
      if (!allSelected) onToggleAll();
    };
    const selectedCount = selectedOrders.length;
    const hasSelection = selectedCount > 0;
    // Qidiruvda: tanlov butun ro'yxatda qoladi; ko'rinmaydigan tanlanganlar soni izohda.
    const visibleSelectedCount = searching ? rows.filter((order) => selectedIds.has(order.id)).length : selectedCount;
    const hiddenSelectedCount = selectedCount - visibleSelectedCount;
    const allVisibleSelected = rows.length > 0 && visibleSelectedCount === rows.length;
    const selectVisible = () => {
      if (!search || allVisibleSelected) return;
      search.onSelectRows(rows.map((order) => order.id), true);
    };

    const selectionActions = (
      <>
        {searching ? (
          rows.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={ListChecks}
              disabled={allVisibleSelected}
              onClick={selectVisible}
              // Nomi ko'rinadigan matndan boshlanadi (WCAG 2.5.3 — ovozli boshqaruv).
              aria-label={`${t("detailPage.search.selectVisible")} (${count(rows.length)})`}
              className="max-md:px-2"
            >
              {t("detailPage.search.selectVisible")}
              <span
                aria-hidden="true"
                className="ml-1 inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-sunken px-1.5 text-xs font-semibold text-text-muted"
              >
                {count(rows.length)}
              </span>
            </Button>
          ) : null
        ) : (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={ListChecks}
            disabled={orders.length === 0 || allSelected}
            onClick={selectAll}
            className="max-md:px-2"
          >
            {t("detailPage.selectAll")}
          </Button>
        )}
        {onClearSelection ? (
          <Button variant="ghost" size="sm" disabled={!hasSelection} onClick={onClearSelection} className="max-md:px-2">
            {t("detailPage.clearSelection")}
          </Button>
        ) : null}
      </>
    );

    const selectionRegion =
      selectable && orders.length > 0 ? (
        isCourierCard && isPhone ? (
          // Kuryer telefoni: «Barchasini tanlash» belgisi + o'ngda chop etish (maket `courier-mails-detail-receive`).
          <div
            role="region"
            aria-label={t("detailPage.selectionRegion")}
            className={cx(
              "flex items-center justify-between gap-2 border-t border-border px-4 py-2",
              hasSelection ? "bg-action-soft" : "bg-sunken",
            )}
          >
            <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                className="size-[18px] shrink-0 cursor-pointer accent-action"
                checked={allSelected}
                ref={(element) => {
                  if (element) element.indeterminate = someSelected && !allSelected;
                }}
                aria-label={t("detailPage.selectAllRows")}
                onChange={onToggleAll}
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-text">{t("detailPage.selectAll")}</span>
                <span className="text-xs text-text-muted" aria-live="polite">
                  {t("detailPage.phoneSelectAllHint", { selected: count(selectedCount), total: count(orders.length) })}
                </span>
              </span>
            </label>
            {phoneSelectionAction}
          </div>
        ) : (
          <SelectionRegion
            idle={!hasSelection}
            inline={isCourierCard}
            label={t("detailPage.selectionRegion")}
            title={
              hasSelection ? (
                <>
                  {t("detailPage.selectionTitle", { value: count(selectedCount), count: selectedCount })}{" "}
                  <span className="font-normal text-text-muted">
                    {t("detailPage.selectionOf", { value: count(orders.length), count: orders.length })}
                  </span>
                </>
              ) : (
                t("detailPage.selectionNone")
              )
            }
            hint={
              hasSelection ? (
                hiddenSelectedCount > 0 ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <EyeOff aria-hidden="true" size={14} className="shrink-0" />
                    <span className="min-w-0">
                      {visibleSelectedCount === 0 && rows.length === 0
                        ? t("detailPage.search.allSelectedHidden")
                        : t("detailPage.search.hiddenSelected", { value: count(hiddenSelectedCount) })}
                    </span>
                  </span>
                ) : (
                  selectionHint
                )
              ) : (
                t("detailPage.selectionNoneHint")
              )
            }
            action={selectionActions}
          />
        )
      ) : null;

    const headerBadge: ReactNode = scannerReady ? (
      <Badge
        tone="success"
        dot
        role="status"
        title={t("detailPage.scannerReadyTitle")}
        className={scannerReadyOnPhone ? undefined : "max-md:hidden"}
      >
        {scannerReadyLabel ?? t("detailPage.scannerReady")}
      </Badge>
    ) : null;

    const hasEmpty = orders.length === 0;
    const searchEmpty = searching && rows.length === 0;
    const hasHeaderSide = headerBadge != null || headerExtra != null || search != null;
    const query = (search?.query ?? search?.value ?? "").trim();
    // Bo'sh holatdagi tugma yo'qoladi — fokus <body> ga tushmasin, qidiruv maydoniga qaytadi.
    const clearSearch = () => {
      search?.onValueChange("");
      searchInputRef?.current?.focus();
    };
    // Bitta doimiy jonli hudud (qidiruv bor ekan): «… N ta topildi» yoki «… topilmadi» — matni almashadi, o'zi
    // yo'qolmaydi (yangi qo'shilgan hudud ko'pincha o'qilmaydi). Bo'sh holatda matn faqat ekran o'quvchisi uchun.
    const searchStatusVisible = searching && !searchEmpty && !hasEmpty;

    const searchField = search ? (
      <TextInput
        ref={searchInputRef}
        mode="search"
        value={search.value}
        onValueChange={search.onValueChange}
        placeholder={t("detailPage.search.placeholder")}
        aria-label={t("detailPage.search.label")}
        clearLabel={t("detailPage.search.clear")}
        className="min-w-0 flex-[1_1_260px] max-md:basis-full"
      />
    ) : null;

    return (
      <Card as="section" padding="none" aria-label={ariaLabel ?? t("detailPage.ordersAria")}>
        {/* Sarlavha qatori (`.el-card-head` chiziqsiz — ostidagi tanlov paneli/jadval o'z chizig'i bilan). */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 max-md:px-4">
          <div className={cx("flex min-w-0 flex-col gap-1", search ? "flex-[1_1_300px]" : "flex-1")}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-text">{title ?? t("detailPage.ordersTitle")}</h2>
              <Badge>{t("detailPage.countBadge", { value: count(orders.length), count: orders.length })}</Badge>
            </div>
            {scanHint ? (
              <p className="flex min-w-0 items-start gap-1.5 text-xs text-text-muted">
                <ScanLine aria-hidden="true" size={14} className="mt-px shrink-0" />
                <span className="min-w-0">{scanHint}</span>
              </p>
            ) : null}
          </div>
          {hasHeaderSide ? (
            <div
              className={cx(
                "flex flex-wrap items-center gap-2",
                search && "min-w-0 flex-[1_1_auto] justify-end gap-x-3 max-md:w-full",
              )}
            >
              {searchField}
              {headerBadge}
              {headerExtra}
            </div>
          ) : null}
          {phoneHeaderAction ? <div className="w-full md:hidden">{phoneHeaderAction}</div> : null}
        </div>

        {search ? (
          <p
            role="status"
            aria-live="polite"
            data-testid="mail-search-status"
            className={
              searchStatusVisible ? "-mt-1 px-5 pb-3 text-[13px] text-text-muted max-md:px-4" : "sr-only"
            }
          >
            {searchStatusVisible ? (
              <Trans
                t={t}
                i18nKey={search.byMarket ? "detailPage.search.foundByMarket" : "detailPage.search.found"}
                values={{ query, value: count(rows.length) }}
                components={{ strong: <span className="font-semibold text-text" /> }}
              />
            ) : searchEmpty && !hasEmpty ? (
              t("detailPage.search.emptyTitle", { query })
            ) : null}
          </p>
        ) : null}

        {alert && !hasEmpty ? <div className="px-5 pb-4 max-md:px-4">{alert}</div> : null}

        {notice ? (
          <p
            role="note"
            className="flex min-w-0 items-center gap-2 border-t border-border bg-sunken px-5 py-2.5 text-[13px] text-text-muted max-md:px-4"
          >
            {notice}
          </p>
        ) : null}

        {hasEmpty ? (
          <div className="border-t border-border">
            {empty ?? <EmptyState title={t("emptyOrders")} description={t("emptyOrdersHint")} />}
          </div>
        ) : (
          <>
            {selectionRegion}
            {searchEmpty ? (
              <div className="border-t border-border">
                <EmptyState
                  icon={SearchX}
                  title={t("detailPage.search.emptyTitle", { query })}
                  description={t("detailPage.search.emptyText")}
                  action={
                    <Button variant="secondary" leftIcon={X} onClick={clearSearch}>
                      {t("detailPage.search.clear")}
                    </Button>
                  }
                />
              </div>
            ) : (
              <DataTable
                rows={rows}
                columns={tableColumns}
                getRowKey={(order) => String(order.id)}
                label={ariaLabel ?? t("detailPage.ordersAria")}
                sort={sortable ? sort : undefined}
                onSortChange={sortable ? setSort : undefined}
                density="tight"
                selection={selection}
                // Qator (telefonda karta) bosilsa — tanlov (v1 dagidek); havola, tugma va belgi o'z ishini qiladi.
                onRowClick={selectable ? (order) => onToggleOne(order.id) : undefined}
                renderCard={renderCard}
                rowClassName={duplicateNote ? (order) => (duplicateNote(order) ? DUPLICATE_ROW : null) : undefined}
                className="border-t border-border"
              />
            )}
            {footer ? (
              <div
                className={cx(
                  "flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-[13px] text-text-muted max-md:px-4",
                  isCourierCard && "max-md:hidden",
                )}
              >
                {isBatch ? (
                  <>
                    <span>{t("detailPage.footerCountTotal", { value: count(orders.length), count: orders.length })}</span>
                    <span className="font-semibold text-text">{money(totalSum)}</span>
                  </>
                ) : searching ? (
                  <>
                    <span>
                      {t("detailPage.search.footerShown", { shown: count(rows.length), total: count(orders.length) })}
                    </span>
                    <span>
                      {t("detailPage.search.footerTotal")}{" "}
                      <span className="font-semibold text-text">{money(totalSum)}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span>{t("detailPage.footerCount", { value: count(orders.length), count: orders.length })}</span>
                    <span>
                      {t("detailPage.footerTotal")} <span className="font-semibold text-text">{money(totalSum)}</span>
                    </span>
                  </>
                )}
              </div>
            ) : null}
            {footerAction ? <div className="border-t border-border px-4 py-3 md:hidden">{footerAction}</div> : null}
          </>
        )}
      </Card>
    );
  },
);
OrdersTable.displayName = "OrdersTable";

export default OrdersTable;

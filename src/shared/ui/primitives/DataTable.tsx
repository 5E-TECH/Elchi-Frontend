import { Fragment, useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { useIsPhone } from "./date/useIsPhone";
import { IconButton } from "./IconButton";
import { useVirtualRows } from "./virtual/useVirtualRows";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  JADVAL — dizayn v2 (`.el-table-wrap` / `.el-table` / `.el-th-sort` / `.el-col-check`)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Maket: `superadmin-orders-list` (asosiy), `manager-orders-list-*` (amallar ustuni, tanlov),
 *  `market-orders-list`, `registrator-orders-list`. Klasslar: `design/CODE-MAP.md` 2.6.
 *
 *  - Faqat jadvalning o'zi gorizontal aylanadi (`overflow-x-auto`), sahifa emas.
 *  - Planshet (768–1023): ikkinchi darajali ustun `hideBelow="lg"` — `th` va `td` ikkalasida
 *    `max-lg:hidden` (jadval 736 px ga sig'ishi shart).
 *  - Telefon (< 768): `renderCard` berilsa jadval o'rniga kartalar ro'yxati (`.el-list`). Tanlash JS'da
 *    (`matchMedia`) — DOM'da faqat bittasi turadi (ekran o'quvchi va testlar ikki nusxani ko'rmaydi).
 *  - Saralash serverda: komponent qatorlarni qayta tartiblamaydi, faqat `onSortChange` ni chaqiradi.
 *    Aylanish: boshqa ustun → `firstDirection` (sukut `asc`) → teskari yo'nalish → saralashsiz (`null`).
 *    Sarlavhada `aria-sort`, tugmada `aria-pressed` (maket `.el-th-sort`).
 *  - Tanlov (`selection`): birinchi ustun `w-11` belgi (`.el-col-check`), sarlavhada «hammasi»
 *    (qisman — `indeterminate`), tanlangan qator `bg-action-soft`, tanlab bo'lmaydigan qator — `disabled`.
 *  - Qatorni bosish (`onRowClick`) — sichqoncha uchun qulaylik: qator ichidagi havola/tugma/belgi bosilsa
 *    chaqirilmaydi. Klaviatura uchun qatorda havola bo'lishi SHART (masalan `№10242` → tafsilot):
 *    `<tr>` ga `role="button"` berilmaydi — ichida havola va tugma bor (ichma-ich interaktiv element yo'q).
 *  - Ochiladigan qator (`expandable`, maket `superadmin-activity-logs-row-expanded`): birinchi ustun
 *    (tanlov bo'lsa undan keyin) — chevron tugma (`aria-expanded`, `aria-controls`, Enter/Space — oddiy
 *    `button`); ochilgan qator va uning paneli `bg-sunken`, panel `colSpan` = barcha ustunlar. Ochib
 *    bo'lmaydigan qatorda (`canExpand` → `false`) chevron yo'q, faqat ekran o'quvchi uchun «Tafsilot yo'q».
 *    Telefonda kartaning o'ng tomonida 44 px chevron, panel karta ostida. `toggle: "none"` — tugmani
 *    iste'molchi o'zi chizadi (masalan amallar ustunida, maket `*-integrations-legacy-partners`):
 *    jadval faqat panelni chiqaradi, `panelId` bilan tugmaga `aria-controls` beriladi.
 *  - Uzun ro'yxat (`virtualizeFrom`, F4RSPBwx): qatorlar shu sondan ko'p bo'lsa faqat ko'rinadiganlari (+ zaxira)
 *    chiziladi, qolgani o'rnida bo'sh joy — skroll uzunligi, qator balandligi, tanlov o'zgarmaydi; ekran o'quvchiga
 *    umumiy son (`aria-rowcount` / `aria-setsize`). Ochiladigan qatorli jadvalda yoqilmaydi.
 *
 *    <DataTable
 *      rows={orders}
 *      columns={[{ id: "createdAt", header: "Buyurtma", sortable: true, cell: (o) => <Link …>№{o.id}</Link> }, …]}
 *      getRowKey={(o) => o.id}
 *      sort={sort}
 *      onSortChange={setSort}
 *      renderCard={(o) => <Link …>…</Link>}
 *    />
 */

export type DataTableSortDirection = "asc" | "desc";

export type DataTableSort = { key: string; direction: DataTableSortDirection };

/**
 * Zichlik: `default` — maket (`th` 40, `td` 56, chekka 16); `tight` — ustunlar ko'p (amallar ustuni,
 * `manager-orders-list-*`: ichki katak 8, birinchi/oxirgi 16); `tablet-tight` — desktopda `default`,
 * < 1024 da `tight` (planshetda jadval 736 px ga sig'ishi shart, ustunlar keng — `market-orders-list`);
 * `compact` — grafik egizagi (`.is-compact`).
 */
export type DataTableDensity = "default" | "tight" | "tablet-tight" | "compact";

export type DataTableColumn<T> = {
  /** Ustun kaliti — saralashda `DataTableSort.key` ham shu. */
  id: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** `end` — son/summa (`.el-num`: o'ngga, `whitespace-nowrap`). */
  align?: "start" | "end";
  /** `lg` — < 1024 da yashirin (`.el-hide-tablet`). */
  hideBelow?: "lg";
  sortable?: boolean;
  /** Saralash tugmasi maslahati (maket: «Sana bo'yicha saralash»). */
  sortTitle?: string;
  /** Birinchi bosishdagi yo'nalish (sana — `desc`: yangilari tepada). Sukut `asc`. */
  firstDirection?: DataTableSortDirection;
  /** `th` va `td` ga (kenglik, `whitespace-nowrap`). */
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
};

export type DataTableSelection<T> = {
  isSelected: (row: T) => boolean;
  /** Tanlab bo'lmaydigan qator — belgi `disabled` (sukut: hammasi tanlanadi). */
  isSelectable?: (row: T) => boolean;
  onToggle: (row: T, checked: boolean) => void;
  /** Sahifadagi tanlanadigan barcha qatorlar. */
  onToggleAll: (checked: boolean) => void;
  /** Sarlavhadagi belgi nomi (maket: «Sahifadagi jo'natilmagan buyurtmalarni tanlash»). */
  headerLabel?: string;
  /** Qator belgisi nomi (maket: «№10242 ni tanlash»). */
  rowLabel?: (row: T) => string;
  /** Tanlab bo'lmaydigan qator belgisi nomi (maket: «№10231 allaqachon jo'natilgan, tanlab bo'lmaydi»). */
  disabledRowLabel?: (row: T) => string;
};

export type DataTableExpandable<T> = {
  isExpanded: (row: T) => boolean;
  onToggle: (row: T, next: boolean) => void;
  /** Ochilgan panel (jadvalda `colSpan` = barcha ustunlar; telefonda karta ostida). */
  render: (row: T) => ReactNode;
  /** `false` — chevron yo'q (masalan o'zgarishsiz jurnal yozuvi). Sukut: hammasi ochiladi. */
  canExpand?: (row: T) => boolean;
  /** Chevron nomi (`aria-label`): maket «Buyurtma №10227 tafsilotini ochish» / «… yopish». */
  toggleLabel?: (row: T, expanded: boolean) => string;
  /**
   * `start` (sukut) — jadval o'zi chevron ustunini chizadi; `none` — tugmani iste'molchi chizadi
   * (`onToggle` + `panelId` bilan `aria-expanded`/`aria-controls`), jadval faqat panelni chiqaradi.
   */
  toggle?: "start" | "none";
  /** Panel elementining `id` si (`aria-controls` uchun). Sukut: jadval ichida yaratiladi. */
  panelId?: (row: T) => string;
  /** Panel katagining chekkalari (sukut: maket — chevron ustuni bilan tekislangan). */
  panelClassName?: string;
  /** Ochilgan qator va panel foni (sukut `bg-sunken`; maket `*-legacy-partners` — `bg-row-hover`). */
  expandedClassName?: string;
};

export type DataTableProps<T> = {
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  getRowKey: (row: T, index: number) => string;
  /** Jadval nomi (`aria-label`), masalan «Buyurtmalar». */
  label?: string;
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null) => void;
  density?: DataTableDensity;
  selection?: DataTableSelection<T>;
  onRowClick?: (row: T, index: number) => void;
  rowClassName?: (row: T, index: number) => string | false | null | undefined;
  /** Telefonda (< 768) jadval o'rniga karta. Berilmasa — jadval (gorizontal aylanadi). */
  renderCard?: (row: T, index: number) => ReactNode;
  /** Kartalar ro'yxati nomi (sukut «Ro'yxat»). */
  cardsLabel?: string;
  /** Fonda yangilanmoqda — ro'yxat xiralashadi (`aria-busy`). */
  busy?: boolean;
  /** Tashqi o'ram (`.el-table-wrap` / kartalar ro'yxati) klassi — masalan `border-t border-border`. */
  className?: string;
  /** Ochiladigan qatorlar (tafsilot paneli). */
  expandable?: DataTableExpandable<T>;
  /** Qatorlar shu sondan ko'p bo'lsa — virtualizatsiya (faqat ko'rinadigan qatorlar DOM'da). Sukut: yo'q. */
  virtualizeFrom?: number;
};

/* ─── Klasslar (CODE-MAP 2.6) ─────────────────────────────────────────────── */

const TH = "whitespace-nowrap border-b border-border bg-sunken text-xs font-semibold uppercase tracking-[.04em] text-text-muted";
const TD = "align-middle text-text";
/** Katak pastki chizig'i — ochilgan qatorda yo'q (panel bilan bitta blok). */
const TD_BORDER = "border-b border-border";

const TH_SIZE: Record<DataTableDensity, string> = {
  default: "h-10 px-4",
  tight: "h-10 px-2 first:pl-4 last:pr-4",
  "tablet-tight": "h-10 px-4 max-lg:px-2 max-lg:first:pl-4 max-lg:last:pr-4",
  compact: "h-9 px-3",
};

const TD_SIZE: Record<DataTableDensity, string> = {
  default: "h-14 px-4 py-2",
  tight: "h-14 px-2 py-2 first:pl-4 last:pr-4",
  "tablet-tight": "h-14 px-4 py-2 max-lg:px-2 max-lg:first:pl-4 max-lg:last:pr-4",
  compact: "h-11 px-3 py-1.5",
};

const SORT_BUTTON =
  "inline-flex items-center gap-1 rounded-sm uppercase tracking-[.04em] text-text-muted hover:text-text " +
  "aria-pressed:text-text transition-[color] duration-150 motion-reduce:transition-none";

/** Virtualizatsiyada qator balandligi taxmini (px; chizilgach o'lchanadi) — `TD_SIZE` va telefon kartasi. */
const ROW_ESTIMATE: Record<DataTableDensity, number> = { default: 56, tight: 56, "tablet-tight": 56, compact: 44 };
const CARD_ESTIMATE = 112;

const CHECKBOX = "size-[18px] cursor-pointer accent-action disabled:cursor-not-allowed disabled:opacity-45";

/** Chevron ustuni (maket: `th` 52 px, o'ng chekka 0). */
const EXPAND_COL = "w-[52px] pr-0";

/** Panel chekkalari: jadvalda chevron ustuni bilan tekis (maket `4px 20px 20px 68px`), telefonda `4px 16px 20px`. */
const PANEL_TABLE: Record<"start" | "none", string> = {
  start: "pb-5 pl-[68px] pr-5 pt-1",
  none: "px-4 pb-4 pt-0",
};
const PANEL_CARD = "px-4 pb-5 pt-1";

/** Qator ichidagi interaktiv element bosildi — qator bosilishi emas. */
const INTERACTIVE = "a, button, input, label, select, textarea, summary, [role='button'], [role='checkbox'], [role='link']";

const nextSort = <T,>(column: DataTableColumn<T>, current: DataTableSort | null | undefined): DataTableSort | null => {
  const first = column.firstDirection ?? "asc";
  if (current?.key !== column.id) return { key: column.id, direction: first };
  if (current.direction === first) return { key: column.id, direction: first === "asc" ? "desc" : "asc" };
  return null;
};

const ariaSort = (direction: DataTableSortDirection | undefined) =>
  direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined;

const SortIcon = ({ direction }: { direction?: DataTableSortDirection }) => {
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
  return <Icon aria-hidden="true" size={14} strokeWidth={2} className="shrink-0" />;
};

/** Sarlavhadagi «hammasi» belgisi: `indeterminate` faqat DOM xossasi. */
const HeaderCheckbox = ({
  checked,
  indeterminate,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={CHECKBOX}
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
};

export const DataTable = <T,>({
  rows,
  columns,
  getRowKey,
  label,
  sort,
  onSortChange,
  density = "default",
  selection,
  onRowClick,
  rowClassName,
  renderCard,
  cardsLabel,
  busy = false,
  className,
  expandable,
  virtualizeFrom,
}: DataTableProps<T>) => {
  const { t } = useTranslation("ui");
  const isPhone = useIsPhone();
  const panelBaseId = useId();
  const asCards = isPhone && Boolean(renderCard);
  const anchorRef = useRef<HTMLElement | null>(null);
  const virtual = useVirtualRows({
    count: rows.length,
    enabled: virtualizeFrom !== undefined && rows.length > virtualizeFrom && !expandable,
    estimateSize: asCards ? CARD_ESTIMATE : ROW_ESTIMATE[density],
    anchorRef,
  });
  const visibleIndexes = virtual ? virtual.items.map((item) => item.index) : rows.map((_, index) => index);
  const setAnchor = (node: HTMLElement | null) => {
    anchorRef.current = node;
  };

  const selectable = (row: T) => (selection?.isSelectable ? selection.isSelectable(row) : true);
  const selectableRows = selection ? rows.filter(selectable) : [];
  const selectedCount = selection ? selectableRows.filter((row) => selection.isSelected(row)).length : 0;
  const allSelected = selectableRows.length > 0 && selectedCount === selectableRows.length;

  const rowCheckbox = (row: T) => {
    if (!selection) return null;
    const enabled = selectable(row);
    const name = enabled
      ? (selection.rowLabel?.(row) ?? t("table.selectRow"))
      : (selection.disabledRowLabel?.(row) ?? selection.rowLabel?.(row) ?? t("table.selectRow"));
    return (
      <input
        type="checkbox"
        className={CHECKBOX}
        checked={enabled && selection.isSelected(row)}
        disabled={!enabled}
        aria-label={name}
        onChange={(event) => selection.onToggle(row, event.target.checked)}
      />
    );
  };

  const toggleMode = expandable?.toggle ?? "start";
  const hasToggleColumn = Boolean(expandable) && toggleMode === "start";
  const expandableRow = (row: T) => Boolean(expandable && (expandable.canExpand ? expandable.canExpand(row) : true));
  const expandedRow = (row: T) => expandableRow(row) && Boolean(expandable?.isExpanded(row));
  const panelIdOf = (row: T, index: number) =>
    expandable?.panelId?.(row) ?? `${panelBaseId}-panel-${getRowKey(row, index)}`;

  const expandToggle = (row: T, index: number) => {
    if (!expandable) return null;
    if (!expandableRow(row)) return <span className="sr-only">{t("table.noDetails")}</span>;
    const expanded = expandedRow(row);
    return (
      <IconButton
        size={isPhone ? "md" : "sm"}
        icon={expanded ? ChevronDown : ChevronRight}
        label={expandable.toggleLabel?.(row, expanded) ?? t(expanded ? "table.collapse" : "table.expand")}
        aria-expanded={expanded}
        aria-controls={expanded ? panelIdOf(row, index) : undefined}
        onClick={() => expandable.onToggle(row, !expanded)}
      />
    );
  };

  const handleRowClick = (row: T, index: number) => (event: MouseEvent<HTMLElement>) => {
    if (!onRowClick) return;
    const target = event.target as Element | null;
    if (target?.closest(INTERACTIVE)) return;
    onRowClick(row, index);
  };

  const rowState = (row: T, index: number) => {
    const selected = Boolean(selection && selectable(row) && selection.isSelected(row));
    const expanded = expandedRow(row);
    return cx(
      selected ? "bg-action-soft" : expanded ? (expandable?.expandedClassName ?? "bg-sunken") : "hover:bg-row-hover",
      selection && !selectable(row) && "text-text-subtle",
      onRowClick && "cursor-pointer",
      rowClassName?.(row, index),
    );
  };

  if (asCards && renderCard) {
    return (
      <ul
        ref={setAnchor}
        aria-label={cardsLabel ?? label ?? t("table.cards")}
        aria-busy={busy || undefined}
        className={cx(
          "flex min-w-0 flex-col",
          busy && "opacity-60 transition-opacity duration-150 motion-reduce:transition-none",
          className,
        )}
      >
        {virtual && virtual.paddingTop > 0 ? <li aria-hidden="true" style={{ height: virtual.paddingTop }} /> : null}
        {visibleIndexes.map((index) => {
          const row = rows[index];
          return (
            <li
              key={getRowKey(row, index)}
              ref={virtual?.measureElement}
              data-index={virtual ? index : undefined}
              aria-setsize={virtual ? rows.length : undefined}
              aria-posinset={virtual ? index + 1 : undefined}
              data-selected={selection && selectable(row) && selection.isSelected(row) ? "" : undefined}
              data-expanded={expandedRow(row) ? "" : undefined}
              className={cx("relative min-w-0 border-b border-border last:border-b-0", rowState(row, index))}
              onClick={onRowClick ? handleRowClick(row, index) : undefined}
            >
              {selection ? (
                <label className="absolute left-0 top-0 z-10 inline-flex size-12 cursor-pointer items-center justify-center">
                  {rowCheckbox(row)}
                </label>
              ) : null}
              {hasToggleColumn ? (
                <div className="flex min-w-0 items-start gap-2 pr-1">
                  <div className="min-w-0 flex-1">{renderCard(row, index)}</div>
                  <div className="flex flex-none pt-2">
                    {expandableRow(row) ? expandToggle(row, index) : <span aria-hidden="true" className="block w-11" />}
                  </div>
                </div>
              ) : (
                renderCard(row, index)
              )}
              {expandable && expandedRow(row) ? (
                <div id={panelIdOf(row, index)} className={cx("min-w-0", expandable.panelClassName ?? PANEL_CARD)}>
                  {expandable.render(row)}
                </div>
              ) : null}
            </li>
          );
        })}
        {virtual && virtual.paddingBottom > 0 ? <li aria-hidden="true" style={{ height: virtual.paddingBottom }} /> : null}
      </ul>
    );
  }

  const columnCount = columns.length + (selection ? 1 : 0) + (hasToggleColumn ? 1 : 0);
  // Virtualizatsiyada ko'rinmas qatorlar o'rni (skroll uzunligi o'zgarmasin).
  const spacer = (height: number) => (
    <tr aria-hidden="true">
      <td colSpan={columnCount} className="p-0" style={{ height }} />
    </tr>
  );

  return (
    <div
      aria-busy={busy || undefined}
      className={cx(
        "relative min-w-0 overflow-x-auto",
        busy && "opacity-60 transition-opacity duration-150 motion-reduce:transition-none",
        className,
      )}
    >
      <table
        aria-label={label}
        aria-rowcount={virtual ? rows.length + 1 : undefined}
        className="w-full border-collapse text-sm [&_tbody_tr:last-child_td]:border-b-0"
      >
        <thead>
          <tr aria-rowindex={virtual ? 1 : undefined}>
            {selection ? (
              <th scope="col" className={cx(TH, TH_SIZE[density], "w-11 pr-0 text-left")}>
                <HeaderCheckbox
                  checked={allSelected}
                  indeterminate={selectedCount > 0 && !allSelected}
                  disabled={selectableRows.length === 0}
                  label={selection.headerLabel ?? t("table.selectAll")}
                  onChange={selection.onToggleAll}
                />
              </th>
            ) : null}
            {hasToggleColumn ? (
              <th scope="col" className={cx(TH, TH_SIZE[density], EXPAND_COL)}>
                <span className="sr-only">{t("table.details")}</span>
              </th>
            ) : null}
            {columns.map((column) => {
              const active = sort?.key === column.id ? sort.direction : undefined;
              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={column.sortable ? ariaSort(active) : undefined}
                  className={cx(
                    TH,
                    TH_SIZE[density],
                    column.align === "end" ? "text-right" : "text-left",
                    column.hideBelow === "lg" && "max-lg:hidden",
                    column.className,
                    column.headerClassName,
                  )}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      className={SORT_BUTTON}
                      aria-pressed={active !== undefined}
                      title={column.sortTitle}
                      onClick={() => onSortChange(nextSort(column, sort))}
                    >
                      {column.header}
                      <SortIcon direction={active} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody ref={setAnchor}>
          {virtual && virtual.paddingTop > 0 ? spacer(virtual.paddingTop) : null}
          {visibleIndexes.map((index) => {
            const row = rows[index];
            const expanded = expandedRow(row);
            const tdBorder = expanded ? null : TD_BORDER;
            return (
              <Fragment key={getRowKey(row, index)}>
                <tr
                  ref={virtual?.measureElement}
                  data-index={virtual ? index : undefined}
                  aria-rowindex={virtual ? index + 2 : undefined}
                  // `aria-selected` faqat grid/treegrid qatorida — oddiy jadvalda holat belgining o'zida (`checked`).
                  data-selected={selection && selectable(row) && selection.isSelected(row) ? "" : undefined}
                  data-expanded={expanded ? "" : undefined}
                  className={cx(
                    "transition-[background-color] duration-150 motion-reduce:transition-none",
                    rowState(row, index),
                  )}
                  onClick={onRowClick ? handleRowClick(row, index) : undefined}
                >
                  {selection ? (
                    <td className={cx(TD, tdBorder, TD_SIZE[density], "w-11 pr-0")}>{rowCheckbox(row)}</td>
                  ) : null}
                  {hasToggleColumn ? (
                    <td className={cx(TD, tdBorder, TD_SIZE[density], EXPAND_COL)}>{expandToggle(row, index)}</td>
                  ) : null}
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cx(
                        TD,
                        tdBorder,
                        TD_SIZE[density],
                        column.align === "end" && "whitespace-nowrap text-right",
                        column.hideBelow === "lg" && "max-lg:hidden",
                        column.className,
                        column.cellClassName,
                      )}
                    >
                      {column.cell(row, index)}
                    </td>
                  ))}
                </tr>
                {expandable && expanded ? (
                  <tr data-expanded-panel="" className={expandable.expandedClassName ?? "bg-sunken"}>
                    <td
                      id={panelIdOf(row, index)}
                      colSpan={columnCount}
                      className={cx(TD_BORDER, "align-top text-text", expandable.panelClassName ?? PANEL_TABLE[toggleMode])}
                    >
                      {expandable.render(row)}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
          {virtual && virtual.paddingBottom > 0 ? spacer(virtual.paddingBottom) : null}
        </tbody>
      </table>
    </div>
  );
};

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { useIsPhone } from "./date/useIsPhone";

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
};

/* ─── Klasslar (CODE-MAP 2.6) ─────────────────────────────────────────────── */

const TH = "whitespace-nowrap border-b border-border bg-sunken text-xs font-semibold uppercase tracking-[.04em] text-text-muted";
const TD = "border-b border-border align-middle text-text";

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

const CHECKBOX = "size-[18px] cursor-pointer accent-action disabled:cursor-not-allowed disabled:opacity-45";

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
}: DataTableProps<T>) => {
  const { t } = useTranslation("ui");
  const isPhone = useIsPhone();

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

  const handleRowClick = (row: T, index: number) => (event: MouseEvent<HTMLElement>) => {
    if (!onRowClick) return;
    const target = event.target as Element | null;
    if (target?.closest(INTERACTIVE)) return;
    onRowClick(row, index);
  };

  const rowState = (row: T, index: number) => {
    const selected = Boolean(selection && selectable(row) && selection.isSelected(row));
    return cx(
      selected ? "bg-action-soft" : "hover:bg-row-hover",
      selection && !selectable(row) && "text-text-subtle",
      onRowClick && "cursor-pointer",
      rowClassName?.(row, index),
    );
  };

  if (isPhone && renderCard) {
    return (
      <ul
        aria-label={cardsLabel ?? label ?? t("table.cards")}
        aria-busy={busy || undefined}
        className={cx(
          "flex min-w-0 flex-col",
          busy && "opacity-60 transition-opacity duration-150 motion-reduce:transition-none",
          className,
        )}
      >
        {rows.map((row, index) => (
          <li
            key={getRowKey(row, index)}
            data-selected={selection && selectable(row) && selection.isSelected(row) ? "" : undefined}
            className={cx("relative min-w-0 border-b border-border last:border-b-0", rowState(row, index))}
            onClick={onRowClick ? handleRowClick(row, index) : undefined}
          >
            {selection ? (
              <label className="absolute left-0 top-0 z-10 inline-flex size-12 cursor-pointer items-center justify-center">
                {rowCheckbox(row)}
              </label>
            ) : null}
            {renderCard(row, index)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div
      aria-busy={busy || undefined}
      className={cx(
        "relative min-w-0 overflow-x-auto",
        busy && "opacity-60 transition-opacity duration-150 motion-reduce:transition-none",
        className,
      )}
    >
      <table aria-label={label} className="w-full border-collapse text-sm [&_tbody_tr:last-child_td]:border-b-0">
        <thead>
          <tr>
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
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={getRowKey(row, index)}
              // `aria-selected` faqat grid/treegrid qatorida — oddiy jadvalda holat belgining o'zida (`checked`).
              data-selected={selection && selectable(row) && selection.isSelected(row) ? "" : undefined}
              className={cx(
                "transition-[background-color] duration-150 motion-reduce:transition-none",
                rowState(row, index),
              )}
              onClick={onRowClick ? handleRowClick(row, index) : undefined}
            >
              {selection ? <td className={cx(TD, TD_SIZE[density], "w-11 pr-0")}>{rowCheckbox(row)}</td> : null}
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={cx(
                    TD,
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
          ))}
        </tbody>
      </table>
    </div>
  );
};

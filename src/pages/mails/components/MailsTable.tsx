// dizayn-v2: superadmin-mails-today, manager-mails-today, courier-mails-today, superadmin-mails-refused, admin-mails-refused, manager-mails-refused, courier-mails-refused
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Badge,
  DataTable,
  type DataTableColumn,
  type DataTableSort,
} from "../../../shared/ui/primitives";
import { sortMailsRows, type MailsTableRow } from "../model/mailsLists";

export type { MailsTableRow } from "../model/mailsLists";

/**
 * POCHTALAR JADVALI — «Pochta» ro'yxatlari uchun umumiy jadval (dizayn v2, CODE-MAP §2.6).
 *
 * Maketlar: `superadmin-mails-today` (xodim), `manager-mails-today`, `courier-mails-today` (saralanadigan),
 * `*-mails-refused`; eski pochtalar va «Filial paketlari» (`*-mails-old*`) ham shu jadvalni ishlatadi.
 *
 * Ustunlar: Pochta (№ havola + sana) · Viloyat (< 1024 da ostida kuryer) · Kuryer (≥ 1024) · Holat ·
 * Buyurtmalar «N ta» · Summa (qalin) · amallar (› havola). Telefonda (< 768) — kartalar:
 *  - xodim: sarlavha — viloyat, o'ngda summa; ostida «№X · kuryer · N ta buyurtma · sana»; holat badge'i;
 *  - kuryer (`courierCards`): sarlavha — sana; ostida «Pochta №X · viloyat · N ta buyurtma».
 * Sarlavha va izohni sahifa o'zi bera oladi (`cardTitle` / `cardSub`, masalan menejerda «Pochta №X»).
 *
 * Saralash (`sortable` / `statusSortable`) — mijoz tomonida (ro'yxat to'liq keladi). Sukut: sana bo'yicha
 * kamayish (yangilari tepada, maket `aria-sort="descending"`). Qatorni bosish — tafsilotga o'tish
 * (sichqoncha uchun; klaviatura — № va › havolalari, ular `state` ni ham olib o'tadi).
 */
export type MailsTableProps<R extends MailsTableRow> = {
  rows: readonly R[];
  ariaLabel: string;
  /** «Pochta» | «Paket». */
  idHeader: string;
  /** Holat ustuni sarlavhasi (sukut «Holat»; admin/superadmin eski pochtalari maketida «Holati»). */
  statusHeader?: string;
  /** Kuryer ustuni (≥ 1024); < 1024 da kuryer viloyat ostida. */
  showCourier: boolean;
  /** Telefon kartasi: sarlavha = sana (kuryer maketlari). */
  courierCards?: boolean;
  /** Kuryer: Pochta (sana) / Buyurtmalar / Summa bo'yicha saralash, mijoz tomonida. */
  sortable?: boolean;
  /** Kuryer eski pochtalari: «Holat bo'yicha saralash». */
  statusSortable?: boolean;
  /** Eski pochtalar: Buyurtmalar < 1024 da yashirin, Summa ostida «N ta buyurtma». */
  tabletMergeOrders?: boolean;
  /** №, › va telefon kartasi uchun `<Link>` (holat bilan). */
  linkOf: (row: R) => { to: string; state?: unknown };
  /** › havolasining nomi: «№2486 pochtani ochish». */
  openLabel: (row: R) => string;
  /** › dan oldin (eski pochtalar: chekni qayta chiqarish `IconButton`). */
  rowActions?: (row: R) => ReactNode;
  /** Telefon kartasining pastki qatori, badge yonida (eski pochtalar: ghost «Chekni qayta chiqarish»). */
  cardActions?: (row: R) => ReactNode;
  /** Telefon kartasi sarlavhasi (sukut: xodim — viloyat, kuryer — sana). */
  cardTitle?: (row: R) => ReactNode;
  /** Telefon kartasi izohi (sukut — yuqoridagi tartib). */
  cardSub?: (row: R) => ReactNode;
  /** Telefon kartasi havolasining nomi (sukut: kuryer kartasida «Pochta №X, viloyat, sana, N ta buyurtma, summa — ochish»). */
  cardLabel?: (row: R) => string | undefined;
  /** Fonda yangilanmoqda — ro'yxat xiralashadi. */
  busy?: boolean;
  /** Jadval/kartalar o'rami (masalan karta ichida `border-t border-border`). */
  className?: string;
};

/** Sukut saralash — sana bo'yicha kamayish. */
const DEFAULT_SORT: DataTableSort = { key: "createdAt", direction: "desc" };

/** Qatordagi «ochish» havolasi — `IconButton size="sm"` (ghost) ko'rinishida, lekin `<a>` (yangi oynada ham ochiladi). */
const ICON_LINK =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted " +
  "transition-[background-color,color] duration-150 hover:bg-sunken hover:text-text " +
  "motion-reduce:transition-none max-md:size-11";

const ID_LINK = "whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline";
const SUB = "text-[13px] text-text-muted";

export const MailsTable = <R extends MailsTableRow>({
  rows,
  ariaLabel,
  idHeader,
  statusHeader,
  showCourier,
  courierCards = false,
  sortable = false,
  statusSortable = false,
  tabletMergeOrders = false,
  linkOf,
  openLabel,
  rowActions,
  cardActions,
  cardTitle,
  cardSub,
  cardLabel,
  busy = false,
  className,
}: MailsTableProps<R>) => {
  const { t, i18n } = useTranslation("mailsShell");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const canSort = sortable || statusSortable;
  const [sort, setSort] = useState<DataTableSort | null>(sortable ? DEFAULT_SORT : null);

  const sortedRows = useMemo(
    () => (canSort ? sortMailsRows(rows, sort, language) : [...rows]),
    [canSort, language, rows, sort],
  );

  const money = useCallback((value: number) => formatMoneyLocalized(value, { language }), [language]);
  const count = useCallback((value: number) => formatNumberLocalized(value, { language }), [language]);
  const dateTime = useCallback((value: string) => formatDateTimeLocalized(value, { language }), [language]);
  const ordersSub = useCallback(
    (value: number) => t("table.ordersSub", { count: value, value: count(value) }),
    [count, t],
  );

  const statusBadge = useCallback(
    (row: R) =>
      row.status ? (
        <Badge tone={row.status.tone} dot>
          {row.status.label}
        </Badge>
      ) : null,
    [],
  );

  const columns = useMemo<DataTableColumn<R>[]>(() => {
    const list: DataTableColumn<R>[] = [
      {
        id: "createdAt",
        header: idHeader,
        sortable,
        firstDirection: "desc",
        sortTitle: t("table.sortDate"),
        cell: (row) => {
          const link = linkOf(row);
          return (
            <>
              <Link to={link.to} state={link.state} className={ID_LINK}>
                {row.displayId}
              </Link>
              <div className={`whitespace-nowrap ${SUB}`}>{dateTime(row.createdAt)}</div>
            </>
          );
        },
      },
      {
        id: "region",
        header: t("table.region"),
        cell: (row) => (
          <>
            <div className="whitespace-nowrap">{row.regionName}</div>
            {showCourier && row.courierName ? (
              <div className={`hidden whitespace-nowrap max-lg:block ${SUB}`}>{row.courierName}</div>
            ) : null}
          </>
        ),
      },
    ];
    if (showCourier) {
      list.push({
        id: "courier",
        header: t("table.courier"),
        hideBelow: "lg",
        className: "whitespace-nowrap",
        cell: (row) => row.courierName ?? "—",
      });
    }
    list.push(
      {
        id: "status",
        header: statusHeader ?? t("table.status"),
        sortable: statusSortable,
        sortTitle: t("table.sortStatus"),
        cell: (row) => statusBadge(row) ?? "—",
      },
      {
        id: "orders",
        header: t("table.orders"),
        align: "end",
        sortable,
        firstDirection: "desc",
        sortTitle: t("table.sortOrders"),
        hideBelow: tabletMergeOrders ? "lg" : undefined,
        cell: (row) => t("table.ordersCell", { value: count(row.orders) }),
      },
      {
        id: "amount",
        header: t("table.amount"),
        align: "end",
        sortable,
        firstDirection: "desc",
        sortTitle: t("table.sortAmount"),
        cell: (row) => (
          <>
            <span className="font-semibold text-text">{money(row.amount)}</span>
            {tabletMergeOrders ? <div className={`hidden max-lg:block ${SUB}`}>{ordersSub(row.orders)}</div> : null}
          </>
        ),
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("table.actions")}</span>,
        className: rowActions ? "w-px whitespace-nowrap" : courierCards ? "w-16" : "w-14",
        cellClassName: "text-right",
        cell: (row) => {
          const link = linkOf(row);
          const label = openLabel(row);
          return (
            <span className="inline-flex items-center justify-end gap-1 align-middle">
              {rowActions?.(row)}
              <Link to={link.to} state={link.state} aria-label={label} title={label} className={ICON_LINK}>
                <ChevronRight aria-hidden="true" size={18} strokeWidth={2} />
              </Link>
            </span>
          );
        },
      },
    );
    return list;
  }, [
    count,
    courierCards,
    dateTime,
    idHeader,
    linkOf,
    money,
    openLabel,
    ordersSub,
    rowActions,
    showCourier,
    sortable,
    statusBadge,
    statusHeader,
    statusSortable,
    t,
    tabletMergeOrders,
  ]);

  const defaultTitle = useCallback(
    (row: R) => (courierCards ? dateTime(row.createdAt) : row.regionName),
    [courierCards, dateTime],
  );

  const defaultSub = useCallback(
    (row: R) =>
      courierCards ? (
        <>
          {t("table.cardId", { header: idHeader, id: row.displayId })} · {row.regionName} ·{" "}
          <span className="whitespace-nowrap">{ordersSub(row.orders)}</span>
        </>
      ) : (
        <>
          {[row.displayId, row.courierName, ordersSub(row.orders)].filter(Boolean).join(" · ")} ·{" "}
          <span className="whitespace-nowrap">{dateTime(row.createdAt)}</span>
        </>
      ),
    [courierCards, dateTime, idHeader, ordersSub, t],
  );

  const defaultCardLabel = useCallback(
    (row: R) =>
      courierCards
        ? t("table.cardLabel", {
            id: t("table.cardId", { header: idHeader, id: row.displayId }),
            region: row.regionName,
            date: dateTime(row.createdAt),
            orders: ordersSub(row.orders),
            amount: money(row.amount),
          })
        : undefined,
    [courierCards, dateTime, idHeader, money, ordersSub, t],
  );

  // Telefon kartasi (`.el-list-item`): sarlavha + summa, izoh, badge (amal bo'lsa — badge bilan pastki qatorda).
  const renderCard = useCallback(
    (row: R) => {
      const link = linkOf(row);
      const actions = cardActions?.(row);
      const head = (
        <>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex min-w-0 items-baseline justify-between gap-2">
              <span className="min-w-0 font-semibold">{(cardTitle ?? defaultTitle)(row)}</span>
              <span className="whitespace-nowrap font-semibold">{money(row.amount)}</span>
            </span>
            <span className={SUB}>{(cardSub ?? defaultSub)(row)}</span>
            {!actions && row.status ? <span className="flex flex-wrap gap-1.5">{statusBadge(row)}</span> : null}
          </span>
          <ChevronRight aria-hidden="true" size={16} strokeWidth={2} className="shrink-0 text-text-subtle" />
        </>
      );
      const label = (cardLabel ?? defaultCardLabel)(row);

      if (!actions) {
        return (
          <Link
            to={link.to}
            state={link.state}
            aria-label={label}
            className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm text-text"
          >
            {head}
          </Link>
        );
      }
      return (
        <div className="flex flex-col gap-2 px-4 py-3 text-sm text-text">
          <Link to={link.to} state={link.state} aria-label={label} className="flex min-h-11 min-w-0 items-center gap-3">
            {head}
          </Link>
          <div className="flex min-h-11 items-center justify-between gap-2">
            {statusBadge(row) ?? <span />}
            {actions}
          </div>
        </div>
      );
    },
    [cardActions, cardLabel, cardSub, cardTitle, defaultCardLabel, defaultSub, defaultTitle, linkOf, money, statusBadge],
  );

  return (
    <DataTable
      rows={sortedRows}
      columns={columns}
      getRowKey={(row) => row.id}
      label={ariaLabel}
      sort={canSort ? sort : undefined}
      onSortChange={canSort ? setSort : undefined}
      onRowClick={(row) => {
        const link = linkOf(row);
        navigate(link.to, { state: link.state });
      }}
      renderCard={renderCard}
      busy={busy}
      className={className}
    />
  );
};

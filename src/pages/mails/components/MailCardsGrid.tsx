// dizayn-v2: (maket yo'q) courier-mails-today, manager-mails-today, superadmin-branches-list-table
import { useMemo, type ReactNode } from "react";
import { Calendar, MapPin, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Skeleton } from "../../../shared/ui/primitives";
import { sortMailsRows, type MailsTableRow } from "../model/mailsLists";

/**
 * POCHTALAR KARTALARI — kuryer va HQ bo'lmagan filial menejeri uchun jadval o'rnida (dizayn v2).
 *
 * Ega qarori 2026-11-03 (BeePost uslubi): har pochta — o'z kartasi, sarlavhasi pochta sanasi va vaqti
 * («Bugun, 13:10» / «Kecha, …» / «06.10.2026, 19:05»). Qatorlar hech qachon birlashtirilmaydi: bitta karta =
 * bitta pochta. Maket yo'q — eng yaqini: `courier-mails-today` telefon qatori (mazmun) va
 * `superadmin-branches-list-table` «Kartalar» ko'rinishi (to'r). Kim ko'radi — `model/mailsCardView.ts`.
 *
 * Karta: sana (Calendar) + holat badge'i · «Pochta №X» · viloyat · kuryer (bo'lsa) · «N ta buyurtma» va summa
 * (qalin). Butun karta — `<Link to state>` (jadval qatoridagi AYNAN o'sha `to` va router holati). Amal (eski
 * pochtalarda «Chekni qayta chiqarish») havoladan TASHQARIDA, kartaning pastki qatorida — havola ichida tugma yo'q.
 *
 * Tartib: yangilari tepada (`createdAt` kamayish; eski pochtalarda — joriy server sahifasi ichida).
 * To'r: ustun ≥ 240 px (`auto-fill` — bitta karta butun enga cho'zilmaydi), telefonda bitta ustun.
 */
export type MailCardsGridProps<R extends MailsTableRow> = {
  rows: readonly R[];
  /** Ro'yxat nomi: «Bugungi pochtalar». */
  ariaLabel: string;
  /** Kartaning `<Link>` manzili va holati — jadvaldagi bilan bir xil. */
  linkOf: (row: R) => { to: string; state?: unknown };
  /** Havola nomi (sukut: «Pochta №X, sana, holat, viloyat, N ta buyurtma, summa — ochish»). */
  cardLabel?: (row: R) => string;
  /** Kuryer nomi kartada (kuryerning o'z ro'yxatida — yo'q, u o'zi). */
  showCourier?: boolean;
  /** Kartaning pastki qatoridagi amal (havoladan tashqarida). `null` — qator chizilmaydi. */
  cardActions?: (row: R) => ReactNode;
  /** Fonda yangilanmoqda — ro'yxat xiralashadi. */
  busy?: boolean;
  /** O'ram (masalan qobiq kartasi ichida `border-t border-border`). */
  className?: string;
};

const NEWEST_FIRST = { key: "createdAt", direction: "desc" } as const;

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-4 p-5 max-md:gap-3 max-md:p-4";

/** Karta yuzasi (`BranchSummaryCard` retsepti) — hover faqat havola ustida. */
const FRAME =
  "flex h-full min-w-0 flex-col rounded-xl border border-border bg-surface text-text " +
  "transition-[background-color,border-color] duration-150 motion-reduce:transition-none";
const FRAME_HOVER = "hover:border-border-strong hover:bg-row-hover";
const FRAME_LINK_HOVER = "has-[a:hover]:border-border-strong has-[a:hover]:bg-row-hover";
const BODY = "flex min-w-0 flex-1 flex-col gap-3 rounded-xl p-4";
const META = "flex min-w-0 items-center gap-1.5";
const ICON = "shrink-0 text-text-subtle";

export const MailCardsGrid = <R extends MailsTableRow>({
  rows,
  ariaLabel,
  linkOf,
  cardLabel,
  showCourier = false,
  cardActions,
  busy = false,
  className,
}: MailCardsGridProps<R>) => {
  const { t, i18n } = useTranslation(["mailsShell", "mails"]);
  const language = i18n.resolvedLanguage ?? i18n.language;

  const sortedRows = useMemo(() => sortMailsRows(rows, NEWEST_FIRST, language), [language, rows]);

  const ordersText = (value: number) =>
    t("table.ordersSub", { count: value, value: formatNumberLocalized(value, { language }) });

  const defaultLabel = (row: R) => {
    const values = {
      id: t("mailTitle", { id: row.displayId }),
      date: formatDateTimeLocalized(row.createdAt, { language }),
      region: row.regionName,
      orders: ordersText(row.orders),
      amount: formatMoneyLocalized(row.amount, { language }),
    };
    return row.status ? t("cards.label", { ...values, status: row.status.label }) : t("table.cardLabel", values);
  };

  const body = (row: R) => (
    <>
      <span className="flex min-w-0 items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-base font-bold text-text">
          <Calendar aria-hidden="true" size={16} strokeWidth={2} className={ICON} />
          <span className="min-w-0">{formatDateTimeLocalized(row.createdAt, { language })}</span>
        </span>
        {row.status ? (
          <Badge tone={row.status.tone} dot className="shrink-0">
            {row.status.label}
          </Badge>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col gap-1.5 text-[13px] text-text-muted">
        <span className="text-sm font-semibold text-text">{t("mailTitle", { id: row.displayId })}</span>
        <span className={META}>
          <MapPin aria-hidden="true" size={16} strokeWidth={2} className={ICON} />
          <span className="min-w-0 truncate">{row.regionName}</span>
        </span>
        {showCourier && row.courierName ? (
          <span className={META}>
            <Truck aria-hidden="true" size={16} strokeWidth={2} className={ICON} />
            <span className="min-w-0 truncate">{t("mails:oldCourierLabel", { name: row.courierName })}</span>
          </span>
        ) : null}
      </span>
      <span className="mt-auto flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border pt-3">
        <span className="whitespace-nowrap text-[13px] text-text-muted">{ordersText(row.orders)}</span>
        <span className="whitespace-nowrap text-base font-bold text-text">
          {formatMoneyLocalized(row.amount, { language })}
        </span>
      </span>
    </>
  );

  return (
    <ul
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      className={cx(GRID, busy && "opacity-60", className)}
    >
      {sortedRows.map((row) => {
        const link = linkOf(row);
        const label = (cardLabel ?? defaultLabel)(row);
        const actions = cardActions?.(row);
        return (
          <li key={row.id} className="min-w-0">
            {actions ? (
              <div className={cx(FRAME, FRAME_LINK_HOVER)}>
                <Link to={link.to} state={link.state} aria-label={label} className={BODY}>
                  {body(row)}
                </Link>
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-2">
                  {actions}
                </div>
              </div>
            ) : (
              <Link to={link.to} state={link.state} aria-label={label} className={cx(FRAME, FRAME_HOVER, "gap-3 p-4")}>
                {body(row)}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
};

/** Yuklanish: karta shaklidagi skelet (sana + badge, 2 qator, pastda son va summa). */
export const MailCardsGridSkeleton = ({ count = 6, className }: { count?: number; className?: string }) => (
  <div data-skeleton-preset="cards" className={cx(GRID, className)}>
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className={cx(FRAME, "gap-3 p-4")}>
        <span className="flex items-center justify-between gap-2">
          <Skeleton width="55%" height={16} />
          <Skeleton shape="block" width={64} height={24} />
        </span>
        <span className="flex flex-col gap-2">
          <Skeleton width="40%" />
          <Skeleton width="60%" />
        </span>
        <span className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <Skeleton width="35%" />
          <Skeleton width="30%" height={16} />
        </span>
      </div>
    ))}
  </div>
);

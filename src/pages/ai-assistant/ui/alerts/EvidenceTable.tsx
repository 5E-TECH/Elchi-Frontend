// dizayn-v2: superadmin-ai-assistant-alert-dialog
import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cx } from "../../../../shared/lib/cx";
import { useIsPhone } from "../../../../shared/ui/primitives/date/useIsPhone";

export type EvidenceColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** `end` — son ustuni (`.el-num`: o'ngda, bir qatorda). */
  align?: "start" | "end";
  /** < 1024 da yashirin (maket `.el-hide-tablet`). */
  hideBelow?: "lg";
  /** «Jami» qatoridagi katak (birinchi ustunda — `totalLabel`). */
  total?: ReactNode;
};

/** Telefon kartasi (`.el-list-item`): sarlavha, o'ngda qiymat, ostida izoh. */
export type EvidenceCard = { title: ReactNode; value?: ReactNode; sub?: ReactNode };

export type EvidenceTableProps<T> = {
  /** Bo'lim sarlavhasi («Dalillar · 3 ta yozuv»), `h3`. */
  title: ReactNode;
  /** Sarlavha o'ngidagi izoh («Uchala smenani … yopgan»). */
  aside?: ReactNode;
  rows: readonly T[];
  columns: readonly EvidenceColumn<T>[];
  getRowKey: (row: T) => string;
  /** Qator havolasi (smena hisoboti …): sarlavha katagi va › ustuni; `null` — havolasiz. */
  rowHref?: (row: T) => string | null;
  /** › tugmasining nomi («21.10.2026, 20:50 smena hisobotini ochish»). */
  rowLinkLabel?: (row: T) => string;
  /** › ustuni sarlavhasi (ekran o'quvchi uchun). */
  linkColumnLabel?: string;
  /** «Jami» qatori: birinchi katak matni (berilmasa — qator yo'q). */
  totalLabel?: ReactNode;
  renderCard: (row: T) => EvidenceCard;
  /** Telefondagi «Jami · 3 smena» qatori. */
  totalCard?: { label: ReactNode; value: ReactNode };
  /** Qisqartirilgan dalil («15 / 42 ta ko'rsatildi»). */
  note?: ReactNode;
};

const TH = "h-9 whitespace-nowrap bg-sunken px-3 text-xs font-semibold tracking-[.04em] text-text-muted uppercase first:pl-4";
const TD = "h-11 border-t border-border px-3 py-1.5 align-middle first:pl-4";
const ICON_LINK =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted transition-[background-color,color] " +
  "duration-150 hover:bg-sunken hover:text-text motion-reduce:transition-none";

/**
 * Dalillar jadvali (D7; maket `superadmin-ai-assistant-alert-dialog` «Dalillar»): `DataTable` da `tfoot` yo'q, shuning
 * uchun ixcham jadval shu yerda — `.el-table.is-compact` retsepti (CODE-MAP 2.6: `th` 36, `td` 44, chekka 12 · 16),
 * ramkada (`border` + 12 radius), «Jami» qatori `sunken`. Telefonda (< 768) — kartalar ro'yxati (`.el-list`, har
 * qator — havola, oxirida «Jami»). Namunasi — `widgets/dashboard-region` jadvali.
 */
export const EvidenceTable = <T,>({
  title,
  aside,
  rows,
  columns,
  getRowKey,
  rowHref,
  rowLinkLabel,
  linkColumnLabel,
  totalLabel,
  renderCard,
  totalCard,
  note,
}: EvidenceTableProps<T>) => {
  const titleId = useId();
  const isPhone = useIsPhone();
  const hasLinks = Boolean(rowHref) && rows.some((row) => Boolean(rowHref?.(row)));
  const align = (column: EvidenceColumn<T>) => (column.align === "end" ? "text-right whitespace-nowrap" : "text-left");
  const hide = (column: EvidenceColumn<T>) => (column.hideBelow === "lg" ? "max-lg:hidden" : undefined);

  const table = (
    <div className="min-w-0 overflow-x-auto rounded-xl border border-border">
      <table aria-labelledby={titleId} className="w-full border-collapse text-sm text-text">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col" className={cx(TH, align(column), hide(column))}>
                {column.header}
              </th>
            ))}
            {hasLinks ? (
              <th scope="col" className={cx(TH, "w-12")}>
                <span className="sr-only">{linkColumnLabel}</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = rowHref?.(row) ?? null;
            return (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td key={column.id} className={cx(TD, align(column), hide(column))}>
                    {column.cell(row)}
                  </td>
                ))}
                {hasLinks ? (
                  <td className={cx(TD, "w-12 pr-2 pl-0 text-right")}>
                    {href ? (
                      <Link to={href} aria-label={rowLinkLabel?.(row)} title={rowLinkLabel?.(row)} className={ICON_LINK}>
                        <ChevronRight aria-hidden="true" size={18} strokeWidth={2} />
                      </Link>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
        {totalLabel != null ? (
          <tfoot>
            <tr className="bg-sunken">
              {columns.map((column, index) => (
                <td key={column.id} className={cx(TD, align(column), hide(column), index === 0 && "font-semibold")}>
                  {index === 0 ? totalLabel : column.total}
                </td>
              ))}
              {hasLinks ? <td className={TD} /> : null}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );

  const cardBody = (card: EvidenceCard, linked: boolean) => (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 font-semibold text-text">{card.title}</span>
          {card.value != null ? <span className="shrink-0">{card.value}</span> : null}
        </span>
        {card.sub != null ? <span className="text-[13px] text-text-muted">{card.sub}</span> : null}
      </span>
      {linked ? <ChevronRight aria-hidden="true" size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-text-subtle" /> : null}
    </>
  );

  const list = (
    <ul aria-labelledby={titleId} className="m-0 flex list-none flex-col overflow-hidden rounded-xl border border-border p-0">
      {rows.map((row) => {
        const href = rowHref?.(row) ?? null;
        const card = renderCard(row);
        const itemClass = "flex min-h-14 items-start gap-3 px-3.5 py-3 text-sm text-text";
        return (
          <li key={getRowKey(row)} className="border-b border-border last:border-b-0">
            {href ? (
              <Link to={href} className={cx(itemClass, "hover:bg-row-hover")}>
                {cardBody(card, true)}
              </Link>
            ) : (
              <div className={itemClass}>{cardBody(card, false)}</div>
            )}
          </li>
        );
      })}
      {totalCard ? (
        <li className="flex min-h-12 items-center justify-between gap-3 bg-sunken px-3.5 py-3 text-sm font-semibold text-text">
          <span className="min-w-0">{totalCard.label}</span>
          <span className="shrink-0">{totalCard.value}</span>
        </li>
      ) : null}
    </ul>
  );

  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id={titleId} className="m-0 text-sm font-semibold text-text">
          {title}
        </h3>
        {aside != null ? <span className="text-xs text-text-muted">{aside}</span> : null}
      </div>
      {isPhone ? list : table}
      {note != null ? <p className="m-0 text-xs text-text-muted">{note}</p> : null}
    </section>
  );
};

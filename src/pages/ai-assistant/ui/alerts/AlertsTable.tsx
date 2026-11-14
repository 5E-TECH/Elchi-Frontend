// dizayn-v2: superadmin-ai-assistant-alerts
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import {
  AlertSeverityBadge,
  AlertStatusBadge,
  alertListTitle,
  alertSubline,
  type AdvisorTranslate,
  type AiAdvisorAlertListItem,
} from "../../../../entities/ai-advisor";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { DataTable, type DataTableColumn } from "../../../../shared/ui/primitives";

export type AlertsTableProps = {
  rows: readonly AiAdvisorAlertListItem[];
  /** Oyna havolasi (`?…&alert=<id>`, joriy parametrlar saqlanadi). */
  hrefOf: (row: AiAdvisorAlertListItem) => string;
  /** Fonda yangilanmoqda (filtr / sahifa almashuvi) — ro'yxat xiralashadi. */
  busy?: boolean;
};

/** Sarlavha — oynani ochuvchi havola (`.el-cell-title`, maket `min-width: 240px`). */
const TITLE_LINK = "block min-w-60 font-semibold text-text hover:text-action-fg hover:underline";
const SUB = "text-[13px] text-text-muted";

/** «Ochish» — `IconButton size="sm"` (ghost) ko'rinishida, lekin `<a>`. */
const ICON_LINK =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted " +
  "transition-[background-color,color] duration-150 hover:bg-sunken hover:text-text motion-reduce:transition-none";

/**
 * Ogohlantirishlar jadvali (maket `superadmin-ai-assistant-alerts`, CODE-MAP §2.6): Jiddiylik · Ogohlantirish
 * (sarlavha-havola + «Qoida · filial») · Holat · Takror «N marta» · Oxirgi marta · ›; < 1024 — oxirgi uchtasi
 * yashirin. Telefonda (< 768) — kartalar: belgilar, sarlavha, «Qoida · filial · N marta · vaqt» (takror faqat > 1).
 *
 * Har havola `?alert=<id>` ni qo'shadi (tarixga — `push`, «Orqaga» oynani yopadi). ⚠️ Ochish (GET tafsilot)
 * ogohlantirishni «Ko'rildi» qiladi — shuning uchun hover/prefetch yo'q, faqat bosilganda.
 */
export const AlertsTable = ({ rows, hrefOf, busy = false }: AlertsTableProps) => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const tt = t as unknown as AdvisorTranslate;

  const title = useCallback((row: AiAdvisorAlertListItem) => alertListTitle(row, tt, language), [language, tt]);
  const times = useCallback(
    (count: number) => t("alerts.list.occurrences", { count, value: formatNumberLocalized(count, { language }) }),
    [language, t],
  );
  const lastAt = useCallback((row: AiAdvisorAlertListItem) => formatDateTimeLocalized(row.last_at, { language }), [language]);

  const columns = useMemo<DataTableColumn<AiAdvisorAlertListItem>[]>(
    () => [
      {
        id: "severity",
        header: t("alerts.list.columns.severity"),
        className: "w-28",
        cell: (row) => <AlertSeverityBadge severity={row.severity} />,
      },
      {
        id: "alert",
        header: t("alerts.list.columns.alert"),
        cell: (row) => (
          <>
            <Link to={hrefOf(row)} aria-haspopup="dialog" className={TITLE_LINK}>
              {title(row)}
            </Link>
            <div className={SUB}>{alertSubline(row, tt)}</div>
          </>
        ),
      },
      {
        id: "status",
        header: t("alerts.list.columns.status"),
        cell: (row) => <AlertStatusBadge status={row.status} />,
      },
      {
        id: "occurrences",
        header: t("alerts.list.columns.occurrences"),
        align: "end",
        hideBelow: "lg",
        className: "whitespace-nowrap",
        cell: (row) => times(row.occurrences),
      },
      {
        id: "lastAt",
        header: t("alerts.list.columns.lastAt"),
        hideBelow: "lg",
        className: "whitespace-nowrap",
        cell: (row) => lastAt(row),
      },
      {
        id: "open",
        header: <span className="sr-only">{t("alerts.list.columns.open")}</span>,
        hideBelow: "lg",
        className: "w-14",
        cellClassName: "text-right",
        cell: (row) => {
          const label = t("alerts.list.open", { title: title(row) });
          return (
            <Link to={hrefOf(row)} aria-haspopup="dialog" aria-label={label} title={label} className={ICON_LINK}>
              <ChevronRight aria-hidden="true" size={18} strokeWidth={2} />
            </Link>
          );
        },
      },
    ],
    [hrefOf, lastAt, t, times, title, tt],
  );

  // Telefon kartasi (`.el-list-item`, `align-items: flex-start`): butun karta — oynani ochuvchi havola.
  const renderCard = useCallback(
    (row: AiAdvisorAlertListItem) => {
      const sub = [alertSubline(row, tt), row.occurrences > 1 ? times(row.occurrences) : null].filter(Boolean).join(" · ");
      return (
        <Link
          to={hrefOf(row)}
          aria-haspopup="dialog"
          className="flex min-h-14 items-start gap-3 px-4 py-3 text-sm text-text"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex flex-wrap gap-1.5">
              <AlertSeverityBadge severity={row.severity} />
              <AlertStatusBadge status={row.status} />
            </span>
            <span className="font-semibold">{title(row)}</span>
            <span className={SUB}>
              {sub} · <span className="whitespace-nowrap">{lastAt(row)}</span>
            </span>
          </span>
          <ChevronRight aria-hidden="true" size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-text-subtle" />
        </Link>
      );
    },
    [hrefOf, lastAt, times, title, tt],
  );

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(row) => row.id}
      label={t("alerts.list.label")}
      onRowClick={(row) => navigate(hrefOf(row))}
      renderCard={renderCard}
      busy={busy}
    />
  );
};

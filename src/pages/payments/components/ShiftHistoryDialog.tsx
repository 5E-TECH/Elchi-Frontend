// dizayn-v2: (maket yo'q) superadmin-payments-main-cashbox-shift-result-dialog
import { memo, useState } from "react";
import { ChevronRight, History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useShiftHistory, type ShiftHistoryRow } from "../../../entities/payments/shiftHistory";
import { formatDateTimeLocalized, formatTimeLocalized, toValidDate } from "../../../shared/lib/formatDateTime";
import { Badge, Button, Dialog, EmptyState, Pagination, QueryBoundary } from "../../../shared/ui/primitives";

/**
 * «SMENALAR TARIXI» — smena hisobotiga (`/payments/shifts/:id`) asosiy kirish yo'li (ega, 2026-11-25: «smena hisobotini
 * UI'dan topolmayapman»). Ilgari hisobotga faqat smena yopilgandagi natija oynasidan, u ham kartalar tekshirilgan
 * smenada o'tilardi.
 *
 * Maket yo'q (`/payments/shifts` ro'yxati chizilmagan) — eng yaqini `superadmin-payments-main-cashbox-shift-result-dialog`.
 * `Dialog` lg (telefonda pastki varaqa): smenalar (eng yangisi birinchi) — «Smena #16», holat («Ochiq» / «Avtomatik
 * yopilgan»), «ochilgan – yopilgan», yopgan (ochiqda — ochgan) xodim. Qator — hisobotga havola. Sahifada 10 ta.
 */

const PAGE_SIZE = 10;

type ShiftHistoryDialogProps = {
  open: boolean;
  onClose: () => void;
  /** «Asosiy kassa» yoki «Urgut filiali kassasi». */
  cashboxLabel: string;
  /** Asosiy kassa — `"0"`; menejerda berilmaydi (backend o'z filialini majburlaydi). */
  cashboxUserId?: string;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const ShiftHistoryDialog = ({ open, onClose, cashboxLabel, cashboxUserId }: ShiftHistoryDialogProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [page, setPage] = useState(1);
  const query = useShiftHistory({ page, limit: PAGE_SIZE, cashboxUserId }, open);

  const rangeText = (row: ShiftHistoryRow) => {
    const opened = toValidDate(row.openedAt);
    const closed = toValidDate(row.closedAt);
    if (!opened) return "—";
    const start = formatDateTimeLocalized(opened, { language });
    if (!closed) return t("v2MainCashbox.shift.since", { time: start });
    return `${start} – ${
      sameDay(opened, closed) ? formatTimeLocalized(closed, { language }) : formatDateTimeLocalized(closed, { language })
    }`;
  };

  const personText = (row: ShiftHistoryRow) => {
    if (row.status === "open") {
      return row.openedByName ? `${t("v2MainCashbox.shift.openedBy")}: ${row.openedByName}` : "";
    }
    return row.closedByName ? `${t("v2MainCashbox.shift.closedBy")}: ${row.closedByName}` : "";
  };

  const statusBadge = (row: ShiftHistoryRow) => {
    if (row.status === "open") {
      return (
        <Badge tone="success" dot>
          {t("v2MainCashbox.shift.history.open")}
        </Badge>
      );
    }
    return row.autoClosed ? <Badge tone="warning">{t("v2MainCashbox.shift.history.auto")}</Badge> : null;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onExited={() => setPage(1)}
      size="lg"
      icon={History}
      title={t("v2MainCashbox.shift.history.title")}
      description={t("v2MainCashbox.shift.history.subtitle", { cashbox: cashboxLabel })}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t("v2MainCashbox.shift.history.close")}
        </Button>
      }
    >
      <QueryBoundary
        query={query}
        skeleton="list"
        isEmpty={(data) => data.items.length === 0}
        loadingLabel={t("v2MainCashbox.shift.history.loading")}
        empty={
          <EmptyState
            icon={History}
            title={t("v2MainCashbox.shift.history.emptyTitle")}
            description={t("v2MainCashbox.shift.history.emptyText")}
          />
        }
      >
        {(data) => (
          <div className="flex min-w-0 flex-col gap-4">
            <ul
              aria-label={t("v2MainCashbox.shift.history.title")}
              className="m-0 flex list-none flex-col overflow-hidden rounded-xl border border-border p-0"
            >
              {data.items.map((row) => {
                const person = personText(row);
                return (
                  <li key={row.id} className="border-b border-border last:border-b-0">
                    <Link
                      to={`/payments/shifts/${row.id}`}
                      onClick={onClose}
                      className="flex min-h-14 items-center gap-3 px-4 py-3 text-text outline-none hover:bg-sunken focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-semibold">
                            {t("v2MainCashbox.shift.history.shift", { id: row.id })}
                          </span>
                          {statusBadge(row)}
                        </span>
                        <span className="text-[13px] leading-[18px] text-text-muted">{rangeText(row)}</span>
                        {person ? <span className="text-[13px] leading-[18px] text-text-muted">{person}</span> : null}
                      </span>
                      <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {data.total > PAGE_SIZE ? (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={data.total}
                onPageChange={setPage}
                label={t("v2MainCashbox.shift.history.pages")}
              />
            ) : null}
          </div>
        )}
      </QueryBoundary>
    </Dialog>
  );
};

export default memo(ShiftHistoryDialog);

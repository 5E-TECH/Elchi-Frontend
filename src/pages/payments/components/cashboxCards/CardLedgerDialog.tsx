// dizayn-v2: (maket yo'q) superadmin-payments-main-cashbox-accounts — eng yaqini «Ko'chirma» tugmasi va «Operatsiyalar tarixi»
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  exportCashboxCardLedger,
  useCashboxCardLedger,
  type CashboxCard,
} from "../../../../entities/payments/cashboxCards";
import { cx } from "../../../../shared/lib/cx";
import { getErrorStatus } from "../../../../shared/lib/errorKind";
import { getExportErrorMessage } from "../../../../shared/lib/exportFile";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatSignedMoneyLocalized, resolveMoneyLanguage } from "../../../../shared/lib/formatMoney";
import { notify } from "../../../../shared/lib/notify";
import {
  Badge,
  Button,
  DateRange,
  Dialog,
  EmptyState,
  ErrorState,
  Pagination,
  SkeletonList,
} from "../../../../shared/ui/primitives";
import { getPresetRange } from "../../../../shared/ui/primitives/date/calendarMath";

/**
 * KARTA KO'CHIRMASI (BeePost karta tafsiloti — oyna sifatida; maket yo'q, eng yaqini «Ko'chirma» tugmasi va sahifadagi
 * «Operatsiyalar tarixi» qatorlari). `GET finance/cashbox/cards/:id/ledger`:
 *
 *  - Xulosa: davr boshida, kirim, chiqim, davr oxirida, hozirgi qoldiq.
 *  - Davr filtri (`DateRange`, Toshkent kuni to'liq) — sukut «Bu oy»: backend `from_date` siz HAMMA yozuvni o'qiydi va
 *    2000 dan oshsa 400 qaytaradi (Asosiy kartaga kartasiz CLICK to'lovlari tushadi — tez o'sadi). Davrsiz («Barchasi»)
 *    shu 400 kelsa — texnik matn emas, «davrni qisqartiring» izohi (qayta urinish o'sha so'rovni takrorlardi).
 *  - Qatorlar: turi badge — neytral (reestr: «badge neytral, rangni summa oladi»), Kirim · Chiqim · O'tkazma (kirim) ·
 *    O'tkazma (chiqim) · Naqddan · Naqdga; ishorali summa, «Qoldiq: N», izoh, qarshi karta, sana; `Pagination` (20 ta).
 *  - «Excelga yuklash» — `GET …/ledger/export` (davrdagi hamma qator, 2000 tagacha).
 */

const PAGE_SIZE = 20;

/** Backend 400 «Oraliqda 2000 dan ortiq yozuv»: davr boshlanishi berilmagan so'rovda. */
const isTooManyRows = (error: unknown, from: string) => !from && getErrorStatus(error) === 400;

export type CardLedgerDialogProps = {
  open: boolean;
  onClose: () => void;
  card: CashboxCard;
  /** Kartalar nomi (qarshi karta: `counterparty_card_id` → nom). */
  cardNames: ReadonlyMap<string, string>;
};

export const CardLedgerDialog = ({ open, onClose, card, cardNames }: CardLedgerDialogProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const [range, setRange] = useState(() => getPresetRange("month"));
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const query = useCashboxCardLedger(card.id, { from: range.from, to: range.to, page, limit: PAGE_SIZE }, open);
  const ledger = query.data;
  const filtered = Boolean(range.from || range.to);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const suffix = [range.from, range.to].filter(Boolean).join("_");
      await exportCashboxCardLedger(card.id, range, `karta-${card.id}${suffix ? `-${suffix}` : ""}.xlsx`);
    } catch (error) {
      if (isTooManyRows(error, range.from)) {
        notify.error(t("cashboxCards.ledger.tooManyRows"));
        return;
      }
      notify.error((await getExportErrorMessage(error)) ?? t("cashboxCards.ledger.exportError"));
    } finally {
      setExporting(false);
    }
  };

  const summaryItems = ledger
    ? [
        { key: "opening", label: t("cashboxCards.ledger.opening"), value: money(ledger.summary.opening_balance) },
        { key: "in", label: t("cashboxCards.ledger.totalIn"), value: formatSignedMoneyLocalized(ledger.summary.total_in, { language }), className: "text-success-fg" },
        { key: "out", label: t("cashboxCards.ledger.totalOut"), value: formatSignedMoneyLocalized(-Math.abs(ledger.summary.total_out), { language }), className: "text-danger-fg" },
        { key: "closing", label: t("cashboxCards.ledger.closing"), value: money(ledger.summary.closing_balance) },
        { key: "current", label: t("cashboxCards.ledger.current"), value: money(ledger.summary.current_balance) },
      ]
    : [];

  let body;
  if (query.isLoading) {
    body = <SkeletonList rows={4} />;
  } else if (query.isError && !ledger) {
    body = isTooManyRows(query.error, range.from) ? (
      <ErrorState
        error={query.error}
        kind="generic"
        title={t("cashboxCards.ledger.error")}
        description={t("cashboxCards.ledger.tooManyRows")}
      />
    ) : (
      <ErrorState
        error={query.error}
        title={t("cashboxCards.ledger.error")}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  } else if (!ledger || ledger.items.length === 0) {
    body = (
      <EmptyState
        icon={FileText}
        title={filtered ? t("cashboxCards.ledger.emptyFiltered") : t("cashboxCards.ledger.empty")}
      />
    );
  } else {
    body = (
      <>
        <ul aria-label={t("cashboxCards.ledger.rows")} className={cx("m-0 flex list-none flex-col p-0", query.isFetching && "opacity-70")}>
          {ledger.items.map((row) => {
            const incoming = row.delta >= 0;
            const Arrow = incoming ? ArrowDownLeft : ArrowUpRight;
            const counterparty = row.counterparty_card_id
              ? (cardNames.get(row.counterparty_card_id) ?? t("cashboxCards.ledger.counterpartyUnknown"))
              : null;
            return (
              <li
                key={row.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 border-t border-border py-3 first:border-t-0"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge icon={Arrow}>
                      {t(`cashboxCards.ledger.kind.${row.kind}`)}
                    </Badge>
                    <span className="text-xs text-text-muted">{formatDateTimeLocalized(row.created_at, { language })}</span>
                  </span>
                  {row.comment ? <span className="break-words text-sm text-text">{row.comment}</span> : null}
                  {counterparty ? (
                    <span className="text-xs text-text-muted">{t("cashboxCards.ledger.counterparty", { name: counterparty })}</span>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <span className={cx("whitespace-nowrap text-sm font-semibold", incoming ? "text-success-fg" : "text-danger-fg")}>
                    {formatSignedMoneyLocalized(row.delta, { language })}
                  </span>
                  {row.balance_after !== null ? (
                    <span className="whitespace-nowrap text-xs text-text-muted">
                      {t("cashboxCards.ledger.balanceAfter", { amount: money(row.balance_after) })}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {ledger.total > PAGE_SIZE ? (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={ledger.total}
            onPageChange={setPage}
            disabled={query.isFetching}
            summary={(info) => t("cashboxCards.ledger.pagination", info)}
          />
        ) : null}
      </>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      icon={FileText}
      title={t("cashboxCards.ledger.title")}
      description={card.name}
    >
      <div className="flex flex-wrap items-center gap-2">
        <DateRange
          value={range}
          onChange={(next) => {
            setRange(next);
            setPage(1);
          }}
          aria-label={t("cashboxCards.ledger.period")}
          className="min-w-0 flex-1 basis-[240px]"
        />
        <Button
          variant="secondary"
          leftIcon={Download}
          loading={exporting}
          loadingText={t("cashboxCards.ledger.exporting")}
          onClick={() => void handleExport()}
          className="max-md:w-full"
        >
          {t("cashboxCards.ledger.excel")}
        </Button>
      </div>

      {summaryItems.length > 0 ? (
        <dl
          aria-label={t("cashboxCards.ledger.summary")}
          className="m-0 grid grid-cols-5 gap-2 rounded-xl bg-sunken p-3 max-md:grid-cols-2"
        >
          {summaryItems.map((item) => (
            <div key={item.key} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-text-muted">{item.label}</dt>
              <dd className={cx("m-0 break-words text-sm font-semibold", item.className ?? "text-text")}>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {body}
    </Dialog>
  );
};

// dizayn-v2: superadmin-integrations-panel-settlement, superadmin-integrations-settlement-pay-dialog, admin-integrations-conn-settlement, admin-integrations-settlement-pay-dialog
import { useState, type FormEvent } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Banknote, CircleCheck, Clock, Info, Plus, ReceiptText, Wallet, CircleX } from "lucide-react";
import {
  resolveBalance,
  toAmount,
  useCreateRemittance,
  useReceivableBalance,
  useReceivables,
  type BalanceSummary,
  type ReceivableRow,
} from "../../../entities/integrations/settlement";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  CURRENCY_LABEL,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatSignedMoneyLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Pagination,
  QueryBoundary,
  Skeleton,
  SkeletonTable,
  StatusBadge,
  TextInput,
  type DataTableColumn,
  type Tone,
} from "../../../shared/ui/primitives";
import { FilterChips, InlineAlert, PanelSection, SectionHead } from "../ui";
import type { Connection } from "../useConnections";

/**
 * HISOB-KITOB — tashuvchi yig'gan pul va bizga qarzi (maket `*-panel-settlement`).
 *
 *   «To'lov asosiy kassaga o'zi yoziladi» → «Qoldiq» (to'lanishi kerak, yopilmagan qarz, hamkor avansi, formula
 *   + «To'lov olindi») → «Qarz yozuvlari» (chiplar + jadval + «Shu sahifada …» + sahifalash).
 *   Hali kodda yo'q (keyingi PR'lar): «Olingan to'lovlar» va bekor qilish (IS-3), «To'lov №» ustuni, ortiqcha
 *   summa va natija oynasi (IS-2). «Kim kiritdi» ismi va «Qarz harakati» grafigi — Taklif, chizilmaydi.
 *
 * ⚠️ «To'lov olindi» summasi ASOSIY KASSAGA O'ZI YOZILADI (backend N3yNa6rO). Ekran buni aytadi — aks holda
 * operator pulni kassaga qo'lda qayta kiritib, ikki marta yozadi.
 *
 * To'lov oynasi (`*-settlement-pay-dialog`) o'zi pul amalining tasdig'i: summa, «Summa asosiy kassaga kirim
 * bo'ladi», qoldiq tafsiloti, «Yozish» — alohida «Ishonchingiz komilmi?» oynasi maketda yo'q.
 */

/**
 * Matn ichidagi havola (maket alert ichidagi `<a>`): ko'k, tagi chizilgan. ⚠️ Tarjimadagi teg nomi `<cashbox>`,
 * `<link>` EMAS — `<link>` HTML'da bo'sh (void) teg, Trans uning ichidagi matnni havoladan tashqariga chiqaradi.
 */
const INLINE_LINK = "font-semibold text-action-fg underline underline-offset-2 hover:text-action-hover";
const STRONG = <strong className="font-semibold text-text" />;

const STATUS_TAG: Record<string, { tone: Tone; labelKey: string }> = {
  pending: { tone: "warning", labelKey: "settlePending" },
  settled: { tone: "neutral", labelKey: "settleSettled" },
  cancelled: { tone: "danger", labelKey: "settleCancelled" },
};

const PAGE_SIZE = 20;

const ConnectionSettlement = ({ connection }: { connection: Connection }) => {
  const { t } = useTranslation("integrations");
  /**
   * ⚠️ HISOB-KITOB FAQAT CHIQUVCHI ULANISHDA. Qarz daftari (`provider_receivable`) tashuvchi uchun
   * yuritiladi. Hamkorda yo'nalish TESKARI — daftar ULARNING tomonida, shuning uchun soxta raqam yo'q.
   */
  if (connection.kind === "partner") {
    return (
      <PanelSection>
        <InlineAlert tone="info" title={t("stlNoLedger")}>
          <span className="block">
            {t("stlPartnerP1a")} {t("stlPartnerP1b")} {t("stlPartnerP1c")} {t("stlPartnerP1d")}
          </span>
          <span className="mt-1 block">{t("stlPartnerP2")}</span>
        </InlineAlert>
      </PanelSection>
    );
  }

  return <CarrierSettlement connection={connection} />;
};

const CarrierSettlement = ({ connection }: { connection: Connection }) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [payOpen, setPayOpen] = useState(false);

  const balance = useReceivableBalance(connection.id, { silentError: true });
  const list = useReceivables({ integrationId: connection.id, status, page, limit: PAGE_SIZE }, { silentError: true });

  const rows = list.data?.items ?? [];
  const total = list.data?.pagination.total ?? rows.length;
  const summary = resolveBalance(balance.data);
  const pageSum = rows.reduce((acc, r) => acc + toAmount(r.amount), 0);

  const statusBadge = (r: ReceivableRow) => {
    /* ⚠️ `tag`, `t` EMAS — i18n funksiyasini soya qilmasin. */
    const tag = STATUS_TAG[r.status];
    return <StatusBadge tone={tag?.tone ?? "neutral"} label={tag ? t(tag.labelKey) : r.status} />;
  };

  const columns: DataTableColumn<ReceivableRow>[] = [
    { id: "order", header: t("colOrder"), cell: (r) => <span className="font-semibold">№{r.order_id}</span> },
    { id: "ext", header: t("colExternalNumber"), cell: (r) => <span className="font-mono text-[13px]">{r.external_ref ?? "—"}</span> },
    { id: "amount", header: t("colAmount"), align: "end", cell: (r) => <span className="font-semibold">{money(toAmount(r.amount))}</span> },
    { id: "status", header: t("colStatus"), cell: statusBadge },
    {
      id: "closed",
      header: t("colClosed"),
      cell: (r) => <span className="whitespace-nowrap">{r.settled_at ? formatDateTimeLocalized(r.settled_at, { language }) : "—"}</span>,
    },
  ];

  return (
    <div className="flex min-w-0 flex-col">
      {/* ═══ KASSA OGOHLANTIRISHI + QOLDIQ (maketda bitta blok) ═══ */}
      <PanelSection aria-label={t("stlBalance")} className="gap-5">
        <InlineAlert tone="info" role="status" title={t("stlCashboxAutoTitle")}>
          <Trans
            t={t}
            i18nKey="stlCashboxAutoDesc"
            components={{ cashbox: <Link to="/payments/main-cashbox" className={INLINE_LINK} />, strong: STRONG }}
          />
        </InlineAlert>

        <div className="flex min-w-0 flex-col gap-4">
          <SectionHead
            title={t("stlBalance")}
            icon={Wallet}
            actions={
              <Button variant="secondary" leftIcon={Plus} onClick={() => setPayOpen(true)} className="max-md:min-h-11">
                {t("console.paymentReceived")}
              </Button>
            }
          />
          <BalanceBlock summary={summary} loading={balance.isLoading} error={balance.isError} hasData={Boolean(balance.data)} />
          <p className="flex items-start gap-2 text-[13px] leading-[18px] text-text-muted">
            <Info size={16} aria-hidden="true" className="mt-px flex-none" />
            <span>
              {t("stlBalanceNoteA")} <strong className="font-semibold text-text">{t("stlBalanceNoteBold")}</strong>{" "}
              {t("stlBalanceNoteB")}
            </span>
          </p>
        </div>
      </PanelSection>

      {/* ═══ QARZ YOZUVLARI ═══ */}
      <PanelSection aria-label={t("stlRows")} className="pb-4">
        <SectionHead title={t("stlRows")} icon={ReceiptText} />
        <FilterChips
          ariaLabel={t("console.statusFilterAria")}
          value={status}
          onChange={(v) => {
            setStatus(v);
            // Filtr o'zgarganda sahifani boshiga qaytaramiz.
            setPage(1);
          }}
          options={[
            { value: "pending", label: t("settlePending"), icon: Clock },
            { value: "settled", label: t("settleSettled"), icon: CircleCheck },
            { value: "cancelled", label: t("settleCancelled"), icon: CircleX },
            { value: "all", label: t("filterAll") },
          ]}
        />
      </PanelSection>
      <QueryBoundary
        query={{ data: list.data ? rows : undefined, isLoading: list.isLoading, isError: list.isError, error: list.error, refetch: list.refetch }}
        loading={<SkeletonTable framed={false} rows={4} columns={[t("colOrder"), t("colExternalNumber"), t("colAmount"), t("colStatus")]} />}
        empty={<EmptyState icon={Banknote} title={t("console.receivablesEmpty")} />}
        error={(error, retry) => <ErrorState error={error} title={t("console.receivablesError")} onRetry={retry} />}
        className="border-t border-border"
      >
        {(list_, { isRefetching }) => (
          <>
            <DataTable
              rows={list_}
              columns={columns}
              getRowKey={(r) => String(r.id)}
              label={t("stlRows")}
              busy={isRefetching}
              renderCard={(r) => (
                <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">№{r.order_id}</span>
                    <span className="font-semibold">{money(toAmount(r.amount))}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {statusBadge(r)}
                    <span className="text-xs text-text-muted">
                      {r.external_ref ?? "—"}
                      {r.settled_at ? ` · ${t("colClosed")}: ${formatDateTimeLocalized(r.settled_at, { language })}` : ""}
                    </span>
                  </span>
                </div>
              )}
            />
            {/* Jami — jadval ostida: operator sahifadagi summani ko'rib turadi. */}
            <div className="flex items-center justify-between gap-3 border-t border-border bg-sunken px-5 py-3 text-sm max-md:px-4">
              <span className="font-semibold text-text-muted">{t("stlPageTotal")}</span>
              <span className="font-bold text-text">{money(pageSum)}</span>
            </div>
          </>
        )}
      </QueryBoundary>
      {total > 0 ? (
        <div className="border-t border-border px-5 py-3 max-md:px-4">
          <Pagination
            page={list.data?.pagination.page ?? page}
            pageSize={list.data?.pagination.limit ?? PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            summary={(range) => t("console.recordsRange", range)}
          />
        </div>
      ) : null}

      <PayDialog
        open={payOpen}
        connection={connection}
        // Qoldiq o'qilmagan bo'lsa — oynada «0 so'm» emas, «—» (nol degani emas).
        summary={balance.data ? summary : null}
        onClose={() => setPayOpen(false)}
        onPaid={() => {
          void balance.refetch();
          void list.refetch();
        }}
      />
    </div>
  );
};

/** Qoldiq tafsiloti qatori (maket `<dl>`: chapda nom, o'ngda qalin summa va ixtiyoriy izoh). */
const BalanceRow = ({
  label,
  value,
  note,
  strong,
  first,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
  first?: boolean;
}) => (
  <div className={cx("flex items-center justify-between gap-3 py-2.5", !first && "border-t border-border")}>
    <dt className={cx("min-w-0 text-[13px] text-text", strong && "font-semibold")}>{label}</dt>
    <dd className="m-0 flex flex-col items-end gap-0.5">
      <span className="whitespace-nowrap font-semibold text-text proportional-nums">{value}</span>
      {note ? <span className="text-right text-xs text-text-subtle">{note}</span> : null}
    </dd>
  </div>
);

/**
 * «Qoldiq» bloki (maket `*-panel-settlement`): «To'lanishi kerak» (`payable_amount`) katta son + «N ta yozuv
 * kutilmoqda» / «Qarz yo'q»; ostida «Yopilmagan qarz» va «Hamkor avansi» (qarz bor — «−N», izoh «oldingi to'lovdan
 * ortib qolgan»; qarz yo'q — «N», izoh «keyingi qarzlarga o'zi qo'llanadi»), so'ng formula izohi (qarz bo'lsa).
 */
const BalanceBlock = ({
  summary,
  loading,
  error,
  hasData,
}: {
  summary: BalanceSummary;
  loading: boolean;
  error: boolean;
  hasData: boolean;
}) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const { payable, outstanding, outstandingCount, advance, noDebt } = summary;

  if (loading) {
    return (
      <div className="flex w-full max-w-[560px] flex-col gap-3" aria-busy="true">
        <Skeleton width={120} height={14} />
        <Skeleton width={200} height={36} />
        <Skeleton height={40} />
      </div>
    );
  }
  if (error && !hasData) {
    return <p className="text-xs text-danger-fg">{t("ovwBalanceError")}</p>;
  }

  return (
    <div className="flex w-full max-w-[560px] min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-text-muted">{t("stlPayable")}</span>
        <span className="whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] text-text proportional-nums max-md:text-[22px] max-md:leading-[30px]">
          {formatNumberLocalized(payable, { language })}
          <span className="sr-only"> </span>
          <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted max-md:text-[13px]">
            {CURRENCY_LABEL[resolveMoneyLanguage(language)]}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          {outstandingCount > 0 ? (
            <Badge tone="warning" dot>
              {t("console.pendingRecords", { count: outstandingCount })}
            </Badge>
          ) : noDebt ? (
            <Badge tone="neutral" dot>
              {t("stlNoDebt")}
            </Badge>
          ) : null}
        </span>
      </div>
      <dl className="m-0 flex flex-col">
        <BalanceRow first label={t("stlOutstanding")} value={money(outstanding)} />
        <BalanceRow
          label={t("stlAdvance")}
          // Qarz bor — avans undan ayriladi («−N»); qarz yo'q — avans kutib turgan summa (ishorasiz).
          value={noDebt ? money(advance) : formatSignedMoneyLocalized(-advance, { language })}
          note={advance > 0 ? t(noDebt ? "stlAdvanceAppliesNext" : "stlAdvanceFromPrevious") : undefined}
        />
      </dl>
      {noDebt ? null : <p className="text-xs text-text-subtle">{t("stlPayableFormula")}</p>}
      {error ? <span className="text-xs text-danger-fg">{t("ovwBalanceError")}</span> : null}
    </div>
  );
};

/** «Tashuvchidan olingan to'lov» oynasi (maket `*-settlement-pay-dialog`; telefonda pastki varaqa). */
const PayDialog = ({
  open,
  connection,
  summary,
  onClose,
  onPaid,
}: {
  open: boolean;
  connection: Connection;
  /** `null` — qoldiq o'qilmagan: summalar o'rnida «—», tafsilot ko'rsatilmaydi. */
  summary: BalanceSummary | null;
  onClose: () => void;
  onPaid: () => void;
}) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const createRemittance = useCreateRemittance();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const value = Number(amount);
  const amountError = !touched
    ? undefined
    : !amount.trim()
      ? t("stlAmountRequired")
      : !Number.isFinite(value) || value < 1
        ? t("stlAmountPositive")
        : undefined;

  const reset = () => {
    setAmount("");
    setReference("");
    setNote("");
    setTouched(false);
  };

  const close = () => {
    // Ikki marta bosishdan himoya: so'rov ketayotganda oyna yopilmaydi.
    if (createRemittance.isPending) return;
    reset();
    onClose();
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setTouched(true);
    if (!amount.trim() || !Number.isFinite(value) || value < 1) return;
    if (createRemittance.isPending) return;
    try {
      await createRemittance.mutateAsync({
        integrationId: connection.id,
        amount: value,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      notify.success(t("stlPaid"));
      reset();
      onClose();
      onPaid();
    } catch {
      // Xom backend matni (inglizcha `message`) ko'rsatilmaydi — faqat i18n matn.
      notify.error(t("console.paymentFailed"), { description: t("stlPayFailedDesc") });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={createRemittance.isPending}
      title={t("stlPayTitle")}
      description={t("console.payDialogSubPayable", {
        name: connection.name,
        amount: summary ? money(summary.payable) : "—",
      })}
      icon={Wallet}
      size="md"
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={createRemittance.isPending}>
            {t("stlPayBack")}
          </Button>
          <Button type="submit" loading={createRemittance.isPending}>
            {t("stlPayOk")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <InlineAlert tone="info" role="status" title={t("stlPayCashboxTitle")}>
          {t("stlPayCashboxDesc")}
        </InlineAlert>
        <Field label={t("stlAmount")} required error={amountError}>
          <TextInput
            mode="money"
            value={amount}
            onValueChange={setAmount}
            // Bo'sh maydondan chiqish xato emas (oyna ochilganda fokus ko'chishi ham blur beradi) — «shart» xatosi
            // faqat «Yozish» bosilganda; yozilgan noto'g'ri qiymat esa chiqishda darhol ko'rsatiladi.
            onBlur={() => {
              if (amount.trim()) setTouched(true);
            }}
            placeholder="1 500 000"
          />
        </Field>
        <Field label={t("stlPayReference")} hint={t("stlPayReferenceHint")}>
          <TextInput value={reference} onValueChange={setReference} placeholder="TXN-2026-0912" />
        </Field>
        <Field label={t("stlNote")}>
          <TextInput multiline value={note} onValueChange={setNote} placeholder={t("stlNotePlaceholder")} rows={2} />
        </Field>
        {/* Qoldiq tafsiloti (maket `<dl>` `bg-sunken` ichida) — summani nimaga qarab yozish kerakligi. */}
        {summary ? (
          <dl className="m-0 flex flex-col rounded-[10px] bg-sunken px-3.5 py-1">
            <BalanceRow
              first
              label={t("stlOutstanding")}
              value={money(summary.outstanding)}
              note={t("stlPayRecords", { count: summary.outstandingCount })}
            />
            <BalanceRow label={t("stlAdvance")} value={formatSignedMoneyLocalized(-summary.advance, { language })} />
            <BalanceRow strong label={t("stlPayable")} value={money(summary.payable)} />
          </dl>
        ) : null}
        <p className="flex items-start gap-2 text-[13px] leading-[18px] text-text-muted">
          <Info size={16} aria-hidden="true" className="mt-px flex-none" />
          <span>
            <Trans t={t} i18nKey="stlPayOldestFirst" components={{ strong: STRONG }} />
          </span>
        </p>
      </div>
    </Dialog>
  );
};

export default ConnectionSettlement;

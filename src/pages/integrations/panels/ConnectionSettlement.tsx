// dizayn-v2: superadmin-integrations-panel-settlement, superadmin-integrations-settlement-pay-dialog, admin-integrations-conn-settlement, admin-integrations-settlement-pay-dialog
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Banknote, CircleCheck, Clock, Plus, ReceiptText, Wallet, CircleX } from "lucide-react";
import {
  toAmount,
  useCreateRemittance,
  useReceivableBalance,
  useReceivables,
  type ReceivableRow,
} from "../../../entities/integrations/settlement";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { CURRENCY_LABEL, formatMoneyLocalized, formatNumberLocalized, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
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
 *   «Bu ekran kassa emas» → «Qoldiq» (yopilmagan qarz + «To'lov olindi») → «Qarz yozuvlari» (chiplar + jadval
 *   + «Shu sahifada …» + sahifalash). «Qarz harakati · oxirgi 30 kun» — «Taklif» (seriya API'da yo'q), chizilmaydi.
 *
 * ⚠️ BU EKRAN KASSAGA YOZMAYDI. Backend ham shunday: «Reconciliation only — does not post to a cashbox».
 * Buni ekranda AYTISH shart, aks holda operator pulni ikki marta kiritganini bilmay qoladi.
 *
 * To'lov oynasi (`*-settlement-pay-dialog`) o'zi pul amalining tasdig'i: summa, «Kassaga yozilmaydi»,
 * «Yozish» — alohida «Ishonchingiz komilmi?» oynasi maketda yo'q.
 */

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

  const balance = useReceivableBalance(connection.id);
  const list = useReceivables({ integrationId: connection.id, status, page, limit: PAGE_SIZE });

  const rows = list.data?.items ?? [];
  const total = list.data?.pagination.total ?? rows.length;
  const outstanding = toAmount(balance.data?.outstanding_amount ?? 0);
  const outstandingCount = balance.data?.outstanding_count ?? 0;
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
      <PanelSection>
        <InlineAlert tone="info" title={t("stlNotCashbox")}>
          {t("stlNotCashboxDesc")}
        </InlineAlert>
      </PanelSection>

      {/* ═══ QOLDIQ ═══ */}
      <PanelSection aria-label={t("stlBalance")}>
        <SectionHead
          title={t("stlBalance")}
          icon={Wallet}
          actions={
            <Button variant="secondary" leftIcon={Plus} onClick={() => setPayOpen(true)} className="max-md:min-h-11">
              {t("console.paymentReceived")}
            </Button>
          }
        />
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-text-muted">{t("stlOutstanding")}</span>
          {balance.isLoading ? (
            <Skeleton width={180} height={36} />
          ) : (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="whitespace-nowrap text-[28px] leading-9 font-bold text-text proportional-nums">
                {formatNumberLocalized(outstanding, { language })}
                <span className="sr-only"> </span>
                <span className="ml-1 text-sm font-semibold text-text-muted">{CURRENCY_LABEL[resolveMoneyLanguage(language)]}</span>
              </span>
              {outstandingCount > 0 ? (
                <Badge tone="warning" dot>
                  {t("console.pendingRecords", { count: outstandingCount })}
                </Badge>
              ) : null}
            </span>
          )}
          {balance.isError ? <span className="text-xs text-danger-fg">{t("ovwBalanceError")}</span> : null}
        </div>
        <p className="text-xs text-text-muted">
          {t("stlBalanceNoteA")} {t("stlBalanceNoteBold")} {t("stlBalanceNoteB")}
        </p>
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
        outstanding={outstanding}
        onClose={() => setPayOpen(false)}
        onPaid={() => {
          void balance.refetch();
          void list.refetch();
        }}
      />
    </div>
  );
};

/** «Tashuvchidan olingan to'lov» oynasi (maket `*-settlement-pay-dialog`; telefonda pastki varaqa). */
const PayDialog = ({
  open,
  connection,
  outstanding,
  onClose,
  onPaid,
}: {
  open: boolean;
  connection: Connection;
  outstanding: number;
  onClose: () => void;
  onPaid: () => void;
}) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
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
    } catch (error) {
      notify.error(getBackendErrorMessage(error) || t("console.paymentFailed"));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={createRemittance.isPending}
      title={t("stlPayTitle")}
      description={t("console.payDialogSub", { name: connection.name, amount: formatMoneyLocalized(outstanding, { language }) })}
      icon={Wallet}
      size="md"
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={createRemittance.isPending}>
            {t("npCancel")}
          </Button>
          <Button type="submit" loading={createRemittance.isPending}>
            {t("stlPayOk")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <InlineAlert tone="warning" title={t("stlPayWarn")}>
          {t("stlPayWarnDesc")}
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
        <Field label={t("stlReference")} hint={t("stlReferenceHint")}>
          <TextInput value={reference} onValueChange={setReference} placeholder="TXN-2026-0912" />
        </Field>
        <Field label={t("stlNote")}>
          <TextInput multiline value={note} onValueChange={setNote} placeholder={t("stlNotePlaceholder")} rows={2} />
        </Field>
        <p className="text-xs text-text-muted">
          {t("stlOldestFirstA")} {t("stlOldestFirstBold")} {t("stlOldestFirstB")}{" "}
          <span className="font-semibold text-text">{formatMoneyLocalized(outstanding, { language })}</span>
        </p>
      </div>
    </Dialog>
  );
};

export default ConnectionSettlement;

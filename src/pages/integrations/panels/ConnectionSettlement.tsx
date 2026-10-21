// dizayn-v2: superadmin-integrations-panel-settlement, superadmin-integrations-settlement-pay-dialog, superadmin-integrations-settlement-pay-overpay-dialog, admin-integrations-conn-settlement, admin-integrations-settlement-pay-dialog, admin-integrations-settlement-pay-overpay-dialog
import { useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Banknote, CircleCheck, Clock, Info, Plus, ReceiptText, TriangleAlert, Wallet, CircleX } from "lucide-react";
import {
  isExactRemittance,
  overpayPreview,
  resolveBalance,
  toAmount,
  useCreateRemittance,
  useReceivableBalance,
  useReceivables,
  type BalanceSummary,
  type ReceivableRow,
} from "../../../entities/integrations/settlement";
import { refreshCashboxQueries } from "../../../entities/payments";
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
import { BALANCE_LIST_CLASS, BalanceRow } from "./settlement/BalanceRow";
import PayResultDialog, { type PayResultContext } from "./settlement/PayResultDialog";
import RemittancesSection from "./settlement/RemittancesSection";
import { focusRemittancesSection } from "./settlement/remittancesAnchor";

/**
 * HISOB-KITOB — tashuvchi yig'gan pul va bizga qarzi (maket `*-panel-settlement`).
 *
 *   «To'lov asosiy kassaga o'zi yoziladi» → «Qoldiq» (to'lanishi kerak, yopilmagan qarz, hamkor avansi, formula
 *   + «To'lov olindi») → «Olingan to'lovlar» (IS-3: sana + chiplar, jadval, «Bekor qilish» oynasi —
 *   `settlement/RemittancesSection`) → «Qarz yozuvlari» (chiplar + jadval «… · To'lov №N · …» + «Shu sahifada …» +
 *   sahifalash; «To'lov №N» — «Olingan to'lovlar» ga o'tish).
 *   «Kim kiritdi / bekor qildi» ismi va «Qarz harakati» grafigi — Taklif, chizilmaydi.
 *
 * ⚠️ «To'lov olindi» summasi ASOSIY KASSAGA O'ZI YOZILADI (backend N3yNa6rO). Ekran buni aytadi — aks holda
 * operator pulni kassaga qo'lda qayta kiritib, ikki marta yozadi.
 *
 * To'lov oynasi (`*-settlement-pay-dialog`) o'zi pul amalining tasdig'i: summa, «Summa asosiy kassaga kirim
 * bo'ladi», qoldiq tafsiloti, «Yozish» — alohida «Ishonchingiz komilmi?» oynasi maketda yo'q. Summa «to'lanishi
 * kerak» dan katta bo'lsa (`*-pay-overpay-dialog`, ega S2) — ogohlantirish «Ortig'i hamkor avansiga o'tadi» va
 * «Summani … ga tenglash»; «Yozish» bloklanmaydi. Natija: aniq tushib kassaga yozilsa — xabar, aks holda
 * «To'lov yozildi» oynasi (`settlement/PayResultDialog`). Kassa, moliya tarixi, bosh sahifa kalitlari —
 * `refreshCashboxQueries`.
 */

/**
 * Matn ichidagi havola (maket alert ichidagi `<a>`): ko'k, tagi chizilgan, oddiy qalinlikda (maketdagi kabi). Telefonda
 * balandligi 44px dan kichik — matn ichidagi havola (WCAG 2.5.8 «inline» istisnosi). ⚠️ Tarjimadagi teg nomi `<cashbox>`,
 * `<link>` EMAS — `<link>` HTML'da bo'sh (void) teg, Trans uning ichidagi matnni havoladan tashqariga chiqaradi.
 */
const INLINE_LINK = "text-action-fg underline underline-offset-2 hover:text-action-hover";
const STRONG = <strong className="font-semibold text-text" />;
/** Ogohlantirish ichidagi summa (maket `.el-strong`, `white-space: nowrap`) — alert rangini saqlaydi. */
const STRONG_NOWRAP = <strong className="whitespace-nowrap font-semibold" />;

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
  /** Natija oynasi: mazmun yopilish animatsiyasida ham qoladi (`resultOpen` alohida). */
  const [result, setResult] = useState<PayResultContext | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  /**
   * «To'lov olindi» — natija oynasi yopilgach fokus shu tugmaga qaytadi. Natija oynasi to'lov oynasi yopilayotgan
   * paytda ochiladi: o'z-o'zidan «ochgan element» to'lov oynasidagi «Yozish» bo'lib qoladi, u esa DOM'dan olinadi.
   */
  const payTriggerRef = useRef<HTMLButtonElement>(null);

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

  /** «To'lov №82» — qarzni yopgan to'lov (jadvalda «Olingan to'lovlar» bo'limiga o'tadi, kartada — matn). */
  const remittanceLabel = (r: ReceivableRow) =>
    r.remittance_id ? t("settlementPay.remittanceNo", { id: r.remittance_id }) : null;

  const columns: DataTableColumn<ReceivableRow>[] = [
    { id: "order", header: t("colOrder"), cell: (r) => <span className="font-semibold">№{r.order_id}</span> },
    {
      id: "ext",
      header: t("colExternalNumber"),
      hideBelow: "lg",
      cell: (r) => <span className="font-mono text-[13px]">{r.external_ref ?? "—"}</span>,
    },
    { id: "amount", header: t("colAmount"), align: "end", cell: (r) => <span className="font-semibold">{money(toAmount(r.amount))}</span> },
    { id: "status", header: t("colStatus"), cell: statusBadge },
    {
      id: "remittance",
      header: t("settlementPay.colRemittance"),
      cell: (r) => {
        const label = remittanceLabel(r);
        return label ? (
          <Button variant="link" size="sm" className="-mx-1 whitespace-nowrap underline" onClick={focusRemittancesSection}>
            {label}
          </Button>
        ) : (
          <span className="text-text-subtle">—</span>
        );
      },
    },
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
              <Button ref={payTriggerRef} variant="secondary" leftIcon={Plus} onClick={() => setPayOpen(true)}>
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

      {/* ═══ OLINGAN TO'LOVLAR (IS-3) ═══ */}
      <RemittancesSection
        integrationId={connection.id}
        connectionName={connection.name}
        // Qoldiq o'qilmagan bo'lsa — bekor qilish to'sig'i oldindan aytilmaydi (backend 409 zaxira).
        advanceBalance={balance.data ? summary.advance : null}
      />

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
        loading={
          <SkeletonTable
            framed={false}
            rows={4}
            columns={[
              t("colOrder"),
              t("colExternalNumber"),
              t("colAmount"),
              t("colStatus"),
              t("settlementPay.colRemittance"),
              t("colClosed"),
            ]}
          />
        }
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
                  {/* Maket: «TY-447738 · To'lov №82 · Bugun, 11:20», ostida holat. */}
                  <span className="text-xs text-text-muted">
                    {[
                      r.external_ref ?? "—",
                      remittanceLabel(r),
                      r.settled_at ? formatDateTimeLocalized(r.settled_at, { language }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">{statusBadge(r)}</span>
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
        onResult={(context) => {
          setResult(context);
          setResultOpen(true);
        }}
      />
      <PayResultDialog
        open={resultOpen}
        context={result}
        returnFocus={payTriggerRef}
        onClose={() => setResultOpen(false)}
      />
    </div>
  );
};

/**
 * «Hamkor avansi» summasi — panel va to'lov oynasida bir xil: qarz bor — avans undan ayriladi («−N»); qarz yo'q —
 * avans kutib turgan summa (ishorasiz).
 */
const advanceValue = ({ advance, noDebt }: BalanceSummary, language: string) =>
  noDebt ? formatMoneyLocalized(advance, { language }) : formatSignedMoneyLocalized(-advance, { language });

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
          value={advanceValue(summary, language)}
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
  onResult,
}: {
  open: boolean;
  connection: Connection;
  /** `null` — qoldiq o'qilmagan: summalar o'rnida «—», tafsilot ko'rsatilmaydi, ortiqcha summa oldindan aytilmaydi. */
  summary: BalanceSummary | null;
  onClose: () => void;
  /** Summa qarzga aniq tushmadi yoki kassaga yozilmadi — natija oynasi. */
  onResult: (context: PayResultContext) => void;
}) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const client = useQueryClient();
  const createRemittance = useCreateRemittance();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  /** «Summani … ga tenglash» bosilgach tugma yo'qoladi — fokus summa maydoniga o'tadi (oynadan chiqib ketmaydi). */
  const amountRef = useRef<HTMLInputElement>(null);

  const value = Number(amount);
  const amountError = !touched
    ? undefined
    : !amount.trim()
      ? t("stlAmountRequired")
      : !Number.isFinite(value) || value < 1
        ? t("stlAmountPositive")
        : undefined;
  /**
   * «Summani … ga tenglash» — to'lanishi kerak ≥ 1 bo'lsa. Maydon faqat butun so'm qabul qiladi: tiyinli qoldiq
   * (4 510 000,50) yuqoriga yaxlitlanadi.
   */
  const equalizeTo = summary && summary.payable >= 1 ? Math.ceil(summary.payable) : null;
  /**
   * Ortiqcha summa (ega S2): ogohlantirish, «Yozish» bloklanmaydi. Xato bo'lsa — ko'rsatilmaydi. Tenglangan summa
   * (yaxlitlangan qoldiqqa teng yoki kichik) ortiqcha emas — aks holda «0,50 so'm ortiq» qolib, tugma takrorlanardi.
   */
  const overpay = amountError || (equalizeTo !== null && value <= equalizeTo) ? null : overpayPreview(value, summary);

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
    const trimmedReference = reference.trim() || undefined;
    try {
      const result = await createRemittance.mutateAsync({
        integrationId: connection.id,
        amount: value,
        reference: trimmedReference,
        note: note.trim() || undefined,
      });
      // Summa MAIN kassaga ham yozildi — kassa, moliya tarixi, bosh sahifa, daromad, KPI, marketlar.
      void refreshCashboxQueries(client);
      reset();
      onClose();
      if (isExactRemittance(result)) {
        notify.success(t("settlementPay.recorded"), {
          description: t("settlementPay.toastDesc", { count: result.settledCount, amount: money(result.remitted) }),
        });
      } else {
        onResult({ result, connectionName: connection.name, reference: trimmedReference, before: summary, at: new Date() });
      }
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
      icon={Banknote}
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
        {overpay ? null : (
          <InlineAlert tone="info" role="status" title={t("stlPayCashboxTitle")}>
            {t("stlPayCashboxDesc")}
          </InlineAlert>
        )}
        <Field
          label={t("stlAmount")}
          required
          error={amountError}
          hintLive
          hint={
            overpay ? (
              <span className="flex items-center gap-1.5 text-warning-fg">
                <TriangleAlert size={14} aria-hidden="true" className="flex-none" />
                {t("settlementPay.overpayHint", { amount: money(overpay.excess) })}
              </span>
            ) : undefined
          }
        >
          <TextInput
            ref={amountRef}
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
        {overpay ? (
          /* Ortiqcha summa (maket `*-pay-overpay-dialog`): qoldiq tafsiloti o'rnida ogohlantirish + tenglash. */
          <>
            <InlineAlert tone="warning" role="status" title={t("settlementPay.overpayTitle")}>
              <Trans
                t={t}
                i18nKey={overpay.recordsClosed > 0 ? "settlementPay.overpayDesc" : "settlementPay.overpayNoDebtDesc"}
                count={overpay.recordsClosed > 0 ? overpay.recordsClosed : undefined}
                values={{
                  name: connection.name,
                  advance: money(overpay.advanceAfter),
                  amount: money(value),
                }}
                components={{ strong: STRONG_NOWRAP }}
              />
            </InlineAlert>
            {equalizeTo !== null ? (
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => {
                  setAmount(String(equalizeTo));
                  amountRef.current?.focus();
                }}
              >
                {t("settlementPay.equalize", { amount: money(equalizeTo) })}
              </Button>
            ) : null}
          </>
        ) : summary ? (
          /* Qoldiq tafsiloti (maket `<dl>` `bg-sunken` ichida) — summani nimaga qarab yozish kerakligi. */
          <dl className={BALANCE_LIST_CLASS}>
            <BalanceRow
              first
              label={t("stlOutstanding")}
              value={money(summary.outstanding)}
              note={t("stlPayRecords", { count: summary.outstandingCount })}
            />
            <BalanceRow label={t("stlAdvance")} value={advanceValue(summary, language)} />
            <BalanceRow strong label={t("stlPayable")} value={money(summary.payable)} />
          </dl>
        ) : null}
        {overpay ? null : (
          <p className="flex items-start gap-2 text-[13px] leading-[18px] text-text-muted">
            <Info size={16} aria-hidden="true" className="mt-px flex-none" />
            <span>
              <Trans t={t} i18nKey="stlPayOldestFirst" components={{ strong: STRONG }} />
            </span>
          </p>
        )}
      </div>
    </Dialog>
  );
};

export default ConnectionSettlement;

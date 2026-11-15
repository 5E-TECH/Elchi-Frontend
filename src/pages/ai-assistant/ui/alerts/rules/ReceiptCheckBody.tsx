// dizayn-v2: superadmin-ai-assistant-alert-dialog-receipt
import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Receipt, TriangleAlert, X } from "lucide-react";
import {
  advisorUserName,
  formatAdvisorDay,
  type AiAdvisorEvidenceReceiptCheck,
} from "../../../../../entities/ai-advisor";
import { formatDateTimeLocalized } from "../../../../../shared/lib/formatDateTime";
import {
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
} from "../../../../../shared/lib/formatMoney";
import { Badge } from "../../../../../shared/ui/primitives";
import { AlertFacts, SignedMoney } from "../AlertFacts";
import type { RuleBodyProps } from "./types";

/** Tranzaksiya raqami: faqat raqamlar bo'lsa — uchtadan guruh («512 778 940 112»), aks holda — o'zicha. */
const groupDigits = (value: string) => (/^\d{4,}$/.test(value) ? value.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : value);

/** «UzAuto Petrol, 12-shoxobcha · ··8840» — karta raqamining oxirgi 4 xonasi bilan. */
const withLast4 = (name: string | null, last4: string | null): ReactNode => {
  if (!name && !last4) return null;
  if (!last4) return name;
  const tail = <span className="whitespace-nowrap">··{last4}</span>;
  return name ? (
    <>
      {name} · {tail}
    </>
  ) : (
    tail
  );
};

/** Doimiy izoh qatori (ikonka + 13 px kulrang) — «Bu hafta 46 ta chek tekshirildi …». */
const NoteLine = ({ children, boxed = false }: { children: ReactNode; boxed?: boolean }) => (
  <p
    className={
      boxed
        ? "m-0 flex items-start gap-2 rounded-xl bg-sunken px-3.5 py-3 text-[13px] text-text-muted"
        : "m-0 flex items-start gap-2 text-[13px] text-text-muted"
    }
  >
    <Receipt aria-hidden="true" size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
    <span className="min-w-0">{children}</span>
  </p>
);

/**
 * R7 «Chek yoki karta farqi» (maket `superadmin-ai-assistant-alert-dialog-receipt`):
 *   chek (`source: receipt`) — faktlar ikki ustunda (telefonda ham): Operatsiya · Kassa · Kiritilgan · Chekda · Farq ·
 *     Kiritgan; «Chek tekshiruvi» + «Farq bor» / «Karta mos emas» belgilari va `.el-kv` (Chek sanasi, Oluvchi ··8840,
 *     To'lovchi ··3307 + «filial kassasi kartasi emas», Bank, Tranzaksiya raqami, Ishonch); haftalik xulosa;
 *   karta qoldig'i (`source: card_balance`, «Boshqa holatlar») — Kassa «Asosiy kassa · Humo virtual», Smena,
 *     Kiritilgan, «AI o'qigan», Farq; chek AI o'chiq bo'lsa — «Chek tekshiruvi yoqilmagan …».
 */
export const ReceiptCheckBody = ({ alert }: RuleBodyProps<"R7">) => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const titleId = useId();
  const facts = alert.facts;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const kassa = facts.branch?.name || alert.branch?.name || facts.cashbox.name;

  if (facts.source === "card_balance") {
    const check = alert.evidence?.kind === "card_balance_check" ? alert.evidence : null;
    const card = facts.card ?? check?.card ?? null;
    const shiftDate = facts.shift?.date ?? check?.shift.date ?? null;
    const read = facts.read_amount ?? check?.ai_read_balance ?? null;
    const difference = facts.difference ?? check?.difference ?? null;
    return (
      <>
        <AlertFacts
          columns="rows"
          facts={[
            {
              id: "cashbox",
              label: t("alerts.facts.cashbox"),
              value: card ? `${facts.cashbox.name} · ${card.name}` : facts.cashbox.name,
            },
            shiftDate ? { id: "shift", label: t("alerts.facts.shift"), value: formatAdvisorDay(shiftDate) } : null,
            { id: "entered", label: t("alerts.facts.entered"), value: money(facts.entered_amount) },
            read !== null ? { id: "read", label: t("alerts.facts.aiRead"), value: money(read) } : null,
            difference !== null
              ? { id: "difference", label: t("alerts.facts.difference"), value: <SignedMoney value={difference} /> }
              : null,
          ]}
        />
        {!facts.receipt_ai_enabled ? <NoteLine boxed>{t("alerts.receipt.disabled")}</NoteLine> : null}
      </>
    );
  }

  const operation = facts.operation;
  const operationLabel = operation
    ? operation.category_name
      ? `${t(`alerts.receipt.operation.${operation.kind}`)} · ${operation.category_name}`
      : t(`alerts.receipt.operation.${operation.kind}`)
    : null;
  const createdBy = advisorUserName(facts.created_by);
  const createdAt = facts.created_at ? formatDateTimeLocalized(facts.created_at, { language }) : null;
  const check: AiAdvisorEvidenceReceiptCheck | null = alert.evidence?.kind === "receipt_check" ? alert.evidence : null;
  const receipt = check?.receipt ?? null;
  const cardMismatch = facts.mismatch.includes("card");
  const amountMismatch = facts.mismatch.includes("amount");

  const receiptDate = receipt?.date_at ? formatDateTimeLocalized(receipt.date_at, { language }) : receipt?.date ?? null;
  const payer = withLast4(receipt?.payer ?? null, receipt?.payer_last4 ?? null);
  const rows: Array<{ id: string; label: string; value: ReactNode } | null> = receipt
    ? [
        receiptDate ? { id: "date", label: t("alerts.receipt.date"), value: receiptDate } : null,
        receipt.recipient || receipt.recipient_last4
          ? { id: "recipient", label: t("alerts.receipt.recipient"), value: withLast4(receipt.recipient, receipt.recipient_last4) }
          : null,
        payer
          ? {
              id: "payer",
              label: t("alerts.receipt.payer"),
              value: (
                <>
                  {payer}
                  {cardMismatch ? (
                    <span className="mt-0.5 block text-xs font-normal text-text-muted">{t("alerts.receipt.payerNotCashbox")}</span>
                  ) : null}
                </>
              ),
            }
          : null,
        receipt.bank ? { id: "bank", label: t("alerts.receipt.bank"), value: receipt.bank } : null,
        receipt.reference ? { id: "reference", label: t("alerts.receipt.reference"), value: groupDigits(receipt.reference) } : null,
        receipt.confidence !== null
          ? {
              id: "confidence",
              label: t("alerts.receipt.confidence"),
              value: formatPercentLocalized(receipt.confidence * 100, { language, fractionDigits: 0 }),
            }
          : null,
      ]
    : [];
  const kv = rows.filter((row): row is { id: string; label: string; value: ReactNode } => row !== null);
  const week = check?.week_summary ?? null;
  const count = (value: number) => formatNumberLocalized(value, { language });

  return (
    <>
      <AlertFacts
        columns={2}
        facts={[
          operationLabel ? { id: "operation", label: t("alerts.facts.operation"), value: operationLabel } : null,
          { id: "cashbox", label: t("alerts.facts.cashbox"), value: kassa },
          { id: "entered", label: t("alerts.facts.entered"), value: money(facts.entered_amount) },
          facts.read_amount !== null ? { id: "read", label: t("alerts.facts.onReceipt"), value: money(facts.read_amount) } : null,
          facts.difference !== null
            ? { id: "difference", label: t("alerts.facts.difference"), value: <SignedMoney value={facts.difference} /> }
            : null,
          createdBy || createdAt
            ? {
                id: "createdBy",
                label: t("alerts.facts.createdBy"),
                value: (
                  <>
                    {createdBy}
                    {createdBy && createdAt ? " · " : null}
                    {createdAt ? <span className="whitespace-nowrap">{createdAt}</span> : null}
                  </>
                ),
              }
            : null,
        ]}
      />
      {receipt ? (
        <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h3 id={titleId} className="m-0 mr-1 text-sm font-semibold text-text">
              {t("alerts.receipt.title")}
            </h3>
            {amountMismatch ? (
              <Badge tone="danger" icon={X}>
                {t("alerts.receipt.amountMismatch")}
              </Badge>
            ) : null}
            {cardMismatch ? (
              <Badge tone="warning" icon={TriangleAlert}>
                {t("alerts.receipt.cardMismatch")}
              </Badge>
            ) : null}
          </div>
          {kv.length ? (
            <dl className="m-0 grid grid-cols-[minmax(120px,40%)_1fr] gap-x-4 gap-y-2.5 text-sm">
              {kv.map((row) => (
                <div key={row.id} className="contents">
                  <dt className="text-text-muted">{row.label}</dt>
                  <dd className="m-0 min-w-0 font-semibold [overflow-wrap:anywhere] text-text">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {week ? (
            <NoteLine>
              {t("alerts.receipt.week", {
                checked: count(week.checked),
                match: count(week.match),
                mismatch: count(week.mismatch),
                unreadable: count(week.unreadable),
              })}
            </NoteLine>
          ) : null}
        </section>
      ) : null}
    </>
  );
};

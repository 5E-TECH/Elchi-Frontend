// dizayn-v2: superadmin-ai-assistant-alert-dialog-receipt
import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Receipt, TriangleAlert, X } from "lucide-react";
import {
  advisorCashboxName,
  advisorRefName,
  advisorUserName,
  formatAdvisorDay,
  isTransferReceipt,
  receiptKindOf,
  type AdvisorTranslate,
  type AiAdvisorEvidenceReceiptCheck,
} from "../../../../../entities/ai-advisor";
import { formatDateTimeLocalized } from "../../../../../shared/lib/formatDateTime";
import {
  formatCurrencyAmountLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
} from "../../../../../shared/lib/formatMoney";
import { Badge } from "../../../../../shared/ui/primitives";
import { AlertFacts, SignedMoney, type AlertFact } from "../AlertFacts";
import type { RuleBodyProps } from "./types";

/** Tranzaksiya raqami: faqat raqamlar bo'lsa — uchtadan guruh («512 778 940 112»), aks holda — o'zicha. */
const groupDigits = (value: string) => (/^\d{4,}$/.test(value) ? value.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : value);

/** «UzAuto Petrol, 12-shoxobcha · ··8840» — karta raqamining oxirgi 4 xonasi bilan (backend ismni yubormaydi — PII). */
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

/** Qiymat ostidagi kulrang izoh (`.el-muted`, 12 px) — «filial kassasi kartasi emas». */
const SubNote = ({ children }: { children: ReactNode }) => (
  <span className="mt-0.5 block text-xs font-normal text-text-muted">{children}</span>
);

/**
 * R7 «Chek yoki karta farqi» (maket `superadmin-ai-assistant-alert-dialog-receipt`; backend semantikasi — #653
 * review, round-3):
 *   chek (`source: receipt`) — faktlar ikki ustunda (telefonda ham): Operatsiya · Kassa (o'tkazmada — Jo'natuvchi;
 *     eski o'tkazma, asosiy kassa yozuvi — Kassa) ·
 *     Kiritilgan · Chekda · Farq · Kiritgan; «Chek tekshiruvi» + belgilar («Farq bor», «So'mda emas», «Karta mos emas»
 *     yoki o'tkazmada «HQ kartasiga tushmagan») va `.el-kv` (Chek sanasi, Oluvchi ··8840, To'lovchi ··3307, Bank,
 *     Tranzaksiya raqami, Ishonch); haftalik xulosa. Chek so'mda bo'lmasa (`currency`): «Chekda» — «100 USD», «Farq» —
 *     «—» va izoh (`receipt.ts` / `ReceiptSection` bilan bir xil ma'no);
 *   karta qoldig'i (`source: card_balance`, «Boshqa holatlar») — Kassa «Asosiy kassa · Humo virtual», Smena; tizim
 *     qoldig'i ma'lum bo'lsa — «Tizimda», «AI o'qigan», «Farq» (`system_difference` — haqiqiy farq), kassir boshqa raqam
 *     kiritgan bo'lsa (|AI o'qigan − kiritilgan| > 1) — «Kiritilgan» qo'shimcha qator; eski qatorda — «Kiritilgan»,
 *     «AI o'qigan», «Farq» (`difference`). Faqat karta mos emas (`mismatch: ["card"]`) — «Farq» «—», izoh «Rasm boshqa
 *     kartaniki». Chek AI o'chiq bo'lsa — «Chek tekshiruvi yoqilmagan …».
 */
export const ReceiptCheckBody = ({ alert }: RuleBodyProps<"R7">) => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const tt = t as unknown as AdvisorTranslate;
  const language = i18n.resolvedLanguage ?? i18n.language;
  const titleId = useId();
  const facts = alert.facts;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const cashboxName = advisorCashboxName(facts.cashbox, tt);
  const amountMismatch = facts.mismatch.includes("amount");
  const cardMismatch = facts.mismatch.includes("card");

  if (facts.source === "card_balance") {
    const check = alert.evidence?.kind === "card_balance_check" ? alert.evidence : null;
    const card = facts.card ?? check?.card ?? null;
    const shiftDate = facts.shift?.date ?? check?.shift.date ?? null;
    const read = facts.read_amount ?? check?.ai_read_balance ?? null;
    const entered = facts.entered_amount ?? check?.entered_balance ?? null;
    const expected = facts.expected_balance ?? check?.expected_balance ?? null;
    /** AI o'qigan − kiritilgan (kassir xatosi). */
    const typed = facts.difference ?? check?.difference ?? null;
    /** Tizim qoldig'i ma'lum — haqiqiy farq `system_difference`; eski qator — `difference`. */
    const known = expected !== null;
    const difference = known ? (facts.system_difference ?? check?.system_difference ?? null) : typed;
    const typo = known && entered !== null && typed !== null && Math.abs(typed) > 1;
    const differenceFact: AlertFact | null = !facts.mismatch.length
      ? null
      : {
          id: "difference",
          label: t("alerts.facts.difference"),
          value: amountMismatch && difference !== null ? <SignedMoney value={difference} /> : "—",
        };
    const enteredFact: AlertFact | null =
      entered === null
        ? null
        : {
            id: "entered",
            label: t("alerts.facts.entered"),
            value: typo ? (
              <>
                {money(entered)}
                <SubNote>{t("alerts.receipt.enteredTypo")}</SubNote>
              </>
            ) : (
              money(entered)
            ),
          };
    return (
      <>
        <AlertFacts
          columns="rows"
          facts={[
            {
              id: "cashbox",
              label: t("alerts.facts.cashbox"),
              value: card ? `${cashboxName} · ${advisorRefName(card)}` : cashboxName,
            },
            shiftDate ? { id: "shift", label: t("alerts.facts.shift"), value: formatAdvisorDay(shiftDate) } : null,
            known ? { id: "expected", label: t("alerts.facts.inSystem"), value: money(expected) } : enteredFact,
            read !== null ? { id: "read", label: t("alerts.facts.aiRead"), value: money(read) } : null,
            differenceFact,
            known && typo ? enteredFact : null,
          ]}
        />
        {cardMismatch ? <NoteLine boxed>{t("alerts.receipt.cardOther")}</NoteLine> : null}
        {facts.receipt_ai_enabled === false ? <NoteLine boxed>{t("alerts.receipt.disabled")}</NoteLine> : null}
      </>
    );
  }

  const kind = receiptKindOf(facts);
  const transfer = isTransferReceipt(facts);
  const categoryName = facts.operation?.category_name ?? null;
  const operationLabel = kind
    ? categoryName
      ? `${t(`alerts.receipt.operation.${kind}`)} · ${categoryName}`
      : t(`alerts.receipt.operation.${kind}`)
    : null;
  // O'tkazmada `cashbox` — jo'natuvchi (kuryer yoki filial kassasi), `branch` — chek filiali. Eski o'tkazma
  // (`counter_history_id` dan oldin) — backend qabul qiluvchi ASOSIY kassa yozuviga tushadi: u jo'natuvchi emas,
  // yorliq «Kassa».
  const sender = transfer && facts.cashbox.type !== "main";
  const kassa = transfer ? cashboxName : facts.branch?.name || alert.branch?.name || cashboxName;
  const createdBy = advisorUserName(facts.created_by);
  const createdAt = facts.created_at ? formatDateTimeLocalized(facts.created_at, { language }) : null;
  const check: AiAdvisorEvidenceReceiptCheck | null = alert.evidence?.kind === "receipt_check" ? alert.evidence : null;
  const receipt = check?.receipt ?? null;
  const currencyMismatch = facts.mismatch.includes("currency");
  const currency = (facts.read_currency ?? receipt?.currency)?.toUpperCase() ?? null;
  const originalAmount = facts.read_amount_original ?? (currencyMismatch ? (receipt?.amount ?? null) : null);
  const onReceipt = currencyMismatch
    ? originalAmount !== null
      ? formatCurrencyAmountLocalized(originalAmount, currency, { language })
      : null
    : facts.read_amount !== null
      ? money(facts.read_amount)
      : null;

  const receiptDate = receipt?.date_at
    ? formatDateTimeLocalized(receipt.date_at, { language })
    : receipt?.date_day
      ? formatAdvisorDay(receipt.date_day)
      : (receipt?.date ?? null);
  const recipient = withLast4(receipt?.recipient ?? null, receipt?.recipient_last4 ?? null);
  const payer = withLast4(receipt?.payer ?? null, receipt?.payer_last4 ?? null);
  const rows: Array<{ id: string; label: string; value: ReactNode } | null> = receipt
    ? [
        receiptDate ? { id: "date", label: t("alerts.receipt.date"), value: receiptDate } : null,
        recipient
          ? {
              id: "recipient",
              label: t("alerts.receipt.recipient"),
              value: (
                <>
                  {recipient}
                  {cardMismatch && transfer ? <SubNote>{t("alerts.receipt.recipientNotHq")}</SubNote> : null}
                </>
              ),
            }
          : null,
        payer
          ? {
              id: "payer",
              label: t("alerts.receipt.payer"),
              value: (
                <>
                  {payer}
                  {cardMismatch && !transfer ? <SubNote>{t("alerts.receipt.payerNotCashbox")}</SubNote> : null}
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
          { id: "cashbox", label: t(sender ? "alerts.facts.sender" : "alerts.facts.cashbox"), value: kassa },
          facts.entered_amount !== null ? { id: "entered", label: t("alerts.facts.entered"), value: money(facts.entered_amount) } : null,
          onReceipt ? { id: "read", label: t("alerts.facts.onReceipt"), value: onReceipt } : null,
          // Valyutali chek — summalar solishtirilmaydi: «Farq» — «—» (`ReceiptSection` bilan bir xil); faqat karta mos
          // emas — summa farqi yo'q, «Farq» qatori yo'q («0 so'm» emas).
          currencyMismatch
            ? { id: "difference", label: t("alerts.facts.difference"), value: "—" }
            : amountMismatch && facts.difference !== null
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
      {currencyMismatch ? (
        <NoteLine boxed>
          {currency ? t("alerts.receipt.currencyNote", { currency }) : t("alerts.receipt.currencyNoteNoCode")}
        </NoteLine>
      ) : null}
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
            {currencyMismatch ? (
              <Badge tone="warning" icon={TriangleAlert}>
                {t("alerts.receipt.currencyMismatch")}
              </Badge>
            ) : null}
            {cardMismatch ? (
              <Badge tone="warning" icon={TriangleAlert}>
                {t(transfer ? "alerts.receipt.transferCardMismatch" : "alerts.receipt.cardMismatch")}
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

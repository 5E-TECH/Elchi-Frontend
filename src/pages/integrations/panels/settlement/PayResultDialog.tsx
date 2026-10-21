// dizayn-v2: superadmin-integrations-settlement-pay-result-dialog, admin-integrations-settlement-pay-result-dialog
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CircleCheck, Wallet } from "lucide-react";
import type { BalanceSummary, RemittanceResult } from "../../../../entities/integrations/settlement";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../../shared/lib/formatMoney";
import { Badge, Button, Dialog, buttonClasses } from "../../../../shared/ui/primitives";
import { InlineAlert } from "../../ui";
import { BALANCE_LIST_CLASS, BalanceRow } from "./BalanceRow";

/**
 * «TO'LOV YOZILDI» — NATIJA OYNASI (maket `{superadmin,admin}-integrations-settlement-pay-result-dialog`).
 *
 * Summa qarzga aniq tushib kassaga yozilsa — oyna emas, xabar (`isExactRemittance`). Aks holda shu oyna:
 *   sarlavha «To'lov yozildi» · «<ulanish> · №<id> · <vaqt>» (javobda `created_at` yo'q — vaqt mijoz vaqti);
 *   avansga o'tgan bo'lsa info «N so'm avansga o'tdi»; tafsilot — to'lov raqami, olingan summa, avvalgi avansdan
 *   ishlatilgani, yopilgan qarzlar («23 ta yozuv — hammasi»), avansga o'tgani va hamkor avansi endi; «Asosiy kassa»
 *   qatori `cashbox_posted` bo'yicha («Kirim yozildi · N» yoki «Kassaga yozilmadi» + «Asosiy kassa tarixini
 *   tekshiring»); amallar «Asosiy kassani ochish» va «Tayyor».
 *
 * Qiymatlar faqat backend javobidan (`advance_applied`, `unapplied_amount`, `advance_balance`) — oldindan
 * hisoblangani emas. Backend avvalgi avansni faqat to'lov summasi yetmaganda ishlatadi, shuning uchun ortiqcha
 * to'lovda «Avansga o'tdi» (shu to'lovning ortig'i) va «Hamkor avansi endi» (jami) alohida ko'rsatiladi.
 */

export type PayResultContext = {
  result: RemittanceResult;
  connectionName: string;
  /** Operator kiritgan «To'lov raqami yoki chek» (javobda qaytmaydi). */
  reference?: string;
  /** To'lovdan oldingi qoldiq — «hammasi yopildi»ni bilish uchun; o'qilmagan bo'lsa `null`. */
  before: BalanceSummary | null;
  /** Mijoz vaqti (yozilgan payt). */
  at: Date;
};

const CASHBOX_PATH = "/payments/main-cashbox";

/**
 * `context` oyna yopilgandan keyin ham saqlanadi (yopilish animatsiyasida mazmun yo'qolmasin) — ko'rinish `open` bilan.
 */
const PayResultDialog = ({
  open,
  context,
  onClose,
}: {
  open: boolean;
  context: PayResultContext | null;
  onClose: () => void;
}) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });

  const content = context ? <ResultBody context={context} money={money} /> : null;
  const time = context ? formatDateTimeLocalized(context.at, { language }) : "";
  /** «Tez Yetkaz · №84 · Bugun, 15:40» — tarjimasiz qismlar (nom, raqam, vaqt) « · » bilan. */
  const description = context
    ? [context.connectionName, context.result.remittanceId ? `№${context.result.remittanceId}` : null, time]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  return (
    <Dialog
      open={open && Boolean(context)}
      onClose={onClose}
      title={t("settlementPay.recorded")}
      description={description}
      icon={CircleCheck}
      iconTone="success"
      iconShape="circle"
      size="md"
      footerDivider="auto"
      footer={
        <>
          <Link to={CASHBOX_PATH} onClick={onClose} className={buttonClasses({ variant: "secondary" })}>
            {t("settlementPay.openCashbox")}
          </Link>
          <Button onClick={onClose}>{t("settlementPay.done")}</Button>
        </>
      }
    >
      {content}
    </Dialog>
  );
};

const ResultBody = ({ context, money }: { context: PayResultContext; money: (value: number) => string }) => {
  const { t } = useTranslation("integrations");
  const { result, connectionName, reference, before } = context;
  const name = connectionName;
  const toAdvance = result.unapplied > 0 ? result.unapplied : 0;
  /** Barcha yopilmagan qarz yopildi (oldingi qoldiq ma'lum bo'lsa). */
  const allClosed = Boolean(before) && before!.outstandingCount > 0 && result.settledCount >= before!.outstandingCount;
  const records = t("stlPayRecords", { count: result.settledCount });
  const posted = result.cashboxPosted === true;
  const advanceNow = result.advanceBalance;
  /** «Hamkor avansi endi» — jami avans «Avansga o'tdi» dan farq qilsa yoki avansga hech narsa o'tmagan bo'lsa. */
  const showAdvanceNow = advanceNow !== null && (toAdvance === 0 || advanceNow !== toAdvance);
  const cashboxLink = <Link to={CASHBOX_PATH} className="text-action-fg underline underline-offset-2 hover:text-action-hover" />;

  return (
    <>
      {toAdvance > 0 ? (
        <InlineAlert tone="info" title={t("settlementPay.advanceTitle", { amount: money(toAdvance) })}>
          {t(allClosed ? "settlementPay.advanceOverpay" : "settlementPay.advanceRemainder", { name })}
        </InlineAlert>
      ) : null}

      <dl className={BALANCE_LIST_CLASS}>
        {reference ? <BalanceRow first wrap label={t("settlementPay.reference")} value={reference} /> : null}
        <BalanceRow first={!reference} label={t("settlementPay.received")} value={money(result.remitted)} />
        {result.advanceApplied > 0 ? (
          <BalanceRow label={t("settlementPay.advanceUsed")} value={money(result.advanceApplied)} />
        ) : null}
        <BalanceRow
          label={t("settlementPay.settled")}
          value={money(result.settledAmount)}
          note={allClosed ? t("settlementPay.settledAll", { records }) : records}
        />
        {toAdvance > 0 ? (
          <BalanceRow
            strong={!showAdvanceNow}
            label={t("settlementPay.toAdvance")}
            value={money(toAdvance)}
            note={t("settlementPay.toAdvanceNote")}
          />
        ) : null}
        {showAdvanceNow ? <BalanceRow strong label={t("settlementPay.advanceNow")} value={money(advanceNow)} /> : null}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[13px] text-text">
          <Wallet size={16} aria-hidden="true" className="text-text-muted" />
          {t("settlementPay.cashbox")}
        </span>
        <Badge tone={posted ? "success" : "warning"} dot>
          {posted
            ? t("settlementPay.cashboxPosted", { amount: money(result.remitted) })
            : t("settlementPay.cashboxNotPosted")}
        </Badge>
      </div>

      {posted ? null : (
        <InlineAlert tone="warning" role="alert" title={t("settlementPay.notPostedTitle")}>
          <Trans t={t} i18nKey="settlementPay.notPostedDesc" components={{ cashbox: cashboxLink }} />
        </InlineAlert>
      )}
    </>
  );
};

export default PayResultDialog;

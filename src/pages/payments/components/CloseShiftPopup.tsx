// dizayn-v2: superadmin-payments-main-cashbox-shift-dialog, admin-payments-shift-dialog, manager-payments-close-shift-dialog, superadmin-payments-main-cashbox-shift-dialog-accounts
import { memo, useId, useState, type ReactNode } from "react";
import { Banknote, CreditCard, Download, Timer, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Button, Dialog, Field, TextInput, TONE_SOFT } from "../../../shared/ui/primitives";
import { cx } from "../../../shared/lib/cx";
import { parseOptionalAmountInput } from "./lib/amountInput";
import { computeShiftDiff, shiftDiffKind } from "./lib/shiftDiff";
import { ShiftDiffAmount, ShiftDiffBadge } from "./ShiftDiff";
import ShiftSummaryList from "./ShiftSummaryList";
import ShiftAccountsSection from "./shiftCheck/ShiftAccountsSection";
import { useShiftAccountsForm } from "./shiftCheck/useShiftAccountsForm";
import type { CloseShiftAccount } from "../../../entities/payments";

/**
 * «SMENANI YOPISH» OYNASI (maketlar `superadmin-payments-main-cashbox-shift-dialog`, `admin-payments-shift-dialog`,
 * `manager-payments-close-shift-dialog`; ega javobi CB-S5).
 *
 *  - «Joriy smena» · «Ochgan xodim».
 *  - «Sanalgan naqd *» va «Sanalgan karta (ixtiyoriy)»: ostida «Tizim bo'yicha kutilgan» (kassaning JONLI qoldig'i —
 *    yakuniy kutilgan summa yopish paytida backendda hisoblanadi) va «Farq» (Kamomad · Ortiqcha · Mos keldi ·
 *    Sanalmadi). Karta bo'sh — «Sanalmadi», backendga yuborilmaydi (`discrepancy_card` null).
 *  - Farq ≠ 0 bo'lsa — «Farq bor — sababini izohga yozing» va izoh majburiy (frontend qoidasi).
 *  - «Smenani yopish» → `onConfirm({ countedCash, countedCard, comment })`. Oynaning o'zi tasdiq (ikkinchi tasdiq
 *    yo'q); yuborilayotganda Esc, fon, × va «Bekor qilish» oynani yopmaydi; xatoda oyna ochiq qoladi (ota komponent).
 *  Yopilgach Excel hisobot avtomatik yuklanadi va natija oynasi ochiladi (`ShiftResultDialog`).
 *
 * Kartalar qoldig'ini tasdiqlash (kiZgTybn, maket `superadmin-payments-main-cashbox-shift-dialog-accounts`): faqat
 * `GET finance/shift/settings` → `account_check_enabled` bo'lsa — «Sanalgan karta» o'rnida «Kartalar va hisob
 * raqamlar» bo'limi (`ShiftAccountsSection`): har karta qoldig'i majburiy, rasm majburiy kartada skrinshot, farq /
 * AI «Mos kelmadi» / kiritilgan ≠ rasm — izoh majburiy (backend 400 qoidalari). Yuborishda `accounts[]` va sanalgan
 * karta = Σ kiritilgan. O'chiq bo'lsa (yoki sozlama o'qilmasa) — oyna avvalgidek.
 */

export type CloseShiftPayload = {
  countedCash: number;
  /** Sanalmagan — `null`. */
  countedCard: number | null;
  comment: string;
  /** kiZgTybn — kartalar qoldig'i (tasdiqlash yoqilganda). */
  accounts?: CloseShiftAccount[];
};

/** `onConfirm` natijasi: backend 400 matni (kartalar tekshiruvi). */
export type CloseShiftResult = { error?: string | null };

interface CloseShiftPopupProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Yopish. Kartalar rejimida 400 bo'lsa `{ error }` qaytaradi — xabar kartaga tegishli bo'lsa («Humo»: … izoh
   * majburiy) oyna o'sha kartani ajratadi va qoldiqlarni qayta o'qiydi.
   */
  onConfirm: (payload: CloseShiftPayload) => void | Promise<CloseShiftResult | void>;
  isLoading?: boolean;
  /** Ochiq smena boshlangan vaqt (`opened_at`). */
  openedAt?: string;
  /** Smenani ochgan xodim. */
  openedByName?: string | null;
  /** Kassaning jonli naqd / karta qoldig'i (kutilgan); noma'lum — `null`. */
  expectedCash: number | null;
  expectedCard: number | null;
  /** Ochiq smena ID si — kartalar qoralamasi (rasm, AI holati) va rasm yuklash uchun. */
  shiftId?: string | null;
}

const LabelWithIcon = ({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5">
    <Icon aria-hidden="true" size={16} className="shrink-0 text-text-muted" />
    {children}
  </span>
);

const CloseShiftPopup = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  openedAt,
  openedByName,
  expectedCash,
  expectedCard,
  shiftId,
}: CloseShiftPopupProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [cashInput, setCashInput] = useState("");
  const [cardInput, setCardInput] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const idBase = useId();
  const cashDiffId = `${idBase}-cash-diff`;
  const cardDiffId = `${idBase}-card-diff`;
  const accountsForm = useShiftAccountsForm({ open: isOpen, shiftId });
  const accountMode = accountsForm.enabled;

  const countedCash = parseOptionalAmountInput(cashInput);
  const countedCard = parseOptionalAmountInput(cardInput);
  const cashDiff = computeShiftDiff(countedCash, expectedCash);
  // Kartalar rejimida «Sanalgan karta» maydoni yo'q — farq har karta qatorida (o'z izohi bilan).
  const cardDiff = accountMode ? null : computeShiftDiff(countedCard, expectedCard);
  const hasDiff = [cashDiff, cardDiff].some((diff) => {
    const kind = shiftDiffKind(diff);
    return kind === "shortage" || kind === "surplus";
  });
  const commentText = comment.trim();
  const cashError = submitted && countedCash === null ? t("v2MainCashbox.shift.close.cashRequired") : undefined;
  const commentError =
    submitted && hasDiff && !commentText ? t("v2MainCashbox.shift.close.commentRequired") : undefined;

  const reset = () => {
    setCashInput("");
    setCardInput("");
    setComment("");
    setSubmitted(false);
    accountsForm.reset();
  };

  const handleClose = () => {
    if (isLoading) return;
    onClose();
  };

  const handleConfirm = () => {
    if (isLoading || accountsForm.settingsLoading || accountsForm.isUploading) return;
    setSubmitted(true);
    if (countedCash === null || (hasDiff && !commentText)) return;
    const accounts = accountsForm.buildPayload();
    if (accounts) {
      if (accountsForm.hasErrors) return;
      void Promise.resolve(
        onConfirm({ countedCash, countedCard: accounts.countedCard, comment: commentText, accounts: accounts.accounts }),
      ).then((result) => {
        if (result?.error) accountsForm.applyCloseError(result.error);
      });
      return;
    }
    onConfirm({ countedCash, countedCard, comment: commentText });
  };

  const openedAtText = openedAt ? formatDateTimeLocalized(openedAt, { language }) : "";
  const money = (value: number | null) =>
    value === null ? "—" : formatMoneyLocalized(value, { language });

  const expectedHint = (value: number | null) => (
    <>
      {t("v2MainCashbox.shift.close.expected")}{" "}
      <span className="whitespace-nowrap font-semibold text-text">{money(value)}</span>
    </>
  );

  // Kutilgan qoldiq o'qilmagan (kassa so'rovi xato yoki yuklanmoqda), summa esa kiritilgan — «Sanalmadi» emas,
  // neytral «Kutilgan noma'lum»: yakuniy farqni backend hisoblaydi (natija oynasi).
  const diffBox = (diff: number | null, counted: number | null, expected: number | null, id: string) => (
    <div
      id={id}
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 rounded-[10px] bg-sunken px-3 py-2"
    >
      <span className="text-[13px] text-text-muted">{t("v2MainCashbox.shift.close.diff")}</span>
      <span className="inline-flex flex-wrap items-center gap-2">
        {counted !== null && expected === null ? (
          <Badge tone="neutral">{t("v2MainCashbox.shift.diff.expectedUnknown")}</Badge>
        ) : (
          <>
            <ShiftDiffAmount diff={diff} className="text-sm" />
            <ShiftDiffBadge diff={diff} />
          </>
        )}
      </span>
    </div>
  );

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      onExited={reset}
      busy={isLoading}
      size="lg"
      icon={Timer}
      title={t("v2MainCashbox.shift.close.title")}
      description={t("v2MainCashbox.shift.close.subtitle")}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
            {t("v2MainCashbox.shift.cancel")}
          </Button>
          <Button
            leftIcon={Timer}
            onClick={handleConfirm}
            loading={isLoading}
            disabled={accountsForm.settingsLoading || accountsForm.isUploading}
            loadingText={t("v2MainCashbox.shift.close.closing")}
          >
            {t("v2MainCashbox.shift.close.submit")}
          </Button>
        </>
      }
    >
      <ShiftSummaryList
        rows={[
          {
            key: "current",
            label: t("v2MainCashbox.shift.current"),
            value: (
              <span className="whitespace-nowrap">
                {openedAtText && openedAtText !== "—" ? t("v2MainCashbox.shift.since", { time: openedAtText }) : "—"}
              </span>
            ),
          },
          { key: "openedBy", label: t("v2MainCashbox.shift.openedBy"), value: openedByName?.trim() || "—" },
        ]}
      />

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Field
            label={<LabelWithIcon icon={Banknote}>{t("v2MainCashbox.shift.close.countedCash")}</LabelWithIcon>}
            required
            hint={expectedHint(expectedCash)}
            error={cashError}
          >
            <TextInput
              mode="money"
              size="lg"
              value={cashInput}
              onValueChange={setCashInput}
              placeholder="0"
              autoComplete="off"
              aria-describedby={cashDiffId}
            />
          </Field>
          {diffBox(cashDiff, countedCash, expectedCash, cashDiffId)}
        </div>
        {accountMode ? null : (
          <div className="flex min-w-0 flex-col gap-1.5">
            <Field
              label={<LabelWithIcon icon={CreditCard}>{t("v2MainCashbox.shift.close.countedCard")}</LabelWithIcon>}
              optional
              hint={expectedHint(expectedCard)}
            >
              <TextInput
                mode="money"
                size="lg"
                value={cardInput}
                onValueChange={setCardInput}
                placeholder="0"
                autoComplete="off"
                aria-describedby={cardDiffId}
              />
            </Field>
            {diffBox(cardDiff, countedCard, expectedCard, cardDiffId)}
          </div>
        )}
      </div>

      {hasDiff ? (
        <div
          role="status"
          className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.warning)}
        >
          <TriangleAlert size={18} aria-hidden="true" className="mt-px shrink-0" />
          <span className="min-w-0 font-bold text-text">{t("v2MainCashbox.shift.close.diffAlert")}</span>
        </div>
      ) : null}

      {accountMode ? <ShiftAccountsSection form={accountsForm} submitted={submitted} /> : null}

      <Field
        label={t("v2MainCashbox.shift.comment")}
        required={hasDiff}
        optional={!hasDiff}
        hint={t("v2MainCashbox.shift.close.commentHint")}
        error={commentError}
      >
        <TextInput
          multiline
          rows={3}
          value={comment}
          onValueChange={setComment}
          placeholder={t("v2MainCashbox.shift.close.commentPlaceholder")}
        />
      </Field>

      <p className="m-0 flex items-start gap-2 text-xs text-text-muted">
        <Download aria-hidden="true" size={16} className="mt-px shrink-0" />
        <span className="min-w-0">
          {accountMode ? t("shiftCheck.accounts.note") : t("v2MainCashbox.shift.close.note")}
        </span>
      </p>
    </Dialog>
  );
};

export default memo(CloseShiftPopup);

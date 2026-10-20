// dizayn-v2: superadmin-balance-entry-dialog, admin-balance-entry-dialog
import { memo, useRef, useState, type FormEvent } from "react";
import { Scale, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFinanceCoverage } from "../../../entities/payments/financeCoverage";
import { getActionErrorMessage } from "../../../shared/lib/actionError";
import { cx } from "../../../shared/lib/cx";
import { formatSignedMoneyLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import {
  Button,
  Dialog,
  Field,
  Pressable,
  SegmentedControl,
  TextInput,
  TONE_FG,
} from "../../../shared/ui/primitives";
import {
  FIXED_DIRECTION,
  MANUAL_ENTRY_SOURCES,
  MAX_AMOUNT,
  MIN_COMMENT_LENGTH,
  SOURCE_LABEL_KEYS,
  buildManualEntryPayload,
  newEntryKey,
  type ManualEntrySource,
} from "../lib/manualEntry";

/**
 * Kassa kirim/chiqimi (`finance/cashbox/spend|fill`) P&L daftariga O'ZI yoziladi (IgR4FVsR) — shu ikki turda
 * kassa harakatini bu yerda qayta kiritish foydani ikki marta o'zgartiradi (yKhhqPLE): ogohlantirish.
 */
const CASH_MOVEMENT_SOURCES: ReadonlySet<ManualEntrySource> = new Set(["manual_expense", "manual_income"]);

/**
 * QO'LDA DAFTAR YOZUVI (GtAoqHlk) — `POST finance/financial-balance/entries`, dizayn v2
 * (maket `superadmin-balance-entry-dialog`, `admin-balance-entry-dialog`).
 *
 * ⚠️ Gateway DTO `forbidNonWhitelisted` ostida: payload AYNAN `{ amount, source_type, comment }` —
 * ortiqcha maydon 400 beradi. Summa ISHORALI: kirim musbat, chiqim manfiy (backend ishorani o'zi
 * tanlamaydi). Qat'iy yo'nalishli manbada (`FIXED_DIRECTION`) segment tanlangan va o'chiq — ishorani
 * baribir `buildManualEntryPayload` qo'yadi; «Tuzatish»da yo'nalishni operator tanlaydi.
 *
 * Takroriy bosish: `Idempotency-Key` oyna ochilganda bir marta yaratiladi; gateway uni
 * summa/manba/izoh bilan birga xeshlaydi — javobi yo'qolgan urinish qayta yuborilsa ham daftarga bir
 * marta yoziladi. Yuborilayotganda oyna yopilmaydi (`busy`), server xatosi oynada (`role=alert`).
 * Kassa harakati emas — oynaning o'zi «Balansga ta'siri» bilan ko'rib chiqish, alohida tasdiq yo'q
 * (spec §10 savol 5c).
 */

type FinancialEntryModalProps = { open: boolean; onClose: () => void };

/** Manba chipi (`.el-chip`, `aria-pressed`) — maketda 2 ustunli to'r, telefonda 44 px. */
const CHIP =
  "inline-flex h-10 min-w-0 items-center justify-center rounded-full border border-border-strong bg-surface px-3.5 " +
  "text-[13px] font-medium text-text transition-[background-color,border-color,color] duration-150 " +
  "hover:border-text-subtle motion-reduce:transition-none max-md:h-11 " +
  "aria-pressed:border-action aria-pressed:bg-action-soft aria-pressed:font-semibold aria-pressed:text-action-fg";

const FinancialEntryModal = ({ open, onClose }: FinancialEntryModalProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { createFinancialBalanceEntry } = useFinanceCoverage();
  const idempotencyKey = useRef(newEntryKey());

  const [source, setSource] = useState<ManualEntrySource>("manual_expense");
  const [direction, setDirection] = useState<1 | -1>(-1);
  const [amountText, setAmountText] = useState("");
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState("");

  const amount = Number(amountText.replace(/\D/g, "") || 0);
  const amountError =
    amount <= 0 ? t("financialEntryAmountRequired") : amount > MAX_AMOUNT ? t("financialEntryAmountTooLarge") : "";
  const commentError = comment.trim().length < MIN_COMMENT_LENGTH ? t("financialEntryCommentRequired") : "";
  const pending = createFinancialBalanceEntry.isPending;
  const fixed = FIXED_DIRECTION[source];
  const sign = fixed ?? direction;
  const impact = sign * amount;

  const reset = () => {
    setSource("manual_expense");
    setDirection(-1);
    setAmountText("");
    setComment("");
    setTouched(false);
    setServerError("");
    idempotencyKey.current = newEntryKey();
  };

  const close = () => {
    if (pending) return;
    reset();
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (amountError || commentError || pending) return;
    setServerError("");

    createFinancialBalanceEntry.mutate(
      {
        data: buildManualEntryPayload(source, amount, direction, comment),
        idempotencyKey: idempotencyKey.current,
      },
      {
        onSuccess: () => {
          notify.success(t("financialEntryCreated"), { duration: 3000 });
          reset();
          onClose();
        },
        // Javob kelmagan (tarmoq) — xom "Network Error" emas, tarjima qilingan matn.
        // Qayta "Saqlash" xavfsiz: o'sha `Idempotency-Key` bilan bir marta yoziladi.
        onError: (error) =>
          setServerError(getActionErrorMessage(error, t("financialEntryFailed")) ?? t("networkError", { ns: "common" })),
      },
    );
  };

  const directionValue = sign === 1 ? "income" : "expense";

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={pending}
      size="md"
      icon={Scale}
      title={t("v2Balance.entry.title")}
      onSubmit={submit}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={pending}>
            {t("cancel", { ns: "common" })}
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            {t("v2Balance.entry.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-[13px] font-semibold text-text">
            {t("v2Balance.entry.source")}
            <span aria-hidden="true" className="text-danger-fg">
              {" *"}
            </span>
          </legend>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
            {MANUAL_ENTRY_SOURCES.map((value) => (
              <Pressable
                key={value}
                aria-pressed={source === value}
                onClick={() => setSource(value)}
                disabled={pending}
                className={CHIP}
              >
                <span className="truncate">{t(SOURCE_LABEL_KEYS[value])}</span>
              </Pressable>
            ))}
          </div>
          {CASH_MOVEMENT_SOURCES.has(source) ? (
            <p
              role="note"
              data-testid="cashbox-auto-note"
              className="m-0 mt-1 flex items-start gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-fg"
            >
              <TriangleAlert size={18} aria-hidden="true" className="mt-px shrink-0" />
              <span className="min-w-0 text-text">{t("v2Balance.entry.cashboxAutoNote")}</span>
            </p>
          ) : null}
        </fieldset>

        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-[13px] font-semibold text-text">
            {t("v2Balance.entry.direction")}
            <span aria-hidden="true" className="text-danger-fg">
              {" *"}
            </span>
          </legend>
          <SegmentedControl
            ariaLabel={t("v2Balance.entry.direction")}
            fullWidth
            value={directionValue}
            onValueChange={(value) => setDirection(value === "income" ? 1 : -1)}
            options={[
              { value: "income", label: t("v2Balance.entry.income"), disabled: fixed !== undefined || pending },
              { value: "expense", label: t("v2Balance.entry.expense"), disabled: fixed !== undefined || pending },
            ]}
          />
        </fieldset>

        <Field
          label={t("v2Balance.entry.amount")}
          required
          error={touched && amountError ? amountError : undefined}
        >
          <TextInput
            mode="money"
            autoComplete="off"
            value={amountText}
            onValueChange={(value) => setAmountText(value.replace(/\D/g, ""))}
            disabled={pending}
          />
        </Field>
        <div
          role="status"
          className="-mt-3.5 flex items-center justify-between gap-3 rounded-[10px] bg-sunken px-3 py-2.5"
        >
          <span className="text-[13px] text-text-muted">{t("v2Balance.entry.impact")}</span>
          <span className="sr-only">: </span>
          <span
            className={cx(
              "whitespace-nowrap text-sm font-semibold",
              impact < 0 ? TONE_FG.danger : impact > 0 ? TONE_FG.success : "text-text-muted",
            )}
          >
            {formatSignedMoneyLocalized(impact, { language })}
          </span>
        </div>

        <Field
          label={t("v2Balance.entry.comment")}
          required
          hint={t("v2Balance.entry.commentHint")}
          error={touched && commentError ? commentError : undefined}
        >
          <TextInput
            multiline
            rows={3}
            maxLength={500}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t("v2Balance.entry.commentPlaceholder")}
            disabled={pending}
          />
        </Field>

        {serverError ? (
          <p role="alert" className={cx("m-0 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold", TONE_FG.danger, "bg-danger-soft")}>
            {serverError}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
};

export default memo(FinancialEntryModal);

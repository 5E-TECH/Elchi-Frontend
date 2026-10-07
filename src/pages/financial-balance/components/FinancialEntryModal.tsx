import { memo, useId, useRef, useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { useFinanceCoverage } from "../../../entities/payments/financeCoverage";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import Popup from "../../../shared/ui/Popup";
import { formatFinancialAmount } from "../lib/financialBalance";
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
 * QO'LDA DAFTAR YOZUVI (GtAoqHlk) — `POST finance/financial-balance/entries`.
 *
 * ⚠️ Gateway DTO `forbidNonWhitelisted` ostida: payload AYNAN
 * `{ amount, source_type, comment }` — ortiqcha maydon 400 beradi.
 * Summa ISHORALI: kirim musbat, chiqim manfiy (backend ishorani o'zi
 * tanlamaydi). Tuzatishda yo'nalishni operator tanlaydi.
 *
 * Takroriy bosish: `Idempotency-Key` oyna ochilganda bir marta yaratiladi;
 * gateway uni summa/manba/izoh bilan birga xeshlaydi — javobi yo'qolgan
 * urinish qayta yuborilsa ham daftarga bir marta yoziladi.
 */

type FinancialEntryModalProps = { open: boolean; onClose: () => void };

const FinancialEntryModal = ({ open, onClose }: FinancialEntryModalProps) => {
  const { t } = useTranslation("payments");
  const { api: notify } = useAppNotification();
  const { createFinancialBalanceEntry } = useFinanceCoverage();
  const titleId = useId();
  const idempotencyKey = useRef(newEntryKey());

  const [source, setSource] = useState<ManualEntrySource>("manual_expense");
  const [direction, setDirection] = useState<1 | -1>(-1);
  const [amountText, setAmountText] = useState("");
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState("");

  const amount = Number(amountText.replace(/\D/g, "") || 0);
  const amountError = amount <= 0 ? t("financialEntryAmountRequired") : amount > MAX_AMOUNT ? t("financialEntryAmountTooLarge") : "";
  const commentError = comment.trim().length < MIN_COMMENT_LENGTH ? t("financialEntryCommentRequired") : "";
  const pending = createFinancialBalanceEntry.isPending;
  const sign = FIXED_DIRECTION[source] ?? direction;

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
          notify.success({ message: t("financialEntryCreated"), placement: "topRight", duration: 3 });
          reset();
          onClose();
        },
        onError: (error) => setServerError(getBackendErrorMessage(error) ?? t("financialEntryFailed")),
      },
    );
  };

  const fieldClass =
    "w-full min-h-11 rounded-xl border border-gray-200 bg-primary px-3 py-2.5 text-sm text-maindark outline-none focus:border-main focus:ring-2 focus:ring-main/30 dark:border-white/10 dark:bg-white/5 dark:text-white";
  const chipClass = (active: boolean) =>
    `min-h-11 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition ${
      active
        ? "border-main bg-main text-primary"
        : "border-gray-200 text-gray-600 hover:border-main/40 dark:border-white/10 dark:text-gray-300"
    }`;

  return (
    <Popup isShow={open} onClose={close} labelledBy={titleId}>
      <form
        onSubmit={submit}
        noValidate
        className="flex max-h-[90vh] w-[calc(100vw-32px)] max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl bg-primary p-5 shadow-xl dark:bg-maindark"
      >
        <h3 id={titleId} className="text-base font-bold text-maindark dark:text-white">
          {t("financialEntryTitle")}
        </h3>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t("financialBalanceSourceType")}
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MANUAL_ENTRY_SOURCES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={source === value}
                onClick={() => setSource(value)}
                className={chipClass(source === value)}
              >
                {t(SOURCE_LABEL_KEYS[value])}
              </button>
            ))}
          </div>
        </fieldset>

        {source === "correction" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t("financialEntryDirection")}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={direction === 1} onClick={() => setDirection(1)} className={chipClass(direction === 1)}>
                {t("financialEntryDirectionIncome")}
              </button>
              <button type="button" aria-pressed={direction === -1} onClick={() => setDirection(-1)} className={chipClass(direction === -1)}>
                {t("financialEntryDirectionExpense")}
              </button>
            </div>
          </fieldset>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t("financialEntryAmount")}
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={amountText ? formatFinancialAmount(amount) : ""}
            onChange={(event) => setAmountText(event.target.value.replace(/\D/g, ""))}
            aria-invalid={touched && Boolean(amountError)}
            className={`${fieldClass} font-mono`}
          />
          {touched && amountError && <span className="text-xs text-error">{amountError}</span>}
          {amount > 0 && (
            <span className={`text-xs font-semibold ${sign < 0 ? "text-rose-500" : "text-emerald-500"}`}>
              {t("financialEntryPreview", {
                amount: `${sign < 0 ? "-" : "+"}${formatFinancialAmount(amount)} ${t("currency")}`,
              })}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t("financialBalanceComment")}
          </span>
          <textarea
            rows={3}
            value={comment}
            maxLength={500}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t("financialEntryCommentPlaceholder")}
            aria-invalid={touched && Boolean(commentError)}
            className={`${fieldClass} resize-none`}
          />
          {touched && commentError && <span className="text-xs text-error">{commentError}</span>}
        </label>

        {serverError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {serverError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={close}
            disabled={pending}
            className="min-h-11 rounded-xl border-2 border-gray-200 px-5 text-sm font-semibold text-gray-600 dark:border-white/10 dark:text-gray-300"
          >
            {t("cancel", { ns: "common" })}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-main px-5 text-sm font-bold text-primary disabled:opacity-60"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {t("financialEntrySubmit")}
          </button>
        </div>
      </form>
    </Popup>
  );
};

export default memo(FinancialEntryModal);

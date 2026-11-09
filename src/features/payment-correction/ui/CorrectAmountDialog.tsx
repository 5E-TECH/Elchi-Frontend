// dizayn-v2: superadmin-payments-history-correct-amount-dialog, superadmin-payments-history-correct-amount-confirm, superadmin-payments-history-correct-amount-errors
import { useRef, useState, type FormEvent, type RefObject } from "react";
import { Pencil } from "lucide-react";
import { notify } from "../../../shared/lib/notify";
import { Badge, Button, Dialog, Field, TextInput, TransferSummary, useConfirm } from "../../../shared/ui/primitives";
import { useCorrectPaymentAmount } from "../api/usePaymentCorrectionMutations";
import { usePaymentCorrectionErrors, type CorrectionErrorModel, type CorrectionOpenShift } from "../model/errorView";
import type { CorrectionTarget } from "../model/target";
import { usePaymentCorrectionTexts } from "../model/texts";
import {
  correctionAmountState,
  parseCorrectionAmount,
  type CorrectionAmountRejection,
} from "../model/validation";

/**
 * «SUMMANI TAHRIRLASH» — superadmin (T6 N2; maketlar `superadmin-payments-history-correct-amount-dialog`,
 * `…-correct-amount-confirm`, `…-correct-amount-errors`).
 *
 * Forma (`Dialog`, `Pencil`): xulosa — «Joriy summa» + usul belgisi + qayerdan → qayerga; «To'g'ri summa» (`money`,
 * `lg`; 0 dan katta va joriy summadan farqli); «Farq» — ishorali, rangsiz, ostida kassalarga ta'siri (faqat to'g'ri
 * summada); «Sabab» (trim 5…500). «Davom etish» → tasdiq (`useConfirm`, `tone: "primary"`): Joriy · To'g'ri (kattaroq) ·
 * Farq · Sabab, oqibatlar, «yana tuzatish mumkin» eslatmasi (zanjirning birinchi to'lovi muddati).
 *
 *  - `AMOUNT_EXCEEDS` / `SAME_AMOUNT` — tasdiqda xato va «Tahrirlash» o'chiq; «Orqaga» dan keyin maydonda
 *    «Ko'pi bilan {max}» (yoki «bir xil») — qiymat o'zgarmaguncha «Davom etish» o'chiq.
 *  - Boshqa xatolar tasdiq oynasida qoladi; `ALREADY_CORRECTED` — «Orqaga» butun oqimni yopadi (ega qarori 2026-11-03).
 *  - Muvaffaqiyat — «Summa tuzatildi» xabari, hamma oyna yopiladi.
 */

export type CorrectAmountDialogProps = {
  open: boolean;
  target: CorrectionTarget | null;
  /** «Bekor qilish», «Yopish», Esc — tafsilot oynasiga qaytish. */
  onCancel: () => void;
  /** Oqim tugadi (muvaffaqiyat yoki `ALREADY_CORRECTED` dan keyin «Orqaga») — hamma oyna yopiladi. */
  onDone: () => void;
  /** «Smenani ochish» (`SHIFT_REQUIRED`); smena ochilgach `onOpened` — tasdiqdagi xato qutisi olib tashlanadi. */
  onOpenShift?: CorrectionOpenShift;
  /**
   * Oqim tugagach fokus qayeriga (oynani ochgan ro'yxat qatori): forma tafsilot o'rnida ochiladi, uning «avvalgi
   * fokusi» — yopilgan tafsilotdagi tugma. Berilmasa — `Dialog` sukuti.
   */
  returnFocus?: RefObject<HTMLElement | null>;
};

export const CorrectAmountDialog = ({ open, target, onCancel, onDone, onOpenShift, returnFocus }: CorrectAmountDialogProps) => {
  const texts = usePaymentCorrectionTexts();
  const errors = usePaymentCorrectionErrors();
  const confirm = useConfirm();
  const mutation = useCorrectPaymentAmount();

  const [shown, setShown] = useState<CorrectionTarget | null>(target);
  if (target && target !== shown) setShown(target);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  /** Server rad etgan summa (`AMOUNT_EXCEEDS` / `SAME_AMOUNT`) — qiymat o'zgarmaguncha maydon xatosi. */
  const [rejection, setRejection] = useState<CorrectionAmountRejection | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setAmount("");
      setReason("");
      setTouched(false);
      setRejection(null);
    }
  }

  const askingRef = useRef(false);

  if (!shown) return null;
  const next = parseCorrectionAmount(amount);
  const base = texts.correct(shown, null);
  const amountState = correctionAmountState(amount, base.current, rejection);
  const valid = amountState === "valid";
  const view = valid && next !== null ? texts.correct(shown, next) : base;
  const field = view.reasonField(reason, touched);
  const methodBadge = view.methodBadge ? <Badge>{view.methodBadge}</Badge> : undefined;
  const amountError =
    amountState === "zero"
      ? view.amountErrors.zero
      : amountState === "same"
        ? view.amountErrors.same
        : amountState === "exceeds"
          ? view.amountErrors.exceeds(rejection?.max ?? null)
          : undefined;

  const handleContinue = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!valid || next === null || !field.valid || askingRef.current) return;
    askingRef.current = true;
    const context = { action: "edit" as const, shape: view.shape };
    const sentReason = reason.trim();
    const newAmount = next;
    const attempt: { error: CorrectionErrorModel | null } = { error: null };
    const { confirm: copy } = view;
    try {
      const ok = await confirm({
        tone: "primary",
        icon: Pencil,
        size: "md",
        title: copy.title,
        description: copy.description,
        rows: [
          { label: copy.rows.currentLabel, value: copy.rows.current },
          { label: copy.rows.nextLabel, value: <span className="text-base font-bold">{copy.rows.next}</span> },
          { label: copy.rows.diffLabel, value: copy.rows.diff },
          { label: copy.rows.reasonLabel, value: sentReason, stacked: true },
        ],
        consequences: copy.consequences,
        note: copy.note ?? undefined,
        cancelLabel: copy.cancelLabel,
        confirmLabel: copy.confirmLabel,
        confirmIcon: Pencil,
        loadingLabel: copy.loadingLabel,
        compactOnError: true,
        errorView: (error, controls) => errors.view(error, { ...context, onOpenShift }, controls),
        onConfirm: async () => {
          attempt.error = null;
          try {
            return await mutation.mutateAsync({ historyId: shown.id, newAmount, reason: sentReason });
          } catch (error) {
            const model = errors.describe(error, context);
            attempt.error = model;
            // Maket: «Orqaga» dan keyin maydonda «Ko'pi bilan {max}» — qiymat o'zgarmaguncha qayta yuborilmaydi.
            if (model.rejection) setRejection({ ...model.rejection, amount: newAmount });
            throw error;
          }
        },
      });
      if (ok) {
        if (view.toast) notify.success(view.toast.title, { description: view.toast.description });
        onDone();
      } else if (attempt.error?.closesFlow) {
        onDone();
      }
    } finally {
      askingRef.current = false;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      returnFocus={returnFocus}
      size="md"
      icon={Pencil}
      title={view.title}
      description={view.description}
      onSubmit={(event) => void handleContinue(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {view.cancelLabel}
          </Button>
          <Button type="submit" disabled={!valid || !field.valid} aria-haspopup="dialog">
            {view.continueLabel}
          </Button>
        </>
      }
    >
      <TransferSummary
        amount={{ value: view.current, label: view.amountLabel, badge: methodBadge }}
        transfer={view.transfer}
      />
      {/* «Farq» — faqat to'g'ri summada (maket: 0 va bir xil summada qator yo'q); o'zgarishi o'qiladi (`aria-live`
          hududi doim DOM'da, bo'sh bo'lsa balandligi 0 — oraliq qo'shilmaydi). */}
      <div className="flex min-w-0 flex-col">
        <Field label={view.newAmountLabel} required hint={view.newAmountHint} error={amountError}>
          <TextInput mode="money" size="lg" value={amount} onValueChange={setAmount} placeholder="0" />
        </Field>
        <div aria-live="polite">
          {valid && view.diffText ? (
            <dl
              data-correction-diff=""
              className="m-0 mt-4 grid grid-cols-[minmax(110px,32%)_minmax(0,1fr)] gap-x-4 text-sm"
            >
              <dt className="text-text-muted">{view.diffLabel}</dt>
              <dd className="m-0 min-w-0 font-semibold text-text">
                <span className="whitespace-nowrap">{view.diffText}</span>
                {view.diffLine ? (
                  <span className="mt-0.5 block text-[13px] font-normal text-text-muted">{view.diffLine}</span>
                ) : null}
              </dd>
            </dl>
          ) : null}
        </div>
      </div>
      <Field
        label={field.label}
        required
        hint={field.hint}
        error={field.error}
        hintAside={<span className="whitespace-nowrap">{field.counter}</span>}
      >
        <TextInput
          multiline
          rows={3}
          maxLength={field.maxLength}
          value={reason}
          onValueChange={setReason}
          onBlur={() => setTouched(true)}
          placeholder={field.placeholder}
        />
      </Field>
    </Dialog>
  );
};

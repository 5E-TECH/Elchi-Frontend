// dizayn-v2: superadmin-payments-history-reverse-dialog, superadmin-payments-history-reverse-confirm, superadmin-payments-history-reverse-errors
import { useRef, useState, type FormEvent } from "react";
import { Info, RotateCcw } from "lucide-react";
import { notify } from "../../../shared/lib/notify";
import { Badge, Button, Dialog, Field, TextInput, TransferSummary, useConfirm } from "../../../shared/ui/primitives";
import { useReversePayment } from "../api/usePaymentCorrectionMutations";
import { usePaymentCorrectionErrors, type CorrectionErrorModel } from "../model/errorView";
import type { CorrectionTarget } from "../model/target";
import { usePaymentCorrectionTexts } from "../model/texts";

/**
 * «TO'LOVNI QAYTARISH» — superadmin (T6 N2; maketlar `superadmin-payments-history-reverse-dialog`, `…-reverse-confirm`,
 * `…-reverse-errors`).
 *
 * Forma (`Dialog`, `RotateCcw`): xulosa — «Qaytariladigan to'lov» + usul belgisi + qayerdan → qayerga (asl yo'nalish),
 * `Info` izohi (pul qayerga qaytadi), «Sabab» (trim 5…500, hisoblagich xato qatorida ham). «Davom etish» → tasdiq
 * (`useConfirm`, `tone: "danger"`): summa, teskari yo'nalish, «Sabab», oqibatlar, «Qaytarishni bekor qilib bo'lmaydi.».
 *
 *  - Xato tasdiq oynasida qoladi (`errorView`, telefonda oqibatlar yashirinadi — `compactOnError`); «Orqaga» — formaga,
 *    qiymatlar saqlanadi. `ALREADY_CORRECTED` (ega qarori 2026-11-03) — «Orqaga» butun oqimni yopadi (`onDone`).
 *  - Muvaffaqiyat (201 yoki takroriy 200 `idempotent`) — «To'lov qaytarildi» xabari, hamma oyna yopiladi (`onDone`);
 *    ro'yxat va kassa mutatsiya hook'ida yangilanadi.
 *  - Mutatsiya hook'i shu komponentda: tafsilot oynasi uni oqim davomida o'chirmaydi (`open` bilan), shuning uchun
 *    javobsiz qolgan urinish o'sha tana bilan qayta yuborilsa — o'sha `Idempotency-Key`.
 *  - Shakl `correctable.transfer` dan; u yo'q (eski backend) — umumiy matn, qayerdan → qayerga chizilmaydi.
 */

export type ReversePaymentDialogProps = {
  open: boolean;
  /** Tafsilot oynasi qurgan nishon (`buildCorrectionTarget`); yopilish harakati davomida oxirgisi ko'rinadi. */
  target: CorrectionTarget | null;
  /** «Bekor qilish», «Yopish», Esc — tafsilot oynasiga qaytish. */
  onCancel: () => void;
  /** Oqim tugadi (muvaffaqiyat yoki `ALREADY_CORRECTED` dan keyin «Orqaga») — hamma oyna yopiladi. */
  onDone: () => void;
  /** «Smenani ochish» (`SHIFT_REQUIRED`) — sahifa smena oynasini ochadi; berilmasa havola chiqmaydi. */
  onOpenShift?: () => void;
};

export const ReversePaymentDialog = ({ open, target, onCancel, onDone, onOpenShift }: ReversePaymentDialogProps) => {
  const texts = usePaymentCorrectionTexts();
  const errors = usePaymentCorrectionErrors();
  const confirm = useConfirm();
  const mutation = useReversePayment();

  // Yopilish harakati davomida oxirgi nishon ko'rinadi.
  const [shown, setShown] = useState<CorrectionTarget | null>(target);
  if (target && target !== shown) setShown(target);

  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  // Har ochilishda bo'sh forma (render paytida — effektsiz).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setReason("");
      setTouched(false);
    }
  }

  const askingRef = useRef(false);

  if (!shown) return null;
  const view = texts.reverse(shown);
  const field = view.reasonField(reason, touched);
  const methodBadge = view.methodBadge ? <Badge>{view.methodBadge}</Badge> : undefined;

  const handleContinue = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!field.valid || askingRef.current) return;
    askingRef.current = true;
    const context = { action: "reverse" as const, shape: view.shape };
    const sentReason = reason.trim();
    // Oxirgi xato modeli (`closesFlow` — «Orqaga» butun oqimni yopadi).
    const attempt: { error: CorrectionErrorModel | null } = { error: null };
    const { confirm: copy } = view;
    try {
      const ok = await confirm({
        tone: "danger",
        icon: RotateCcw,
        size: "md",
        title: copy.title,
        description: copy.description,
        amount: { value: view.shape.amount, badge: methodBadge },
        transfer: copy.transfer,
        rows: [{ label: copy.reasonLabel, value: sentReason, stacked: true }],
        consequences: copy.consequences,
        irreversible: copy.irreversible,
        cancelLabel: copy.cancelLabel,
        confirmLabel: copy.confirmLabel,
        confirmIcon: RotateCcw,
        loadingLabel: copy.loadingLabel,
        compactOnError: true,
        errorView: (error) => errors.view(error, { ...context, onOpenShift }),
        onConfirm: async () => {
          attempt.error = null;
          try {
            return await mutation.mutateAsync({ historyId: shown.id, reason: sentReason });
          } catch (error) {
            attempt.error = errors.describe(error, context);
            throw error;
          }
        },
      });
      if (ok) {
        notify.success(view.toast.title, { description: view.toast.description });
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
      size="md"
      icon={RotateCcw}
      title={view.title}
      description={view.description}
      onSubmit={(event) => void handleContinue(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {view.cancelLabel}
          </Button>
          <Button type="submit" disabled={!field.valid} aria-haspopup="dialog">
            {view.continueLabel}
          </Button>
        </>
      }
    >
      <TransferSummary
        amount={{ value: view.shape.amount, label: view.amountLabel, badge: methodBadge }}
        transfer={view.transfer}
      />
      <p className="m-0 flex items-start gap-2 text-[13px] text-text-muted">
        <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
        <span className="min-w-0">{view.note}</span>
      </p>
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

// dizayn-v2: (maket yo'q) superadmin-integrations-settlement-cancel-dialog
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { CircleX, Info, PackageOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BATCH_STATUS_TONE, useCancelTransferBatch, type Batch } from "../../../entities/batch";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { Badge, Button, Dialog, Field, TextInput, TransferSummary, TONE_SOFT } from "../../../shared/ui/primitives";
import { BATCH_CANCEL_MIN_REASON, resolveBatchCancelError, type BatchCancelError } from "../model/batchCancel";

/**
 * «PAKETNI BEKOR QILISH» oynasi — `/batches/:id` (Trello oP02jE2P). Maket yo'q — eng yaqini
 * `superadmin-integrations-settlement-cancel-dialog` (sarlavha savol + № qatori, oqibatlar, «Sabab *», «Orqaga» ·
 * danger tugma, server xatosi oyna ichida).
 *
 * Mazmun: «Paket B-172 · Yaratilgan: …», yo'nalish (Qayerdan → Qayerga), holat, buyurtmalar soni va summa
 * (`TransferSummary`), oqibatlar, majburiy sabab (≥ 10 belgi, backend `CancelTransferBatchRequestDto`).
 * `POST transfer-batches/:id/cancel { reason }` — faqat «Paketni bekor qilish» bosilganda (sabab qisqa bo'lsa so'rov
 * ketmaydi, maydon xatosi). Muvaffaqiyat — oyna yopiladi, `notify.success`, paket so'rovlari yangilanadi (hook).
 *
 * Rad javobi (`resolveBatchCancelError`) — oyna ochiq qoladi, xato qutisi: 409 / `batch_in_transit` — «Paket yo'lda …»;
 * qabul qilingan / allaqachon bekor / boshqa holat / 403 / 404 — o'z matnimiz va tugma o'chadi (qayta urinish befoyda);
 * boshqa 4xx — backend o'zbekcha matni (holat kodisiz); tarmoq / 5xx — umumiy matn, qayta urinish mumkin.
 *
 * `ConfirmDialog` emas, `Dialog` (`alertdialog`): sabab maydoni bilan forma va bloklangan holatda o'chiq tugma —
 * `CancelRemittanceDialog` (integratsiyalar) bilan bir xil yo'l.
 */

type ErrorText = { title: string; description: string };

const CancelBatchDialog = ({
  open,
  batch,
  batchId,
  displayId,
  fromName,
  toName,
  returnFocus,
  onClose,
}: {
  open: boolean;
  /** Mazmun yopilish animatsiyasida ham qoladi — ko'rinish `open` bilan. */
  batch: Batch | null;
  /** So'rov uchun paket id'si (sahifa manzilidagi `:id`) va ko'rinadigan raqam («B-172»). */
  batchId: string;
  displayId: string;
  /** Filial nomlari (noma'lum — `null` → «—»). */
  fromName: string | null;
  toName: string | null;
  returnFocus?: RefObject<HTMLElement | null>;
  onClose: () => void;
}) => {
  const { t, i18n } = useTranslation(["batches", "newOrders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const cancel = useCancelTransferBatch();
  const backRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<BatchCancelError | null>(null);
  /** Bir tikda ikki marta yuborishdan himoya (`cancel.isPending` keyingi renderdagina yangilanadi). */
  const inFlight = useRef(false);

  // Qayta ochilganda eski sabab va xato ko'rinmasin (render paytida — effektsiz).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setReason("");
      setTouched(false);
      setServerError(null);
    }
  }

  const blocked = Boolean(serverError?.blockConfirm);
  // Bloklovchi xatodan keyin tasdiqlash tugmasi o'chadi — fokus <body> ga tushmasin, «Orqaga» ga o'tadi.
  useEffect(() => {
    if (open && blocked) backRef.current?.focus();
  }, [open, blocked]);

  if (!batch) return null;
  const count = (value: number) => formatNumberLocalized(value, { language });
  const trimmed = reason.trim();
  const tooShort = trimmed.length < BATCH_CANCEL_MIN_REASON;
  const reasonError =
    touched && tooShort
      ? trimmed.length === 0
        ? t("cancel.reasonRequired", { min: BATCH_CANCEL_MIN_REASON })
        : t("cancel.reasonTooShort", { count: trimmed.length, min: BATCH_CANCEL_MIN_REASON })
      : undefined;

  const close = () => {
    if (cancel.isPending) return;
    onClose();
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (blocked || cancel.isPending || inFlight.current) return;
    setTouched(true);
    if (tooShort) {
      reasonRef.current?.focus();
      return;
    }
    setServerError(null);
    inFlight.current = true;
    try {
      await cancel.mutateAsync({ batchId, reason: trimmed });
      onClose();
      notify.success(t("cancel.success"), {
        description: t("cancel.successDescription", {
          id: displayId,
          value: count(batch.orders_count),
          count: batch.orders_count,
        }),
      });
    } catch (error) {
      setServerError(resolveBatchCancelError(error));
    } finally {
      inFlight.current = false;
    }
  };

  const errorText = (error: BatchCancelError): ErrorText => {
    if (error.kind === "rejected" || error.kind === "failed") {
      return {
        title: t("cancel.errors.failedTitle"),
        description: error.message ?? t(error.kind === "rejected" ? "cancel.errors.rejected" : "cancel.errors.failed"),
      };
    }
    return { title: t(`cancel.errors.${error.kind}Title`), description: t(`cancel.errors.${error.kind}`) };
  };
  const shownError = serverError ? errorText(serverError) : null;

  const statusLabel = t(`batchStatus.${batch.status}`, { ns: "newOrders" });
  const consequences = [
    {
      icon: PackageOpen,
      text: t(batch.direction === "return" ? "cancel.consequenceOrdersReturn" : "cancel.consequenceOrders", {
        value: count(batch.orders_count),
        count: batch.orders_count,
      }),
    },
    { icon: Info, text: t("cancel.consequenceKeep") },
  ];

  return (
    <Dialog
      open={open}
      onClose={close}
      role="alertdialog"
      busy={cancel.isPending}
      title={t("cancel.title")}
      description={t("cancel.subtitle", {
        id: displayId,
        date: formatDateTimeLocalized(batch.created_at, { language }),
      })}
      icon={CircleX}
      iconTone="danger"
      iconShape="circle"
      size="md"
      initialFocus={backRef}
      returnFocus={returnFocus ?? true}
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button ref={backRef} variant="secondary" onClick={close} disabled={cancel.isPending}>
            {t("cancel.back")}
          </Button>
          <Button
            type="submit"
            variant="danger"
            leftIcon={CircleX}
            loading={cancel.isPending}
            loadingText={t("cancel.cancelling")}
            disabled={blocked}
          >
            {t("cancel.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TransferSummary
          transfer={{ from: { title: fromName ?? "—" }, to: { title: toName ?? "—" } }}
          rows={[
            {
              label: t("cancel.status"),
              value: (
                <Badge tone={BATCH_STATUS_TONE[batch.status]} dot>
                  {statusLabel}
                </Badge>
              ),
            },
            { label: t("cancel.orders"), value: t("qty", { value: count(batch.orders_count) }) },
            { label: t("cancel.amount"), value: formatMoneyLocalized(batch.total_price, { language }) },
          ]}
        />

        {blocked ? null : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0" data-testid="batch-cancel-consequences">
            {consequences.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5 text-[13px] leading-[18px] text-text">
                <Icon size={16} aria-hidden="true" className="mt-px flex-none text-text-muted" />
                <span className="min-w-0">{text}</span>
              </li>
            ))}
          </ul>
        )}

        {blocked ? null : (
          <Field
            label={t("cancel.reason")}
            required
            error={reasonError}
            hint={t("cancel.reasonHint", { count: trimmed.length, min: BATCH_CANCEL_MIN_REASON })}
          >
            <TextInput
              ref={reasonRef}
              multiline
              rows={2}
              value={reason}
              disabled={cancel.isPending}
              onValueChange={(value) => {
                setReason(value);
                if (serverError && !serverError.blockConfirm) setServerError(null);
              }}
            />
          </Field>
        )}

        {shownError ? (
          <div
            role="alert"
            data-tone="danger"
            className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.danger)}
          >
            <CircleX size={18} aria-hidden="true" className="mt-px shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-text">
              <div className="font-bold">{shownError.title}</div>
              <div className="text-[13px] leading-[18px] text-text-muted [overflow-wrap:anywhere]">
                {shownError.description}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
};

export default CancelBatchDialog;

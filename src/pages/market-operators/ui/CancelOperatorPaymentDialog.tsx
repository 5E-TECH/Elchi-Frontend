// dizayn-v2: (maket yo'q) courier-orders-cancel-dialog
import { useRef, useState, type FormEvent } from "react";
import { CircleX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCancelOperatorPayment, type OperatorPayment } from "../../../entities/operator-payment";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { Button, Dialog, Field, TextInput } from "../../../shared/ui/primitives";
import { CANCEL_REASON_MAX, CANCEL_REASON_MIN, paymentHttpStatus } from "../model/operatorPayments";
import { PaymentNotice } from "./PaymentNotice";

type Props = {
  open: boolean;
  /** Yopilish harakati paytida ham oxirgi yozuv turadi (matn sakramasin). */
  payment: OperatorPayment | null;
  onClose: () => void;
};

/**
 * TO'LOV YOZUVINI BEKOR QILISH (F2qp6FtE): xato yozilgan to'lov o'chirilmaydi — sabab bilan bekor qilinadi, tarixda
 * «Bekor qilingan» bo'lib qoladi va «To'landi» ga kirmaydi. Sabab majburiy (3–500 belgi), tugma — qizil «Bekor
 * qilish». Maket yo'q — eng yaqini `courier-orders-cancel-dialog` (sabab + izoh, telefonda pastki varaqa).
 * Xato: 404 — yozuv topilmadi (ro'yxat yangilanadi), 409 — eski Elchi yozuvi, boshqasi — umumiy matn (oyna ichida).
 */
export const CancelOperatorPaymentDialog = ({ open, payment, onClose }: Props) => {
  const { t, i18n } = useTranslation("marketOperators");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const cancel = useCancelOperatorPayment();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const busy = cancel.isPending;
  const trimmed = reason.trim();
  const reasonError = touched && trimmed.length < CANCEL_REASON_MIN ? t("payments.cancelDialog.reasonRequired") : undefined;

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (!payment || submittingRef.current || busy || trimmed.length < CANCEL_REASON_MIN) return;
    submittingRef.current = true;
    setFailure(null);
    try {
      const result = await cancel.mutateAsync({ id: payment.id, reason: trimmed });
      if (result.idempotent) notify.info(t("payments.cancelDialog.already"));
      else notify.success(t("payments.cancelDialog.done"));
      onClose();
    } catch (error) {
      const status = paymentHttpStatus(error);
      setFailure(
        status === 404
          ? t("payments.cancelDialog.notFound")
          : status === 409
            ? t("payments.cancelDialog.legacy")
            : t("payments.cancelDialog.failed"),
      );
    } finally {
      submittingRef.current = false;
    }
  };

  const description = payment
    ? [
        payment.operatorName ?? t("payments.history.deletedOperator"),
        formatMoneyLocalized(payment.amount, { language }),
        formatDateLocalized(payment.paidAt, { language }),
      ].join(" · ")
    : undefined;

  return (
    <Dialog
      open={open && payment !== null}
      onClose={handleClose}
      busy={busy}
      size="sm"
      icon={CircleX}
      iconTone="danger"
      title={t("payments.cancelDialog.title")}
      description={description}
      onSubmit={(event) => void handleSubmit(event)}
      formProps={{ noValidate: true }}
      footer={
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 max-md:[&>button]:flex-1">
          <Button variant="secondary" disabled={busy} onClick={handleClose}>
            {t("payments.cancelDialog.back")}
          </Button>
          <Button
            type="submit"
            variant="danger"
            leftIcon={CircleX}
            loading={busy}
            loadingText={t("payments.cancelDialog.loading")}
          >
            {t("payments.cancelDialog.confirm")}
          </Button>
        </div>
      }
    >
      <Field label={t("payments.cancelDialog.reason")} required error={reasonError}>
        <TextInput
          multiline
          rows={2}
          maxLength={CANCEL_REASON_MAX}
          value={reason}
          onValueChange={(value) => {
            setReason(value);
            setFailure(null);
          }}
          onBlur={() => setTouched(true)}
          placeholder={t("payments.cancelDialog.reasonPlaceholder")}
          disabled={busy}
        />
      </Field>
      <p className="m-0 text-[13px] text-text-muted">{t("payments.cancelDialog.note")}</p>
      {failure ? (
        <div role="alert">
          <PaymentNotice tone="warning">{failure}</PaymentNotice>
        </div>
      ) : null}
    </Dialog>
  );
};

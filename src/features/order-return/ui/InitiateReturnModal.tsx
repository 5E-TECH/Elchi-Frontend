// dizayn-v2: (maket yo'q) manager-orders-cancel-dialog
import { memo, useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOrdersCoverage } from "../../../entities/orders/ordersCoverage";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";
import { Button, Dialog, Field, TextInput } from "../../../shared/ui/primitives";

interface Props {
  open: boolean;
  orderId: string;
  onClose: () => void;
  /** Muvaffaqiyatdan keyin — sahifa buyurtma tarixini yangilaydi. */
  onDone?: () => void;
}

/**
 * HQ: buyurtmani marketga qaytarishni boshlash — sabab majburiy (`POST orders/:id/initiate-return`).
 * Maket yo'q — eng yaqini `manager-orders-cancel-dialog` (sabab maydoni + pastda amallar);
 * telefonda `Dialog` o'zi pastki varaqa. So'rov ketayotganda oyna yopilmaydi.
 */
const InitiateReturnModal = ({ open, orderId, onClose, onDone }: Props) => {
  const { t } = useTranslation(["orders", "common"]);
  const queryClient = useQueryClient();
  const { initiateReturn } = useOrdersCoverage();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setReason("");
    setError("");
  }, [open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (initiateReturn.isPending) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(t("returnReasonRequired"));
      return;
    }
    setError("");
    initiateReturn.mutate(
      { id: orderId, data: { reason: trimmed } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          notify.success(t("returnInitiateSuccess"), { duration: 3000 });
          onDone?.();
          onClose();
        },
        onError: (mutationError) => setError(getBackendErrorMessage(mutationError) ?? t("orderActionError")),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={initiateReturn.isPending}
      size="sm"
      className="md:max-w-[460px]"
      title={t("returnInitiateTitle", { id: orderId })}
      description={t("returnInitiateHint")}
      icon={Undo2}
      iconTone="warning"
      onSubmit={handleSubmit}
      formProps={{ noValidate: true }}
      data-testid="initiate-return-modal"
      footer={
        <>
          <Button variant="secondary" disabled={initiateReturn.isPending} onClick={onClose}>
            {t("cancel", { ns: "common" })}
          </Button>
          <Button type="submit" leftIcon={Undo2} loading={initiateReturn.isPending} data-testid="initiate-return-submit">
            {t("returnInitiateSubmit")}
          </Button>
        </>
      }
    >
      <Field label={t("returnReasonLabel")} required error={error || undefined}>
        <TextInput
          multiline
          rows={3}
          maxLength={500}
          value={reason}
          onValueChange={(value) => {
            setReason(value);
            if (error) setError("");
          }}
          placeholder={t("returnReasonPlaceholder")}
          data-testid="return-reason-input"
        />
      </Field>
    </Dialog>
  );
};

export default memo(InitiateReturnModal);

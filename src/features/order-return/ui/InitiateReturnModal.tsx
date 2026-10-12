import { memo, useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Undo2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import Popup from "../../../shared/ui/Popup";
import { useOrdersCoverage } from "../../../entities/orders/ordersCoverage";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";

interface Props {
  open: boolean;
  orderId: string;
  onClose: () => void;
  /** Muvaffaqiyatdan keyin — sahifa buyurtma tarixini yangilaydi. */
  onDone?: () => void;
}

/** HQ: buyurtmani marketga qaytarishni boshlash — sabab majburiy. */
const InitiateReturnModal = ({ open, orderId, onClose, onDone }: Props) => {
  const { t } = useTranslation("orders");
  const titleId = useId();
  const queryClient = useQueryClient();
  const { api: notificationApi } = useAppNotification();
  const { initiateReturn } = useOrdersCoverage();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setReason("");
    setError("");
  }, [open]);

  const handleSubmit = () => {
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
          notificationApi.success({
            message: t("returnInitiateSuccess"),
            placement: "topRight",
            duration: 3,
          });
          onDone?.();
          onClose();
        },
        onError: (mutationError) => setError(getBackendErrorMessage(mutationError) ?? t("orderActionError")),
      },
    );
  };

  return (
    <Popup isShow={open} onClose={onClose} labelledBy={titleId}>
      <div
        data-testid="initiate-return-modal"
        className="relative mx-3 w-[calc(100vw-24px)] max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-primary shadow-2xl dark:border-primarydark/60 dark:bg-maindark"
      >
        <div className="flex items-center justify-between bg-gradient-to-r from-amber-600 to-amber-500 px-5 py-4 dark:from-amber-700 dark:to-amber-600">
          <div className="flex items-center gap-2">
            <Undo2 size={20} className="text-white" aria-hidden="true" />
            <h2 id={titleId} className="text-base font-bold text-white">
              {t("returnInitiateTitle", { id: orderId })}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 transition-colors hover:bg-white/30"
            aria-label={t("close", { ns: "common" })}
          >
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm text-gray-600 dark:text-gray-300">{t("returnInitiateHint")}</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${titleId}-reason`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("returnReasonLabel")} <span className="text-red-400">*</span>
            </label>
            <textarea
              id={`${titleId}-reason`}
              data-testid="return-reason-input"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={500}
              aria-invalid={error ? true : undefined}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-base text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-amber-400 dark:border-white/10 dark:bg-primarydark/35 dark:text-white dark:placeholder:text-white/35 md:text-sm"
              placeholder={t("returnReasonPlaceholder")}
            />
            {error ? (
              <p role="alert" className="text-xs font-semibold text-error">
                {error}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            data-testid="initiate-return-submit"
            onClick={handleSubmit}
            disabled={initiateReturn.isPending}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-bold text-white transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {initiateReturn.isPending ? t("loading", { ns: "common" }) : t("returnInitiateSubmit")}
          </button>
        </div>
      </div>
    </Popup>
  );
};

export default memo(InitiateReturnModal);

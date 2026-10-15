import { memo, useEffect, useId, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PackageCheck, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import Popup from "../../../shared/ui/Popup";
import ScannerActionButton from "../../../shared/components/ScannerActionButton";
import ScannerCameraModal from "../../../shared/components/ScannerCameraModal";
import { useOrders } from "../../../entities/orders";
import { useOrdersCoverage } from "../../../entities/orders/ordersCoverage";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { extractMarketQrToken, readHandoverAuthorization } from "../model/orderReturnRules";

interface Props {
  open: boolean;
  orderId: string;
  onClose: () => void;
  /** Muvaffaqiyatdan keyin — sahifa buyurtma tarixini yangilaydi. */
  onDone?: () => void;
}

// Backend ruxsati 5 daqiqa; chegarada yiqilmasligi uchun 10 s oldin eskiradi.
const AUTHORIZATION_TTL_MS = 5 * 60 * 1000 - 10_000;

/**
 * Filial: qaytarilgan buyurtmani marketga topshirish. Backend market QR
 * ruxsatini MAJBURIY talab qiladi — market QR (`MCR-...`) skan qilinadi,
 * 5 daqiqalik `authorization_token` olinadi va topshirish tasdiqlanadi.
 */
const MarkReturnedModal = ({ open, orderId, onClose, onDone }: Props) => {
  const { t } = useTranslation(["orders", "newOrders", "common"]);
  const titleId = useId();
  const queryClient = useQueryClient();
  const { api: notificationApi } = useAppNotification();
  const { scanMarketCancelledQr } = useOrders();
  const { markReturnedToMarket } = useOrdersCoverage();
  const [qrInput, setQrInput] = useState("");
  const [error, setError] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  // QR bir martalik: topshirish yiqilsa, ruxsat saqlanadi va qayta skan shart emas.
  const [authorization, setAuthorization] = useState<{ token: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setQrInput("");
    setError("");
    setIsCameraOpen(false);
    setAuthorization(null);
  }, [open]);

  // Ruxsat muddati tugaganda — qayta QR skan talab qilinadi.
  useEffect(() => {
    if (!authorization) return;
    const timer = window.setTimeout(() => setAuthorization(null), AUTHORIZATION_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [authorization]);

  const isPending = scanMarketCancelledQr.isPending || markReturnedToMarket.isPending;

  const markReturned = (authorizationToken: string) =>
    markReturnedToMarket.mutate(
      { id: orderId, data: { authorization_token: authorizationToken } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          notificationApi.success({
            message: t("returnHandoverSuccess"),
            placement: "topRight",
            duration: 3,
          });
          onDone?.();
          onClose();
        },
        onError: (mutationError) => setError(getBackendErrorMessage(mutationError) ?? t("orderActionError")),
      },
    );

  const submitQr = (rawValue: string) => {
    if (isPending) return;
    const qrToken = extractMarketQrToken(rawValue);
    if (!qrToken) {
      setError(t("returnHandoverInvalidQr"));
      return;
    }
    setError("");
    scanMarketCancelledQr.mutate(qrToken, {
      onSuccess: (response) => {
        const token = readHandoverAuthorization(response);
        if (!token) {
          setError(t("orderActionError"));
          return;
        }
        setAuthorization({ token });
        markReturned(token);
      },
      onError: (mutationError) => setError(getBackendErrorMessage(mutationError) ?? t("returnHandoverInvalidQr")),
    });
  };

  const hasLiveAuthorization = authorization !== null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (authorization) {
      setError("");
      markReturned(authorization.token);
      return;
    }
    submitQr(qrInput);
  };

  const handleCameraDecode = (rawValue: string) => {
    setIsCameraOpen(false);
    setQrInput(rawValue);
    submitQr(rawValue);
  };

  if (open && isCameraOpen) {
    return (
      <ScannerCameraModal
        isOpen
        onClose={() => setIsCameraOpen(false)}
        onDecode={handleCameraDecode}
        title={t("scanCancelledHandoverQr", { ns: "newOrders" })}
        subtitle={t("returnHandoverHint")}
        waitingText={t("returnHandoverHint")}
        closeLabel={t("closeScanner", { ns: "newOrders" })}
        torchOnLabel={t("torchOn", { ns: "newOrders" })}
        torchOffLabel={t("torchOff", { ns: "newOrders" })}
        invalidQrMessage={t("returnHandoverInvalidQr")}
        loading={isPending}
        loadingText={t("loading", { ns: "common" })}
        error={error}
      />
    );
  }

  return (
    <Popup isShow={open} onClose={onClose} labelledBy={titleId}>
      <form
        data-testid="mark-returned-modal"
        onSubmit={handleSubmit}
        className="relative mx-3 w-[calc(100vw-24px)] max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-primary shadow-2xl dark:border-primarydark/60 dark:bg-maindark"
      >
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-4 dark:from-emerald-700 dark:to-emerald-600">
          <div className="flex items-center gap-2">
            <PackageCheck size={20} className="text-white" aria-hidden="true" />
            <h2 id={titleId} className="text-base font-bold text-white">
              {t("returnHandoverTitle", { id: orderId })}
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
          <p className="text-sm text-gray-600 dark:text-gray-300">{t("returnHandoverHint")}</p>

          {hasLiveAuthorization ? (
            <p
              data-testid="mark-returned-authorized"
              className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"
            >
              {t("returnHandoverAuthorized")}
            </p>
          ) : (
            <>
              <ScannerActionButton
                onClick={() => {
                  setError("");
                  setIsCameraOpen(true);
                }}
                label={t("returnHandoverScan")}
                showLabel
                className="min-h-11 w-full"
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${titleId}-qr`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("returnHandoverManualLabel")}
                </label>
                <input
                  id={`${titleId}-qr`}
                  data-testid="mark-returned-qr-input"
                  value={qrInput}
                  onChange={(event) => setQrInput(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-base text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-emerald-400 dark:border-white/10 dark:bg-primarydark/35 dark:text-white dark:placeholder:text-white/35 md:text-sm"
                  placeholder="MCR-..."
                />
              </div>
            </>
          )}

          {error ? (
            <p role="alert" data-testid="mark-returned-error" className="text-xs font-semibold text-error">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            data-testid="mark-returned-submit"
            disabled={isPending || (!hasLiveAuthorization && !qrInput.trim())}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-bold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? t("loading", { ns: "common" })
              : hasLiveAuthorization
                ? t("returnHandoverRetry")
                : t("returnHandoverSubmit")}
          </button>
        </div>
      </form>
    </Popup>
  );
};

export default memo(MarkReturnedModal);

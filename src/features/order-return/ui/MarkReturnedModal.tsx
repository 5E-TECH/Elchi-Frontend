// dizayn-v2: (maket yo'q) admin-neworders-cancelled-scanner-dialog
import { memo, useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, PackageCheck, ScanQrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import ScannerCameraModal from "../../../shared/components/ScannerCameraModal";
import { Button, Dialog, Field, TextInput } from "../../../shared/ui/primitives";
import { useOrders } from "../../../entities/orders";
import { useOrdersCoverage } from "../../../entities/orders/ordersCoverage";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { extractMarketQrToken, readHandoverAuthorization } from "../model/orderReturnRules";
import { notify } from "../../../shared/lib/notify";

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
 *
 * Dizayn v2: `Dialog` (telefonda pastki varaqa). Maket yo'q — eng yaqini
 * `admin-neworders-cancelled-scanner-dialog` (kamera tugmasi + qo'lda kiritish). Kamera — umumiy
 * `ScannerCameraModal` (oyna o'rnida ochiladi, ichma-ich emas).
 */
const MarkReturnedModal = ({ open, orderId, onClose, onDone }: Props) => {
  const { t } = useTranslation(["orders", "newOrders", "common"]);
  const queryClient = useQueryClient();
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
          notify.success(t("returnHandoverSuccess"), { duration: 3000 });
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
    <Dialog
      open={open}
      onClose={onClose}
      busy={isPending}
      size="sm"
      className="md:max-w-[460px]"
      title={t("returnHandoverTitle", { id: orderId })}
      description={t("returnHandoverHint")}
      icon={PackageCheck}
      iconTone="success"
      onSubmit={handleSubmit}
      formProps={{ noValidate: true }}
      data-testid="mark-returned-modal"
      footer={
        <>
          <Button variant="secondary" disabled={isPending} onClick={onClose}>
            {t("cancel", { ns: "common" })}
          </Button>
          <Button
            type="submit"
            leftIcon={PackageCheck}
            loading={isPending}
            disabled={!hasLiveAuthorization && !qrInput.trim()}
            data-testid="mark-returned-submit"
          >
            {hasLiveAuthorization ? t("returnHandoverRetry") : t("returnHandoverSubmit")}
          </Button>
        </>
      }
    >
      {hasLiveAuthorization ? (
        <p
          data-testid="mark-returned-authorized"
          className="m-0 flex items-start gap-2 rounded-xl bg-success-soft px-3 py-2.5 text-[13px] text-success-fg"
        >
          <CircleCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span className="text-text">{t("returnHandoverAuthorized")}</span>
        </p>
      ) : (
        <>
          <Button
            variant="secondary"
            leftIcon={ScanQrCode}
            fullWidth
            onClick={() => {
              setError("");
              setIsCameraOpen(true);
            }}
          >
            {t("returnHandoverScan")}
          </Button>
          <Field label={t("returnHandoverManualLabel")}>
            <TextInput
              value={qrInput}
              onValueChange={setQrInput}
              autoComplete="off"
              spellCheck={false}
              placeholder="MCR-..."
              data-testid="mark-returned-qr-input"
            />
          </Field>
        </>
      )}

      {error ? (
        <p role="alert" data-testid="mark-returned-error" className="m-0 text-[13px] font-semibold text-danger-fg">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
};

export default memo(MarkReturnedModal);

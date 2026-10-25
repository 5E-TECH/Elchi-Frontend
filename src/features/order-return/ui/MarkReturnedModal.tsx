// dizayn-v2: (maket yo'q) admin-neworders-cancelled-scanner-dialog
import { memo, useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, PackageCheck, ScanQrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { playScanFeedback } from "../../../shared/lib/scanner/feedback";
import { closeScanner, openScanner } from "../../../shared/lib/scanner/scannerHost";
import { useScanTarget } from "../../../shared/lib/scanner/scanTargets";
import { Button, Dialog, Field, TextInput } from "../../../shared/ui/primitives";
import { useOrders } from "../../../entities/orders";
import { useOrdersCoverage } from "../../../entities/orders/ordersCoverage";
import { extractHandoverPin, readHandoverPinError } from "../../../entities/orders/handoverPin";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { extractMarketQrToken, readHandoverAuthorization } from "../model/orderReturnRules";
import { notify } from "../../../shared/lib/notify";

interface Props {
  open: boolean;
  orderId: string;
  /**
   * Buyurtma marketi (`order.market_id`). Bor bo'lsa — QR o'rniga market QR oynasidagi 6 xonali kod ham qabul
   * qilinadi (zkRab9M2, BG6: `POST scan/market-cancelled { market_id, pin }`).
   */
  marketId?: string | null;
  onClose: () => void;
  /** Muvaffaqiyatdan keyin — sahifa buyurtma tarixini yangilaydi. */
  onDone?: () => void;
}

// Backend ruxsati 5 daqiqa; chegarada yiqilmasligi uchun 10 s oldin eskiradi.
const AUTHORIZATION_TTL_MS = 5 * 60 * 1000 - 10_000;

/**
 * Filial: qaytarilgan buyurtmani marketga topshirish. Backend market QR
 * ruxsatini MAJBURIY talab qiladi — market QR (`MCR-...`) skan qilinadi,
 * 5 daqiqalik `authorization_token` olinadi va topshirish tasdiqlanadi. QR o'qilmasa — market QR oynasidagi
 * 6 xonali kod (zkRab9M2, BG6) shu maydonga yoziladi: xuddi shu ruxsat, backend usulni `pin` deb yozadi.
 *
 * Dizayn v2: `Dialog` (telefonda pastki varaqa). Maket yo'q — eng yaqini
 * `admin-neworders-cancelled-scanner-dialog` (kamera tugmasi + qo'lda kiritish).
 *
 * KAMERA (Trello v1eLN2tV 2-bosqich) — EGA QARORIDAN ISTISNO: oqim ichida kamera tugmasi qilinmaydi (markaziy
 * «Skaner» kontekstli), lekin bu oyna ochiq turganda telefonda markaziy tugma oyna (pastki varaqa) ostida qoladi va
 * bosib bo'lmaydi. Shuning uchun oynaning o'z «Kamera bilan skanerlash» tugmasi qoladi: u oyna maqsadini
 * (`layer: "dialog"` — sahifanikidan ustun) v2 `ScannerCamera` oynasida ochadi (`openScanner()`, umumiy
 * `ScannerHost`; v1 `ScannerCameraModal` o'chirildi). Kamera skani qo'lda kiritish / USB bilan bitta yo'l
 * (`submitQr`); ruxsat olingach yoki oyna yopilsa kamera yopiladi.
 */
const MarkReturnedModal = ({ open, orderId, marketId, onClose, onDone }: Props) => {
  const { t, i18n } = useTranslation(["orders", "newOrders", "common"]);
  const queryClient = useQueryClient();
  const { scanMarketCancelledQr, verifyMarketCancelledPin } = useOrders();
  const pinMarketId = String(marketId ?? "").trim();
  const { markReturnedToMarket } = useOrdersCoverage();
  const [qrInput, setQrInput] = useState("");
  const [error, setError] = useState("");
  // Kamerani shu oyna ochgan (oyna yopilsa yoki ruxsat olinsa — yopiladi).
  const cameraRequestedRef = useRef(false);
  // QR bir martalik: topshirish yiqilsa, ruxsat saqlanadi va qayta skan shart emas.
  const [authorization, setAuthorization] = useState<{ token: string; method: "qr" | "pin" } | null>(null);

  useEffect(() => {
    if (!open) return;
    setQrInput("");
    setError("");
    setAuthorization(null);
  }, [open]);

  // Ruxsat muddati tugaganda — qayta QR skan talab qilinadi.
  useEffect(() => {
    if (!authorization) return;
    const timer = window.setTimeout(() => setAuthorization(null), AUTHORIZATION_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [authorization]);

  const isPending =
    scanMarketCancelledQr.isPending || verifyMarketCancelledPin.isPending || markReturnedToMarket.isPending;

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

  /** Xato — oynada va (kamera ochiq bo'lsa) kamera natija qatorida. */
  const fail = (message: string) => {
    setError(message);
    void playScanFeedback("error", message);
  };

  /** Ruxsat olindi (QR yoki kod) — darhol topshiriladi. */
  const authorize = (response: unknown, method: "qr" | "pin") => {
    const token = readHandoverAuthorization(response);
    if (!token) {
      fail(t("orderActionError"));
      return;
    }
    void playScanFeedback("success", t(method === "pin" ? "returnHandoverPinAccepted" : "returnHandoverQrAccepted"));
    setAuthorization({ token, method });
    markReturned(token);
  };

  const submitPin = (pin: string) => {
    setError("");
    verifyMarketCancelledPin.mutate(
      { marketId: pinMarketId, pin },
      {
        onSuccess: (response) => authorize(response, "pin"),
        onError: (mutationError) => {
          const { kind, remainingAttempts } = readHandoverPinError(mutationError);
          fail(
            kind === "invalid"
              ? remainingAttempts === null
                ? t("cancelled.pin.invalidPlain", { ns: "newOrders" })
                : t("cancelled.pin.invalid", {
                    ns: "newOrders",
                    count: remainingAttempts,
                    value: formatNumberLocalized(remainingAttempts, { language: i18n.language }),
                  })
              : kind === "unknown"
                ? (getBackendErrorMessage(mutationError) ?? t("cancelled.pin.error", { ns: "newOrders" }))
                : t(`cancelled.pin.${kind}`, { ns: "newOrders" }),
          );
        },
      },
    );
  };

  const submitQr = (rawValue: string) => {
    if (isPending) return;
    const pin = pinMarketId ? extractHandoverPin(rawValue) : "";
    if (pin) {
      submitPin(pin);
      return;
    }
    const qrToken = extractMarketQrToken(rawValue);
    if (!qrToken) {
      fail(t(pinMarketId ? "returnHandoverInvalidCode" : "returnHandoverInvalidQr"));
      return;
    }
    setError("");
    scanMarketCancelledQr.mutate(qrToken, {
      onSuccess: (response) => authorize(response, "qr"),
      onError: (mutationError) => fail(getBackendErrorMessage(mutationError) ?? t("returnHandoverInvalidQr")),
    });
  };

  const hasLiveAuthorization = authorization !== null;

  // Oyna maqsadi — faqat market QR kutilayotganda (ruxsat olingach skan kerak emas).
  const cameraActive = open && !hasLiveAuthorization;
  useScanTarget(
    cameraActive
      ? {
          id: `mark-returned:${orderId}`,
          layer: "dialog",
          title: t("scanCancelledHandoverQr", { ns: "newOrders" }),
          context: t("returnHandoverTitle", { id: orderId }),
          hint: t("cancelled.camera.qrHint", { ns: "newOrders" }),
          note: { title: t("returnHandoverCameraNote") },
          onScan: (rawValue) => {
            setQrInput(rawValue);
            submitQr(rawValue);
          },
        }
      : null,
  );
  useEffect(() => {
    if (cameraActive || !cameraRequestedRef.current) return;
    cameraRequestedRef.current = false;
    closeScanner();
  }, [cameraActive]);
  useEffect(
    () => () => {
      if (cameraRequestedRef.current) closeScanner();
    },
    [],
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (authorization) {
      setError("");
      markReturned(authorization.token);
      return;
    }
    submitQr(qrInput);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={isPending}
      size="sm"
      className="md:max-w-[460px]"
      title={t("returnHandoverTitle", { id: orderId })}
      description={t(pinMarketId ? "returnHandoverHintPin" : "returnHandoverHint")}
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
          <span className="text-text">
            {t(authorization?.method === "pin" ? "returnHandoverAuthorizedPin" : "returnHandoverAuthorized")}
          </span>
        </p>
      ) : (
        <>
          <Button
            variant="secondary"
            leftIcon={ScanQrCode}
            fullWidth
            aria-haspopup="dialog"
            onClick={() => {
              setError("");
              cameraRequestedRef.current = openScanner() === "overlay";
            }}
          >
            {t("returnHandoverScan")}
          </Button>
          <Field
            label={t(pinMarketId ? "returnHandoverManualLabelPin" : "returnHandoverManualLabel")}
            hint={pinMarketId ? t("returnHandoverPinHint") : undefined}
          >
            <TextInput
              value={qrInput}
              onValueChange={setQrInput}
              autoComplete="off"
              spellCheck={false}
              placeholder={pinMarketId ? "000000" : "MCR-..."}
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

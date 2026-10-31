// dizayn-v2: superadmin-payments-receipt-viewer-dialog
import { useEffect, useState } from "react";
import { ExternalLink, ImageOff, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../../shared/lib/cx";
import { Button, buttonClasses, Dialog, EmptyState, SegmentedControl, Spinner } from "../../../../shared/ui/primitives";

/**
 * CHEK RASMI KO'RUVCHISI (QlLf33Ma; maket `superadmin-payments-receipt-viewer-dialog`): `Dialog` lg, telefonda to'liq
 * ekranga yaqin varaqa (ikki barmoq bilan kattalashadi). «Moslash» — rasm oynaga sig'adi; «100%» — asl o'lcham, suriladi.
 * `photo_url` 300 s yashaydi: rasm ochilmasa «Qayta urinish» → `onReload` (yangi havola so'raladi).
 */

type Zoom = "fit" | "actual";

type ReceiptViewerDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Ko'rsatiladigan manzil (qoralamada mahalliy eskiz, saqlanganda imzolangan havola). */
  src: string | null;
  /** «Yangi oynada ochish» (imzolangan havola; mahalliy `data:` manzil yangi oynada ochilmaydi). */
  openUrl?: string | null;
  description?: string;
  /** Rasm ochilmadi (havola eskirgan) — yangi havola so'raladi. */
  onReload?: () => void;
};

const ReceiptViewerDialog = ({ open, onClose, src, openUrl, description, onReload }: ReceiptViewerDialogProps) => {
  const { t } = useTranslation("payments");
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  // Yangi manzil yoki qayta ochilish — yuklanish holatidan boshlanadi.
  useEffect(() => {
    if (open) setStatus("loading");
    if (!open) setZoom("fit");
  }, [open, src]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={t("receipt.viewer.title")}
      description={description}
      className="max-md:h-[92dvh]"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <SegmentedControl<Zoom>
            ariaLabel={t("receipt.viewer.zoomLabel")}
            value={zoom}
            onValueChange={setZoom}
            options={[
              { value: "fit", label: t("receipt.viewer.fit") },
              { value: "actual", label: t("receipt.viewer.actual") },
            ]}
          />
          {openUrl ? (
            <a href={openUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary" })}>
              <ExternalLink aria-hidden="true" size={18} />
              {t("receipt.viewer.open")}
            </a>
          ) : null}
        </div>
      }
    >
      <div
        className={cx(
          "relative flex min-h-[280px] overflow-auto rounded-xl bg-sunken [touch-action:pan-x_pan-y_pinch-zoom]",
          // Telefonda varaqa to'liq balandlikda: rasm qolgan joyni to'ldiradi (sarlavha, izoh va amallardan tashqari).
          "max-h-[60dvh] max-md:h-[calc(92dvh-300px)] max-md:max-h-none",
          zoom === "fit" ? "items-center justify-center" : "items-start justify-start",
        )}
        tabIndex={zoom === "actual" ? 0 : undefined}
        data-testid="receipt-viewer-canvas"
      >
        {src && status !== "failed" ? (
          <img
            key={src}
            src={src}
            alt={t("receipt.viewer.alt")}
            onLoad={() => setStatus("ready")}
            onError={() => setStatus("failed")}
            className={cx(zoom === "fit" ? "max-h-full max-w-full object-contain" : "max-w-none", status === "loading" && "invisible")}
          />
        ) : null}
        {status === "loading" && src ? (
          <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted">
            <Spinner size="lg" />
            <span className="text-[13px]">{t("receipt.viewer.loading")}</span>
          </div>
        ) : null}
        {status === "failed" || !src ? (
          <div role="alert" className="w-full self-center">
            <EmptyState
              icon={ImageOff}
              title={t("receipt.viewer.failed")}
              description={t("receipt.viewer.failedHint")}
              action={
                onReload ? (
                  <Button
                    variant="secondary"
                    leftIcon={RefreshCw}
                    onClick={() => {
                      setStatus("loading");
                      onReload();
                    }}
                  >
                    {t("receipt.viewer.retry")}
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : null}
      </div>
      <p className="m-0 text-xs text-text-muted md:hidden">{t("receipt.viewer.pinchHint")}</p>
    </Dialog>
  );
};

export default ReceiptViewerDialog;

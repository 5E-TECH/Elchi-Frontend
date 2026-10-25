// dizayn-v2: superadmin-neworders-cancelled-handover, superadmin-neworders-cancelled-scanner-dialog, superadmin-neworders-cancelled-pin-dialog, superadmin-neworders-cancelled-manual-dialog, admin-neworders-cancelled-detail, admin-neworders-cancelled-scanner-dialog, admin-neworders-cancelled-manual-dialog, registrator-new-orders-cancelled-detail, registrator-new-orders-cancelled-scanner-dialog, registrator-new-orders-cancelled-manual-dialog
import { CircleCheck, Clock, Info, KeyRound, QrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Button } from "../../../../shared/ui/primitives";
import { DetailAlert } from "../../components/detail/DetailAlert";
import {
  formatCountdown,
  splitCountdown,
  type HandoverAuthMethod,
  type HandoverQrStage,
} from "../cancelledModel";

/**
 * Market QR holati (sahifa ogohlantirishi, `.el-alert`):
 *  - `required`    — `warning` «Market QR kerak» (maket `*-scanner-dialog`); matni «Marketga jo'natish»
 *                    tugmasining tavsifi ham (`hintId` → `aria-describedby`);
 *  - `scanned`     — `success` «Market QR skanerlandi» + o'ngda «QR amal qilish vaqti» taymeri
 *                    (`role="timer"`; maket `*-cancelled-handover`), telefonda matn ostida;
 *  - `notRequired` — `neutral` «Market QR talab qilinmaydi» (maket `*-manual-dialog`).
 *
 * zkRab9M2 (BG6): `required` holatda o'ngda «PIN kodni kiritish» (ikkinchi darajali; maket
 * `*-scanner-dialog` dagi «QR o'qilmayaptimi?» bloki — kamera ichida tugma yo'q, ega qarori, shuning uchun shu
 * ogohlantirishda) → `MarketPinDialog`. Ruxsat kod bilan olingan bo'lsa `scanned` sarlavhasi — «Market PIN kodi
 * tasdiqlandi».
 */

type HandoverStatusAlertProps = {
  stage: HandoverQrStage;
  /** Jo'natishga tayyor bekor qilingan buyurtmalar soni («6 ta … jo'natishga tayyor»). */
  readyCount: number;
  remainingSeconds: number;
  hintId: string;
  /** Ruxsat qanday olingan (`scanned` sarlavhasi uchun). */
  method?: HandoverAuthMethod;
  /** «PIN kodni kiritish» — berilsa `required` holatda ko'rinadi. */
  onPinClick?: () => void;
};

const BODY = "text-[13px] text-text-muted";

export const HandoverStatusAlert = ({
  stage,
  readyCount,
  remainingSeconds,
  hintId,
  method = "qr",
  onPinClick,
}: HandoverStatusAlertProps) => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;

  if (stage === "notRequired") {
    return (
      <DetailAlert tone="neutral" icon={Info} role="status" title={t("cancelled.alert.notRequiredTitle")} titleBlock>
        <p className={BODY}>{t("cancelled.alert.notRequiredBody")}</p>
      </DetailAlert>
    );
  }

  if (stage === "required") {
    return (
      <DetailAlert
        tone="warning"
        icon={QrCode}
        role="status"
        title={t("cancelled.alert.requiredTitle")}
        titleBlock
        aside={
          onPinClick ? (
            <Button
              variant="secondary"
              leftIcon={KeyRound}
              aria-haspopup="dialog"
              onClick={onPinClick}
            >
              {t("cancelled.alert.pinAction")}
            </Button>
          ) : undefined
        }
      >
        <p id={hintId} className={BODY}>
          {t("cancelled.alert.requiredBody")}
        </p>
      </DetailAlert>
    );
  }

  const parts = splitCountdown(remainingSeconds);
  return (
    <DetailAlert
      tone="success"
      icon={CircleCheck}
      role="status"
      title={method === "pin" ? t("cancelled.alert.scannedTitlePin") : t("cancelled.alert.scannedTitle")}
      titleBlock
      aside={
        <div
          role="timer"
          aria-label={t("cancelled.alert.timerAria", { minutes: parts.minutes, seconds: parts.seconds })}
          className="flex items-center gap-2.5 rounded-[10px] bg-surface px-3.5 py-2"
        >
          <Clock size={20} aria-hidden="true" className="shrink-0 text-success-fg" />
          <span className="flex flex-col">
            <span className="text-xs font-semibold text-text-muted">{t("cancelled.alert.timerLabel")}</span>
            <span aria-hidden="true" className="text-xl/[26px] font-bold tabular-nums text-success-fg">
              {formatCountdown(remainingSeconds)}
            </span>
          </span>
        </div>
      }
    >
      <p className={BODY}>
        {t("cancelled.alert.scannedBody", { count: readyCount, value: formatNumberLocalized(readyCount, { language }) })}
      </p>
    </DetailAlert>
  );
};

// dizayn-v2: (maket yo'q) courier-cashbox-my-all
import { memo } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, type BadgeSize } from "../../../shared/ui/primitives";
import type { PaymentAck } from "./paymentAck";

/**
 * Kuryer kvitansiyasi javobi belgisi (2crjWf7v) — kassa tarixidagi «Kuryerdan qabul» qatorida
 * (`PaymentHistoryList`: `/payments/main-cashbox`, `/payments/cash-detail/:id`; `MyCashboxPage`: `/cash-box`).
 *
 * Maketda bu belgi yo'q (Trello kartasidagi ega qarori): ko'rinishi maketdagi qator badge'i
 * (`courier-cashbox-my-all` → «Tuzatish», `.el-badge`) bilan bir xil, ton — DESIGN_SYSTEM §8:
 *  - `disputed` → «Noto'g'ri» (danger + `CircleX`: xato/rad etildi);
 *  - `confirmed` → «Tasdiqlangan» (success + `CircleCheck`);
 *  - `null` / yo'q → hech narsa (javob bermaganlar ko'p: bot ulanmagan yoki eski yozuv — har qatorda
 *    «Javob yo'q» shovqin bo'lardi, maketda ham «noma'lum» holat namunasi yo'q).
 * `size` — qatordagi qo'shni «Tuzatish» badge'i bilan bir xil balandlik uchun (zich qatorlarda `sm`).
 */
export const PaymentAckBadge = memo(({ ack, size }: { ack?: PaymentAck | null; size?: BadgeSize }) => {
  const { t } = useTranslation("payments");

  if (ack === "disputed") {
    return (
      <Badge tone="danger" size={size} icon={CircleX} title={t("paymentAckDisputedHint")} data-payment-ack="disputed">
        {t("paymentAckDisputed")}
      </Badge>
    );
  }

  if (ack === "confirmed") {
    return (
      <Badge tone="success" size={size} icon={CircleCheck} title={t("paymentAckConfirmedHint")} data-payment-ack="confirmed">
        {t("paymentAckConfirmed")}
      </Badge>
    );
  }

  return null;
});

PaymentAckBadge.displayName = "PaymentAckBadge";

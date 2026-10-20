// dizayn-v2: manager-payments-cash-detail-courier-ack, manager-payments-history-detail-dialog-ack, courier-cashbox-my-transfers-ack
import { memo } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, type BadgeSize } from "../../../shared/ui/primitives";
import { paymentAckKeys, type PaymentAck, type PaymentAckAudience } from "./paymentAck";

/**
 * Kuryer kvitansiyasi javobi belgisi (2crjWf7v, KI-S1) — kassa tarixidagi «Kuryerdan filialga o'tkazma» qatorida
 * (`PaymentHistoryList`: `/payments/cash-detail/:id`; `MyCashboxPage`: `/cash-box`) va tafsilot oynasidagi
 * «Kvitansiya javobi» qatorida (`FinanceHistoryDetailPopup`).
 *
 * Matn kim ko'rayotganiga qarab (`audience`, ega javobi KI-S1):
 *  - `staff` (sukut) — «Kuryer tasdiqladi» / «Kuryer: noto'g'ri» (maket `manager-payments-cash-detail-courier-ack`,
 *    `manager-payments-history-detail-dialog-ack`);
 *  - `self` — kuryerning o'zi: «Siz tasdiqlagansiz» / «Siz: noto'g'ri» (maket `courier-cashbox-my-transfers-ack`).
 * Ton — DESIGN_SYSTEM §8: `disputed` → danger + `CircleX`, `confirmed` → success + `CircleCheck`.
 * `null` / yo'q → hech narsa (javob bermaganlar ko'p — har qatorda «Javob yo'q» shovqin bo'lardi).
 * `title` — maketdagi to'liq izoh. `size` — qo'shni «Tuzatish» badge'i bilan bir xil balandlik (zich qatorda `sm`).
 */
export const PaymentAckBadge = memo(
  ({
    ack,
    size,
    audience = "staff",
  }: {
    ack?: PaymentAck | null;
    size?: BadgeSize;
    audience?: PaymentAckAudience;
  }) => {
    const { t } = useTranslation("payments");
    const keys = paymentAckKeys(ack, audience);
    if (!keys || !ack) return null;

    const disputed = ack === "disputed";
    return (
      <Badge
        tone={disputed ? "danger" : "success"}
        size={size}
        icon={disputed ? CircleX : CircleCheck}
        title={t(keys.hint)}
        data-payment-ack={ack}
      >
        {t(keys.label)}
      </Badge>
    );
  },
);

PaymentAckBadge.displayName = "PaymentAckBadge";

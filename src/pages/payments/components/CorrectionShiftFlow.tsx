// dizayn-v2: superadmin-payments-main-cashbox-shift-open-dialog
import { memo } from "react";
import OpenShiftFlow from "./OpenShiftFlow";
import { useCashboxShift } from "./lib/useCashboxShift";

/**
 * T6 N2 «Smenani ochish» (`SHIFT_REQUIRED` — tuzatish joriy asosiy kassa smenasiga yoziladi): tasdiq oynasidagi xato
 * qutisidan ochiladi va uning ustida turadi (maket `superadmin-payments-history-reverse-errors` →
 * `superadmin-payments-main-cashbox-shift-open-dialog`). Tafsilot oynasi uni faqat so'ralganda o'rnatadi — boshqa
 * rollarda va oddiy ko'rishda smena so'rovi ketmaydi. Smena ochilgach (`onOpened`) oyna yopiladi va tasdiqdagi
 * «Smena ochilmagan» qutisi olib tashlanadi (fokus «Orqaga» da); foydalanuvchi tasdiqni o'sha kalit bilan qayta bosadi
 * (muvaffaqiyatsiz urinish backendda kalit saqlamaydi).
 */

type CorrectionShiftFlowProps = {
  open: boolean;
  /** Bekor qilindi (smena ochilmadi). */
  onClose: () => void;
  /** Smena ochildi (shu oynadan yoki boshqa xodim tomonidan) — oyna yopiladi, tasdiqdagi xato olib tashlanadi. */
  onOpened: () => void;
};

const CorrectionShiftFlow = ({ open, onClose, onOpened }: CorrectionShiftFlowProps) => {
  const shift = useCashboxShift({ enabled: open, resolveOpener: false });
  return (
    <OpenShiftFlow
      open={open}
      onClose={onClose}
      onOpened={onOpened}
      shiftOpen={shift.status === "open"}
      openerName={shift.currentUserName}
      onRefetchShift={shift.refetch}
    />
  );
};

export default memo(CorrectionShiftFlow);

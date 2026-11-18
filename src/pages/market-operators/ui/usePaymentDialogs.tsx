// dizayn-v2: (maket yo'q) market_operator-earnings
import { useCallback, useState } from "react";
import type { OperatorPayment } from "../../../entities/operator-payment";
import { CancelOperatorPaymentDialog } from "./CancelOperatorPaymentDialog";
import { RecordOperatorPaymentDialog, type PaymentDialogOperator } from "./RecordOperatorPaymentDialog";

/**
 * «To'lov yozish» va «Bekor qilish» oynalari holati. Har ochilishda yangi `session` — oyna (va uning `Idempotency-Key`
 * kaliti, forma maydonlari) toza boshlanadi; yopilish harakati paytida oxirgi ma'lumot turadi.
 */
export const usePaymentDialogs = () => {
  const [record, setRecord] = useState<{ open: boolean; session: number; operator: PaymentDialogOperator | null }>({
    open: false,
    session: 0,
    operator: null,
  });
  const [cancel, setCancel] = useState<{ open: boolean; session: number; payment: OperatorPayment | null }>({
    open: false,
    session: 0,
    payment: null,
  });

  const openRecord = useCallback(
    (operator?: PaymentDialogOperator | null) =>
      setRecord((previous) => ({ open: true, session: previous.session + 1, operator: operator ?? null })),
    [],
  );
  const openCancel = useCallback(
    (payment: OperatorPayment) => setCancel((previous) => ({ open: true, session: previous.session + 1, payment })),
    [],
  );

  const dialogs = (
    <>
      <RecordOperatorPaymentDialog
        key={`record-${record.session}`}
        open={record.open}
        operator={record.operator}
        onClose={() => setRecord((previous) => ({ ...previous, open: false }))}
      />
      <CancelOperatorPaymentDialog
        key={`cancel-${cancel.session}`}
        open={cancel.open}
        payment={cancel.payment}
        onClose={() => setCancel((previous) => ({ ...previous, open: false }))}
      />
    </>
  );

  return { openRecord, openCancel, dialogs };
};

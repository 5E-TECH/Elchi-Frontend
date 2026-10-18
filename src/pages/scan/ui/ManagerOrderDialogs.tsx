// dizayn-v2: manager-scan-result
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOrders } from "../../../entities/orders";
import type { CancelOrderPayload } from "../../../entities/orders/cancelReason";
import { resolveOrderActionResponse } from "../../../entities/orders/extraCostApproval";
import { getSellPaymentStatus, SELL_PAYMENT_NOTICE_KEYS, type SellOrderPayload } from "../../../entities/orders/sellPayment";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";
import { buildActionOrder, type OrderDetail } from "../../new_orders/components/detail/orderDetailModel";
import CancelModal from "../../orders/list/courier/list/CancelModal";
import { notifyOrderActionDone } from "../../orders/list/courier/list/orderActionModel";
import SellModal from "../../orders/list/courier/list/SellModal";

type PartlySellPayload = {
  order_item_info: { order_item_id: string; product_id?: string; quantity: number }[];
  totalPrice: number;
  extraCost: number;
  comment: string;
  proof?: File;
};

type ManagerOrderDialogsProps = {
  order: OrderDetail;
  dialog: "sell" | "cancel" | null;
  onClose: () => void;
  /** Amal bajarildi (oyna yopiladi) — sahifa skan so'rovini qayta oladi. */
  onDone: () => void;
};

/**
 * Menejerning «Sotish» / «Bekor qilish» oynalari skaner natijasida (maket `manager-scan-result`) —
 * `/orders` va buyurtma tafsilotidagi AYNI v2 oynalar (`variant="manager"`), so'rov tanalari o'zgarmagan.
 * Ishlovchilar `new_orderUpdate.tsx` dagidek: market tasdig'iga tushsa — oyna holatni ko'rsatadi
 * (`resolveOrderActionResponse`), marketga to'lov yozilsa — o'sha xabar (`SELL_PAYMENT_NOTICE_KEYS`),
 * aks holda «Sotildi» / «Bekor qilindi» xabari; xato — backend matni. Sahifa bu faylni `lazy()` bilan
 * yuklaydi: kuryer va xodim telefoniga oynalar kodi tushmaydi.
 */
const ManagerOrderDialogs = ({ order, dialog, onClose, onDone }: ManagerOrderDialogsProps) => {
  const { t } = useTranslation(["orders", "common"]);
  const { SellOrder, PartlySellOrder, CancelOrder } = useOrders();
  const actionOrder = useMemo(() => buildActionOrder(order), [order]);
  // Market tasdig'iga tushgan amal: oyna yopilmaydi, holat ko'rsatiladi.
  const [isApprovalRequested, setIsApprovalRequested] = useState(false);

  const close = useCallback(() => {
    setIsApprovalRequested(false);
    onClose();
  }, [onClose]);

  const complete = useCallback(() => {
    close();
    onDone();
  }, [close, onDone]);

  const showActionError = useCallback(
    (error: unknown) => {
      notify.error(t("error", { ns: "common" }), {
        description: getBackendErrorMessage(error) ?? t("orderActionError", { ns: "orders" }),
      });
    },
    [t],
  );

  const handleSell = useCallback(
    (id: string, payload: SellOrderPayload) => {
      const target = actionOrder ?? { id };
      SellOrder.mutate(
        { orderId: id, data: payload },
        {
          onSuccess: (response) => {
            const paymentStatus = getSellPaymentStatus(response);
            resolveOrderActionResponse(response, {
              order: target,
              action: "sell",
              extraCost: payload.extraCost,
              onCompleted: () => {
                complete();
                if (!paymentStatus) notifyOrderActionDone("sell", actionOrder);
              },
              onApprovalRequested: () => setIsApprovalRequested(true),
            });
            if (paymentStatus) notify.success(t(SELL_PAYMENT_NOTICE_KEYS[paymentStatus], { ns: "orders" }));
          },
          onError: showActionError,
        },
      );
    },
    [SellOrder, actionOrder, complete, showActionError, t],
  );

  const handlePartlySell = useCallback(
    (id: string, payload: PartlySellPayload) => {
      const target = actionOrder ?? { id };
      PartlySellOrder.mutate(
        { orderId: id, data: payload },
        {
          onSuccess: (response) =>
            resolveOrderActionResponse(response, {
              order: target,
              action: "partly_sell",
              extraCost: payload.extraCost,
              onCompleted: () => {
                complete();
                notifyOrderActionDone("partly_sell", actionOrder);
              },
              onApprovalRequested: () => setIsApprovalRequested(true),
            }),
          onError: showActionError,
        },
      );
    },
    [PartlySellOrder, actionOrder, complete, showActionError],
  );

  const handleCancel = useCallback(
    (id: string, payload: CancelOrderPayload) => {
      const target = actionOrder ?? { id };
      CancelOrder.mutate(
        { orderId: id, data: payload },
        {
          onSuccess: (response) =>
            resolveOrderActionResponse(response, {
              order: target,
              action: "cancel",
              extraCost: payload.extraCost,
              onCompleted: () => {
                complete();
                notifyOrderActionDone("cancel", actionOrder);
              },
              onApprovalRequested: () => setIsApprovalRequested(true),
            }),
          onError: showActionError,
        },
      );
    },
    [CancelOrder, actionOrder, complete, showActionError],
  );

  return (
    <>
      <SellModal
        order={actionOrder}
        open={dialog === "sell"}
        onClose={close}
        onSell={handleSell}
        onPartlySell={handlePartlySell}
        isLoading={SellOrder.isPending || PartlySellOrder.isPending}
        awaitingApproval={isApprovalRequested}
        variant="manager"
      />
      <CancelModal
        order={actionOrder}
        open={dialog === "cancel"}
        onClose={close}
        onCancel={handleCancel}
        isLoading={CancelOrder.isPending}
        awaitingApproval={isApprovalRequested}
        variant="manager"
      />
    </>
  );
};

export default ManagerOrderDialogs;

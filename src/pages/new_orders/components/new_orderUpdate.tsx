// dizayn-v2: superadmin-orders-detail, admin-orders-detail, manager-orders-detail, registrator-orders-detail, market-orders-detail, courier-orders-detail, manager-orders-sell-dialog, manager-orders-cancel-dialog, manager-orders-rollback-dialog
import { memo, useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Check, PackageCheck, RotateCcw, SearchX, Undo2, X } from "lucide-react";
import type { RootState } from "../../../app/config/store";
import { readProofFiles } from "../../../entities/order";
import { useOrders } from "../../../entities/orders";
import type { CancelOrderPayload } from "../../../entities/orders/cancelReason";
import {
  getActivePendingApproval,
  pollWhileApprovalPending,
  resolveOrderActionResponse,
  usePendingExtraCostApprovals,
} from "../../../entities/orders/extraCostApproval";
import { getSellPaymentStatus, SELL_PAYMENT_NOTICE_KEYS, type SellOrderPayload } from "../../../entities/orders/sellPayment";
import { InitiateReturnModal, MarkReturnedModal } from "../../../features/order-return";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";
import { Button, EmptyState, QueryBoundary } from "../../../shared/ui/primitives";
import { OrderMeta, readOrderMeta } from "../../../widgets/order-meta";
import { OrderTracking } from "../../../widgets/order-tracking";
import { getSidebarConfigForUser } from "../../../widgets/Sidebar/model/menuConfig";
import CancelModal from "../../orders/list/courier/list/CancelModal";
import { notifyOrderActionDone } from "../../orders/list/courier/list/orderActionModel";
import RollbackOrderDialog from "../../orders/list/courier/list/RollbackOrderDialog";
import SellModal from "../../orders/list/courier/list/SellModal";
import { AddressCard } from "./detail/AddressCard";
import { CourierContactCard, CourierPaymentCard, CourierProductsCard } from "./detail/CourierCards";
import { CustomerCard } from "./detail/CustomerCard";
import { DetailAlerts } from "./detail/DetailAlerts";
import { DetailHeader } from "./detail/DetailHeader";
import { DetailSkeleton } from "./detail/DetailSkeleton";
import { getLockAlertIds, getOrderDetailAccess, getOrderPageBranchType } from "./detail/orderDetailAccess";
import {
  buildActionOrder,
  buildTrackingAccess,
  buildTrackingContext,
  normalizeOrderDetail,
  type OrderDetail,
} from "./detail/orderDetailModel";
import { PaymentCard } from "./detail/PaymentCard";
import { ProductsCard } from "./detail/ProductsCard";
import { ProofCard } from "./detail/ProofCard";
import { EditAddressDialog, EditCustomerDialog, EditOrderDialog } from "./editDialogs";

/**
 * BUYURTMA TAFSILOTI — `/orders/edit/:orderId` (va `/new-orders/:marketId/edit/:orderId`), dizayn v2.
 *
 * Maketlar: `<rol>-orders-detail` (superadmin, admin, manager, registrator, market, courier). Sahifa
 * shell ichida chiziladi (tashqi karta / chekka / o'z skrolli yo'q). Tuzilma:
 *  - sarlavha (`DetailHeader`): «← Buyurtmalar», №, holat, rol amallari (sotish, bekor qilish,
 *    qaytarish, marketga qaytarish / topshirish);
 *  - ogohlantirishlar (`DetailAlerts`): market tasdig'i, qulflar, qisman sotuv banneri;
 *  - ikki ustun (`flex-row-reverse flex-wrap`: yon ustun DOM'da birinchi — telefonda tepada):
 *    yon — Buyurtma ma'lumotlari, Mijoz + Manzil, To'lov; asosiy — Mahsulotlar, Dalillar, Tarix.
 *    Market va kuryer — o'z maketlaridagi tartib.
 *
 * Ruxsat va qulf qoidalari — `detail/orderDetailAccess.ts`; xom javob tozalanadi
 * (`detail/orderDetailModel.ts`): `id` yo'q javob «topilmadi», sahifa yiqilmaydi.
 */

type EditDialogKind = "customer" | "address" | "order" | null;

const NewOrderUpdate = () => {
  const { t } = useTranslation(["newOrders", "orders", "common"]);
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId = "", marketId } = useParams<{ orderId: string; marketId?: string }>();
  const role = useSelector((state: RootState) => state.role.role);
  const user = useSelector((state: RootState) => state.user.user);
  const menu = useMemo(() => getSidebarConfigForUser(role, user), [role, user]);
  /** Pochta raqami / mijoz ismi havola bo'ladimi — `/mails`, `/all-users` marshrutlari bilan AYNI qoida. */
  const canOpenMails = menu.some((item) => item.to === "/mails");
  const canOpenProfiles = menu.some((item) => item.to === "/all-users");
  const branchType = getOrderPageBranchType(user);

  // ─── Ma'lumot ─────────────────────────────────────────────────────────────
  const { useGetOrderById, SellOrder, PartlySellOrder, CancelOrder, RollbackOrder } = useOrders();
  const orderQuery = useGetOrderById(orderId, Boolean(orderId), (current) => {
    const detail = normalizeOrderDetail(current);
    return pollWhileApprovalPending(detail ? [detail] : []);
  });
  const order = useMemo(() => normalizeOrderDetail(orderQuery.data), [orderQuery.data]);
  const pendingApprovals = usePendingExtraCostApprovals();
  const pendingApproval = getActivePendingApproval(pendingApprovals, order) ?? null;
  const access = getOrderDetailAccess({ role, branchType, order });
  const lockIds = getLockAlertIds(access.productsLocked, access.destinationLocked);

  const actionOrder = useMemo(() => buildActionOrder(order), [order]);
  const trackingContext = useMemo(() => buildTrackingContext(order), [order]);
  const trackingAccess = useMemo(() => buildTrackingAccess(order), [order]);
  /** Qisman sotuvdan tug'ilgan bo'lsa — asosiy buyurtma id'si. */
  const parentOrderId = useMemo(() => readOrderMeta(order)?.parentOrderId ?? null, [order]);
  /** Kuryer biriktirgan dalillar — bo'sh bo'lsa karta umuman chiqmaydi. */
  const proofKeys = useMemo(() => readProofFiles(order?.proof_files), [order]);

  // ─── Oynalar ──────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<EditDialogKind>(null);
  const [isSellOpen, setIsSellOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isRollbackOpen, setIsRollbackOpen] = useState(false);
  const [isInitiateReturnOpen, setIsInitiateReturnOpen] = useState(false);
  const [isMarkReturnedOpen, setIsMarkReturnedOpen] = useState(false);
  // Market tasdig'iga tushgan amal: oyna yopilmaydi, holat ko'rsatiladi.
  const [isApprovalRequested, setIsApprovalRequested] = useState(false);
  // Tarix (tracking) o'zi qayta so'ralmaydi — amaldan keyin qayta mount.
  const [trackingVersion, setTrackingVersion] = useState(0);
  const refreshTracking = useCallback(() => setTrackingVersion((version) => version + 1), []);
  const closeEdit = useCallback(() => setEditing(null), []);

  const handleBack = useCallback(() => {
    // Havoladan to'g'ridan-to'g'ri ochilgan sahifada tarix bo'sh — ota ro'yxatga.
    if (location.key !== "default") navigate(-1);
    else navigate(marketId ? `/new-orders/${marketId}` : "/orders");
  }, [location.key, marketId, navigate]);

  // ─── Sotish / bekor qilish / qaytarish ──────────────────────────────────────
  const showActionError = useCallback(
    (error: unknown) => {
      notify.error(t("error", { ns: "common" }), {
        description: getBackendErrorMessage(error) ?? t("orderActionError", { ns: "orders" }),
      });
    },
    [t],
  );

  const closeSellModal = useCallback(() => {
    setIsSellOpen(false);
    setIsApprovalRequested(false);
  }, []);

  const closeCancelModal = useCallback(() => {
    setIsCancelOpen(false);
    setIsApprovalRequested(false);
  }, []);

  const handleSell = useCallback(
    (id: string, payload: SellOrderPayload) => {
      const target = actionOrder ?? { id };
      SellOrder.mutate(
        { orderId: id, data: payload },
        {
          onSuccess: (response) => {
            // Marketga to'lov yozilgan bo'lsa — natija (to'liq / qisman) o'sha xabarning o'zi.
            const paymentStatus = getSellPaymentStatus(response);
            resolveOrderActionResponse(response, {
              order: target,
              action: "sell",
              extraCost: payload.extraCost,
              onCompleted: () => {
                closeSellModal();
                refreshTracking();
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
    [SellOrder, actionOrder, closeSellModal, refreshTracking, showActionError, t],
  );

  const handlePartlySell = useCallback(
    (
      id: string,
      payload: {
        order_item_info: { order_item_id: string; product_id?: string; quantity: number }[];
        totalPrice: number;
        extraCost: number;
        comment: string;
        proof?: File;
      },
    ) => {
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
                closeSellModal();
                refreshTracking();
                notifyOrderActionDone("partly_sell", actionOrder);
              },
              onApprovalRequested: () => setIsApprovalRequested(true),
            }),
          onError: showActionError,
        },
      );
    },
    [PartlySellOrder, actionOrder, closeSellModal, refreshTracking, showActionError],
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
                closeCancelModal();
                refreshTracking();
                notifyOrderActionDone("cancel", actionOrder);
              },
              onApprovalRequested: () => setIsApprovalRequested(true),
            }),
          onError: showActionError,
        },
      );
    },
    [CancelOrder, actionOrder, closeCancelModal, refreshTracking, showActionError],
  );

  const handleRollback = useCallback(() => {
    if (!actionOrder) return;
    RollbackOrder.mutate(actionOrder.id, {
      onSuccess: () => {
        setIsRollbackOpen(false);
        refreshTracking();
        notifyOrderActionDone("rollback", actionOrder);
      },
      onError: showActionError,
    });
  }, [RollbackOrder, actionOrder, refreshTracking, showActionError]);

  // ─── Sarlavha amallari (bitta asosiy — «Sotish») ───────────────────────────
  const headerActions =
    order && access.layout === "default" ? (
      <>
        {access.canStartReturn ? (
          <Button
            variant="secondary"
            leftIcon={Undo2}
            data-testid="initiate-return-button"
            aria-haspopup="dialog"
            onClick={() => setIsInitiateReturnOpen(true)}
          >
            {t("returnInitiate", { ns: "orders" })}
          </Button>
        ) : null}
        {access.canHandOverReturn ? (
          <Button
            variant="secondary"
            leftIcon={PackageCheck}
            data-testid="mark-returned-button"
            aria-haspopup="dialog"
            onClick={() => setIsMarkReturnedOpen(true)}
          >
            {t("returnHandover", { ns: "orders" })}
          </Button>
        ) : null}
        {access.canRollback ? (
          <Button
            variant="secondary"
            leftIcon={RotateCcw}
            title={t("ordersList.rollbackHint", { ns: "orders" })}
            aria-haspopup="dialog"
            onClick={() => setIsRollbackOpen(true)}
          >
            {t("ordersList.rollback", { ns: "orders" })}
          </Button>
        ) : null}
        {access.canUseCourierActions ? (
          <Button variant="danger-soft" leftIcon={X} aria-haspopup="dialog" onClick={() => setIsCancelOpen(true)}>
            {t("cancelOrderAction", { ns: "orders" })}
          </Button>
        ) : null}
        {access.canSell ? (
          <Button leftIcon={Check} aria-haspopup="dialog" onClick={() => setIsSellOpen(true)}>
            {t("sell", { ns: "orders" })}
          </Button>
        ) : null}
      </>
    ) : null;

  // ─── Ko'rinishlar ─────────────────────────────────────────────────────────
  const tracking = (detail: OrderDetail, variant: "default" | "courier" = "default") => (
    <OrderTracking
      key={`${detail.id}:${trackingVersion}`}
      orderId={detail.id}
      currentStatus={detail.status}
      access={trackingAccess}
      context={trackingContext}
      variant={variant}
    />
  );
  const meta = (className?: string) => (
    <OrderMeta order={order} role={role} self={user} canOpenMails={canOpenMails} className={className} />
  );
  const proofs = proofKeys.length > 0 ? <ProofCard keys={proofKeys} /> : null;

  const renderDefault = (detail: OrderDetail) => (
    <div className="flex flex-row-reverse flex-wrap gap-6 max-md:gap-4">
      <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-6 max-md:gap-4">
        {/* Buyurtma ma'lumotlari — Mijozdan YUQORIDA (tartib: Meta → Mijoz → Manzil). */}
        {meta()}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-6 max-md:gap-4">
          <CustomerCard
            order={detail}
            canOpenProfile={canOpenProfiles}
            edit={access.customerEdit}
            locked={access.destinationLocked}
            lockDescribedBy={lockIds.destination}
            showLockHint={access.showCustomerLockHint}
            onEdit={() => setEditing("customer")}
          />
          <AddressCard
            order={detail}
            editable={access.canEditOrderFull}
            locked={access.destinationLocked}
            lockDescribedBy={lockIds.destination}
            onEdit={() => setEditing("address")}
          />
        </div>
        <PaymentCard order={detail} />
      </div>
      <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-6 max-md:gap-4">
        <ProductsCard
          order={detail}
          editable={access.canEditOrderFull}
          locked={access.productsLocked}
          lockDescribedBy={lockIds.products}
          onEdit={() => setEditing("order")}
        />
        {proofs}
        {tracking(detail)}
      </div>
    </div>
  );

  const renderMarket = (detail: OrderDetail) => (
    <div className="flex flex-wrap items-start gap-6 max-md:gap-4">
      <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-6 max-md:gap-4">
        <ProductsCard order={detail} showDelivery={false} />
        <PaymentCard order={detail} />
        {proofs}
        {tracking(detail)}
      </div>
      <div className="flex min-w-0 flex-[2_1_340px] flex-wrap gap-6 max-md:gap-4">
        {meta("basis-full")}
        <CustomerCard order={detail} variant="market" className="min-w-0 flex-[1_1_300px]" />
        <AddressCard order={detail} showDelivery className="min-w-0 flex-[1_1_300px]" />
      </div>
    </div>
  );

  const renderCourier = (detail: OrderDetail) => (
    <div className="flex flex-row-reverse flex-wrap items-start gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-[2_1_340px] flex-wrap content-start gap-4">
        <CourierPaymentCard order={detail} className="min-w-0 flex-[1_1_300px]" />
        <CourierContactCard order={detail} locked={access.destinationLocked} className="min-w-0 flex-[1_1_300px]" />
        {meta("basis-full")}
      </div>
      <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-4">
        <CourierProductsCard order={detail} locked={access.productsLocked} />
        {proofs}
        {tracking(detail, "courier")}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <DetailHeader
        orderId={orderId}
        order={order}
        layout={access.layout}
        onBack={handleBack}
        actions={headerActions}
      />

      {order ? (
        <DetailAlerts
          layout={access.layout}
          pendingApproval={pendingApproval}
          productsLocked={access.productsLocked}
          destinationLocked={access.destinationLocked}
          canEditCustomer={access.canEditCustomer}
          parentOrderId={parentOrderId}
        />
      ) : null}

      <QueryBoundary
        query={{ ...orderQuery, data: order }}
        keepPreviousData={false}
        loading={<DetailSkeleton />}
        empty={<EmptyState icon={SearchX} title={t("notFound")} size="page" />}
        size="page"
      >
        {(detail) =>
          access.layout === "courier"
            ? renderCourier(detail)
            : access.layout === "market"
              ? renderMarket(detail)
              : renderDefault(detail)
        }
      </QueryBoundary>

      {/* Tahrirlash oynalari — har biri o'zi saqlaydi va natijani aytadi; ruxsat (rol, qulf) — sahifada. */}
      {access.canEditCustomer ? (
        <EditCustomerDialog open={editing === "customer"} order={order} onClose={closeEdit} />
      ) : null}
      {access.canEditOrderFull ? (
        <>
          <EditAddressDialog open={editing === "address"} order={order} onClose={closeEdit} />
          <EditOrderDialog open={editing === "order"} order={order} onClose={closeEdit} />
        </>
      ) : null}

      <SellModal
        order={actionOrder}
        open={isSellOpen}
        onClose={closeSellModal}
        onSell={handleSell}
        onPartlySell={handlePartlySell}
        isLoading={SellOrder.isPending || PartlySellOrder.isPending}
        awaitingApproval={isApprovalRequested}
        variant="manager"
      />
      <CancelModal
        order={actionOrder}
        open={isCancelOpen}
        onClose={closeCancelModal}
        onCancel={handleCancel}
        isLoading={CancelOrder.isPending}
        awaitingApproval={isApprovalRequested}
        variant="manager"
      />
      <RollbackOrderDialog
        order={isRollbackOpen ? actionOrder : null}
        variant="manager"
        loading={RollbackOrder.isPending}
        onCancel={() => setIsRollbackOpen(false)}
        onConfirm={handleRollback}
      />

      {/* Faqat ochilganda mount — yopiq oyna so'rov hook'larini yaratmaydi. */}
      {isInitiateReturnOpen && order ? (
        <InitiateReturnModal
          open
          orderId={order.id}
          onClose={() => setIsInitiateReturnOpen(false)}
          onDone={refreshTracking}
        />
      ) : null}
      {isMarkReturnedOpen && order ? (
        <MarkReturnedModal
          open
          orderId={order.id}
          onClose={() => setIsMarkReturnedOpen(false)}
          onDone={refreshTracking}
        />
      ) : null}
    </div>
  );
};

export default memo(NewOrderUpdate);

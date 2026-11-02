// dizayn-v2: superadmin-orders-detail, superadmin-orders-detail-cancelled, manager-orders-detail-cancelled, market-orders-detail-cancelled, admin-orders-detail, manager-orders-detail, registrator-orders-detail, market-orders-detail, courier-orders-detail, manager-orders-sell-dialog, manager-orders-cancel-dialog, manager-orders-rollback-dialog, superadmin-neworders-market-order-edit, registrator-new-orders-market-order-edit, market-new-orders-edit
import { memo, useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Check, PackageCheck, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import type { RootState } from "../../../app/config/store";
import {
  isWarehouseReturn,
  normalizeOrderStatus,
  readProofFiles,
  resolveCancelReturnStage,
  useCancelHandoverMethodLabel,
} from "../../../entities/order";
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
import { Button, QueryBoundary } from "../../../shared/ui/primitives";
import { OrderMeta, readOrderMeta } from "../../../widgets/order-meta";
import { OrderReturnPathCard, useOrderReturnPath } from "../../../widgets/order-return-path";
import { OrderTracking } from "../../../widgets/order-tracking";
import { getSidebarConfigForUser } from "../../../widgets/Sidebar/model/menuConfig";
import CancelModal from "../../orders/list/courier/list/CancelModal";
import { notifyOrderActionDone } from "../../orders/list/courier/list/orderActionModel";
import RollbackOrderDialog from "../../orders/list/courier/list/RollbackOrderDialog";
import type { RollbackTarget } from "../../../entities/orders/rollbackTarget";
import SellModal from "../../orders/list/courier/list/SellModal";
import { AddressCard } from "./detail/AddressCard";
import { CourierContactCard, CourierPaymentCard, CourierProductsCard } from "./detail/CourierCards";
import { CustomerCard } from "./detail/CustomerCard";
import { DetailAlerts } from "./detail/DetailAlerts";
import { DetailErrorState, DetailNotFound } from "./detail/DetailErrorState";
import { DetailHeader } from "./detail/DetailHeader";
import { OrderPrintMenu } from "./detail/OrderPrintMenu";
import { OrderQrCard } from "./detail/OrderQrCard";
import { DetailSkeleton } from "./detail/DetailSkeleton";
import {
  getLockAlertIds,
  getOrderDetailAccess,
  getOrderPageBranchType,
  getUserCanSellCancel,
} from "./detail/orderDetailAccess";
import {
  buildActionOrder,
  buildTrackingAccess,
  buildTrackingContext,
  normalizeOrderDetail,
  readHqName,
  readOrderMarket,
  type OrderDetail,
} from "./detail/orderDetailModel";
import { PaymentCard } from "./detail/PaymentCard";
import { ProductsCard } from "./detail/ProductsCard";
import { ProofCard } from "./detail/ProofCard";
import { useDeleteWarehouseOrder } from "./detail/useDeleteWarehouseOrder";
import { EditAddressDialog, EditCustomerDialog, EditOrderDialog } from "./editDialogs";

/**
 * BUYURTMA TAFSILOTI — `/orders/edit/:orderId` (va `/new-orders/:marketId/edit/:orderId`), dizayn v2.
 *
 * Maketlar: `<rol>-orders-detail` (superadmin, admin, manager, registrator, market, courier). Sahifa
 * shell ichida chiziladi (tashqi karta / chekka / o'z skrolli yo'q). Tuzilma:
 *  - sarlavha (`DetailHeader`): «← Buyurtmalar», №, holat, rol amallari (sotish, bekor qilish,
 *    qaytarish, marketga qaytarish / topshirish; superadmin — qabul qilingan ombor buyurtmasini «O'chirish»,
 *    hfkhYrGk №6, maket yo'q — eng yaqini `manager-orders-detail` «Bekor qilish» + `manager-new-orders-delete-confirm-dialog`);
 *  - ogohlantirishlar (`DetailAlerts`): market tasdig'i, qulflar, qisman sotuv banneri;
 *  - ikki ustun (`flex-row-reverse flex-wrap`: yon ustun DOM'da birinchi — telefonda tepada):
 *    yon — Buyurtma ma'lumotlari, Mijoz + Manzil, To'lov; asosiy — Mahsulotlar, Dalillar, Tarix.
 *    Market va kuryer — o'z maketlaridagi tartib.
 *
 * Ruxsat va qulf qoidalari — `detail/orderDetailAccess.ts`; xom javob tozalanadi
 * (`detail/orderDetailModel.ts`): `id` yo'q javob «topilmadi», sahifa yiqilmaydi.
 *
 * `/new-orders/:marketId/edit/:orderId` (maketlar `superadmin-neworders-market-order-edit`,
 * `registrator-new-orders-market-order-edit`, `market-new-orders-edit`): orqaga — market nomi (marketda
 * «Qabul va yaratish»), «Buyurtma ma'lumotlari» kartasi yo'q, qulf bo'lmasa xodimga «Tahrirlash ochiq.»,
 * marketga «Faqat ko'rish uchun» + «Yangi buyurtmalar ro'yxatidan o'chirib, qaytadan yarating».
 */

type EditDialogKind = "customer" | "address" | "order" | null;

const NewOrderUpdate = () => {
  const { t } = useTranslation(["newOrders", "orders", "common"]);
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId = "", marketId } = useParams<{ orderId: string; marketId?: string }>();
  /** «Qabul va yaratish» ichidagi yangi buyurtma (`/new-orders/:marketId/edit/:orderId`). */
  const isNewOrdersRoute = Boolean(marketId);
  const role = useSelector((state: RootState) => state.role.role);
  const user = useSelector((state: RootState) => state.user.user);
  const menu = useMemo(() => getSidebarConfigForUser(role, user), [role, user]);
  /** Pochta raqami / mijoz ismi havola bo'ladimi — `/mails`, `/all-users` marshrutlari bilan AYNI qoida. */
  const canOpenMails = menu.some((item) => item.to === "/mails");
  const canOpenProfiles = menu.some((item) => item.to === "/all-users");
  const branchType = getOrderPageBranchType(user);
  const canSellCancel = getUserCanSellCancel(user);

  // ─── Ma'lumot ─────────────────────────────────────────────────────────────
  const { useGetOrderById, SellOrder, PartlySellOrder, CancelOrder, RollbackOrder, deleteOrder } = useOrders();
  const orderQuery = useGetOrderById(orderId, Boolean(orderId), (current) => {
    const detail = normalizeOrderDetail(current);
    return pollWhileApprovalPending(detail ? [detail] : []);
  });
  const order = useMemo(() => normalizeOrderDetail(orderQuery.data), [orderQuery.data]);
  const pendingApprovals = usePendingExtraCostApprovals();
  const pendingApproval = getActivePendingApproval(pendingApprovals, order) ?? null;
  const access = getOrderDetailAccess({ role, branchType, canSellCancel, order });
  const lockIds = getLockAlertIds(access.productsLocked, access.destinationLocked);

  const actionOrder = useMemo(() => buildActionOrder(order), [order]);
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
  // Bekor bosqichi va «Qaytarish yo'li» (maketlar `*-orders-detail-cancelled`): sarlavhadagi usul va karta
  // bitta so'rovdan (`GET orders/:id/tracking`).
  const cancelStage = resolveCancelReturnStage(order);
  const returnPath = useOrderReturnPath(order, {
    hqName: readHqName(order),
    version: trackingVersion,
    // Kuryer tafsilotida karta yo'q (maket `courier-orders-detail` o'zgarmagan); market operatoriga tarix 403 (MO-3).
    enabled: access.layout !== "courier" && access.canViewTracking,
  });
  const handoverMethodLabel = useCancelHandoverMethodLabel();
  const handoverStep = returnPath.path?.steps.find((step) => step.kind === "handed") ?? null;
  const handoverMethod = handoverStep ? handoverMethodLabel(handoverStep.handover) : null;
  // Topshirish vaqti — tarixdagi hodisadan (`mark-returned-to-market` `last_handover_at` ni yangilamaydi);
  // tarix kelgach topshirish hodisasi bo'lmasa — `last_handover_at` (bulk topshirish uni yozadi).
  const handoverAt =
    handoverStep?.at ?? (returnPath.isLoading ? null : (order?.last_handover_at ?? order?.lastHandoverAt ?? null));
  // Tarix jumlalaridagi HQ nomi «Qaytarish yo'li» bilan bir xil bo'lsin (topshirilgandan keyin ham «— Toshkent HQ»).
  const returnPathHqName = returnPath.path?.hqName ?? null;
  const trackingContext = useMemo(() => {
    const context = buildTrackingContext(order);
    return context.hqName || !returnPathHqName ? context : { ...context, hqName: returnPathHqName };
  }, [order, returnPathHqName]);
  // Qulf sababi holatdan ham: qabulgacha bekor qilingan (bosqichsiz) buyurtma «filialga jo'natilgan» emas.
  // hfkhYrGk №3: ombor buyurtmasi omborga qaytgan (`returned_to_market` + WAREHOUSE) — marketga topshirilmagan.
  const normalizedStatus = normalizeOrderStatus(order?.status);
  const lockReason = isWarehouseReturn(order)
    ? "warehouse"
    : cancelStage === "market" || normalizedStatus === "returned_to_market"
      ? "returned"
      : cancelStage || normalizedStatus === "cancelled" || normalizedStatus === "cancelled (sent)"
        ? "cancelled"
        : null;
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

  const handleRollback = useCallback((targetStatus: RollbackTarget) => {
    if (!actionOrder) return;
    RollbackOrder.mutate({ orderId: actionOrder.id, targetStatus }, {
      onSuccess: () => {
        setIsRollbackOpen(false);
        refreshTracking();
        notifyOrderActionDone("rollback", actionOrder);
      },
      onError: showActionError,
    });
  }, [RollbackOrder, actionOrder, refreshTracking, showActionError]);

  // hfkhYrGk №6: superadmin — qabul qilingan ombor buyurtmasini o'chirish (tasdiq oynasi, band bo'shaydi).
  const requestDelete = useDeleteWarehouseOrder({ order, deleteOrder, onDeleted: handleBack });

  // ─── Sarlavha amallari (bitta asosiy — «Sotish») ───────────────────────────
  const printMenu = order ? <OrderPrintMenu order={order} /> : null;
  const headerActions =
    order && access.layout === "default" ? (
      <>
        {printMenu}
        {access.canDelete ? (
          <Button
            variant="danger-soft"
            leftIcon={Trash2}
            data-testid="delete-order-button"
            aria-haspopup="dialog"
            onClick={() => void requestDelete()}
          >
            {t("orderDetail.deleteAction", { ns: "orders" })}
          </Button>
        ) : null}
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
  // MO-3: market operatorida «Kuzatuv» yo'q — `GET orders/:id/tracking` unga 403 (`access.canViewTracking`).
  const tracking = (detail: OrderDetail, variant: "default" | "courier" = "default") =>
    access.canViewTracking ? (
      <OrderTracking
        key={`${detail.id}:${trackingVersion}`}
        orderId={detail.id}
        currentStatus={detail.status}
        access={trackingAccess}
        context={trackingContext}
        variant={variant}
        defaultCollapsed={Boolean(returnPath.path)}
      />
    ) : null;
  // `/new-orders/:marketId/edit` maketlarida «Buyurtma ma'lumotlari» kartasi yo'q.
  const meta = (className?: string) =>
    isNewOrdersRoute ? null : (
      <OrderMeta
        order={order}
        role={role}
        self={user}
        canOpenMails={canOpenMails}
        handoverAt={handoverAt}
        className={className}
      />
    );
  /** «Buyurtma topilmadi» holatidagi qaytish manzili — sarlavhadagi «←» bilan bir ro'yxat. */
  const notFoundBackTo = marketId ? `/new-orders/${marketId}` : "/orders";
  const newOrdersBackLabel = isNewOrdersRoute
    ? access.layout === "market"
      ? t("orderEdit.backToNewOrders")
      : (readOrderMarket(order)?.name ?? t("orderEdit.backToNewOrders"))
    : undefined;
  const editOpen =
    isNewOrdersRoute && access.layout === "default" && access.canEditOrderFull
      ? access.canEditCustomer
        ? "full"
        : "limited"
      : null;
  const proofs = proofKeys.length > 0 ? <ProofCard keys={proofKeys} /> : null;
  const returnPathCard = returnPath.path ? (
    <OrderReturnPathCard
      path={returnPath.path}
      isLoading={returnPath.isLoading}
      isError={returnPath.isError}
      onRetry={returnPath.retry}
      marketView={access.layout === "market"}
      qrHref={access.canOpenCancelledQr && order?.market_id ? `/new-orders/cancelled/${String(order.market_id)}` : null}
    />
  ) : null;

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
        <OrderQrCard order={detail} />
      </div>
      <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-6 max-md:gap-4">
        {returnPathCard}
        <ProductsCard
          order={detail}
          editable={access.canEditOrderFull}
          locked={access.productsLocked}
          lockReason={access.productsLockReason}
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
        {returnPathCard}
        <ProductsCard order={detail} showDelivery={false} />
        <PaymentCard order={detail} />
        <OrderQrCard order={detail} />
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
        <CourierProductsCard order={detail} locked={access.productsLocked} lockReason={access.productsLockReason} />
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
        backLabel={newOrdersBackLabel}
        actions={access.layout === "market" ? printMenu : headerActions}
        handoverMethod={handoverMethod}
        handoverAt={handoverAt}
      />

      {order ? (
        <DetailAlerts
          layout={access.layout}
          pendingApproval={pendingApproval}
          productsLocked={access.productsLocked}
          productsLockReason={access.productsLockReason}
          destinationLocked={access.destinationLocked}
          canEditCustomer={access.canEditCustomer}
          parentOrderId={parentOrderId}
          editOpen={editOpen}
          marketListHref={isNewOrdersRoute && access.layout === "market" ? `/new-orders/${marketId}` : null}
          lockReason={lockReason}
        />
      ) : null}

      <QueryBoundary
        query={{ ...orderQuery, data: order }}
        keepPreviousData={false}
        loading={<DetailSkeleton />}
        // D-13: bo'sh javob va 404 — «Buyurtma topilmadi» («Buyurtmalarga qaytish»); boshqa xato — «Qayta urinish».
        empty={<DetailNotFound orderId={orderId} backTo={notFoundBackTo} />}
        error={(error, retry) => (
          <DetailErrorState orderId={orderId} backTo={notFoundBackTo} error={error} onRetry={retry} />
        )}
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
          marketId={order.market_id != null ? String(order.market_id) : null}
          onClose={() => setIsMarkReturnedOpen(false)}
          onDone={refreshTracking}
        />
      ) : null}
    </div>
  );
};

export default memo(NewOrderUpdate);

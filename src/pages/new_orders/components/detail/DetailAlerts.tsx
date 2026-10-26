// dizayn-v2: superadmin-orders-detail, superadmin-orders-detail-cancelled, manager-orders-detail-cancelled, admin-orders-detail, manager-orders-detail, registrator-orders-detail, market-orders-detail, courier-orders-detail, superadmin-neworders-market-order-edit, registrator-new-orders-market-order-edit, market-new-orders-edit
import { Clock, Info, Lock } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { isExtraCostAction, type PendingExtraCostApproval } from "../../../../entities/orders/extraCostApproval";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../../shared/lib/formatMoney";
import { OrderParentBanner } from "../../../../widgets/order-meta";
import { DetailAlert } from "./DetailAlert";
import { LOCK_ALERT_ID, type OrderDetailLayout, type ProductsLockReason } from "./orderDetailAccess";

const ACTION_LABEL_KEYS = {
  sell: "extraCostApprovalActionSell",
  partly_sell: "extraCostApprovalActionPartlySell",
  cancel: "extraCostApprovalActionCancel",
} as const;

type DetailAlertsProps = {
  layout: OrderDetailLayout;
  pendingApproval: PendingExtraCostApproval | null;
  productsLocked: boolean;
  /**
   * Mahsulot qulfi sababi: `hq` — «HQ qabul qilgandan keyin …», `warehouse` — viloyat ombori buyurtmasi HQ'dan
   * o'tmaydi, mahsulot omborda band qilingan (hfkhYrGk №4).
   */
  productsLockReason?: ProductsLockReason;
  destinationLocked: boolean;
  /** Superadmin / admin — qulf matnida «Mijoz va manzilni …», boshqalarda «Manzilni …». */
  canEditCustomer: boolean;
  parentOrderId: string | null;
  /**
   * `/new-orders/:marketId/edit` (maketlar `*-market-order-edit`): qulf yo'q bo'lsa xodimga «Tahrirlash ochiq.»
   * (info) — `full` (mijoz ham tahrirlanadi: superadmin/admin) yoki `limited` (mahsulot, summa, manzil).
   */
  editOpen?: "full" | "limited" | null;
  /** Marketning «Yangi buyurtmalar» ro'yxati — «Faqat ko'rish uchun» matniga «o'chirib, qaytadan yarating» havolasi. */
  marketListHref?: string | null;
  /**
   * Qulf sababi (maketlar `*-orders-detail-cancelled`): bekor qilingan — «Buyurtma bekor qilingan — …»,
   * marketga topshirilgan — «Buyurtma marketga topshirilgan — …», ombor buyurtmasi omborga qaytgan (hfkhYrGk №3,
   * marketga topshirilmagan) — «Mahsulot omborga qaytarilgan — …». Berilmasa — «filialga jo'natilgan».
   */
  lockReason?: "cancelled" | "returned" | "warehouse" | null;
};

/**
 * Sarlavha ostidagi ogohlantirishlar (`flex flex-col gap-3`): market tasdig'i kutilmoqda (warning),
 * qulf (neytral: «Mahsulotlar va summa qulflangan.» / «Tahrirlash yopiq.»), marketda «Faqat ko'rish
 * uchun» (info) va qisman sotuv banneri. Kuryerda qulf kartalar ostida izoh bo'lib turadi.
 */
export const DetailAlerts = ({
  layout,
  pendingApproval,
  productsLocked,
  productsLockReason = "hq",
  destinationLocked,
  canEditCustomer,
  parentOrderId,
  editOpen = null,
  marketListHref = null,
  lockReason = null,
}: DetailAlertsProps) => {
  const { t, i18n } = useTranslation(["orders", "newOrders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;

  const approval = (() => {
    if (!pendingApproval) return null;
    const amount = formatMoneyLocalized(pendingApproval.amount, { language });
    const time = formatDateTimeLocalized(pendingApproval.requestedAt, { language });
    const sent = isExtraCostAction(pendingApproval.action)
      ? t("extraCostApprovalSentAtAction", { amount, time, action: t(ACTION_LABEL_KEYS[pendingApproval.action]) })
      : t("extraCostApprovalSentAt", { amount, time });
    const full = (
      <DetailAlert
        tone="warning"
        icon={Clock}
        role="status"
        title={t("orderDetail.approvalTitle")}
        className={layout === "courier" ? "max-md:hidden" : undefined}
      >
        {t("orderDetail.approvalBody", { sent })}
      </DetailAlert>
    );
    if (layout !== "courier") return full;
    return (
      <>
        {full}
        <DetailAlert
          tone="warning"
          icon={Clock}
          role="status"
          compact
          title={t("orderDetail.approvalCompactTitle")}
          className="hidden max-md:flex"
        >
          {t("orderDetail.approvalCompact", { amount, time })}
        </DetailAlert>
      </>
    );
  })();

  const lock = (() => {
    if (layout === "courier") return null;
    if (layout === "market") {
      return (
        <DetailAlert tone="info" icon={Lock} role="note" title={t("orderDetail.readOnlyTitle")} titleBlock>
          {t("orderEditRoleOnly", { ns: "newOrders" })}
          {destinationLocked ? ` ${t("orderDetail.readOnlyLocked")}` : null}
          {marketListHref ? (
            <>
              {" "}
              <Trans
                t={t}
                ns="newOrders"
                i18nKey="orderEdit.marketReadOnlyHint"
                components={{ list: <Link to={marketListHref} className="font-semibold text-action-fg underline" /> }}
              />
            </>
          ) : null}
        </DetailAlert>
      );
    }
    if (productsLocked && destinationLocked) {
      return (
        <DetailAlert tone="neutral" icon={Lock} role="status" id={LOCK_ALERT_ID.all} title={t("orderDetail.editClosedTitle")}>
          {lockReason === "warehouse"
            ? t("orderDetail.editClosedWarehouseBody")
            : lockReason === "returned"
              ? t("orderDetail.editClosedReturnedBody")
              : lockReason === "cancelled"
                ? t("orderDetail.editClosedCancelledBody")
                : t("orderDetail.editClosedBody")}
        </DetailAlert>
      );
    }
    if (productsLocked) {
      return (
        <DetailAlert
          tone="neutral"
          icon={Lock}
          role="status"
          id={LOCK_ALERT_ID.products}
          title={t("orderDetail.productsLockedTitle")}
        >
          {productsLockReason === "warehouse"
            ? t("orderDetail.productsLockedWarehouseBody")
            : t("orderDetail.productsLockedBody")}{" "}
          {canEditCustomer ? t("orderDetail.productsLockedCustomerAddress") : t("orderDetail.productsLockedAddress")}
        </DetailAlert>
      );
    }
    if (destinationLocked) {
      return (
        <DetailAlert tone="neutral" icon={Lock} role="status" id={LOCK_ALERT_ID.destination}>
          {t("destinationLockReason", { ns: "newOrders" })}
        </DetailAlert>
      );
    }
    if (editOpen) {
      return (
        <DetailAlert tone="info" icon={Info} role="status" title={t("orderEdit.editOpenTitle", { ns: "newOrders" })}>
          {editOpen === "full"
            ? t("orderEdit.editOpenBody", { ns: "newOrders" })
            : t("orderEdit.editOpenBodyLimited", { ns: "newOrders" })}
        </DetailAlert>
      );
    }
    return null;
  })();

  if (!approval && !lock && !parentOrderId) return null;

  return (
    <div className="flex flex-col gap-3">
      {approval}
      {lock}
      <OrderParentBanner parentOrderId={parentOrderId} />
    </div>
  );
};

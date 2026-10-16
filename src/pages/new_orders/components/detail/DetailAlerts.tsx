// dizayn-v2: superadmin-orders-detail, admin-orders-detail, manager-orders-detail, registrator-orders-detail, market-orders-detail, courier-orders-detail
import { Clock, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isExtraCostAction, type PendingExtraCostApproval } from "../../../../entities/orders/extraCostApproval";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../../shared/lib/formatMoney";
import { OrderParentBanner } from "../../../../widgets/order-meta";
import { DetailAlert } from "./DetailAlert";
import { LOCK_ALERT_ID, type OrderDetailLayout } from "./orderDetailAccess";

const ACTION_LABEL_KEYS = {
  sell: "extraCostApprovalActionSell",
  partly_sell: "extraCostApprovalActionPartlySell",
  cancel: "extraCostApprovalActionCancel",
} as const;

type DetailAlertsProps = {
  layout: OrderDetailLayout;
  pendingApproval: PendingExtraCostApproval | null;
  productsLocked: boolean;
  destinationLocked: boolean;
  /** Superadmin / admin — qulf matnida «Mijoz va manzilni …», boshqalarda «Manzilni …». */
  canEditCustomer: boolean;
  parentOrderId: string | null;
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
  destinationLocked,
  canEditCustomer,
  parentOrderId,
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
        </DetailAlert>
      );
    }
    if (productsLocked && destinationLocked) {
      return (
        <DetailAlert tone="neutral" icon={Lock} role="status" id={LOCK_ALERT_ID.all} title={t("orderDetail.editClosedTitle")}>
          {t("orderDetail.editClosedBody")}
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
          {t("orderDetail.productsLockedBody")}{" "}
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

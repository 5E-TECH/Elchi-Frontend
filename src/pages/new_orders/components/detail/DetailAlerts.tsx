// dizayn-v2: superadmin-orders-detail, superadmin-orders-detail-cancelled, manager-orders-detail-cancelled, admin-orders-detail, manager-orders-detail, registrator-orders-detail, market-orders-detail, courier-orders-detail, superadmin-neworders-market-order-edit, registrator-new-orders-market-order-edit, market-new-orders-edit
import { Clock, Info, Lock, Repeat } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  formatReplacementOrderRef,
  type OrderReplacementInfo,
} from "../../../../entities/order/model/orderReplacement";
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
  /**
   * lQjt6sKP almashtirish (`readOrderReplacement`): yangi buyurtmada — «Eski №EL-… o'rniga» (+ eski buyurtmaga havola,
   * kuryerdan tashqari — kuryer eski buyurtmani ocholmaydi, 403), eski buyurtmada — eski mahsulot qayerdaligi.
   */
  replacement?: OrderReplacementInfo | null;
};

const RETURN_STATE_KEYS = {
  awaiting_old_pickup: "replacementTag.returnAwaiting",
  old_collected: "replacementTag.returnCollected",
  old_returned: "replacementTag.returnReturned",
} as const;

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
  replacement = null,
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

  // Almashtirish banneri (maket yo'q — `DetailAlert` naqshida, BeePost tafsilotidagi «Almashtirish» kartasi o'rnida).
  const replacementAlert = (() => {
    if (!replacement) return null;
    const collectedAt = replacement.collectedAt ? formatDateTimeLocalized(replacement.collectedAt, { language }) : null;
    if (replacement.isReplacement && replacement.oldOrderId) {
      const ref = formatReplacementOrderRef(replacement.oldOrderId);
      const body = replacement.needsOldItemConfirm
        ? t("replacementBanner.newAwaiting", { ref })
        : collectedAt
          ? t("replacementBanner.newCollected", { ref, date: collectedAt })
          : t("replacementBanner.newCollectedNoDate", { ref });
      return (
        <DetailAlert
          tone={replacement.needsOldItemConfirm ? "warning" : "info"}
          icon={Repeat}
          role="note"
          title={t("replacementBanner.newTitle")}
          data-testid="order-replacement-banner"
        >
          {body}
          {layout === "courier" ? null : (
            <>
              {" "}
              <Link
                to={`/orders/edit/${replacement.oldOrderId}`}
                className="whitespace-nowrap font-semibold text-action-fg underline-offset-2 hover:underline"
              >
                {t("replacementBanner.openOld")}
              </Link>
            </>
          )}
        </DetailAlert>
      );
    }
    if (replacement.isReplacementReturn) {
      return (
        <DetailAlert
          tone="info"
          icon={Repeat}
          role="note"
          title={t("replacementBanner.returnTitle")}
          data-testid="order-replacement-return-banner"
        >
          {replacement.state ? t(RETURN_STATE_KEYS[replacement.state]) : null}
          {collectedAt ? ` ${t("replacementBanner.returnCollectedAt", { date: collectedAt })}` : null}
        </DetailAlert>
      );
    }
    return null;
  })();

  if (!approval && !lock && !parentOrderId && !replacementAlert) return null;

  return (
    <div className="flex flex-col gap-3">
      {approval}
      {replacementAlert}
      {lock}
      <OrderParentBanner parentOrderId={parentOrderId} />
    </div>
  );
};

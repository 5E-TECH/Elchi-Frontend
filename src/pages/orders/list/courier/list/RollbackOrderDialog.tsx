// dizayn-v2: courier-orders-rollback-confirm, manager-orders-rollback-dialog
import { memo, useId, useRef, useState } from "react";
import { ArrowRight, RotateCcw, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  humanizeOrderStatus,
  ORDER_STATUS_NS,
  ORDER_STATUS_REGISTRY,
  OrderStatusBadge,
  resolveDisplayOrderStatus,
} from "../../../../../entities/order";
import {
  getRollbackTargets,
  ROLLBACK_TARGET_STATUS,
  type RollbackTarget,
} from "../../../../../entities/orders/rollbackTarget";
import { formatPhone } from "../../../../../shared/lib/formatPhone";
import { Button, Dialog, SegmentedControl } from "../../../../../shared/ui/primitives";
import { OrderCustomerSummary } from "./OrderActionParts";
import { getDeliveryLabelKey, type ActionOrder, type OrderActionVariant } from "./orderActionModel";
import { useActionDialogSession } from "./useActionDialogSession";

/**
 * BUYURTMANI QAYTARISH (rollback) TASDIG'I — sotilgan yoki bekor qilingan buyurtma «Kutilmoqda»
 * holatiga qaytadi (`POST /orders/rollback/:id`; kassa yozuvlari ham qaytariladi). `alertdialog`:
 * ochilganda fokus xavfsiz «Orqaga» tugmasida, so'rov ketayotganda yopilmaydi.
 *
 * Maketlar: `courier-orders-rollback-confirm` (`variant="courier"`, sukut) — «Holatni qayta tiklash»,
 * mijoz bloki ichida «Holat: Sotilgan → Kutilmoqda»; `manager-orders-rollback-dialog`
 * (`variant="manager"`, superadmin ham) — «Buyurtmani qaytarish», mijoz bloki ostida savol.
 *
 * Maqsad holat (y2RarzlT, `target_status`): «Kutilmoqda» · «Bekor qilish» · kuryerda «Bekor — jo'natilgan»
 * (`getRollbackTargets`); bekor qilingan buyurtma faqat «Kutilmoqda» ga — tanlov chiqmaydi. Maketda tanlov va
 * kassa izohi yo'q (ega qarori kutilmoqda) — `SegmentedControl` va bir jumlalik izoh.
 */

type Props = {
  /** Qaytariladigan buyurtma; `null` — oyna yopiq. */
  order: ActionOrder | null;
  variant?: OrderActionVariant;
  /** Mutatsiya ketmoqda: tugmada yuklanish, Esc / fon / «Orqaga» ishlamaydi. */
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (target: RollbackTarget) => void;
};

const RollbackDialog = ({
  order,
  open,
  variant,
  loading = false,
  onCancel,
  onConfirm,
}: Omit<Props, "order" | "variant"> & { order: ActionOrder; open: boolean; variant: OrderActionVariant }) => {
  const { t } = useTranslation(["orders", "common"]);
  const ids = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const isManager = variant === "manager";
  // Holat yorlig'i — `OrderStatusBadge` bilan bir manbadan (ekran o'quvchi uchun jumla).
  const statusLabel = (status: unknown) => {
    const key = resolveDisplayOrderStatus(status);
    return key ? t(ORDER_STATUS_REGISTRY[key].labelKey, { ns: ORDER_STATUS_NS }) : (humanizeOrderStatus(status) ?? "—");
  };
  const targets = getRollbackTargets(isManager ? "manager" : "courier", order.status);
  const [target, setTarget] = useState<RollbackTarget>(targets[0]);
  const targetStatus = ROLLBACK_TARGET_STATUS[target];
  const targetLabel = statusLabel(targetStatus);
  const choice =
    targets.length > 1 ? (
      <SegmentedControl<RollbackTarget>
        ariaLabel={t("rollbackTargetLabel")}
        value={target}
        onValueChange={setTarget}
        options={targets.map((value) => ({
          value,
          label: value === "cancelled" ? t("rollbackTargetCancel") : statusLabel(ROLLBACK_TARGET_STATUS[value]),
          disabled: loading,
        }))}
      />
    ) : null;
  const cashNote = <p className="m-0 text-[13px] text-text-muted">{t("rollbackCashNote")}</p>;

  const footer = (
    <>
      <Button ref={cancelRef} variant="secondary" disabled={loading} onClick={onCancel}>
        {t("back", { ns: "common" })}
      </Button>
      <Button leftIcon={RotateCcw} loading={loading} onClick={() => onConfirm(target)}>
        {isManager ? t("rollbackConfirmLabel") : t("rollbackRestoreConfirm")}
      </Button>
    </>
  );

  const phone = order.customer?.phone_number ? formatPhone(order.customer.phone_number) : null;

  if (isManager) {
    const district = order.district?.name?.trim() || null;
    const deliveryKey = getDeliveryLabelKey(order.where_deliver);
    const subtitle = [`№${order.id}`, order.market?.name, deliveryKey ? t(deliveryKey) : null]
      .filter(Boolean)
      .join(" · ");
    return (
      <Dialog
        open={open}
        onClose={onCancel}
        role="alertdialog"
        busy={loading}
        initialFocus={cancelRef}
        size="md"
        title={t("rollbackOrder")}
        description={<span id={`${ids}-sub`}>{subtitle}</span>}
        aria-describedby={`${ids}-sub ${ids}-desc`}
        icon={RotateCcw}
        iconTone="warning"
        footer={footer}
      >
        <OrderCustomerSummary
          order={order}
          variant="manager"
          // Maket: «telefon · tuman» (telefonda ajratgichsiz, qatorlar o'raladi).
          metaClassName="items-center gap-x-1.5 gap-y-0.5"
          meta={
            <>
              {phone ? <span className="whitespace-nowrap">{phone}</span> : null}
              {phone && district ? (
                <span aria-hidden="true" className="max-md:hidden">
                  ·
                </span>
              ) : null}
              {district ? <span className="whitespace-nowrap">{district}</span> : null}
            </>
          }
        />
        {choice}
        <p id={`${ids}-desc`} className="m-0 text-sm text-text">
          {t("rollbackManagerDescription", { status: targetLabel })}
        </p>
        {cashNote}
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      role="alertdialog"
      busy={loading}
      initialFocus={cancelRef}
      size="sm"
      className="md:max-w-[460px]"
      title={t("rollbackRestoreTitle")}
      description={
        target === "waiting" ? t("rollbackRestoreDescription") : t("rollbackManagerDescription", { status: targetLabel })
      }
      icon={TriangleAlert}
      iconTone="warning"
      footer={footer}
    >
      <OrderCustomerSummary
        order={order}
        variant="courier"
        amountLabel={null}
        meta={
          <>
            <span className="whitespace-nowrap">№{order.id}</span>
            {phone ? <span className="whitespace-nowrap">{phone}</span> : null}
          </>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-text-muted">{t("orderStatus")}</span>
            <span className="inline-flex items-center">
              <span className="sr-only">
                {t("rollbackStatusChange", { from: statusLabel(order.status), to: targetLabel })}
              </span>
              <span aria-hidden="true" className="inline-flex items-center gap-1.5">
                <OrderStatusBadge status={order.status} />
                <ArrowRight size={16} strokeWidth={2} className="shrink-0 text-text-subtle" />
                <OrderStatusBadge status={targetStatus} />
              </span>
            </span>
          </div>
        }
      />
      {choice}
      {cashNote}
    </Dialog>
  );
};

/**
 * Qaytarish tasdig'i (boshqariladigan): `order` berilsa ochiq. Mutatsiya va natija xabari — sahifada
 * (`onConfirm`), oyna faqat so'raydi.
 */
const RollbackOrderDialog = ({ order, variant = "courier", ...rest }: Props) => {
  const session = useActionDialogSession(Boolean(order), order);
  if (!session.order) return null;
  return <RollbackDialog key={session.session} {...rest} order={session.order} open={session.open} variant={variant} />;
};

export default memo(RollbackOrderDialog);

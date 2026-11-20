// dizayn-v2: courier-orders-rollback-confirm, manager-orders-rollback-dialog
import { memo, useId, useRef, useState } from "react";
import { ArrowRight, Info, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";
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
import { OrderActionErrorAlert } from "../../../../../entities/orders/ui/OrderActionErrorAlert";
import { formatPhone } from "../../../../../shared/lib/formatPhone";
import { Button, Dialog, SegmentedControl } from "../../../../../shared/ui/primitives";
import { OrderCustomerSummary } from "./OrderActionParts";
import { getDeliveryLabelKey, type ActionOrder, type OrderActionVariant } from "./orderActionModel";
import { useActionDialogSession } from "./useActionDialogSession";
import type { RollbackDialogError } from "./useRollbackOrderFlow";

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
 *
 * BE #738: rad etish / xato OYNA ICHIDA (`error`, `OrderActionErrorAlert`; maketda xato holati yo'q — sotish
 * oynasidagi naqsh): qayta urinish mumkin bo'lsa asosiy tugma «Qayta urinish», aniq rad etishda o'chiq. Superadmin
 * oynasida daftar izohi (`ledgerNote`: pul HQ'ga o'tgan / market to'langan — naqd ko'chmaydi).
 */

type Props = {
  /** Qaytariladigan buyurtma; `null` — oyna yopiq. */
  order: ActionOrder | null;
  variant?: OrderActionVariant;
  /** Mutatsiya ketmoqda: tugmada yuklanish, Esc / fon / «Orqaga» ishlamaydi. */
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (target: RollbackTarget) => void;
  /** So'rov rad etildi yoki javob kelmadi — oyna ichida (`useRollbackOrderFlow`). */
  error?: RollbackDialogError | null;
  /** Maqsad holat almashtirildi (avvalgi xato endi tegishli emas). */
  onTargetChange?: () => void;
  /** Superadmin: «pul HQ'ga o'tgan / market to'langan — naqd ko'chmaydi, daftarga yoziladi» izohi. */
  ledgerNote?: boolean;
};

const RollbackDialog = ({
  order,
  open,
  variant,
  loading = false,
  onCancel,
  onConfirm,
  error = null,
  onTargetChange,
  ledgerNote = false,
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
  const [selected, setSelected] = useState<RollbackTarget>(targets[0]);
  // Qayta o'qilgan buyurtmaning holati o'zgarsa (`STATE_CHANGED` → qayta urinish) tanlov ro'yxati ham o'zgaradi.
  const target = targets.includes(selected) ? selected : targets[0];
  const setTarget = (next: RollbackTarget) => {
    setSelected(next);
    if (next !== target) onTargetChange?.();
  };
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
  const cashNote = (
    <>
      <p className="m-0 text-[13px] text-text-muted">{t("rollbackCashNote")}</p>
      {ledgerNote ? (
        <div
          role="note"
          data-testid="rollback-ledger-note"
          className="flex items-start gap-2 rounded-xl bg-sunken px-3 py-2.5 text-[13px] text-text-muted"
        >
          <Info size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="m-0 min-w-0">{t("rollbackSuperadminLedgerNote")}</p>
        </div>
      ) : null}
      {error ? <OrderActionErrorAlert message={error.message} hint={error.hint} /> : null}
    </>
  );

  const retry = Boolean(error?.retry);
  const footer = (
    <>
      <Button ref={cancelRef} variant="secondary" disabled={loading} onClick={onCancel}>
        {t("back", { ns: "common" })}
      </Button>
      <Button
        leftIcon={retry ? RefreshCw : RotateCcw}
        loading={loading}
        // Aniq rad etish (qayta urinish ma'nosiz) — tugma o'chiq, sabab oynada.
        disabled={Boolean(error) && !retry}
        onClick={() => onConfirm(target)}
      >
        {retry ? t("retry", { ns: "common" }) : isManager ? t("rollbackConfirmLabel") : t("rollbackRestoreConfirm")}
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

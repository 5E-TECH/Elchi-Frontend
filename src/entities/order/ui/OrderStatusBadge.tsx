import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { StatusBadge, type StatusBadgeProps } from "../../../shared/ui/primitives/StatusBadge";
import {
  cancelStageMetaFor,
  resolveCancelReturnPlace,
  resolveCancelReturnStage,
  type CancelReturnStage,
} from "../model/cancelReturnStage";
import { useCancelReturnPlaceText } from "./useCancelReturnPlaceText";
import {
  ORDER_STATUS_NS,
  ORDER_STATUS_REGISTRY,
  ORDER_STATUS_UNKNOWN_LABEL_KEY,
  humanizeOrderStatus,
  resolveDisplayOrderStatus,
} from "../model/statusRegistry";

export type OrderStatusBadgeProps = Omit<
  StatusBadgeProps,
  "tone" | "label" | "icon" | "variant"
> & {
  /** API'dan kelgan xom holat (`on the road`, `ON_THE_ROAD`, `cancelled_sent` …). */
  status: unknown;
  /**
   * Buyurtma yozuvi (ro'yxat qatori yoki detal) — berilsa, bekor qilingan buyurtma uchun JOY
   * BOSQICHI belgisi chiziladi («Bekor · HQ'da», «Bekor · yo'lda» …; `cancelReturnStage.ts`).
   * Berilmasa — oddiy holat belgisi (`returned_to_market` bundan mustasno: u doim bosqich belgisi).
   */
  order?: unknown;
  /** Bosqich belgisi ostida joy qatori («Toshkent HQ · 2 kun», «→ Toshkent HQ»). Faqat `order` bilan. */
  withPlace?: boolean;
};

/**
 * BUYURTMA HOLATI BELGISI (dizayn v2): ton, yorliq va ko'rinish
 * `ORDER_STATUS_REGISTRY` dan; maketdagidek nuqtali (`el-badge el-badge-dot`),
 * ikonkasiz; «Bekor — jo'natilgan» chegarali.
 *
 * Bekor bosqichi (`order` berilganda, maket `tizim-states-data` §09) — nuqtasiz, ikonkali
 * belgi: «Bekor · kuryerda / yo'lda / filialda / HQ'da» (danger) va «Marketga topshirildi»
 * (neytral, `PackageCheck`); ombor buyurtmasi (`fulfillment_source: WAREHOUSE`) uchun — «Omborga qaytdi» (`Warehouse`).
 *
 * Noma'lum holat yiqitmaydi va bo'sh qolmaydi: neytral ton + o'qiladigan xom
 * qiymat (`lost_in_transit` → «Lost in transit»), bo'sh qiymat — «Noma'lum».
 */
export const OrderStatusBadge = ({
  status,
  order,
  withPlace = false,
  className,
  ...rest
}: OrderStatusBadgeProps) => {
  const { t } = useTranslation(ORDER_STATUS_NS);
  const resolved = resolveDisplayOrderStatus(status);
  const stage: CancelReturnStage | null =
    order !== undefined
      ? resolveCancelReturnStage({ ...(order && typeof order === "object" ? order : {}), status })
      : resolved === "returned_to_market"
        ? "market"
        : null;

  if (stage) {
    // 6kHnNH9j: ombor buyurtmasi omborga qaytgan bo'lsa — «Omborga qaytdi» (`market` bosqichi o'rnida).
    const meta = cancelStageMetaFor({ ...(order && typeof order === "object" ? order : {}), status }, stage);
    const warehouseReturn = meta.labelKey === "cancelStage.warehouse";
    const badge = (
      <StatusBadge
        tone={meta.tone}
        variant={meta.variant}
        icon={meta.icon}
        label={t(meta.labelKey)}
        data-order-status={resolved ? ORDER_STATUS_REGISTRY[resolved].key : undefined}
        data-cancel-stage={warehouseReturn ? "warehouse" : stage}
        className={withPlace ? undefined : className}
        {...rest}
      />
    );
    if (!withPlace) return badge;
    return (
      <span className={cx("inline-flex min-w-0 flex-col items-start gap-1", className)}>
        {badge}
        <OrderReturnPlace order={order} stage={stage} />
      </span>
    );
  }

  if (resolved) {
    const meta = ORDER_STATUS_REGISTRY[resolved];
    return (
      <StatusBadge
        tone={meta.tone}
        variant={meta.variant}
        label={t(meta.labelKey)}
        data-order-status={meta.key}
        className={className}
        {...rest}
      />
    );
  }

  return (
    <StatusBadge
      tone="neutral"
      label={humanizeOrderStatus(status) ?? t(ORDER_STATUS_UNKNOWN_LABEL_KEY)}
      data-order-status="unknown"
      className={className}
      {...rest}
    />
  );
};

/**
 * BEKOR BOSQICHINING JOY QATORI (`.el-cell-sub`): jadval katagida belgi ostida, telefon kartasida
 * alohida qator. Ma'lumot yo'q bo'lsa — hech narsa chizilmaydi.
 */
export const OrderReturnPlace = ({
  order,
  stage,
  className,
}: {
  order: unknown;
  stage?: CancelReturnStage | null;
  className?: string;
}) => {
  const format = useCancelReturnPlaceText();
  const resolvedStage = stage === undefined ? resolveCancelReturnStage(order) : stage;
  const text = format(resolveCancelReturnPlace(order, resolvedStage));
  if (!text) return null;
  return (
    <span
      className={cx("text-[13px] text-text-muted", className)}
      data-testid="cancel-return-place"
    >
      {text.name}
      {text.name && text.extra ? " · " : null}
      {text.extra ? <span className="whitespace-nowrap">{text.extra}</span> : null}
    </span>
  );
};

import { ShieldAlert, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { Badge } from "../../../shared/ui/primitives/Badge";
import { StatusBadge, type StatusBadgeProps } from "../../../shared/ui/primitives/StatusBadge";
import {
  cancelStageMetaFor,
  readCancelHandoverFlags,
  resolveCancelReturnPlace,
  resolveCancelReturnStage,
  type CancelReturnAgeLevel,
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
 * «N kun» (vNKGbg5q, maket `superadmin-orders-list-cancelled`): < 3 kun — oddiy; ≥ 3 — sariq qalin; ≥ 7 — sariq +
 * `TriangleAlert` (rang yolg'iz emas — matn va ikonka bilan).
 */
const CancelReturnAge = ({ text, level }: { text: string; level: CancelReturnAgeLevel | null }) => (
  <span
    data-testid="cancel-return-age"
    data-level={level ?? undefined}
    className={cx(
      "whitespace-nowrap",
      level && "font-semibold text-warning-fg",
      level === "alert" && "inline-flex items-center gap-1 align-bottom",
    )}
  >
    {level === "alert" ? <TriangleAlert size={14} aria-hidden="true" className="shrink-0" /> : null}
    {text}
  </span>
);

/**
 * BEKOR BOSQICHINING JOY QATORI (`.el-cell-sub`): jadval katagida belgi ostida, telefon kartasida
 * alohida qator. Ma'lumot yo'q bo'lsa — hech narsa chizilmaydi. Joy, «N kun» (3/7 kunda ogohlantirish) va
 * «Marketga topshirildi» vaqti + usuli backend `cancel_return` dan (BG1/BG2; yo'q bo'lsa — zaxira hisob).
 *
 * `withHandoverFlags` (xodim ro'yxatlari; market tomonida yo'q) — BG7: `handover_escalated_at` → qizil
 * «Eskalatsiya» belgisi, `handover_notified_at` → «Marketga eslatildi (sana)». Faqat filial / HQ bosqichida.
 */
export const OrderReturnPlace = ({
  order,
  stage,
  className,
  withHandoverFlags = false,
}: {
  order: unknown;
  stage?: CancelReturnStage | null;
  className?: string;
  withHandoverFlags?: boolean;
}) => {
  const { t, i18n } = useTranslation(ORDER_STATUS_NS);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const format = useCancelReturnPlaceText();
  const resolvedStage = stage === undefined ? resolveCancelReturnStage(order) : stage;
  const text = format(resolveCancelReturnPlace(order, resolvedStage));
  const flags =
    withHandoverFlags && (resolvedStage === "branch" || resolvedStage === "hq")
      ? readCancelHandoverFlags(order)
      : null;
  const escalated = flags?.escalatedAt != null;
  const notifiedAt = flags?.notifiedAt ?? null;
  if (!text && !escalated && notifiedAt === null) return null;

  const parts = text
    ? [
        text.name,
        text.time ? <span className="whitespace-nowrap">{text.time}</span> : null,
        text.days ? <CancelReturnAge text={text.days} level={text.level} /> : null,
        text.method,
      ].filter(Boolean)
    : [];

  return (
    <>
      {parts.length > 0 ? (
        <span className={cx("text-[13px] text-text-muted", className)} data-testid="cancel-return-place">
          {parts.map((part, index) => (
            <span key={index}>
              {index > 0 ? " · " : null}
              {part}
            </span>
          ))}
        </span>
      ) : null}
      {escalated || notifiedAt !== null ? (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-muted">
          {escalated ? (
            <Badge tone="danger" size="sm" icon={ShieldAlert} data-testid="cancel-return-escalated">
              {t("cancelReturn.escalated")}
            </Badge>
          ) : null}
          {notifiedAt !== null ? (
            <span data-testid="cancel-return-notified">
              {t("cancelReturn.notified", { date: formatDateLocalized(notifiedAt, { language }) })}
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );
};

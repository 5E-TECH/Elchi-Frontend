// dizayn-v2: superadmin-orders-detail, manager-orders-detail, courier-orders-detail
import { normalizeOrderStatus, OrderStatusBadge } from "../../../entities/order";
import { StatusBadge, type Tone } from "../../../shared/ui/primitives";
import { normalizeKey } from "../model/describeTrackingEvent";
import { useTrackingStatusLabel } from "../model/useTrackingStatusLabel";

/**
 * Tarixdagi holat belgisi. Registrdagi holatlar — `OrderStatusBadge` (yagona registr; «Marketga topshirildi»
 * ham — neytral, `PackageCheck`). Backend'ning ichki holatlari esa o'z nomi bilan: «Mijoz kutilmoqda»,
 * «Jarayonda», «Tayyor».
 */
const EXTRA_TONES: Record<string, Tone> = {
  waiting_customer: "warning",
  processing: "warning",
  completed: "info",
};

export const TrackingStatusBadge = ({ status }: { status: string }) => {
  const label = useTrackingStatusLabel();
  if (normalizeOrderStatus(status)) return <OrderStatusBadge status={status} />;
  const tone = EXTRA_TONES[normalizeKey(status)];
  if (!tone) return <OrderStatusBadge status={status} />;
  return <StatusBadge tone={tone} label={label(status)} data-order-status={normalizeKey(status)} />;
};

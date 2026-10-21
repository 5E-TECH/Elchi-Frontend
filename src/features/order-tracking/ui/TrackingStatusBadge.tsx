// dizayn-v2: superadmin-orders-detail, manager-orders-detail, courier-orders-detail
import { normalizeOrderStatus, OrderStatusBadge } from "../../../entities/order";
import { StatusBadge, type Tone } from "../../../shared/ui/primitives";
import { normalizeKey } from "../model/describeTrackingEvent";
import { useTrackingStatusLabel } from "../model/useTrackingStatusLabel";

/**
 * Tarixdagi holat belgisi. Registrdagi 13 holat («Marketga topshirildi» — neytral, `PackageCheck`; «Mijoz kutilmoqda» ham —
 * SllBYhnt) — `OrderStatusBadge` (yagona registr). Registrda yo'q ichki holatlar o'z nomi bilan:
 * «Jarayonda», «Tayyor».
 */
const EXTRA_TONES: Record<string, Tone> = {
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

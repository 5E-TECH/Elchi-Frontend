// dizayn-v2: superadmin-orders-detail, admin-orders-detail, manager-orders-detail, registrator-orders-detail, market-orders-detail, courier-orders-detail, tizim-errors
import { ArrowLeft, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getErrorStatus } from "../../../../shared/lib/errorKind";
import { buttonClasses, EmptyState, ErrorState } from "../../../../shared/ui/primitives";

type DetailNotFoundProps = {
  /** URL'dagi raqam — izohda («№99999999 raqamli buyurtma yo'q …»). */
  orderId: string;
  /** «Buyurtmalarga qaytish» manzili (sukut `/orders`; `/new-orders/:marketId/edit` — market ro'yxati). */
  backTo?: string;
};

/**
 * BUYURTMA TOPILMADI (D-13) — `tizim-errors` naqshi: sarlavha «Buyurtma topilmadi», izoh raqam bilan,
 * yagona amal «Buyurtmalarga qaytish» («Qayta urinish» emas — qayta so'rash natijani o'zgartirmaydi).
 * Backendning inglizcha matni («Order #… topilmadi») ko'rsatilmaydi.
 */
export const DetailNotFound = ({ orderId, backTo = "/orders" }: DetailNotFoundProps) => {
  const { t } = useTranslation("orders");
  return (
    <EmptyState
      size="page"
      icon={SearchX}
      title={t("orderDetail.notFoundTitle")}
      description={t("orderDetail.notFoundDescription", { id: orderId })}
      action={
        <Link to={backTo} className={buttonClasses({ variant: "secondary" })}>
          <ArrowLeft aria-hidden="true" size={16} strokeWidth={2} />
          {t("orderDetail.backToOrders")}
        </Link>
      }
    />
  );
};

type DetailErrorStateProps = DetailNotFoundProps & {
  error: unknown;
  onRetry?: () => void;
};

/**
 * Tafsilot so'rovi xatosi: 404 — `DetailNotFound`; boshqasi — umumiy `ErrorState` («Qayta urinish» bilan).
 *
 *   <QueryBoundary … error={(error, retry) => <DetailErrorState orderId={orderId} error={error} onRetry={retry} />}>
 */
export const DetailErrorState = ({ orderId, backTo, error, onRetry }: DetailErrorStateProps) =>
  getErrorStatus(error) === 404 ? (
    <DetailNotFound orderId={orderId} backTo={backTo} />
  ) : (
    <ErrorState error={error} size="page" onRetry={onRetry} />
  );

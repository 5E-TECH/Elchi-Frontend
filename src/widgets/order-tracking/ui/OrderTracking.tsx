import { useTranslation } from "react-i18next";
import { Loader } from "../../../shared/ui/Loader";
import { TrackingEmptyState, TrackingTimeline, useOrderTracking } from "../../../features/order-tracking";

type OrderTrackingProps = {
  orderId: string | number;
};

export const OrderTracking = ({ orderId }: OrderTrackingProps) => {
  const { t } = useTranslation("orders");
  const { events, isLoading, isError, errorMessage, hasMore, loadMore } = useOrderTracking(orderId);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/4">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("tracking.title")}</h2>
          <p className="text-sm text-gray-500 dark:text-white/50">{events.length}</p>
        </div>
      </div>

      {isLoading && events.length === 0 ? (
        <div className="flex min-h-56 items-center justify-center">
          <Loader />
        </div>
      ) : null}

      {!isLoading && isError ? (
        <TrackingEmptyState
          type="error"
          message={errorMessage || t("tracking.error")}
        />
      ) : null}

      {!isLoading && !isError && events.length === 0 ? <TrackingEmptyState type="empty" /> : null}

      {events.length > 0 ? (
        <div className="space-y-5">
          <TrackingTimeline events={events} />
          {hasMore ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={isLoading}
                className="inline-flex items-center justify-center rounded-xl border border-main/20 bg-main/10 px-4 py-2.5 text-sm font-semibold text-main transition-colors hover:bg-main/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("tracking.loadMore")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default OrderTracking;

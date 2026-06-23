import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { Loader } from "../../../shared/ui/Loader";
import { TrackingEmptyState, TrackingTimeline, useOrderTracking } from "../../../features/order-tracking";

type OrderTrackingProps = {
  orderId: string | number;
  currentStatus?: string | null;
  context?: {
    branchName?: string | null;
    postName?: string | null;
    marketName?: string | null;
    branchNamesById?: Record<string, string>;
    marketNamesById?: Record<string, string>;
  };
};

export const OrderTracking = ({ orderId, currentStatus, context }: OrderTrackingProps) => {
  const { t } = useTranslation("orders");
  const { events, isLoading, isError, errorMessage, hasMore, loadMore } = useOrderTracking(orderId);
  const currentUser = useSelector((state: RootState) => state.user.user);
  void currentStatus;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/8 dark:bg-white/4 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-main/12 text-main dark:bg-main/25 dark:text-primary">
            <History size={18} />
          </div>
          <div>
            <h2 className="text-[18px] font-medium text-[var(--color-maindark)] dark:text-primary">
              {t("tracking.title")}
            </h2>
            {events.length > 0 ? (
              <p className="mt-1 text-xs font-semibold text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                {t("tracking.oldToNew", { count: events.length })}
              </p>
            ) : null}
          </div>
        </div>
        <div className="rounded-full border border-[color:var(--color-border-soft)] bg-[color:color-mix(in_srgb,var(--color-main)_10%,var(--color-primary))] px-3 py-1 text-xs font-semibold text-main dark:border-white/10 dark:bg-white/10 dark:text-primary">
          {events.length}
        </div>
      </div>

      {isLoading && events.length === 0 ? (
        <div className="relative flex min-h-56 items-center justify-center">
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
          <TrackingTimeline events={events} currentUser={currentUser} context={context} />
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

// dizayn-v2: superadmin-scan-result, registrator-scan-result
import { ChevronDown, History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import type { TrackingEvent } from "../../../entities/order";
import { TrackingTimeline, useOrderTracking, type TrackingContext } from "../../../features/order-tracking";
import { Button, Card, EmptyState, ErrorState, QueryBoundary, Skeleton } from "../../../shared/ui/primitives";

type ScanTrackingCardProps = {
  orderId: string;
  context?: TrackingContext;
};

const TrackingSkeleton = () => (
  <div className="flex flex-col gap-5">
    {[72, 56, 64].map((width) => (
      <div key={width} className="flex gap-3">
        <Skeleton shape="circle" width={32} height={32} />
        <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1.5">
          <Skeleton width={`${width}%`} height={14} />
          <Skeleton width="36%" height={12} />
        </div>
      </div>
    ))}
  </div>
);

/**
 * «Holat tarixi» (maket `superadmin-scan-result`, «Eng yangisi tepada») — superadmin, admin, registrator.
 * Hodisalar va jumlalar `features/order-tracking` dan (`useOrderTracking` — `GET orders/:id/tracking`,
 * `TrackingTimeline` — buyurtma tafsilotidagi bilan bir xil yozuvlar). Sahifa bu kartani `lazy()` bilan
 * yuklaydi — kuryer telefoniga tarix kodi tushmaydi.
 */
const ScanTrackingCard = ({ orderId, context }: ScanTrackingCardProps) => {
  const { t } = useTranslation(["scan", "orders"]);
  const currentUser = useSelector((state: RootState) => state.user.user);
  const { events, isLoading, isError, errorMessage, errorStatus, hasMore, loadMore, retry } = useOrderTracking(orderId);

  const query = {
    data: events.length > 0 || (!isLoading && !isError) ? events : undefined,
    isLoading: isLoading && events.length === 0,
    isError,
    refetch: retry,
  };

  return (
    <Card
      padding="none"
      title={t("history.title")}
      description={t("history.subtitle")}
      footer={
        hasMore ? (
          <div className="flex w-full justify-center">
            <Button variant="ghost" size="sm" leftIcon={ChevronDown} loading={isLoading} onClick={loadMore}>
              {t("tracking.loadMore", { ns: "orders" })}
            </Button>
          </div>
        ) : undefined
      }
    >
      <QueryBoundary<TrackingEvent[]>
        query={query}
        keepPreviousData={false}
        loading={<TrackingSkeleton />}
        className="p-5"
        empty={<EmptyState icon={History} title={t("tracking.empty", { ns: "orders" })} />}
        error={() => (
          <ErrorState
            kind={errorStatus === 403 ? "forbidden" : "section"}
            title={errorMessage || t("tracking.error", { ns: "orders" })}
            description={null}
            onRetry={retry}
          />
        )}
      >
        {(items) => <TrackingTimeline events={items} currentUser={currentUser} context={context} />}
      </QueryBoundary>
    </Card>
  );
};

export default ScanTrackingCard;

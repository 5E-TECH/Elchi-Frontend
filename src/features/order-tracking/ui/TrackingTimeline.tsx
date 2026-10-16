// dizayn-v2: superadmin-orders-detail, manager-orders-detail, courier-orders-detail
import type { TrackingEvent } from "../../../entities/order";
import type { User } from "../../../entities/user/model/types";
import type { TrackingContext } from "../model/describeTrackingEvent";
import { TrackingTimelineItem } from "./TrackingTimelineItem";

type TrackingTimelineProps = {
  events: TrackingEvent[];
  currentUser?: User | null;
  context?: TrackingContext;
};

/**
 * Buyurtma tarixi — VERTIKAL vaqt chizig'i, ENG YANGISI TEPADA (Ho5qcDn4, maket `*-orders-detail`).
 * `useOrderTracking` hodisalarni yangidan eskiga saralab beradi.
 */
export const TrackingTimeline = ({ events, currentUser, context }: TrackingTimelineProps) => (
  <ol className="m-0 flex list-none flex-col p-0">
    {events.map((event, position) => (
      <TrackingTimelineItem
        key={event.id}
        event={event}
        isLast={position === events.length - 1}
        currentUser={currentUser}
        context={context}
      />
    ))}
  </ol>
);

export default TrackingTimeline;

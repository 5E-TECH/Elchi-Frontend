import type { TrackingEvent } from "../../../entities/order";
import type { User } from "../../../entities/user/model/types";
import { TrackingTimelineItem } from "./TrackingTimelineItem";

type TrackingTimelineProps = {
  events: TrackingEvent[];
  currentUser?: User | null;
  context?: {
    branchName?: string | null;
    postName?: string | null;
    marketName?: string | null;
    branchNamesById?: Record<string, string>;
    marketNamesById?: Record<string, string>;
  };
};

/**
 * Buyurtma tarixi — VERTIKAL vaqt chizig'i, ENG YANGISI TEPADA (Ho5qcDn4).
 * `useOrderTracking` hodisalarni yangidan eskiga saralab beradi; ilgari bu
 * yerda teskari qilinib gorizontal (chapdan o'ngga) ko'rsatilardi — telefonda
 * yon tomonga cho'zilardi. Tartib raqami xronologik qoladi (eng yangisi #N/N).
 */
export const TrackingTimeline = ({ events, currentUser, context }: TrackingTimelineProps) => (
  <ol className="m-0 flex list-none flex-col gap-3 p-0">
    {events.map((event, position) => (
      <li key={event.id}>
        <TrackingTimelineItem
          event={event}
          index={events.length - 1 - position}
          total={events.length}
          isLast={position === events.length - 1}
          currentUser={currentUser}
          context={context}
        />
      </li>
    ))}
  </ol>
);

export default TrackingTimeline;

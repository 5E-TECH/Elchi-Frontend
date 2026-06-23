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

export const TrackingTimeline = ({ events, currentUser, context }: TrackingTimelineProps) => (
  <div className="-mx-2 overflow-x-auto px-2 pb-4">
    <div className="flex min-w-max gap-4 pr-2">
      {[...events].reverse().map((event, index) => (
        <TrackingTimelineItem
          key={event.id}
          event={event}
          index={index}
          total={events.length}
          currentUser={currentUser}
          context={context}
        />
      ))}
    </div>
  </div>
);

export default TrackingTimeline;

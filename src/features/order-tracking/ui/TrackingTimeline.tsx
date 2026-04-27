import type { TrackingEvent } from "../../../entities/order";
import { TrackingTimelineItem } from "./TrackingTimelineItem";

type TrackingTimelineProps = {
  events: TrackingEvent[];
};

export const TrackingTimeline = ({ events }: TrackingTimelineProps) => (
  <div className="space-y-6">
    {events.map((event, index) => (
      <TrackingTimelineItem
        key={event.id}
        event={event}
        isLast={index === events.length - 1}
      />
    ))}
  </div>
);

export default TrackingTimeline;

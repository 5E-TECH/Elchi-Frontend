import { TimelineRoot } from "../../../shared/ui/Timeline";
import type { TrackingEvent } from "../../../entities/order";
import { TrackingTimelineItem } from "./TrackingTimelineItem";

type TrackingTimelineProps = {
  events: TrackingEvent[];
};

export const TrackingTimeline = ({ events }: TrackingTimelineProps) => (
  <TimelineRoot>
    {events.map((event, index) => (
      <TrackingTimelineItem
        key={event.id}
        event={event}
        isLast={index === events.length - 1}
      />
    ))}
  </TimelineRoot>
);

export default TrackingTimeline;

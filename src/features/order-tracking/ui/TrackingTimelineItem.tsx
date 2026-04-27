import { useTranslation } from "react-i18next";
import type { TrackingEvent } from "../../../entities/order";
import { formatTrackingDate } from "../lib/formatTrackingDate";
import { actionLabelMap } from "../model/actionLabelMap";

type TrackingTimelineItemProps = {
  event: TrackingEvent;
  isLast?: boolean;
};

const humanize = (value?: string | null) => {
  if (!value) {
    return "—";
  }

  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const TrackingTimelineItem = ({ event, isLast = false }: TrackingTimelineItemProps) => {
  const { t } = useTranslation("orders");
  const actionLabelKey = event.action ? actionLabelMap[event.action] : undefined;
  const oldStatus = event.old_value?.status;
  const newStatus = event.new_value?.status;
  const actionName = actionLabelKey ? t(actionLabelKey) : humanize(event.action);
  const descriptionParts: string[] = [];

  if (oldStatus || newStatus) {
    descriptionParts.push(`${humanize(oldStatus)} -> ${humanize(newStatus)}`);
  }

  if (event.user_name) {
    descriptionParts.push(`${t("tracking.by")}: ${event.user_name}`);
  }

  if (event.note) {
    descriptionParts.push(`${t("tracking.note")}: ${event.note}`);
  }

  if (descriptionParts.length === 0) {
    descriptionParts.push(`${t("tracking.role")}: ${humanize(event.changed_by_role)}`);
  }

  return (
    <div className="flex items-start gap-4">
      <div className="relative flex flex-col items-center">
        <span className="relative z-10 h-3 w-3 rounded-full bg-main" />
        {!isLast ? (
          <span className="absolute left-[5px] top-5 h-[42px] w-0.5 bg-main/35" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-medium text-[var(--color-maindark)] dark:text-primary">
          {actionName}
        </h3>
        <p className="text-[15px] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
          {descriptionParts.join(" • ")}
        </p>
      </div>

      <time className="shrink-0 whitespace-nowrap text-[13px] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
        {formatTrackingDate(event.created_at)}
      </time>
    </div>
  );
};

export default TrackingTimelineItem;

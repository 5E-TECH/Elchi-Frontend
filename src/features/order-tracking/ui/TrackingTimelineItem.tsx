import { Activity, Lock, PlusCircle, RefreshCw, RotateCcw, ShoppingCart, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TimelineItem } from "../../../shared/ui/Timeline";
import type { TrackingEvent } from "../../../entities/order";
import { formatTrackingDate } from "../lib/formatTrackingDate";
import { actionLabelMap } from "../model/actionLabelMap";
import { StatusTransitionBadge } from "./StatusTransitionBadge";

type TrackingTimelineItemProps = {
  event: TrackingEvent;
  isLast?: boolean;
};

const getActionIcon = (action?: string) => {
  switch (action) {
    case "created":
      return <PlusCircle size={16} />;
    case "status_change":
      return <RefreshCw size={16} />;
    case "sold":
      return <ShoppingCart size={16} />;
    case "cancelled":
      return <XCircle size={16} />;
    case "closed":
      return <Lock size={16} />;
    case "rollback":
      return <RotateCcw size={16} />;
    default:
      return <Activity size={16} />;
  }
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
  const roleName = humanize(event.changed_by_role);

  return (
    <TimelineItem icon={getActionIcon(event.action)} isLast={isLast}>
      <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-primarydark">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {actionName}
              </h3>
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                {roleName}
              </span>
            </div>

            {(oldStatus || newStatus) && (
              <StatusTransitionBadge oldStatus={oldStatus} newStatus={newStatus} />
            )}

            <div className="flex flex-col gap-1 text-sm text-gray-500 dark:text-white/60">
              {event.user_name ? (
                <p>
                  <span className="font-medium text-gray-700 dark:text-white/80">{t("tracking.by")}:</span>{" "}
                  {event.user_name}
                </p>
              ) : null}
              <p>
                <span className="font-medium text-gray-700 dark:text-white/80">{t("tracking.role")}:</span>{" "}
                {roleName}
              </p>
              {event.note ? (
                <p>
                  <span className="font-medium text-gray-700 dark:text-white/80">{t("tracking.note")}:</span>{" "}
                  {event.note}
                </p>
              ) : null}
            </div>
          </div>

          <time className="shrink-0 text-xs font-medium text-gray-400 dark:text-white/40">
            {formatTrackingDate(event.created_at)}
          </time>
        </div>
      </article>
    </TimelineItem>
  );
};

export default TrackingTimelineItem;

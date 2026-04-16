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
      <article className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-linear-to-br from-white/95 via-white to-white/90 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition-transform duration-200 hover:-translate-y-0.5 dark:from-white/7 dark:via-white/5 dark:to-transparent sm:p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-linear-to-r from-main/10 via-transparent to-cyan-400/10 opacity-80 dark:from-main/10 dark:to-cyan-300/8" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white sm:text-[15px]">
                {actionName}
              </h3>
              <span className="inline-flex items-center rounded-full border border-main/15 bg-main/8 px-2.5 py-1 text-[11px] font-medium text-main dark:border-white/10 dark:bg-white/6 dark:text-white">
                {roleName}
              </span>
            </div>

            {(oldStatus || newStatus) && (
              <StatusTransitionBadge oldStatus={oldStatus} newStatus={newStatus} />
            )}

            <div className="grid gap-2 text-sm text-gray-500 dark:text-white/90 sm:grid-cols-2">
              {event.user_name ? (
                <p className="rounded-xl bg-black/[0.02] px-3 py-2 dark:bg-white/[0.04]">
                  <span className="font-medium text-gray-700 dark:text-white">{t("tracking.by")}:</span>{" "}
                  {event.user_name}
                </p>
              ) : null}
              <p className="rounded-xl bg-black/[0.02] px-3 py-2 dark:bg-white/[0.04]">
                <span className="font-medium text-gray-700 dark:text-white">{t("tracking.role")}:</span>{" "}
                {roleName}
              </p>
              {event.note ? (
                <p className="rounded-xl bg-black/[0.02] px-3 py-2 dark:bg-white/[0.04] sm:col-span-2">
                  <span className="font-medium text-gray-700 dark:text-white">{t("tracking.note")}:</span>{" "}
                  {event.note}
                </p>
              ) : null}
            </div>
          </div>

          <time className="shrink-0 rounded-full border border-black/5 bg-black/[0.03] px-3 py-1 text-xs font-medium text-gray-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-white">
            {formatTrackingDate(event.created_at)}
          </time>
        </div>
      </article>
    </TimelineItem>
  );
};

export default TrackingTimelineItem;

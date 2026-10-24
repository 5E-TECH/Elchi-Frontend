// dizayn-v2: superadmin-orders-detail, manager-orders-detail, courier-orders-detail
import { Fragment } from "react";
import { ChevronRight, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TrackingEvent } from "../../../entities/order";
import type { User } from "../../../entities/user/model/types";
import { formatPhone, toTelHref } from "../../../shared/lib/formatPhone";
import { cx } from "../../../shared/lib/cx";
import { Badge } from "../../../shared/ui/primitives";
import { formatTrackingDateTime } from "../lib/formatTrackingDate";
import { describeTrackingEvent, normalizeKey, type TrackingContext } from "../model/describeTrackingEvent";
import { useTrackingStatusLabel } from "../model/useTrackingStatusLabel";
import { TrackingStatusBadge } from "./TrackingStatusBadge";

type TrackingTimelineItemProps = {
  event: TrackingEvent;
  /** Ro'yxatdagi oxirgi (eng eski) yozuv — pastga chiziq chizilmaydi. */
  isLast?: boolean;
  currentUser?: User | null;
  context?: TrackingContext;
};

/**
 * TARIX YOZUVI — dizayn v2 (`*-orders-detail` «Buyurtma tarixi» `<li>`):
 * chapda 32px doira ikonka va pastga chiziq; o'ngda jumla («Ro'yxatchi **Bobur Xolmatov** buyurtmani
 * HQ'da qabul qildi»), bog'liq ma'lumotlar qatori, holat o'tishi («Yangi › [Qabul qilindi]») va vaqt,
 * izoh bo'lsa — «Izoh: …» bloki. Holat o'zgarmagan yozuvda o'tish o'rnida amal nomi («Qaytarish so'raldi»).
 */
export const TrackingTimelineItem = ({ event, isLast = false, currentUser, context }: TrackingTimelineItemProps) => {
  const { t, i18n } = useTranslation("orders");
  const statusLabel = useTrackingStatusLabel();
  const view = describeTrackingEvent(event, t, currentUser, context);
  const Icon = view.icon;
  const showRole = Boolean(view.roleLabel) && normalizeKey(view.roleLabel) !== normalizeKey(view.actor);
  const oldKey = normalizeKey(view.oldStatus);
  const newKey = normalizeKey(view.newStatus);

  const statusRow = (() => {
    if (view.newStatus && oldKey && oldKey !== newKey) {
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] text-text-muted">{statusLabel(view.oldStatus)}</span>
          <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-text-subtle" />
          <span className="sr-only">→</span>
          <TrackingStatusBadge status={view.newStatus} warehouseReturn={view.warehouseReturn} />
        </div>
      );
    }
    if (view.newStatus && !oldKey) {
      return <TrackingStatusBadge status={view.newStatus} warehouseReturn={view.warehouseReturn} />;
    }
    return (
      <Badge variant="outline" tone="neutral">
        {view.actionName}
      </Badge>
    );
  })();

  return (
    <li data-testid="tracking-event" className="flex gap-3">
      <div className="flex w-8 flex-none flex-col items-center">
        <span
          role="img"
          aria-label={view.actionName}
          className="inline-flex size-8 items-center justify-center rounded-full bg-sunken text-text-muted"
        >
          <Icon size={16} aria-hidden="true" />
        </span>
        {!isLast ? <span aria-hidden="true" className="my-1 w-0.5 flex-1 rounded-full bg-border" /> : null}
      </div>

      <div className={cx("flex min-w-0 flex-1 flex-col gap-2 pt-[5px]", !isLast && "pb-5")}>
        <p className="m-0 text-sm text-text wrap-break-word">
          {view.sentence.before}
          {showRole ? `${view.roleLabel} ` : null}
          <span className="font-semibold">{view.actor}</span>
          {view.sentence.after}
        </p>

        {view.details.length > 0 ? (
          <p className="m-0 text-[13px] text-text-muted wrap-break-word">
            {view.details.map((detail, index) => {
              const href = detail.kind === "phone" ? toTelHref(detail.value) : undefined;
              const value = detail.kind === "phone" ? formatPhone(detail.value) : detail.value;
              return (
                <Fragment key={`${detail.label}-${detail.value}`}>
                  {index > 0 ? <span aria-hidden="true"> · </span> : null}
                  <span className="whitespace-nowrap">
                    {detail.label}:{" "}
                    {href ? (
                      <a href={href} className="text-text hover:text-action-hover">
                        {value}
                      </a>
                    ) : (
                      <span className="text-text">{value}</span>
                    )}
                  </span>
                </Fragment>
              );
            })}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          {statusRow}
          <time dateTime={event.created_at} className="whitespace-nowrap text-[13px] text-text-muted">
            {formatTrackingDateTime(event.created_at, { language: i18n.resolvedLanguage ?? i18n.language })}
          </time>
        </div>

        {view.note ? (
          <p className="m-0 flex items-start gap-2 rounded-[10px] bg-sunken px-3 py-2 text-[13px] text-text">
            <MessageSquare size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-text-muted" />
            <span className="min-w-0 wrap-break-word">
              <span className="text-text-muted">{t("tracking.noteLabel")}</span> {view.note}
            </span>
          </p>
        ) : null}
      </div>
    </li>
  );
};

export default TrackingTimelineItem;

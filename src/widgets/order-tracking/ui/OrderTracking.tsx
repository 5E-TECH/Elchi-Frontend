// dizayn-v2: superadmin-orders-detail, admin-orders-detail, manager-orders-detail, registrator-orders-detail, courier-orders-detail
import { useId, useState } from "react";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import type { TrackingEvent } from "../../../entities/order";
import { TrackingTimeline, useOrderTracking, type TrackingContext } from "../../../features/order-tracking";
import { cx } from "../../../shared/lib/cx";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  QueryBoundary,
  Skeleton,
} from "../../../shared/ui/primitives";

type TrackingAccessContext = {
  holderType?: string | null;
  holderBranchId?: string | number | null;
  holderCourierId?: string | number | null;
};

type OrderTrackingProps = {
  orderId: string | number;
  currentStatus?: string | null;
  access?: TrackingAccessContext | null;
  context?: TrackingContext;
  /**
   * `courier` — `courier-orders-detail`: telefonda sarlavha o'rnida butun enli qator-tugma
   * (ikonka, sarlavha, son, chegarali «▾»). Desktop va planshetda — oddiy karta.
   */
  variant?: "default" | "courier";
  className?: string;
};

const normalize = (value?: string | number | null) => String(value ?? "").trim();

/** Telefonda (< 768) blok YIG'ILGAN ochiladi — sahifani cho'zib yubormasin (Ho5qcDn4, maket telefon ko'rinishi). */
const PHONE_QUERY = "(max-width: 767px)";
const isPhoneViewport = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches;

/**
 * Market ham o'z buyurtmasi tarixini ko'radi (Ho5qcDn4, TC9). Boshqa market buyurtmasini backend
 * `GET /orders/:id/tracking` 403 bilan rad etadi — blok o'rnida izoh chiqadi, sahifa buzilmaydi.
 */
const canRoleViewTracking = (role: string | null | undefined) =>
  ["admin", "superadmin", "branch", "manager", "registrator", "courier", "market"].includes(
    normalize(role).toLowerCase(),
  );

/** Yuklanish skeleti — vaqt chizig'i shaklida (doira + ikki qator). */
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
 * BUYURTMA TARIXI — dizayn v2 kartasi (`*-orders-detail` «Buyurtma tarixi»): sarlavha, «N ta yozuv —
 * eng yangisi tepada», yig'ish tugmasi (desktopda ochiq, telefonda yig'ilgan), vaqt chizig'i va
 * «Ko'proq yuklash». Holatlar — `QueryBoundary`: skelet, bo'sh («hali tarix yozuvlari yo'q»), xato
 * (backend matni yoki umumiy matn, «Qayta urinish»; 403 da qayta urinish yo'q).
 */
export const OrderTracking = ({ orderId, context, variant = "default", className }: OrderTrackingProps) => {
  const { t } = useTranslation("orders");
  const currentUser = useSelector((state: RootState) => state.user.user);
  const currentRole = useSelector((state: RootState) => state.role.role);
  const canViewTracking = canRoleViewTracking(currentRole);
  const { events, isLoading, isError, errorMessage, errorStatus, hasMore, loadMore, total, retry } = useOrderTracking(
    orderId,
    canViewTracking,
  );
  const [open, setOpen] = useState(() => !isPhoneViewport());
  const bodyId = useId();
  const titleId = useId();

  if (!canViewTracking) return null;

  // Backend `total` yashirin (custody) yozuvlarni ham sanaydi — u faqat hali yuklanmagan sahifa bo'lsa olinadi.
  const count = hasMore && total !== null ? Math.max(total, events.length) : events.length;
  const title = t("tracking.title");
  const subtitle = count > 0 ? t("tracking.newestFirst", { count }) : null;
  const toggleLabel = open ? t("tracking.collapse") : t("tracking.expand");
  const toggle = () => setOpen((value) => !value);
  const isCourier = variant === "courier";

  const query = {
    data: events.length > 0 || (!isLoading && !isError) ? events : undefined,
    isLoading: isLoading && events.length === 0,
    isError,
    refetch: retry,
  };

  return (
    <Card padding="none" aria-labelledby={titleId} className={className}>
      <div
        className={cx(
          "flex min-w-0 items-center justify-between gap-3 px-5 py-4",
          open && "border-b border-border",
          isCourier && "max-md:hidden",
        )}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={titleId} className="text-base font-bold text-text">
            {title}
          </h2>
          {subtitle ? <p className="text-[13px] leading-[18px] text-text-muted">{subtitle}</p> : null}
        </div>
        <IconButton
          size="sm"
          icon={open ? ChevronUp : ChevronDown}
          label={toggleLabel}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={toggle}
          className="-mr-2"
        />
      </div>

      {isCourier ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={toggle}
          className={cx(
            "hidden w-full min-w-0 items-center gap-3 py-2.5 pl-4 pr-3 text-left text-text max-md:flex",
            open ? "rounded-t-[14px] border-b border-border" : "rounded-[14px]",
          )}
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted">
            <History size={20} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-base font-bold text-text">{title}</span>
            {subtitle ? <span className="text-xs text-text-muted">{subtitle}</span> : null}
          </span>
          <span
            aria-hidden="true"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border-strong bg-surface text-action-fg"
          >
            <ChevronDown size={20} className={cx("transition-transform duration-150", open && "rotate-180")} />
          </span>
          <span className="sr-only">{toggleLabel}</span>
        </button>
      ) : null}

      <div id={bodyId} data-testid="tracking-body" className={cx(!open && "hidden")}>
        <QueryBoundary<TrackingEvent[]>
          query={query}
          keepPreviousData={false}
          loading={<TrackingSkeleton />}
          className="p-5"
          empty={<EmptyState icon={History} title={t("tracking.empty")} />}
          error={() => (
            <ErrorState
              kind={errorStatus === 403 ? "forbidden" : "section"}
              title={errorMessage || t("tracking.error")}
              description={null}
              onRetry={retry}
            />
          )}
        >
          {(items) => (
            <>
              <TrackingTimeline events={items} currentUser={currentUser} context={context} />
              {isError ? (
                <p role="alert" className="m-0 mt-4 text-[13px] text-danger-fg">
                  {errorMessage || t("tracking.error")}
                </p>
              ) : null}
            </>
          )}
        </QueryBoundary>
        {hasMore ? (
          <div className="flex justify-center border-t border-border px-5 py-3">
            <Button variant="ghost" size="sm" leftIcon={ChevronDown} loading={isLoading} onClick={loadMore}>
              {t("tracking.loadMore")}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
};

export default OrderTracking;

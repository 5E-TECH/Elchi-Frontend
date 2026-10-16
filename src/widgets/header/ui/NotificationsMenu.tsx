// dizayn-v2: shell
import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Bell,
  BellOff,
  Building2,
  CheckCheck,
  ShoppingBag,
  Server,
  Truck,
  User,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useInboxList, useUnreadCount } from "../../../entities/notification-inbox/api/useInbox";
import type { InboxNotification, NotificationCategory } from "../../../entities/notification-inbox/model/types";
import { useMarkAllInboxRead, useMarkInboxRead } from "../../../features/notification-inbox/api/useInboxMutations";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { useFocusTrap } from "../../../shared/lib/useFocusTrap";
import { Badge, Button, IconButton, buttonClasses } from "../../../shared/ui/primitives";
import { useDismiss } from "../model/useDismiss";
import { PHONE_QUERY, useMediaQuery } from "../model/useMediaQuery";
import { SKELETON, STAT_ICON } from "./styles";

/**
 * QO'NG'IROQCHA (maket `common-bell-dropdown`, taxta `tizim-states-navigation` → «Qo'ng'iroqcha»).
 *
 *   - tugma: `.el-iconbtn` + o'qilmaganlar soni (`.el-dotcount`, 0 da chiqmaydi, 99 dan ko'p — «99+»);
 *   - ≥ 768: tugma ostida panel (`.el-popover`, 420px): sarlavha + «Barchasini o'qilgan deb belgilash»,
 *     so'nggi 5 ta bildirishnoma, pastda «Barchasini ko'rish» → `/inbox`;
 *   - < 768: pastdan chiquvchi varaqa (`.el-sheet`), o'sha tarkib, yopish tugmasi bilan.
 * Bildirishnoma bosilsa — o'qilgan deb belgilanadi va uning havolasiga o'tiladi (havola yo'q bo'lsa `/inbox`).
 */

const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  order: ShoppingBag,
  finance: Wallet,
  branch: Building2,
  logistics: Truck,
  account: User,
  system: Server,
  marketing: Bell,
};

/** `.el-dotcount`: qizil doira, oq 12px son (ikkala mavzuda AA). 99 dan ko'p bo'lsa kengayib chetga chiqadi. */
const DOT_COUNT =
  "pointer-events-none absolute h-[18px] min-w-[18px] rounded-full bg-danger px-[5px] text-center text-xs " +
  "font-bold leading-[18px] text-on-solid";

const PREVIEW_LIMIT = 5;

type PanelProps = {
  variant: "popover" | "sheet";
  titleId: string;
  onClose: () => void;
};

const NotificationRow = ({
  notification,
  sheet,
  onOpen,
}: {
  notification: InboxNotification;
  sheet: boolean;
  onOpen: (notification: InboxNotification) => void;
}) => {
  const { t } = useTranslation(["ui", "notifications"]);
  const unread = !notification.is_read;
  const Icon = CATEGORY_ICON[notification.category] ?? Bell;
  const important = notification.priority === "critical" || notification.priority === "high";

  return (
    <li className="flex border-b border-border last:border-b-0">
      <Link
        to={notification.link || "/inbox"}
        onClick={() => onOpen(notification)}
        className={cx(
          // Panel `overflow-hidden`: fokus halqasi qator ichida (`!` — global `:focus-visible` qatlamsiz).
          "flex min-w-0 flex-1 items-start px-4 py-3 text-text no-underline transition-[background-color] duration-150 -outline-offset-2!",
          "motion-reduce:transition-none hover:bg-row-hover",
          sheet ? "gap-2.5" : "gap-3",
        )}
      >
        <span
          aria-hidden="true"
          className={cx("size-2 shrink-0 rounded-full", unread && "bg-info", sheet ? "mt-[7px]" : "mt-3.5")}
        />
        {!sheet ? (
          <span aria-hidden="true" className={cx(STAT_ICON, "size-9")}>
            <Icon size={20} />
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cx("flex min-w-0 items-center gap-x-2 gap-y-1", sheet && "flex-wrap")}>
            {unread ? <span className="sr-only">{t("ui:header.notifications.unread")} </span> : null}
            <span className={cx("min-w-0 text-sm", unread ? "font-bold" : "font-medium", !sheet && "truncate")}>
              {notification.title}
            </span>
            {important ? (
              <Badge tone={notification.priority === "critical" ? "danger" : "warning"} className="shrink-0">
                {t(`notifications:priority.${notification.priority}`)}
              </Badge>
            ) : null}
          </span>
          {notification.body ? (
            <span className={cx("text-[13px] text-text-muted", !sheet && "truncate")}>{notification.body}</span>
          ) : null}
          <span className="text-xs text-text-subtle">
            {t(`notifications:category.${notification.category}`)} ·{" "}
            <time dateTime={notification.created_at}>{formatDateTimeLocalized(notification.created_at)}</time>
          </span>
        </span>
      </Link>
    </li>
  );
};

const NotificationsPanel = ({ variant, titleId, onClose }: PanelProps) => {
  const { t } = useTranslation(["ui", "notifications"]);
  const sheet = variant === "sheet";
  const { data, isLoading, isError } = useInboxList({ page: 1, limit: PREVIEW_LIMIT });
  const markAll = useMarkAllInboxRead();
  const markRead = useMarkInboxRead();
  const items = data?.items ?? [];
  const unread = data?.unread ?? items.filter((item) => !item.is_read).length;

  const onOpen = (notification: InboxNotification) => {
    // Ochish o'tishni to'xtatmaydi: o'qildi belgisi yozilmasa ham sahifa ochiladi.
    if (!notification.is_read) markRead.mutate({ id: notification.id, read: true });
    onClose();
  };

  // Xato panelning o'zida (`role="alert"`) — antd statik `message` emas (3-bosqichda `notify()` keladi).
  const onMarkAll = () => markAll.mutate();
  const markAllError = markAll.isError ? (
    <p role="alert" className="m-0 shrink-0 border-b border-border px-4 py-2 text-[13px] text-danger-fg">
      {t("notifications:markAllReadError")}
    </p>
  ) : null;

  let list;
  if (isLoading) {
    list = (
      <div aria-hidden="true" className="flex flex-col">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
            {!sheet ? <span className={cx(SKELETON, "size-9 shrink-0 rounded-[10px]")} /> : null}
            <span className="flex flex-1 flex-col gap-2 pt-1">
              <span className={cx(SKELETON, "h-3 w-[70%]")} />
              <span className={cx(SKELETON, "h-3 w-[45%]")} />
            </span>
          </div>
        ))}
      </div>
    );
  } else if (isError) {
    list = (
      <p role="status" className="m-0 px-4 py-6 text-center text-[13px] text-text-muted">
        {t("ui:header.notifications.error")}
      </p>
    );
  } else if (items.length === 0) {
    list = (
      <div role="status" className="flex flex-col items-center gap-1.5 px-4 py-6 text-center">
        <span aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-full bg-sunken text-text-muted">
          <BellOff size={20} />
        </span>
        <span className="text-sm font-semibold text-text">{t("ui:header.notifications.empty")}</span>
        <span className="text-[13px] text-text-muted">{t("ui:header.notifications.emptyHint")}</span>
      </div>
    );
  } else {
    list = (
      <ul
        aria-label={t("ui:header.notifications.list")}
        // Ro'yxat — panelning yagona aylanuvchi qismi (sarlavha va «Barchasini ko'rish» doim ko'rinadi).
        className="m-0 flex min-h-0 flex-1 list-none flex-col overflow-y-auto overscroll-contain p-0"
      >
        {items.map((notification) => (
          <NotificationRow key={notification.id} notification={notification} sheet={sheet} onOpen={onOpen} />
        ))}
      </ul>
    );
  }

  const markAllButton = (
    <Button
      variant="link"
      size={sheet ? "md" : "sm"}
      leftIcon={CheckCheck}
      disabled={unread === 0 || isLoading}
      loading={markAll.isPending}
      onClick={onMarkAll}
      className={sheet ? "-ml-1" : "-ml-1 h-8"}
    >
      {t("notifications:markAllRead")}
    </Button>
  );

  const viewAll = (
    <Link
      to="/inbox"
      onClick={onClose}
      className={
        sheet
          ? buttonClasses({ variant: "secondary", fullWidth: true })
          : // `.el-btn-ghost.el-btn-block` + `color: var(--action-fg)` — ghost'ning `text-muted` i bilan to'qnashmasin.
            "inline-flex h-10 w-full items-center justify-center gap-2 rounded-[10px] text-sm font-semibold text-action-fg " +
            "no-underline transition-[background-color] duration-150 motion-reduce:transition-none hover:bg-sunken"
      }
    >
      {t("ui:header.notifications.viewAll")}
      <ArrowRight aria-hidden="true" size={18} />
    </Link>
  );

  if (sheet) {
    return (
      <>
        <div aria-hidden="true" className="mx-auto mt-1 h-1 w-10 shrink-0 rounded-full bg-border-strong" />
        <div className="flex shrink-0 items-center justify-between gap-3 pb-0 pl-4 pr-2 pt-1">
          <h2 id={titleId} className="m-0 text-base font-bold text-text">
            {t("ui:header.notifications.title")}
          </h2>
          <IconButton label={t("ui:header.notifications.close")} icon={X} size="lg" onClick={onClose} />
        </div>
        <div className="shrink-0 border-b border-border px-4 pb-2">{markAllButton}</div>
        {markAllError}
        {list}
        <div className="shrink-0 border-t border-border px-4 pt-3">{viewAll}</div>
      </>
    );
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border py-3 pl-4 pr-3">
        <h2 id={titleId} className="m-0 text-base font-bold text-text">
          {t("ui:header.notifications.title")}
        </h2>
        {markAllButton}
      </div>
      {markAllError}
      {list}
      <div className="shrink-0 border-t border-border p-2">{viewAll}</div>
    </>
  );
};

/** Telefon varaqasi: `body` ga portal, fon `overlay`, fokus ichida, Esc va fon yopadi. */
const NotificationsSheet = ({ panelId, titleId, onClose }: { panelId: string; titleId: string; onClose: () => void }) => {
  const sheetRef = useFocusTrap<HTMLDivElement>(true, { onEscape: onClose, inertAppRoot: true });
  return createPortal(
    <div className="fixed inset-0 z-[9990]">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 size-full cursor-default bg-overlay"
      />
      <div
        ref={sheetRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          "fixed inset-x-0 bottom-0 flex max-h-[calc(100dvh-48px)] flex-col rounded-t-[20px] border border-border",
          "bg-raised pb-[calc(16px+env(safe-area-inset-bottom))] pt-2 shadow-xl outline-none",
        )}
      >
        <NotificationsPanel variant="sheet" titleId={titleId} onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
};

/** `enabled` — sanoq faqat rol aniqlangach so'raladi (eski header xulqi). */
const NotificationsMenu = ({ enabled = true }: { enabled?: boolean }) => {
  const { t } = useTranslation("ui");
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();
  const { data: unread = 0 } = useUnreadCount(enabled);

  const close = useCallback(() => setOpen(false), []);

  // Desktop/planshet paneli: tashqariga bosish va Esc (Esc — fokus tugmaga qaytadi). Telefonda — varaqa o'zi.
  useDismiss(open && !isPhone, [rootRef], (reason) => {
    setOpen(false);
    if (reason === "escape") triggerRef.current?.focus();
  });

  // Panel ochilganda fokus panelga o'tadi (keyingi Tab — birinchi amal).
  useEffect(() => {
    if (open && !isPhone) panelRef.current?.focus({ preventScroll: true });
  }, [open, isPhone]);

  const label =
    unread > 99
      ? t("header.notifications.labelMany")
      : unread > 0
        ? t("header.notifications.labelUnread", { count: unread })
        : t("header.notifications.label");

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        // Tab bilan paneldan chiqilsa — yopiladi (telefon varaqasi `body` da, unga tegishli emas).
        const next = event.relatedTarget;
        if (open && !isPhone && next instanceof Node && !rootRef.current?.contains(next)) setOpen(false);
      }}
    >
      <IconButton
        ref={triggerRef}
        label={label}
        icon={Bell}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        // Ochiq holat (taxta: «tanlangan») — `aria-expanded` varianti asosiy rangdan keyin keladi.
        className="aria-expanded:bg-sunken aria-expanded:text-text"
      />
      {unread > 0 ? (
        <span aria-hidden="true" className={cx(DOT_COUNT, unread > 99 ? "-right-3 -top-0.5" : "right-1.5 top-1.5")}>
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}

      {open && !isPhone ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cx(
            // Past oynada (telefon yotiq, 390px) panel ekrandan chiqmasin: balandlik chegaralangan, ro'yxat aylanadi.
            "absolute -right-2 top-[calc(100%+8px)] z-10 flex max-h-[calc(100dvh-80px)] w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden",
            "rounded-[14px] border border-border bg-raised shadow-xl outline-none",
          )}
        >
          <NotificationsPanel variant="popover" titleId={titleId} onClose={close} />
        </div>
      ) : null}
      {open && isPhone ? <NotificationsSheet panelId={panelId} titleId={titleId} onClose={close} /> : null}
    </div>
  );
};

export default memo(NotificationsMenu);

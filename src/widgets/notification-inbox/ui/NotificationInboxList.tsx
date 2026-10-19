// dizayn-v2: common-inbox, superadmin-notifications-inbox, courier-inbox-list
import { useId, useMemo, useState } from "react";
import { BellOff, ListFilter, ListX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  NOTIFICATION_CATEGORIES,
  useInboxCounts,
  useInboxList,
  type InboxCounts,
  type InboxListResult,
  type NotificationCategory,
} from "../../../entities/notification-inbox";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Pagination,
  Pressable,
  QueryBoundary,
  Tabs,
} from "../../../shared/ui/primitives";
import NotificationInboxItem from "./NotificationInboxItem";

/** Maket: «1–10 / 46 ta bildirishnoma». */
const PAGE_SIZE = 10;
type InboxTab = "all" | "unread";

const isCategory = (value: string | null): value is NotificationCategory =>
  NOTIFICATION_CATEGORIES.includes(value as NotificationCategory);

/** `.el-chip` (`aria-pressed`) — CODE-MAP 2.2; telefonda 44 px. */
const CHIP =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-3 " +
  "text-[13px] font-medium text-text transition-[background-color,border-color,color] duration-150 " +
  "motion-reduce:transition-none hover:border-text-subtle aria-pressed:border-action aria-pressed:bg-action-soft " +
  "aria-pressed:font-semibold aria-pressed:text-action-fg max-md:h-11";

/** `.el-tab-count` chip ichida. Tanlangan chipda — `surface` fon (maket `superadmin-notifications-inbox`). */
const CHIP_COUNT =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sunken px-1.5 text-xs font-semibold " +
  "tabular-nums text-text-muted group-aria-pressed:bg-surface group-aria-pressed:text-action-fg";

/** `.el-switch` ko'rinishi (CODE-MAP 2.2), ota tugma `group` — `role="switch"`. */
const SWITCH_TRACK =
  "relative h-5 w-9 flex-none rounded-full bg-border-strong transition-colors duration-150 motion-reduce:transition-none " +
  "group-aria-checked:bg-action";
const SWITCH_KNOB =
  "absolute left-0.5 top-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 " +
  "group-aria-checked:translate-x-4 motion-reduce:transition-none";

const unreadOf = (counts: InboxCounts | null, category: NotificationCategory | null) =>
  counts ? (category ? counts.categories[category].unread : counts.unread) : null;

/** Kategoriya chiplari (desktop qatorda, telefonda «Filtrlar» varaqasida). */
const CategoryChips = ({
  value,
  counts,
  onChange,
}: {
  value: NotificationCategory | undefined;
  counts: InboxCounts | null;
  onChange: (category: NotificationCategory | undefined) => void;
}) => {
  const { t } = useTranslation("notifications");
  const options: (NotificationCategory | null)[] = [null, ...NOTIFICATION_CATEGORIES];
  return (
    <div
      role="group"
      aria-label={t("filters.category")}
      className="flex min-w-0 flex-1 flex-wrap gap-2"
    >
      {options.map((category) => {
        const active = category === null ? !value : value === category;
        const unread = unreadOf(counts, category);
        return (
          <Pressable
            key={category ?? "all"}
            aria-pressed={active}
            onClick={() => onChange(category === null || active ? undefined : category)}
            className={cx("group", CHIP)}
          >
            {category === null ? t("filters.allCategories") : t(`category.${category}`)}
            {/* Chipdagi raqam — shu kategoriyadagi O'QILMAGANLAR (sanoq kelmasa yoki 0 — chiqmaydi). */}
            {unread ? (
              <span className={CHIP_COUNT}>
                {formatNumberLocalized(unread)}
                <span className="sr-only">{t("filters.unreadCount")}</span>
              </span>
            ) : null}
          </Pressable>
        );
      })}
    </div>
  );
};

/**
 * INBOX ro'yxati (maketlar `common-inbox`, `superadmin-notifications-inbox`, `courier-inbox-list`): karta ichida
 * «Barchasi N · O'qilmagan N» tablari, kategoriya chiplari (telefonda «Filtrlar» varaqasi) va «Faqat muhim»,
 * ro'yxat, pastda «1–10 / 46 ta bildirishnoma» + sahifalash.
 *
 * Filtr holati URL'da (`/inbox?category=order&unread=1&important=1`, n1sNvGLn) — sahifa yangilanganda saqlanadi
 * va havolani ulashish mumkin. Sahifa raqami ATAYLAB lokal: har filtr o'zgarishida 1 ga qaytadi.
 * Chip sanoqlari `GET inbox/counts` dan (butun inbox bo'yicha). Kelmasa chipda raqam UMUMAN chiqmaydi.
 */
const NotificationInboxList = () => {
  const { t } = useTranslation(["notifications", "ui"]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState<NotificationCategory | undefined>(undefined);
  const idPrefix = useId();

  const tab: InboxTab = searchParams.get("unread") === "1" ? "unread" : "all";
  const rawCategory = searchParams.get("category");
  const category = isCategory(rawCategory) ? rawCategory : undefined;
  const important = searchParams.get("important") === "1";
  const activeFilters = Number(Boolean(category)) + Number(important);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      is_read: tab === "unread" ? false : undefined,
      category,
      important: important || undefined,
    }),
    [category, important, page, tab],
  );

  const listQuery = useInboxList(params, { silentError: true });
  const counts = useInboxCounts().data ?? null;

  const totalAll = counts
    ? NOTIFICATION_CATEGORIES.reduce((sum, key) => sum + counts.categories[key].total, 0)
    : undefined;
  const unreadTotal = counts?.unread ?? listQuery.data?.unread;

  /** URL filtrini yangilaydi va sahifani 1 ga qaytaradi. */
  const setFilter = (key: "unread" | "category" | "important", value: string | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
    setPage(1);
  };

  const clearFilters = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        ["unread", "category", "important"].forEach((key) => next.delete(key));
        return next;
      },
      { replace: true },
    );
    setPage(1);
  };

  const openSheet = () => {
    setDraftCategory(category);
    setSheetOpen(true);
  };

  const applySheet = () => {
    setFilter("category", draftCategory ?? null);
    setSheetOpen(false);
  };

  const emptyState =
    activeFilters > 0 ? (
      <EmptyState
        icon={ListX}
        title={t("filters.emptyTitle")}
        description={t("filters.emptyHint")}
        action={
          <Button variant="secondary" leftIcon={ListX} onClick={clearFilters}>
            {t("filters.clear")}
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={BellOff}
        title={tab === "unread" ? t("emptyUnread") : t("empty")}
        description={tab === "unread" ? t("emptyUnreadHint") : t("emptyHint")}
      />
    );

  const total = listQuery.data?.total ?? 0;

  return (
    <Card
      padding="none"
      aria-label={t("inbox.listLabel")}
      footer={
        total > 0 ? (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            summary={(range) => t("inbox.pagination", range)}
          />
        ) : undefined
      }
    >
      <Tabs
        ariaLabel={t("tabs.label")}
        idPrefix={idPrefix}
        value={tab}
        onValueChange={(value) => setFilter("unread", value === "unread" ? "1" : null)}
        items={[
          { value: "all", label: t("tabs.all"), count: totalAll },
          { value: "unread", label: t("tabs.unread"), count: unreadTotal },
        ]}
        listClassName="px-3"
      />

      <div className="flex items-start justify-between gap-x-6 gap-y-3 border-b border-border px-5 py-4 max-md:items-center max-md:gap-3 max-md:px-4 max-md:py-3">
        <div className="min-w-0 flex-1 max-md:hidden">
          <CategoryChips
            value={category}
            counts={counts}
            onChange={(next) => setFilter("category", next ?? null)}
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={ListFilter}
          aria-haspopup="dialog"
          onClick={openSheet}
          className="min-w-0 flex-1 md:hidden"
        >
          {category ? t("filters.toggleActive", { count: 1 }) : t("filters.toggle")}
        </Button>
        <Pressable
          role="switch"
          aria-checked={important}
          onClick={() => setFilter("important", important ? null : "1")}
          className="group inline-flex min-h-8 flex-none items-center gap-2.5 rounded-md text-[13px] font-semibold text-text max-md:min-h-11"
        >
          <span aria-hidden="true" className={SWITCH_TRACK}>
            <span className={SWITCH_KNOB} />
          </span>
          {t("filters.importantOnly")}
          {counts && counts.important_unread > 0 ? (
            <span className={cx(CHIP_COUNT, "max-md:hidden")}>
              {formatNumberLocalized(counts.important_unread)}
              <span className="sr-only">{t("filters.unreadCount")}</span>
            </span>
          ) : null}
        </Pressable>
      </div>

      <QueryBoundary<InboxListResult>
        query={listQuery}
        skeleton="list"
        isEmpty={(data) => data.items.length === 0}
        empty={emptyState}
        error={(error, retry) => (
          <ErrorState error={error} title={t("loadError")} onRetry={retry} />
        )}
      >
        {(data, { isRefetching }) => (
          <ul className={cx("m-0 list-none p-0", isRefetching && "opacity-60")}>
            {data.items.map((notification) => (
              <li key={notification.id} className="border-b border-border last:border-b-0">
                <NotificationInboxItem notification={notification} />
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        icon={ListFilter}
        title={t("ui:filters.sheetTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraftCategory(undefined)}>
              {t("ui:filters.reset")}
            </Button>
            <Button onClick={applySheet}>{t("ui:filters.apply")}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-text">{t("filters.category")}</span>
          <CategoryChips value={draftCategory} counts={counts} onChange={setDraftCategory} />
        </div>
      </Dialog>
    </Card>
  );
};

export default NotificationInboxList;

import { useId, useMemo, useState } from "react";
import { Badge, Button, Pagination, Segmented, Spin, Switch, message } from "antd";
import { BellOff, CheckCheck, ChevronDown, ChevronUp, FilterX, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  NOTIFICATION_CATEGORIES,
  useInboxCounts,
  useInboxList,
  type NotificationCategory,
} from "../../../entities/notification-inbox";
import { useMarkAllInboxRead } from "../../../features/notification-inbox";
import EmptyState from "../../../shared/ui/EmptyState";
import QueryErrorState from "../../../shared/ui/QueryErrorState";
import NotificationInboxItem from "./NotificationInboxItem";

const PAGE_SIZE = 20;
type InboxTab = "all" | "unread";

const isCategory = (value: string | null): value is NotificationCategory =>
  NOTIFICATION_CATEGORIES.includes(value as NotificationCategory);

/**
 * INBOX — filtrlar (n1sNvGLn): o'qilmagan / kategoriya / "Faqat muhim".
 *
 * Filtr holati URL'da (`/inbox?category=order&unread=1&important=1`) —
 * sahifa yangilanganda saqlanadi va havolani ulashish mumkin. Sahifa raqami
 * esa ATAYLAB lokal: har filtr o'zgarishida 1 ga qaytadi.
 *
 * Chip sanoqlari `GET inbox/counts` dan (butun inbox bo'yicha). Kelmasa
 * chipda raqam UMUMAN chiqmaydi — `unread` (global) kategoriya sanog'i
 * sifatida ishlatilmaydi.
 */
const NotificationInboxList = () => {
  const { t } = useTranslation("notifications");
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();

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

  const { data, isLoading, isError, refetch, isFetching } = useInboxList(params);
  const counts = useInboxCounts().data ?? null;
  const markAllRead = useMarkAllInboxRead();

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;
  const total = data?.total ?? 0;

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

  const handleMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync();
      message.success(t("markAllReadSuccess"));
    } catch {
      message.error(t("markAllReadError"));
    }
  };

  const chipClass = (active: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors ${
      active
        ? "border-[var(--color-main)] bg-[var(--color-main)] text-[var(--color-primary)]"
        : "border-[color:var(--color-border-soft)] bg-[color:var(--color-card-surface-strong)] text-[color:var(--color-maindark)] hover:border-[var(--color-main)] dark:text-white/80"
    }`;
  const countClass = (active: boolean) =>
    `inline-flex min-w-[20px] justify-center rounded-full px-1.5 text-xs font-semibold ${
      active ? "bg-white/25" : "bg-[color:var(--color-border-soft)]"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<InboxTab>
          value={tab}
          onChange={(value) => setFilter("unread", value === "unread" ? "1" : null)}
          options={[
            { label: t("tabs.all"), value: "all" },
            {
              label: (
                <span className="inline-flex items-center gap-2">
                  {t("tabs.unread")}
                  {unread > 0 ? <Badge count={unread} overflowCount={99} /> : null}
                </span>
              ),
              value: "unread",
            },
          ]}
        />

        {/* Telefonda tor: tugmalar kerak bo'lsa keyingi qatorga o'tadi, matn kesilmaydi. */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Telefonda filtrlar yig'ilgan — ro'yxat ekranning asosiy qismini egallaydi. */}
          <Button
            className="sm:!hidden"
            icon={<SlidersHorizontal size={16} />}
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            {activeFilters ? t("filters.toggleActive", { count: activeFilters }) : t("filters.toggle")}
            {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
          <Button
            icon={<CheckCheck size={16} />}
            disabled={unread === 0}
            loading={markAllRead.isPending}
            onClick={handleMarkAllRead}
          >
            {t("markAllRead")}
          </Button>
        </div>
      </div>

      <div
        id={filtersId}
        data-testid="inbox-filters"
        className={`flex-col gap-3 sm:flex ${filtersOpen ? "flex" : "hidden"}`}
      >
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("filters.category")}>
          <button
            type="button"
            aria-pressed={!category}
            onClick={() => setFilter("category", null)}
            className={chipClass(!category)}
          >
            {t("filters.allCategories")}
            {counts ? <span className={countClass(!category)}>{counts.unread}</span> : null}
          </button>
          {NOTIFICATION_CATEGORIES.map((value) => {
            const active = category === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter("category", active ? null : value)}
                className={chipClass(active)}
              >
                {t(`category.${value}`)}
                {/* Chipdagi raqam — shu kategoriyadagi O'QILMAGANLAR. */}
                {counts ? <span className={countClass(active)}>{counts.categories[value].unread}</span> : null}
              </button>
            );
          })}
        </div>

        <label className="inline-flex w-fit cursor-pointer items-center gap-2 text-sm text-[color:var(--color-maindark)] dark:text-white/80">
          <Switch size="small" checked={important} onChange={(checked) => setFilter("important", checked ? "1" : null)} />
          {t("filters.importantOnly")}
          {counts && counts.important_unread > 0 ? (
            <Badge count={counts.important_unread} overflowCount={99} />
          ) : null}
        </label>
      </div>

      {isError ? (
        <QueryErrorState description={t("loadError")} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Spin size="large" />
        </div>
      ) : items.length === 0 ? (
        activeFilters > 0 ? (
          <EmptyState
            icon={<FilterX size={28} />}
            title={t("filters.emptyTitle")}
            description={t("filters.emptyHint")}
            action={
              <Button icon={<FilterX size={16} />} onClick={clearFilters}>
                {t("filters.clear")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<BellOff size={28} />}
            title={tab === "unread" ? t("emptyUnread") : t("empty")}
            description={tab === "unread" ? t("emptyUnreadHint") : t("emptyHint")}
          />
        )
      ) : (
        <>
          <Spin spinning={isFetching && !isLoading}>
            <div className="flex flex-col gap-2.5">
              {items.map((notification) => (
                <NotificationInboxItem key={notification.id} notification={notification} />
              ))}
            </div>
          </Spin>

          {total > PAGE_SIZE ? (
            <div className="flex justify-end pt-2">
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={total}
                showSizeChanger={false}
                onChange={setPage}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default NotificationInboxList;

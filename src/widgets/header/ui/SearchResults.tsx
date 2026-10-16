// dizayn-v2: shell
import { memo, useEffect, type ReactNode, type UIEvent } from "react";
import { History, Search, SearchX, ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OrderStatusBadge } from "../../../entities/order/ui/OrderStatusBadge";
import { getUserRoleLabelKey } from "../../../entities/user/lib/role";
import { cx } from "../../../shared/lib/cx";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { Spinner } from "../../../shared/ui/primitives";
import type { HeaderSearchState, SearchOption } from "../model/useHeaderSearch";
import { splitByQuery, type SearchEntry } from "../model/searchEntry";
import { getInitials } from "../model/userIdentity";
import { AVATAR, KBD, MENU_LABEL, MENU_SEP, RAISED, SKELETON, STAT_ICON } from "./styles";

/**
 * GLOBAL QIDIRUV NATIJALARI (maket `.el-options` / `.el-option`, taxta `tizim-states-navigation` → «Yuqori
 * panel», telefonda `courier-dashboard-mobile-search`).
 *
 *   popover — desktop: maydon ostida, pastida klaviatura yo'riqnomasi (↑ ↓ · Enter · Esc);
 *   screen  — planshet/telefon qidiruv ekrani: 60px qatorlar, yo'riqnomasiz.
 *
 * Holatlar: so'nggi qidiruvlar · qidirilmoqda (spinner + skelet) · natija yo'q · xato · guruhlangan natijalar.
 * Variantlar fokus olmaydi (`aria-activedescendant`) — fokus maydonda qoladi.
 */

type SearchResultsProps = {
  search: HeaderSearchState;
  listId: string;
  variant: "popover" | "screen";
  /** Natija tanlandi (qidiruv ekrani shu yerda yopiladi). */
  onChosen?: () => void;
  className?: string;
};

const Highlight = ({ text, query }: { text: string; query: string }) => (
  <>
    {splitByQuery(text, query).map((part, index) =>
      part.match ? (
        <strong key={index} className="font-bold text-text">
          {part.text}
        </strong>
      ) : (
        <span key={index}>{part.text}</span>
      ),
    )}
  </>
);

const EntryContent = ({ entry, query, screen }: { entry: SearchEntry; query: string; screen: boolean }) => {
  const { t } = useTranslation("ui");
  const { t: tUsers } = useTranslation("users");
  const title = entry.orderId ? t("header.search.orderTitle", { id: entry.orderId }) : entry.title;
  const iconBox = cx(STAT_ICON, screen ? "size-9" : "size-8 rounded-lg");

  let leading: ReactNode;
  let subtitle: string | null = entry.subtitle;
  if (entry.kind === "users") {
    leading = (
      <span aria-hidden="true" className={cx(AVATAR, screen ? "size-9 text-[13px]" : "size-8 text-xs")}>
        {getInitials(entry.title)}
      </span>
    );
    const role = entry.role ? tUsers(getUserRoleLabelKey(entry.role)) : null;
    const phone = entry.phone ? formatPhone(entry.phone) : null;
    subtitle = [role, phone].filter(Boolean).join(" · ") || entry.subtitle;
  } else {
    const Icon = entry.kind === "orders" ? ShoppingBag : Search;
    leading = (
      <span aria-hidden="true" className={iconBox}>
        <Icon size={screen ? 20 : 18} />
      </span>
    );
  }

  return (
    <>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-text">
          <Highlight text={title} query={query} />
        </span>
        {subtitle ? (
          <span className={cx("truncate text-text-muted", screen ? "text-[13px]" : "text-xs")}>
            <Highlight text={subtitle} query={query} />
          </span>
        ) : null}
      </span>
      {entry.status ? <OrderStatusBadge status={entry.status} className="shrink-0" /> : null}
    </>
  );
};

const SkeletonRow = ({ wide }: { wide: boolean }) => (
  <div aria-hidden="true" className="flex items-center gap-3 px-2.5 py-2">
    <span className={cx(SKELETON, "size-8 shrink-0 rounded-lg")} />
    <span className="flex flex-1 flex-col gap-2">
      <span className={cx(SKELETON, "h-3", wide ? "w-[70%]" : "w-[60%]")} />
      <span className={cx(SKELETON, "h-3", wide ? "w-[45%]" : "w-[38%]")} />
    </span>
  </div>
);

const SearchResults = ({ search, listId, variant, onChosen, className }: SearchResultsProps) => {
  const { t } = useTranslation("ui");
  const screen = variant === "screen";
  const { view, options, activeIndex, activeId, groups, hasMore, loadingMore, query } = search;

  // Klaviatura bilan tanlangan variant ko'rinib tursin (ro'yxat skroll bo'lsa).
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  if (view === "closed") return null;

  const choose = (option: SearchOption) => {
    if (search.choose(option)) onChosen?.();
  };

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 24) search.loadMore();
  };

  const optionClass = (recent: boolean) =>
    cx(
      "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 text-left text-sm text-text",
      "transition-[background-color] duration-150 motion-reduce:transition-none hover:bg-sunken data-[active=true]:bg-sunken",
      // `.el-option` 36px (so'nggi qidiruvlar); natija qatori ikki qatorli; telefonda kamida 44/60px.
      recent ? "min-h-9 py-1.5 max-md:min-h-11" : screen ? "min-h-[60px] py-2" : "min-h-[52px] py-2",
    );

  const renderOption = (option: SearchOption, index: number) => {
    const active = index === activeIndex;
    return (
      <div
        key={option.id}
        id={option.id}
        role="option"
        aria-selected={active}
        data-active={active}
        className={optionClass(option.type === "recent")}
        // Fokus maydonda qoladi (combobox): bosish fokusni olib ketmasin.
        onMouseDown={(event) => event.preventDefault()}
        onMouseMove={() => {
          if (!active) search.setActiveIndex(index);
        }}
        onClick={() => choose(option)}
      >
        {option.type === "recent" ? (
          <>
            <History aria-hidden="true" size={18} className="shrink-0 text-text-subtle" />
            <span className="min-w-0 flex-1 truncate">{option.query}</span>
          </>
        ) : (
          <EntryContent entry={option.entry} query={query} screen={screen} />
        )}
      </div>
    );
  };

  const hints = !screen && (view === "results" || view === "recent") && (
    <div
      aria-hidden="true"
      className="mt-1 flex flex-wrap gap-x-4 gap-y-2 border-t border-border px-2.5 pb-1 pt-2.5 text-xs text-text-muted"
    >
      <span className="inline-flex items-center gap-1.5">
        <span className={KBD}>↑</span>
        <span className={KBD}>↓</span>
        {t("header.search.hintSelect")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={KBD}>Enter</span>
        {t("header.search.hintOpen")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={KBD}>Esc</span>
        {t("header.search.hintClose")}
      </span>
    </div>
  );

  let body: ReactNode;
  if (view === "recent") {
    const labelId = `${listId}-recent-label`;
    body = (
      <>
        <div className="flex items-center justify-between gap-2 py-0.5 pl-2.5 pr-1">
          <span id={labelId} className="text-xs font-semibold text-text-muted">
            {t("header.search.recent")}
          </span>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={search.clearRecent}
            className="inline-flex h-7 items-center rounded-md px-1 text-[13px] font-semibold text-action-fg hover:underline max-md:h-11"
          >
            {t("header.search.clearRecent")}
          </button>
        </div>
        <div id={listId} role="listbox" aria-labelledby={labelId} className="flex flex-col gap-0.5">
          {options.map(renderOption)}
        </div>
      </>
    );
  } else if (view === "loading") {
    body = (
      <div id={listId}>
        <div role="status" className="flex items-center gap-2.5 px-2.5 py-2 text-[13px] text-text-muted">
          <Spinner size="sm" />
          {t("header.search.loading")}
        </div>
        <SkeletonRow wide />
        <SkeletonRow wide={false} />
      </div>
    );
  } else if (view === "error") {
    body = (
      <div id={listId} role="status" className="px-2.5 py-4 text-center text-[13px] text-text-muted">
        {t("header.search.error")}
      </div>
    );
  } else if (view === "empty") {
    body = (
      <div id={listId} role="status" className="flex flex-col items-center gap-1.5 px-4 py-5 text-center">
        <span aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-full bg-sunken text-text-muted">
          <SearchX size={20} />
        </span>
        <span className="text-sm font-semibold text-text">{t("header.search.empty")}</span>
        <span className="text-[13px] text-text-muted">{t("header.search.emptyHint")}</span>
      </div>
    );
  } else {
    // Har guruhning tekis ro'yxatdagi boshlanish indeksi (klaviatura tanlovi bitta ketma-ketlikda).
    const starts = groups.map((_, index) =>
      groups.slice(0, index).reduce((sum, group) => sum + group.entries.length, 0),
    );
    body = (
      <div
        id={listId}
        role="listbox"
        aria-label={t("header.search.results")}
        onScroll={onScroll}
        className={cx(
          "flex flex-col gap-0.5 overflow-y-auto overscroll-contain",
          screen ? "max-h-[calc(100dvh-104px)]" : "max-h-[min(440px,calc(100dvh-180px))]",
        )}
      >
        {groups.map((group, groupIndex) => {
          const start = starts[groupIndex];
          const end = start + group.entries.length;
          const labelId = `${listId}-${group.kind}-label`;
          return (
            <div key={group.kind} role="group" aria-labelledby={labelId} className="flex flex-col gap-0.5">
              {groupIndex > 0 ? <div role="presentation" className={MENU_SEP} /> : null}
              <div id={labelId} className={cx(MENU_LABEL, "flex justify-between gap-2")}>
                <span>{t(`header.search.groups.${group.kind}`)}</span>
                {!hasMore ? <span>{t("header.search.count", { count: group.entries.length })}</span> : null}
              </div>
              {options.slice(start, end).map((option, index) => renderOption(option, start + index))}
            </div>
          );
        })}
        {loadingMore ? (
          <div
            role="status"
            className="mt-0.5 flex min-h-11 items-center justify-center gap-2 border-t border-border text-[13px] text-text-muted"
          >
            <Spinner size="sm" />
            {t("header.search.loadingMore")}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cx(RAISED, "flex flex-col p-1.5", className)}>
      {body}
      {hints}
    </div>
  );
};

export default memo(SearchResults);

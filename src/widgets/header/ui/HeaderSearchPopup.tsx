import { memo } from "react";
import { Loader2, Search } from "lucide-react";
import type { GlobalSearchItem } from "../../../features/search/api/useGlobalSearch";

interface HeaderSearchPopupProps {
  open: boolean;
  loading: boolean;
  loadingMore: boolean;
  items: GlobalSearchItem[];
  query: string;
  onSelect: (item: GlobalSearchItem) => void;
  hasMore: boolean;
  onLoadMore: () => void;
}

const HeaderSearchPopup = ({
  open,
  loading,
  loadingMore,
  items,
  query,
  onSelect,
  hasMore,
  onLoadMore,
}: HeaderSearchPopupProps) => {
  if (!open) return null;

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-70 rounded-2xl border border-primarydark/40 bg-primary p-2 shadow-2xl dark:bg-maindark">
      {loading && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-maindark/70 dark:text-primary/70">
          <Loader2 size={14} className="animate-spin" />
          Qidirilmoqda...
        </div>
      )}

      {!loading && items.length === 0 && query.trim().length > 0 && (
        <div className="rounded-xl px-3 py-2 text-sm text-maindark/70 dark:text-primary/70">
          Natija topilmadi
        </div>
      )}

      {!loading && items.length > 0 && (
        <div
          className="max-h-[320px] overflow-auto space-y-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onScroll={(event) => {
            const target = event.currentTarget;
            const nearBottom =
              target.scrollTop + target.clientHeight >= target.scrollHeight - 24;
            if (nearBottom && hasMore && !loadingMore) {
              onLoadMore();
            }
          }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-main/10"
            >
              <Search size={14} className="mt-0.5 text-main/80" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-maindark dark:text-primary">
                  {item.title}
                </p>
                <p className="truncate text-xs text-maindark/60 dark:text-primary/60">
                  {item.subtitle ?? item.type ?? item.source ?? "Natija"}
                </p>
              </div>
            </button>
          ))}
          {loadingMore && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-maindark/70 dark:text-primary/70">
              <Loader2 size={12} className="animate-spin" />
              Yana yuklanmoqda...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(HeaderSearchPopup);

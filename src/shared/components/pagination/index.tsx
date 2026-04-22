import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const LIMIT_DROPDOWN_WIDTH = 132;
const LIMIT_DROPDOWN_HEIGHT = 174;

interface PaginationProps {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (limit: number) => void;
  summary?: ReactNode;
  className?: string;
}

const buildPageItems = (page: number, totalPages: number) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const normalizedPages = [...pages]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b);

  const items: Array<number | string> = [];

  normalizedPages.forEach((item, index) => {
    const previous = normalizedPages[index - 1];
    if (previous && item - previous > 1) {
      items.push(`ellipsis-${previous}-${item}`);
    }
    items.push(item);
  });

  return items;
};

const Pagination = ({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  onItemsPerPageChange,
  summary,
  className = "",
}: PaginationProps) => {
  const { t } = useTranslation("common");
  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const [limitDropdownPosition, setLimitDropdownPosition] = useState({
    left: 0,
    top: 0,
  });
  const limitRef = useRef<HTMLDivElement | null>(null);
  const limitDropdownRef = useRef<HTMLDivElement | null>(null);
  const safeItemsPerPage = Math.max(1, itemsPerPage);
  const pageSizeOptions = useMemo(
    () =>
      Array.from(new Set([...PAGE_SIZE_OPTIONS, safeItemsPerPage])).sort(
        (a, b) => a - b,
      ),
    [safeItemsPerPage],
  );
  const totalPages = Math.max(1, Math.ceil(totalItems / safeItemsPerPage));
  const from = totalItems === 0 ? 0 : (currentPage - 1) * safeItemsPerPage + 1;
  const to = totalItems === 0 ? 0 : Math.min(currentPage * safeItemsPerPage, totalItems);
  const resolvedSummary = summary ?? (
    <span>
      Showing {from}-{to} of {totalItems}
    </span>
  );

  const pages = buildPageItems(currentPage, totalPages);

  const updateLimitDropdownPosition = useCallback(() => {
    const rect = limitRef.current?.getBoundingClientRect();
    if (!rect) return;

    const gap = 8;
    const viewportPadding = 8;
    const left = Math.min(
      Math.max(rect.right - LIMIT_DROPDOWN_WIDTH, viewportPadding),
      window.innerWidth - LIMIT_DROPDOWN_WIDTH - viewportPadding,
    );
    const shouldOpenAbove =
      rect.bottom + gap + LIMIT_DROPDOWN_HEIGHT > window.innerHeight &&
      rect.top > LIMIT_DROPDOWN_HEIGHT;

    setLimitDropdownPosition({
      left,
      top: shouldOpenAbove
        ? rect.top - LIMIT_DROPDOWN_HEIGHT - gap
        : rect.bottom + gap,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isLimitOpen) return;
    updateLimitDropdownPosition();
  }, [isLimitOpen]);

  useEffect(() => {
    if (!isLimitOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !limitRef.current?.contains(target)
        && !limitDropdownRef.current?.contains(target)
      ) {
        setIsLimitOpen(false);
      }
    };

    updateLimitDropdownPosition();
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", updateLimitDropdownPosition);
    window.addEventListener("scroll", updateLimitDropdownPosition, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", updateLimitDropdownPosition);
      window.removeEventListener("scroll", updateLimitDropdownPosition, true);
    };
  }, [isLimitOpen, updateLimitDropdownPosition]);

  if (totalItems === 0 && !summary) {
    return null;
  }

  return (
    <div className={`flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="min-h-5 text-center text-xs text-gray-400 sm:text-left">
        {resolvedSummary}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
        {onItemsPerPageChange && (
          <div
            ref={limitRef}
            className="relative flex items-center gap-2 rounded-full border border-main/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-maindark/70 shadow-sm shadow-main/5 dark:border-white/10 dark:bg-white/[0.08] dark:text-primary/75"
          >
            <span className="whitespace-nowrap">{t("itemsPerPage")}</span>
            <button
              type="button"
              onClick={() => {
                updateLimitDropdownPosition();
                setIsLimitOpen((current) => !current);
              }}
              className="flex h-8 min-w-[4.5rem] items-center justify-between gap-2 rounded-full border border-main/20 bg-main/8 px-3 text-xs font-extrabold text-main transition hover:border-main/40 hover:bg-main/12 dark:border-white/12 dark:bg-primary/10 dark:text-primary dark:hover:bg-primary/15"
              aria-expanded={isLimitOpen}
            >
              {safeItemsPerPage}
              <ChevronDown
                size={14}
                className={`transition-transform ${isLimitOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isLimitOpen && createPortal(
              <div
                ref={limitDropdownRef}
                style={{
                  left: limitDropdownPosition.left,
                  top: limitDropdownPosition.top,
                  width: LIMIT_DROPDOWN_WIDTH,
                }}
                className="fixed z-[9999] overflow-hidden rounded-2xl border border-main/15 bg-white p-1.5 shadow-2xl shadow-maindark/20 dark:border-white/10 dark:bg-maindark dark:shadow-black/40"
              >
                {pageSizeOptions.map((option) => {
                  const isSelected = option === safeItemsPerPage;

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        onItemsPerPageChange(option);
                        setIsLimitOpen(false);
                      }}
                      className={`flex h-9 w-full items-center justify-between rounded-xl px-3 text-sm font-bold transition-colors ${
                        isSelected
                          ? "bg-main text-primary shadow-sm shadow-main/20"
                          : "text-maindark/75 hover:bg-main/8 hover:text-main dark:text-primary/80 dark:hover:bg-primary/10 dark:hover:text-primary"
                      }`}
                    >
                      {option}
                      {isSelected ? <Check size={14} /> : null}
                    </button>
                  );
                })}
              </div>,
              document.body,
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label={t("previous")}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-all duration-200 hover:border-main/50 hover:text-main disabled:cursor-not-allowed disabled:opacity-40 dark:border-primarydark dark:text-gray-400"
        >
          <ChevronLeft size={15} />
        </button>

        {pages.map((item) => {
          if (typeof item !== "number") {
            return (
              <span
                key={item}
                className="flex h-9 min-w-9 items-center justify-center text-xs font-semibold text-gray-400"
              >
                ...
              </span>
            );
          }

          const isActive = item === currentPage;

          return (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              disabled={item === currentPage && totalPages === 1}
              className={`h-9 min-w-9 rounded-xl px-2 text-xs font-semibold transition-all duration-200 ${isActive
                  ? "bg-main text-primary shadow-md shadow-main/20"
                  : "border border-gray-200 text-gray-500 hover:border-main/50 hover:text-main dark:border-primarydark dark:text-gray-400"
                } ${item === currentPage && totalPages === 1 ? "cursor-not-allowed opacity-70" : ""}`}
            >
              {item}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label={t("next")}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-all duration-200 hover:border-main/50 hover:text-main disabled:cursor-not-allowed disabled:opacity-40 dark:border-primarydark dark:text-gray-400"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default memo(Pagination);

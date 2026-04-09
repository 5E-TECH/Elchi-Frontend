import { memo, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PaginationProps {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  onPageChange: (page: number) => void;
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
  summary,
  className = "",
}: PaginationProps) => {
  const { t } = useTranslation("common");
  const safeItemsPerPage = Math.max(1, itemsPerPage);
  const totalPages = Math.max(1, Math.ceil(totalItems / safeItemsPerPage));
  const from = totalItems === 0 ? 0 : (currentPage - 1) * safeItemsPerPage + 1;
  const to = totalItems === 0 ? 0 : Math.min(currentPage * safeItemsPerPage, totalItems);
  const resolvedSummary = summary ?? (
    <span>
      Showing {from}-{to} of {totalItems}
    </span>
  );

  if (totalItems === 0 && !summary) {
    return null;
  }

  const pages = buildPageItems(currentPage, totalPages);

  return (
    <div className={`flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="min-h-5 text-center text-xs text-gray-400 sm:text-left">
        {resolvedSummary}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end">
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

import { memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
    onChange: (page: number) => void;
}

const OrderPagination = ({ page, totalPages, total, limit, onChange }: Props) => {
    const { t } = useTranslation("orders");
    if (totalPages <= 1) return null;

    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    return (
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center text-xs text-gray-400 sm:text-left">
                {t("paginationSummary", {
                    from,
                    to,
                    total,
                    highlight: `${from}–${to}`,
                }).split(String(from) + "–" + String(to)).map((part, index, array) => (
                    <span key={`${part}-${index}`}>
                        {part}
                        {index < array.length - 1 && (
                            <span className="font-semibold text-maindark dark:text-primary">{from}–{to}</span>
                        )}
                    </span>
                ))}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end">
                {/* Prev */}
                <button
                    onClick={() => onChange(page - 1)}
                    disabled={page <= 1}
                    className="
                        w-8 h-8 rounded-lg flex items-center justify-center
                        border border-gray-200 dark:border-primarydark
                        text-gray-500 dark:text-gray-400
                        hover:border-main/50 hover:text-main
                        disabled:opacity-40 disabled:cursor-not-allowed
                        transition-all duration-200
                    "
                >
                    <ChevronLeft size={15} />
                </button>

                {/* Pages */}
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let p: number;
                    if (totalPages <= 5) {
                        p = i + 1;
                    } else if (page <= 3) {
                        p = i + 1;
                    } else if (page >= totalPages - 2) {
                        p = totalPages - 4 + i;
                    } else {
                        p = page - 2 + i;
                    }
                    return (
                        <button
                            key={p}
                            onClick={() => onChange(p)}
                            className={`
                                w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-200
                                ${p === page
                                    ? "bg-main text-primary shadow-md shadow-main/20"
                                    : "border border-gray-200 dark:border-primarydark text-gray-500 dark:text-gray-400 hover:border-main/50 hover:text-main"
                                }
                            `}
                        >
                            {p}
                        </button>
                    );
                })}

                {/* Next */}
                <button
                    onClick={() => onChange(page + 1)}
                    disabled={page >= totalPages}
                    className="
                        w-8 h-8 rounded-lg flex items-center justify-center
                        border border-gray-200 dark:border-primarydark
                        text-gray-500 dark:text-gray-400
                        hover:border-main/50 hover:text-main
                        disabled:opacity-40 disabled:cursor-not-allowed
                        transition-all duration-200
                    "
                >
                    <ChevronRight size={15} />
                </button>
            </div>
        </div>
    );
};

export default memo(OrderPagination);

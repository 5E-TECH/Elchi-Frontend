import { memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
    onChange: (page: number) => void;
}

const OrderPagination = ({ page, totalPages, total, limit, onChange }: Props) => {
    if (totalPages <= 1) return null;

    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    return (
        <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
            <p className="text-xs text-gray-400">
                <span className="font-semibold text-maindark dark:text-primary">{from}–{to}</span>
                {" "}/ {total} ta buyurtma
            </p>

            <div className="flex items-center gap-1.5">
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

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

const UZ_MONTHS = [
    "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
    "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

const UZ_DAYS_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

const toISODate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const parseDate = (str: string): Date | null => {
    if (!str) return null;
    const [y, m, d] = str.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
};

const buildCalendarDays = (year: number, month: number): (number | null)[] => {
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = (firstDay + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
};

const formatDisplay = (str: string): string => {
    const date = parseDate(str);
    if (!date) return "";
    return `${date.getDate()} ${UZ_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

interface CustomDatePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    minDate?: string;
    maxDate?: string;
    className?: string;
    size?: "sm" | "md";
    variant?: "default" | "filter";
    placement?: "auto" | "bottom";
}

const CustomDatePicker = memo(({
    value,
    onChange,
    placeholder = "Sanani tanlang",
    minDate,
    maxDate,
    className = "",
    size = "md",
    variant = "default",
    placement = "auto",
}: CustomDatePickerProps) => {

    const today = new Date();
    const selectedDate = parseDate(value);

    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());
    const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());

    const containerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; width: number } | null>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            const inTrigger = containerRef.current?.contains(target);
            const inPopover = popoverRef.current?.contains(target);
            if (!inTrigger && !inPopover) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    useEffect(() => {
        if (selectedDate) {
            setViewYear(selectedDate.getFullYear());
            setViewMonth(selectedDate.getMonth());
        }
    }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleToggle = () => setOpen((prev) => !prev);

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange("");
        setOpen(false);
    };

    const handleClearKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onChange("");
            setOpen(false);
        }
    };

    const goPrevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
        else setViewMonth((m) => m - 1);
    };

    const goNextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
        else setViewMonth((m) => m + 1);
    };

    const handleSelectDay = useCallback((day: number) => {
        const dateStr = toISODate(new Date(viewYear, viewMonth, day));

        if (minDate && dateStr < minDate) return;
        if (maxDate && dateStr > maxDate) return;

        onChange(dateStr);
        setOpen(false);
    }, [viewYear, viewMonth, minDate, maxDate, onChange]);

    const isDisabled = (day: number): boolean => {
        const dateStr = toISODate(new Date(viewYear, viewMonth, day));
        if (minDate && dateStr < minDate) return true;
        if (maxDate && dateStr > maxDate) return true;
        return false;
    };

    const isToday = (day: number): boolean => {
        return (
            day === today.getDate() &&
            viewMonth === today.getMonth() &&
            viewYear === today.getFullYear()
        );
    };

    const isSelected = (day: number): boolean => {
        if (!selectedDate) return false;
        return (
            day === selectedDate.getDate() &&
            viewMonth === selectedDate.getMonth() &&
            viewYear === selectedDate.getFullYear()
        );
    };

    const calendarDays = buildCalendarDays(viewYear, viewMonth);

    const popupWidth = size === "sm" ? 260 : 288;
    const popupHeight = 340;
    const popupGap = 8;

    useLayoutEffect(() => {
        if (!open) {
            setPopoverPos(null);
            return;
        }

        const update = () => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;

            const viewportW = window.innerWidth;
            const viewportH = window.innerHeight;

            const canOpenUp =
                rect.bottom + popupGap + popupHeight > viewportH &&
                rect.top - popupGap - popupHeight > popupGap;
            const openUp = placement === "auto" && canOpenUp;
            const preferredTop = openUp ? rect.top - popupGap - popupHeight : rect.bottom + popupGap;
            const top = Math.min(
                Math.max(popupGap, preferredTop),
                Math.max(popupGap, viewportH - popupHeight - popupGap),
            );

            const maxLeft = Math.max(popupGap, viewportW - popupWidth - popupGap);
            const left = Math.min(Math.max(popupGap, rect.left), maxLeft);

            setPopoverPos({ top, left, width: popupWidth });
        };

        update();
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [open, popupWidth]);

    const triggerClassName = variant === "filter"
        ? `
            flex items-center gap-2 w-full
            rounded-xl border-2 border-[color:var(--color-border-strong)]
            bg-[color:var(--color-sidebar)] px-3 py-2 text-sm font-semibold
            transition-all duration-200
            dark:border-white/10 dark:bg-white/7
            ${open
                ? "border-main ring-2 ring-main/10 text-maindark dark:text-white"
                : "text-maindark dark:text-white hover:border-main/40"
            }
        `
        : `
            flex items-center gap-2 w-full
            bg-white dark:bg-primarydark
            border ${size === "sm" ? "rounded-lg px-3 py-2 text-[13px]" : "rounded-xl px-3 py-2 text-sm"}
            font-medium transition-all duration-200
            ${open
                ? "border-main ring-2 ring-main/20 text-maindark dark:text-white"
                : "border-gray-200 dark:border-white/15 text-maindark/60 dark:text-sidebar/80 hover:border-main/50"
            }
        `;

    const iconClassName = variant === "filter"
        ? (open ? "text-main" : "text-[color:var(--color-text-muted)] dark:text-white/55")
        : (open ? "text-main" : "text-maindark/40 dark:text-sidebar/50");

    const valueClassName = variant === "filter"
        ? (value ? "text-maindark dark:text-white" : "text-[color:var(--color-text-muted)] dark:text-white/55")
        : (value ? "text-maindark dark:text-white" : "text-maindark/50 dark:text-sidebar/60");

    const clearClassName = variant === "filter"
        ? "ml-1 cursor-pointer text-[color:var(--color-text-muted)] transition-colors hover:text-red-400 dark:text-white/45 dark:hover:text-red-400"
        : "ml-1 text-maindark/30 hover:text-red-400 dark:text-sidebar/40 dark:hover:text-red-400 transition-colors cursor-pointer";

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={handleToggle}
                className={triggerClassName}
            >
                <Calendar
                    size={size === "sm" ? 13 : 14}
                    className={iconClassName}
                />
                <span className={`flex-1 text-left truncate ${valueClassName}`}>
                    {value ? formatDisplay(value) : placeholder}
                </span>

                {value && (
                    <span
                        role="button"
                        tabIndex={0}
                        onClick={handleClear}
                        onKeyDown={handleClearKeyDown}
                        aria-label="Sanani tozalash"
                        className={clearClassName}
                    >
                        <X size={12} />
                    </span>
                )}
            </button>

            {open && popoverPos && createPortal((
                <div
                    ref={popoverRef}
                    style={{ position: "fixed", top: popoverPos.top, left: popoverPos.left, width: popoverPos.width }}
                    className="
                        z-[9999]
                        rounded-2xl
                        bg-white dark:bg-maindark
                        border border-gray-200 dark:border-white/10
                        shadow-xl shadow-black/10 dark:shadow-black/30
                        overflow-hidden
                        animate-in fade-in-0 zoom-in-95 duration-150
                    "
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/10">
                        <button
                            type="button"
                            onClick={goPrevMonth}
                            className="
                                w-7 h-7 rounded-lg flex items-center justify-center
                                text-gray-400 dark:text-white/40
                                hover:bg-main/10 hover:text-main
                                transition-all duration-150
                            "
                        >
                            <ChevronLeft size={15} />
                        </button>

                        <span className="text-sm font-bold text-maindark dark:text-primary">
                            {UZ_MONTHS[viewMonth]} {viewYear}
                        </span>

                        <button
                            type="button"
                            onClick={goNextMonth}
                            className="
                                w-7 h-7 rounded-lg flex items-center justify-center
                                text-gray-400 dark:text-white/40
                                hover:bg-main/10 hover:text-main
                                transition-all duration-150
                            "
                        >
                            <ChevronRight size={15} />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 px-3 pt-3 pb-1">
                        {UZ_DAYS_SHORT.map((d) => (
                            <div
                                key={d}
                                className="text-center text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-wider py-1"
                            >
                                {d}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 px-3 pb-3 gap-y-1">
                        {calendarDays.map((day, idx) => {
                            if (day === null) {
                                return <div key={`empty-${idx}`} />;
                            }

                            const selected = isSelected(day);
                            const todayCell = isToday(day);
                            const disabled = isDisabled(day);

                            return (
                                <button
                                    key={day}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => handleSelectDay(day)}
                                    className={`
                                        aspect-square rounded-xl text-sm font-semibold
                                        flex items-center justify-center
                                        transition-all duration-150
                                        ${selected
                                            ? "bg-main text-white shadow-md shadow-main/25"
                                            : todayCell
                                                ? "text-main bg-main/10"
                                                : "text-maindark dark:text-primary hover:bg-main/8"
                                        }
                                        ${disabled
                                            ? "opacity-30 cursor-not-allowed hover:bg-transparent"
                                            : ""
                                        }
                                    `}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ), document.body)}
        </div>
    );
});

CustomDatePicker.displayName = "CustomDatePicker";

export default CustomDatePicker;

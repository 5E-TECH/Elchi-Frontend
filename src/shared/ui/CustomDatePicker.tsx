import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

// ── Ko'makchi funksiyalar ──────────────────────────────────────────────────
const UZ_MONTHS = [
    "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
    "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

const UZ_DAYS_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

/** "YYYY-MM-DD" formatiga o'tkazish */
const toISODate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

/** "YYYY-MM-DD" formatini parse qilish */
const parseDate = (str: string): Date | null => {
    if (!str) return null;
    const [y, m, d] = str.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
};

/** Oyning barcha kunlarini grid uchun hisoblash (oldingi oy bo'shliqlar bilan) */
const buildCalendarDays = (year: number, month: number): (number | null)[] => {
    const firstDay = new Date(year, month, 1).getDay();
    // Dushanba = 0 hisoblash
    const startOffset = (firstDay + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
};

/** "YYYY-MM-DD" → ko'rinadigan format: "26 Fevral" */
const formatDisplay = (str: string): string => {
    const date = parseDate(str);
    if (!date) return "";
    return `${date.getDate()} ${UZ_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

// ── Types ──────────────────────────────────────────────────────────────────
interface CustomDatePickerProps {
    value: string;           // "YYYY-MM-DD" yoki ""
    onChange: (value: string) => void;
    placeholder?: string;
    minDate?: string;        // "YYYY-MM-DD"
    maxDate?: string;        // "YYYY-MM-DD"
    className?: string;
}

// ── Komponent ──────────────────────────────────────────────────────────────
const CustomDatePicker = memo(({
    value,
    onChange,
    placeholder = "Sanani tanlang",
    minDate,
    maxDate,
    className = "",
}: CustomDatePickerProps) => {

    const today = new Date();
    const selectedDate = parseDate(value);

    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());
    const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());

    const containerRef = useRef<HTMLDivElement>(null);

    // Tashqariga bosilsa — yopish
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    // Tanlangan qiymat o'zgarganda viewport ni sync qilish
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

        // min / max tekshiruvi
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

    return (
        <div ref={containerRef} className={`relative ${className}`}>

            {/* ── Trigger button ── */}
            <button
                type="button"
                onClick={handleToggle}
                className={`
                    flex items-center gap-2 w-full
                    bg-white dark:bg-primarydark
                    border rounded-xl px-3 py-2
                    text-sm font-medium transition-all duration-200
                    ${open
                        ? "border-main ring-2 ring-main/20 text-maindark dark:text-primary"
                        : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 hover:border-main/50"
                    }
                `}
            >
                <Calendar
                    size={14}
                    className={open ? "text-main" : "text-gray-400 dark:text-white/30"}
                />
                <span className={`flex-1 text-left truncate ${value ? "text-maindark dark:text-primary" : ""}`}>
                    {value ? formatDisplay(value) : placeholder}
                </span>

                {value && (
                    <span
                        role="button"
                        onClick={handleClear}
                        className="ml-1 text-gray-400 hover:text-red-400 dark:text-white/30 dark:hover:text-red-400 transition-colors cursor-pointer"
                    >
                        <X size={12} />
                    </span>
                )}
            </button>

            {/* ── Popup Kalendar ── */}
            {open && (
                <div
                    className="
                        absolute top-full left-0 mt-2 z-50
                        w-72 rounded-2xl
                        bg-white dark:bg-maindark
                        border border-gray-200 dark:border-white/10
                        shadow-xl shadow-black/10 dark:shadow-black/30
                        overflow-hidden
                        animate-in fade-in-0 zoom-in-95 duration-150
                    "
                >
                    {/* Oy sarlavhasi va navigatsiya */}
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

                    {/* Hafta kunlari sarlavhalari */}
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

                    {/* Kunlar gridi */}
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
                                        relative mx-auto w-8 h-8 rounded-xl
                                        text-sm font-medium
                                        flex items-center justify-center
                                        transition-all duration-150
                                        ${selected
                                            ? "bg-main text-primary shadow-md shadow-main/30"
                                            : todayCell
                                                ? "text-main font-bold border border-main/40 hover:bg-main/10"
                                                : disabled
                                                    ? "text-gray-300 dark:text-white/15 cursor-not-allowed"
                                                    : "text-maindark dark:text-primary/80 hover:bg-main/10 hover:text-main"
                                        }
                                    `}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer: Bugun tugmasi */}
                    <div className="px-4 py-2.5 border-t border-gray-100 dark:border-white/10 flex justify-end">
                        <button
                            type="button"
                            onClick={() => {
                                const todayStr = toISODate(today);
                                if (minDate && todayStr < minDate) return;
                                if (maxDate && todayStr > maxDate) return;
                                onChange(todayStr);
                                setOpen(false);
                            }}
                            className="
                                text-xs font-semibold text-main
                                hover:underline transition-all
                            "
                        >
                            Bugun
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

CustomDatePicker.displayName = "CustomDatePicker";

export default CustomDatePicker;

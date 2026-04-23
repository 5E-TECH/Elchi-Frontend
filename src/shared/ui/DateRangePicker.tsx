import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

const UZ_MONTHS = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
] as const;

const UZ_DAYS_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"] as const;

const PANEL_MAX_WIDTH = 520;
const PANEL_MIN_HEIGHT = 320;
const PANEL_GAP = 8;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isSameDay = (left: Date | null, right: Date | null) => {
  if (!left || !right) {
    return false;
  }

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
};

const isBeforeDay = (left: Date, right: Date) =>
  startOfDay(left).getTime() < startOfDay(right).getTime();

const isAfterDay = (left: Date, right: Date) =>
  startOfDay(left).getTime() > startOfDay(right).getTime();

const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

const formatTriggerDate = (date: Date | null) => {
  if (!date) {
    return "";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
};

const buildMonthDays = (monthDate: Date) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );

    return {
      date,
      isCurrentMonth: date.getMonth() === month,
    };
  });
};

const getPreviewRange = (
  startDate: Date | null,
  endDate: Date | null,
  hoveredDate: Date | null,
) => {
  if (!startDate) {
    return { previewStart: null, previewEnd: null };
  }

  if (endDate) {
    return { previewStart: startDate, previewEnd: endDate };
  }

  if (!hoveredDate) {
    return { previewStart: startDate, previewEnd: null };
  }

  if (isBeforeDay(hoveredDate, startDate)) {
    return { previewStart: hoveredDate, previewEnd: startDate };
  }

  return { previewStart: startDate, previewEnd: hoveredDate };
};

export interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
}

const DateRangePicker = ({
  value,
  onChange,
  placeholder = "Boshlanish → Tugash",
  className = "",
  size = "md",
}: DateRangePickerProps) => {
  const [open, setOpen] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState<Date | null>(value.startDate);
  const [draftEndDate, setDraftEndDate] = useState<Date | null>(value.endDate);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const baseDate = value.startDate ?? new Date();
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  });
  const [panelPosition, setPanelPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const triggerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const committedStartDate = value.startDate ? startOfDay(value.startDate) : null;
  const committedEndDate = value.endDate ? startOfDay(value.endDate) : null;

  const leftMonth = visibleMonth;
  const rightMonth = addMonths(visibleMonth, 1);
  const leftMonthDays = useMemo(() => buildMonthDays(leftMonth), [leftMonth]);
  const rightMonthDays = useMemo(() => buildMonthDays(rightMonth), [rightMonth]);

  const hasRange = Boolean(committedStartDate && committedEndDate);
  const triggerLabel = hasRange
    ? `${formatTriggerDate(committedStartDate)} → ${formatTriggerDate(committedEndDate)}`
    : placeholder;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const inTrigger = triggerRef.current?.contains(target);
      const inPanel = panelRef.current?.contains(target);

      if (!inTrigger && !inPanel) {
        setDraftStartDate(committedStartDate);
        setDraftEndDate(committedEndDate);
        setHoveredDate(null);
        setOpen(false);
      }
    };

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const panelWidth = Math.min(PANEL_MAX_WIDTH, viewportWidth - PANEL_GAP * 2);
      const maxLeft = Math.max(PANEL_GAP, viewportWidth - panelWidth - PANEL_GAP);
      const maxTop = Math.max(PANEL_GAP, viewportHeight - PANEL_MIN_HEIGHT - PANEL_GAP);

      setPanelPosition({
        top: Math.min(rect.bottom + PANEL_GAP, maxTop),
        left: Math.min(Math.max(PANEL_GAP, rect.left), maxLeft),
        width: panelWidth,
      });
    };

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [committedEndDate, committedStartDate, open]);

  const openCalendar = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    const baseDate = committedStartDate ?? new Date();

    setDraftStartDate(committedStartDate);
    setDraftEndDate(committedEndDate);
    setHoveredDate(null);
    setVisibleMonth(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));

    if (rect) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const panelWidth = Math.min(PANEL_MAX_WIDTH, viewportWidth - PANEL_GAP * 2);
      const maxLeft = Math.max(PANEL_GAP, viewportWidth - panelWidth - PANEL_GAP);
      const maxTop = Math.max(PANEL_GAP, viewportHeight - PANEL_MIN_HEIGHT - PANEL_GAP);

      setPanelPosition({
        top: Math.min(rect.bottom + PANEL_GAP, maxTop),
        left: Math.min(Math.max(PANEL_GAP, rect.left), maxLeft),
        width: panelWidth,
      });
    }

    setOpen(true);
  };

  const closeCalendar = () => {
    setHoveredDate(null);
    setOpen(false);
  };

  const handleClear = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onChange({ startDate: null, endDate: null });
    setDraftStartDate(null);
    setDraftEndDate(null);
    closeCalendar();
  };

  const handlePrevMonth = () => {
    setVisibleMonth((currentMonth) => addMonths(currentMonth, -1));
  };

  const handleNextMonth = () => {
    setVisibleMonth((currentMonth) => addMonths(currentMonth, 1));
  };

  const handleToday = () => {
    const today = startOfDay(new Date());
    onChange({ startDate: today, endDate: today });
    setDraftStartDate(today);
    setDraftEndDate(today);
    closeCalendar();
  };

  const handleDayClick = (day: Date) => {
    const normalizedDay = startOfDay(day);

    if (!draftStartDate || draftEndDate) {
      setDraftStartDate(normalizedDay);
      setDraftEndDate(null);
      setHoveredDate(null);
      return;
    }

    if (isBeforeDay(normalizedDay, draftStartDate)) {
      onChange({ startDate: normalizedDay, endDate: draftStartDate });
      setDraftStartDate(normalizedDay);
      setDraftEndDate(draftStartDate);
      closeCalendar();
      return;
    }

    onChange({ startDate: draftStartDate, endDate: normalizedDay });
    setDraftEndDate(normalizedDay);
    closeCalendar();
  };

  const { previewStart, previewEnd } = getPreviewRange(draftStartDate, draftEndDate, hoveredDate);
  const today = startOfDay(new Date());

  const renderMonth = (monthDate: Date, days: ReturnType<typeof buildMonthDays>) => (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-1 grid grid-cols-7 gap-y-0.5">
        {UZ_DAYS_SHORT.map((day) => (
          <div
            key={`${monthDate.getMonth()}-${day}`}
            className="py-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map(({ date, isCurrentMonth }) => {
          const normalizedDate = startOfDay(date);
          const isRangeStart = previewStart ? isSameDay(normalizedDate, previewStart) : false;
          const isRangeEnd = previewEnd ? isSameDay(normalizedDate, previewEnd) : false;
          const isToday = isSameDay(normalizedDate, today);
          const isInRange =
            previewStart &&
            previewEnd &&
            !isRangeStart &&
            !isRangeEnd &&
            !isBeforeDay(normalizedDate, previewStart) &&
            !isAfterDay(normalizedDate, previewEnd);

          return (
            <div
              key={`${monthDate.getMonth()}-${normalizedDate.toISOString()}`}
              className={`px-[1px] py-[1px] ${isInRange ? "bg-main/10" : ""} ${
                isRangeStart ? "rounded-l-full" : ""
              } ${isRangeEnd ? "rounded-r-full" : ""}`}
            >
              <button
                type="button"
                onClick={() => handleDayClick(normalizedDate)}
                onMouseEnter={() => {
                  if (draftStartDate && !draftEndDate) {
                    setHoveredDate(normalizedDate);
                  }
                }}
                className={`relative flex h-7 w-full items-center justify-center rounded-full border text-[12px] font-medium transition-colors ${
                  isRangeStart || isRangeEnd
                    ? "border-main bg-main text-primary"
                    : isToday
                      ? "border-[color:var(--color-maindark)] bg-[color:var(--color-maindark)] font-bold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]"
                    : isCurrentMonth
                      ? "border-transparent text-[color:var(--color-maindark)] hover:bg-main/10 dark:text-[color:var(--color-primary)] dark:hover:bg-main/10"
                      : "border-transparent text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]"
                }`}
              >
                {date.getDate()}
                {isToday && !isRangeStart && !isRangeEnd && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-white" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={triggerRef} className={`relative ${className}`}>
      <div
        className={`group flex h-14 w-full items-center gap-3 rounded-[1.1rem] border bg-[color:var(--color-surface-elevated)] px-3.5 text-left shadow-[0_12px_28px_color-mix(in_srgb,var(--color-background-deep)_10%,transparent)] backdrop-blur-sm transition-all duration-200 dark:bg-[color:var(--color-surface-elevated-dark)] ${
          open
            ? "border-main shadow-[0_14px_34px_color-mix(in_srgb,var(--color-main)_18%,transparent)] ring-2 ring-main/15"
            : "border-[color:var(--color-border-strong)] hover:border-main/50 hover:shadow-[0_14px_34px_color-mix(in_srgb,var(--color-main)_10%,transparent)]"
        } ${size === "sm" ? "text-[13px]" : "text-sm"}`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-main/12 text-main shadow-inner shadow-main/8">
          <Calendar
            size={size === "sm" ? 14 : 16}
            className="shrink-0 transition-colors group-hover:text-main group-focus-within:text-main"
          />
        </div>

        <button
          type="button"
          onClick={openCalendar}
          className={`min-w-0 flex-1 truncate bg-transparent text-left outline-none ${
            hasRange
              ? "font-semibold text-[color:var(--color-maindark)] dark:text-[color:var(--color-primary)]"
              : "font-medium text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]"
          }`}
        >
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-main/70">
            Sana oralig&apos;i
          </span>
          <span className="block truncate">
            {triggerLabel}
          </span>
        </button>

        {hasRange && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--color-text-muted)] transition-colors hover:bg-main/10 hover:text-main dark:text-[color:var(--color-text-muted-dark)]"
            aria-label="Sanalar oralig'ini tozalash"
          >
          <X size={14} />
          </button>
        )}
      </div>

      {open &&
        panelPosition &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: panelPosition.top,
              left: panelPosition.left,
              width: panelPosition.width,
            }}
            className="z-[9999] overflow-hidden rounded-[1.5rem] border border-[color:var(--color-border-soft)] bg-[color:var(--color-primary)] shadow-[0_24px_50px_color-mix(in_srgb,var(--color-background-deep)_18%,transparent)] dark:bg-[color:var(--color-primarydark)]"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--color-border-soft)] px-3 py-2.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--color-text-muted)] transition-colors hover:bg-main/10 hover:text-main dark:text-[color:var(--color-text-muted-dark)]"
              >
                <ChevronLeft size={14} />
              </button>

              <div className="flex flex-1 items-center gap-3 px-2">
                <div className="flex-1 text-center text-[13px] font-bold text-[color:var(--color-maindark)] dark:text-[color:var(--color-primary)]">
                  {UZ_MONTHS[leftMonth.getMonth()]} {leftMonth.getFullYear()}
                </div>
                <div className="h-5 w-px bg-[color:var(--color-border-soft)]" />
                <div className="flex-1 text-center text-[13px] font-bold text-[color:var(--color-maindark)] dark:text-[color:var(--color-primary)]">
                  {UZ_MONTHS[rightMonth.getMonth()]} {rightMonth.getFullYear()}
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--color-text-muted)] transition-colors hover:bg-main/10 hover:text-main dark:text-[color:var(--color-text-muted-dark)]"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="flex gap-3 px-3 py-3">
              {renderMonth(leftMonth, leftMonthDays)}
              {renderMonth(rightMonth, rightMonthDays)}
            </div>

            <div className="flex justify-end border-t border-[color:var(--color-border-soft)] px-3 py-2.5">
              <button
                type="button"
                onClick={handleToday}
                className="rounded-lg bg-main/10 px-2.5 py-1 text-[12px] font-semibold text-[color:var(--color-maindark)] transition-colors hover:bg-main/20 dark:text-[color:var(--color-primary)]"
              >
                Bugun
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default memo(DateRangePicker);

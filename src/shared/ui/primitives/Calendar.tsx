import { useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  clampDay,
  endOfMonth,
  endOfWeek,
  isOutOfBounds,
  normalizeISODay,
  startOfMonth,
  startOfWeek,
  todayISODay,
  type CalendarCell,
  type ISODay,
} from "./date/calendarMath";
import { useCalendarText } from "./date/calendarText";
import { IconButton } from "./IconButton";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  KALENDAR — dizayn v2 (`.el-cal-head` · `.el-cal-grid` · `.el-cal-dow` · `.el-cal-day`,
 *  `design/CODE-MAP.md` 2.2, taxta `tizim-states-forms` 04 «Sana oralig'i»)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Oy to'ri: hafta dushanbadan («Du Se Ch Pa Ju Sh Ya»), har oy 6 hafta (qo'shni oy kunlari kulrang —
 *  `.is-muted`), ikki oy yonma-yon (`months={2}`, oraliq tanlash) yoki bitta (telefon, bitta sana).
 *  Belgilar (taxtadagi «Taqvim belgilari»): boshlanish va tugash — to'liq ko'k; oraliq ichidagi kunlar —
 *  yumshoq ko'k, burchaksiz (yaxlit chiziq); bugun — ko'k ichki chiziq; qo'shni oy kunlari — kulrang.
 *  `min` / `max` dan tashqaridagi kun xira va tanlanmaydi (`aria-disabled`, klaviatura bilan
 *  o'tib ketsa bo'ladi).
 *
 *  Kirish qulayligi — WAI-ARIA «Date Picker Dialog» naqshi: har oy `role="grid"` (sarlavhasi — oy
 *  nomi), kun — `gridcell` tugmasi, nomi to'liq («1-oktabr, bugun, boshlanish»), tanlangan kunlarda
 *  `aria-selected`, bugun — `aria-current="date"`. To'rga bitta Tab bilan kiriladi (faol kun,
 *  roving `tabIndex`). Klaviatura:
 *    ← →        — oldingi / keyingi kun        ↑ ↓        — oldingi / keyingi hafta
 *    Home End   — hafta boshi / oxiri           PageUp/Down — oldingi / keyingi oy (Shift — yil)
 *    Enter, Bo'sh joy — tanlash                Esc — ochgan oyna yopadi (`DateRange` / `DateInput`)
 *  Faol kun ko'rinadigan oylardan chiqsa — oylar o'zi suriladi. Oy almashsa sarlavha o'qiladi
 *  (`aria-live`).
 *
 *  Kalendar faqat to'r: qiymatni (oraliq qoralamasi, tez tanlov) `DateRange` / `DateInput` boshqaradi.
 */

export type CalendarMode = "single" | "range";

export type CalendarProps = Omit<ComponentProps<"div">, "onSelect" | "children"> & {
  /** `single` — bitta sana (`start`); `range` — oraliq (`start` … `end`). Sukut `single`. */
  mode?: CalendarMode;
  /** Tanlangan kun (`single`) yoki oraliq boshi (`range`): `"YYYY-MM-DD"`, bo'sh — `""`. */
  start?: string;
  /** Oraliq oxiri (`range`); yo'q bo'lsa faqat boshlanish belgilanadi. */
  end?: string;
  /** Kun tanlandi (sichqoncha, Enter yoki Bo'sh joy). `min`/`max` dan tashqaridagi kun — chaqirilmaydi. */
  onSelect: (day: ISODay) => void;
  /**
   * Ko'rib turilgan kun (sichqoncha ustida yoki klaviatura bilan o'tilgan) — oraliqning oldindan
   * ko'rinishi uchun; `null` — sichqoncha to'rdan chiqdi.
   */
  onPreview?: (day: ISODay | null) => void;
  /** Eng erta tanlanadigan kun (`"YYYY-MM-DD"`). */
  min?: string;
  /** Eng kech tanlanadigan kun. */
  max?: string;
  /** Yonma-yon oylar soni: 2 (oraliq, planshet/desktop) yoki 1 (telefon, bitta sana). Sukut 1. */
  months?: 1 | 2;
  /** Ochilgandagi faol kun (fokus): sukut — `start`, bo'lmasa bugun. */
  defaultActive?: string;
  /** Ochilganda faol kunga fokus (oyna ichida — WAI-ARIA: fokus tanlangan sanaga). */
  autoFocus?: boolean;
  /** «Bugun» (namuna va testlar uchun); sukut — brauzerning bugungi kuni. */
  today?: string;
};

type DayState = {
  disabled: boolean;
  isToday: boolean;
  /** Boshlanish / tugash / bitta tanlangan kun — to'liq ko'k. */
  solid: boolean;
  isStart: boolean;
  isEnd: boolean;
  inRange: boolean;
  selected: boolean;
};

/** `.el-cal-day`: 36 px (telefonda 44 px — bosish maydoni), r 8, 13 px. Fokus halqasi — global `:focus-visible`. */
const DAY_BASE =
  "h-9 w-full text-[13px] transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none max-md:h-11";

const dayClasses = (cell: CalendarCell, state: DayState) =>
  cx(
    DAY_BASE,
    state.inRange ? "rounded-none" : "rounded-lg",
    state.solid
      ? "bg-action font-bold text-on-solid"
      : state.inRange
        ? "bg-action-soft text-text"
        : cx(cell.inMonth ? "text-text" : "text-text-subtle", !state.disabled && "hover:bg-sunken"),
    state.isToday && "ring-1 ring-action ring-inset",
    state.disabled && "cursor-not-allowed opacity-45",
  );

/** Fokus so'rovi: hali urinilmagan. */
const FOCUS_PENDING = -1;
/** Fokus tushmasa shuncha vaqt (ms) qayta uriniladi. */
const FOCUS_RETRY_MS = 1000;

/** Faol kun ko'rinadigan oylar ichida qolsin: kerak bo'lsa birinchi ko'rinadigan oyni suradi. */
const keepVisible = (view: ISODay, day: ISODay, months: number): ISODay => {
  if (day < view) return startOfMonth(day);
  if (day > endOfMonth(addMonths(view, months - 1))) return addMonths(startOfMonth(day), -(months - 1));
  return view;
};

const chunk = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));

/**
 * Dizayn v2 kalendari (oy to'ri).
 *
 *   <Calendar mode="range" months={2} start={from} end={to} onSelect={pick} onPreview={setHover} autoFocus />
 *   <Calendar start={day} onSelect={setDay} min="2026-01-01" />
 */
export const Calendar = ({
  mode = "single",
  start,
  end,
  onSelect,
  onPreview,
  min,
  max,
  months = 1,
  defaultActive,
  autoFocus = false,
  today: todayProp,
  className,
  ...rest
}: CalendarProps) => {
  const { t } = useTranslation("ui");
  const text = useCalendarText();
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  /**
   * Fokus so'rovi (vaqti, ms): klaviatura bilan yurilganda yoki ochilganda. Popover birinchi o'lchovgacha
   * `visibility: hidden` (`usePopover`) — u paytda `focus()` ishlamaydi, shuning uchun so'rov fokus
   * haqiqatan tushguncha keyingi render'larda qayta uriniladi (eskirgani — 1 s dan keyin — tashlanadi).
   */
  const focusRequestRef = useRef<number | null>(autoFocus ? FOCUS_PENDING : null);

  const minDay = normalizeISODay(min) || undefined;
  const maxDay = normalizeISODay(max) || undefined;
  const today = normalizeISODay(todayProp) || todayISODay();
  const startDay = normalizeISODay(start);
  const endDay = normalizeISODay(end);
  // Teskari oraliq (`end < start`) ham to'g'ri chiziladi.
  const [rangeStart, rangeEnd] = startDay && endDay && endDay < startDay ? [endDay, startDay] : [startDay, endDay];

  const [active, setActive] = useState<ISODay>(() =>
    clampDay(normalizeISODay(defaultActive) || startDay || today, minDay, maxDay),
  );
  const [view, setView] = useState<ISODay>(() => startOfMonth(active));
  // Tanlov tashqaridan o'zgarsa (ochiq paneldagi tez tanlov, boshqa maydon) — faol kun unga ko'chadi va
  // ko'rinadigan oylar unga suriladi (ko'rinib turgan bo'lsa — joyida qoladi). Render paytidagi
  // hosila holat (React: «prop o'zgarganda holatni moslash»), effekt emas.
  const [syncedStart, setSyncedStart] = useState(startDay);
  if (syncedStart !== startDay) {
    setSyncedStart(startDay);
    if (startDay) {
      const next = clampDay(startDay, minDay, maxDay);
      setActive(next);
      setView(keepVisible(keepVisible(view, active, months), next, months));
    }
  }
  // Ko'rinadigan birinchi oy — faol kun doim ko'rinsin (telefon ↔ desktop: oylar soni o'zgarsa ham).
  const shownView = keepVisible(view, active, months);

  // Klaviatura bilan yurilganda (va ochilganda) fokus yangi faol kunga — render'dan keyin.
  useEffect(() => {
    const requested = focusRequestRef.current;
    if (requested === null) return;
    const now = Date.now();
    if (requested === FOCUS_PENDING) focusRequestRef.current = now;
    else if (now - requested > FOCUS_RETRY_MS) {
      focusRequestRef.current = null;
      return;
    }
    const target = rootRef.current?.querySelector<HTMLElement>(`[data-day="${active}"][data-in-month]`);
    target?.focus({ preventScroll: true });
    if (target && document.activeElement === target) focusRequestRef.current = null;
  });

  const moveActive = (next: ISODay) => {
    const day = clampDay(next, minDay, maxDay);
    setActive(day);
    setView(keepVisible(shownView, day, months));
    focusRequestRef.current = FOCUS_PENDING;
    onPreview?.(day);
  };

  const isPrevDisabled = (firstMonth: ISODay) => Boolean(minDay && firstMonth <= minDay);
  const isNextDisabled = (firstMonth: ISODay) => Boolean(maxDay && endOfMonth(addMonths(firstMonth, months - 1)) >= maxDay);

  const shiftMonth = (delta: number) => {
    const nextView = addMonths(shownView, delta);
    setView(nextView);
    setActive(clampDay(addMonths(active, delta), minDay, maxDay));
    // Chegaraga yetdi: bosilgan tugma `disabled` bo'ladi va fokus `body` ga tushib, oynadan chiqib ketardi —
    // fokus faol kunga o'tadi (WCAG 2.4.3).
    if (delta < 0 ? isPrevDisabled(nextView) : isNextDisabled(nextView)) focusRequestRef.current = FOCUS_PENDING;
  };

  const prevDisabled = isPrevDisabled(shownView);
  const nextDisabled = isNextDisabled(shownView);

  const choose = (day: ISODay) => {
    if (isOutOfBounds(day, minDay, maxDay)) return;
    setActive(day);
    onSelect(day);
  };

  const onGridKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const from = (event.target as HTMLElement).dataset.day;
    if (!from || event.altKey || event.ctrlKey || event.metaKey) return;
    let next: ISODay;
    switch (event.key) {
      case "ArrowLeft":
        next = addDays(from, -1);
        break;
      case "ArrowRight":
        next = addDays(from, 1);
        break;
      case "ArrowUp":
        next = addDays(from, -7);
        break;
      case "ArrowDown":
        next = addDays(from, 7);
        break;
      case "Home":
        next = startOfWeek(from);
        break;
      case "End":
        next = endOfWeek(from);
        break;
      case "PageUp":
        next = addMonths(from, event.shiftKey ? -12 : -1);
        break;
      case "PageDown":
        next = addMonths(from, event.shiftKey ? 12 : 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    moveActive(next);
  };

  const stateOf = (cell: CalendarCell): DayState => {
    const disabled = isOutOfBounds(cell.day, minDay, maxDay);
    // Ikki oy yonma-yon bo'lganda qo'shni oy kunlari belgilanmaydi (o'sha kun yonidagi oyda bor) — «bugun»
    // chizig'i va `aria-current` ham: aks holda bugun ikki joyda belgilanardi.
    const marks = cell.inMonth || months === 1;
    const isToday = marks && cell.day === today;
    if (!marks) return { disabled, isToday, solid: false, isStart: false, isEnd: false, inRange: false, selected: false };
    if (mode === "single") {
      const selected = Boolean(startDay) && cell.day === startDay;
      return { disabled, isToday, solid: selected, isStart: false, isEnd: false, inRange: false, selected };
    }
    const isStart = Boolean(rangeStart) && cell.day === rangeStart;
    const isEnd = Boolean(rangeEnd) && cell.day === rangeEnd;
    const inRange = Boolean(rangeStart && rangeEnd) && cell.day > rangeStart && cell.day < rangeEnd;
    return { disabled, isToday, solid: isStart || isEnd, isStart, isEnd, inRange, selected: isStart || isEnd || inRange };
  };

  const dayLabel = (cell: CalendarCell, state: DayState) => {
    const month = Number(cell.day.slice(5, 7));
    const parts = [t("date.dayLabel", { day: cell.date, month: text.monthsOf[month - 1] })];
    if (state.isToday) parts.push(t("date.today"));
    if (state.isStart) parts.push(t("date.start"));
    if (state.isEnd) parts.push(t("date.end"));
    if (state.disabled) parts.push(t("date.unavailable"));
    return parts.join(", ");
  };

  return (
    <div
      {...rest}
      ref={rootRef}
      data-calendar={mode}
      className={cx("flex min-w-0 flex-wrap gap-x-5 gap-y-2", className)}
    >
      {Array.from({ length: months }, (_, index) => {
        const monthStart = addMonths(shownView, index);
        const year = Number(monthStart.slice(0, 4));
        const month = Number(monthStart.slice(5, 7));
        const titleId = `${baseId}-month-${index}`;
        const rows = chunk(buildMonthGrid(monthStart), 7);
        const spacer = <span aria-hidden="true" className="size-8 shrink-0 max-md:size-11" />;
        return (
          <div key={index} className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-sm font-bold text-text">
              {index === 0 ? (
                <IconButton
                  size="sm"
                  label={t("date.prevMonth")}
                  icon={ChevronLeft}
                  disabled={prevDisabled}
                  onClick={() => shiftMonth(-1)}
                />
              ) : (
                spacer
              )}
              <span id={titleId} aria-live="polite" className="min-w-0 truncate text-center">
                {`${text.months[month - 1]} ${year}`}
              </span>
              {index === months - 1 ? (
                <IconButton
                  size="sm"
                  label={t("date.nextMonth")}
                  icon={ChevronRight}
                  disabled={nextDisabled}
                  onClick={() => shiftMonth(1)}
                />
              ) : (
                spacer
              )}
            </div>
            <table
              role="grid"
              aria-labelledby={titleId}
              onKeyDown={onGridKeyDown}
              onMouseLeave={() => onPreview?.(null)}
              className="w-full table-fixed border-separate border-spacing-x-0 border-spacing-y-0.5 text-center"
            >
              <thead>
                <tr>
                  {text.weekdaysShort.map((short, weekday) => (
                    <th key={weekday} scope="col" className="py-1 text-xs font-semibold text-text-muted">
                      <span aria-hidden="true">{short}</span>
                      <span className="sr-only">{text.weekdays[weekday]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row[0].day}>
                    {row.map((cell) => {
                      const state = stateOf(cell);
                      const focusable = cell.inMonth && cell.day === active;
                      return (
                        <td key={cell.day} role="presentation" className="p-0">
                          <button
                            type="button"
                            role="gridcell"
                            data-day={cell.day}
                            data-in-month={cell.inMonth || undefined}
                            tabIndex={focusable ? 0 : -1}
                            aria-selected={state.selected}
                            aria-disabled={state.disabled || undefined}
                            aria-current={state.isToday ? "date" : undefined}
                            aria-label={dayLabel(cell, state)}
                            onClick={() => choose(cell.day)}
                            onMouseEnter={() => onPreview?.(cell.day)}
                            className={dayClasses(cell, state)}
                          >
                            {cell.date}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

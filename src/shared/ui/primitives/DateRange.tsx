import { useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import type { ISODateRange } from "../../lib/dateRange";
import { cx } from "../../lib/cx";
import { formatNumberLocalized } from "../../lib/formatMoney";
import { Calendar } from "./Calendar";
import {
  countDays,
  DEFAULT_DATE_PRESETS,
  EMPTY_RANGE,
  formatDay,
  formatRangeFull,
  formatRangeShort,
  getPresetRange,
  normalizeISODay,
  normalizeRange,
  pluralForm,
  RANGE_DASH,
  resolvePreset,
  todayISODay,
  type DatePresetKey,
  type ISODay,
} from "./date/calendarMath";
import { useCalendarText } from "./date/calendarText";
import { DatePickerLayer, DateTrigger } from "./date/DatePickerParts";
import { useDatePicker } from "./date/useDatePicker";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  SANA ORALIG'I — dizayn v2 (`.el-select` + `.el-cal*` + `.el-cal-presets`, `design/CODE-MAP.md` 2.2,
 *  taxta `tizim-states-forms` 04 «Sana oralig'i»)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Maydon: `Calendar` ikonka + «01.10 – 08.10.2026» (bo'sh — «Sana oralig'ini tanlang»), o'ngda chevron;
 *  qiymat bo'lsa chevron o'rnida × «Sanalar oralig'ini tozalash». Ochiq — ko'k chegara va halqa.
 *  Panel: tez tanlov chiplari (`Bugun / Bu hafta / Bu oy / Barchasi`), chiziq, ikki oylik taqvim va
 *  pastda «01.10.2026 – 08.10.2026 · 8 kun». «Birinchi bosish — boshlanish, ikkinchisi — tugash;
 *  oraliq darhol qo'llanadi va panel yopiladi» (maket) — «Qo'llash» tugmasi yo'q. Tez tanlov ham darhol.
 *  Tugash boshlanishdan oldin bosilsa — joylari almashadi. Esc / tashqariga bosish — qoralama
 *  bekor, qiymat o'zgarmaydi.
 *
 *  Telefonda (< 768) — pastki varaqa, bitta oy (`date/DatePickerParts.tsx`).
 *
 *  Qiymat — `{ from, to }` satrlari (`"YYYY-MM-DD"`, bo'sh — `""`): URL parametri va API filtri
 *  shu shaklda (`shared/lib/dateRange` `ISODateRange`). «Barchasi» — bo'sh oraliq (sana filtri yo'q).
 *
 *  `Field` ichida: `<Field label="Sana" labelAs="span">` — yorliq bosilganda panel ochilib ketmaydi,
 *  nom `aria-labelledby` orqali (yorliq + qiymat).
 *
 *  `selection="day"` (qisqartirilgan sana filtri — backend oraliq emas, faqat davr yoki bitta kun qabul qilsa,
 *  masalan `/returns`: `period=today|week|month` | `date=YYYY-MM-DD`): tez tanlov chiplari o'sha-o'sha, taqvimda
 *  BITTA kun — bir bosishda `{ from: kun, to: kun }` qo'llanadi va panel yopiladi (oraliq tanlab bo'lmaydi);
 *  maydonda tez tanlovga mos qiymat uning nomi bilan («Bugun», «Bu hafta», «Bu oy»), aks holda — kun.
 *  `inlineLabel` — maydon ichida kulrang «Sana:» (`Select` `inlineLabel` bilan bir xil). Ikkalasi ham ixtiyoriy,
 *  sukut — oldingi xatti-harakat (oraliq, ichki yorliqsiz).
 */

export type { DatePresetKey } from "./date/calendarMath";

export type DateRangeChangeSource = "calendar" | "preset";

/** `range` (sukut) — ikki bosishda oraliq; `day` — bitta kun (+ tez tanlov davrlari). */
export type DateRangeSelection = "range" | "day";

export type DateRangePanelProps = Omit<ComponentProps<"div">, "onChange" | "children"> & {
  value: Partial<ISODateRange> | null | undefined;
  /** Oraliq tanlandi (ikkinchi bosish) yoki tez tanlov bosildi (`preset` — qaysi chip). */
  onChange: (range: ISODateRange, source: DateRangeChangeSource, preset?: DatePresetKey) => void;
  /**
   * Oxirgi bosilgan chip (dushanba «Bu hafta» = «Bugun» oralig'i — qaysi biri bosilgani). Berilmasa — panelning
   * ichki holati; `DateRange` uni o'zida saqlaydi (panel har ochilishda yangidan chiziladi).
   */
  preset?: DatePresetKey | null;
  /** Tez tanlov chiplari; `false` — yo'q. Sukut — maketdagi `Bugun / Bu hafta / Bu oy / Barchasi`. */
  presets?: readonly DatePresetKey[] | false;
  min?: string;
  max?: string;
  /** Yonma-yon oylar (2 — sukut; telefon varaqasida 1). */
  months?: 1 | 2;
  today?: string;
  /** Ochilganda faol kunga fokus. */
  autoFocus?: boolean;
  /**
   * `raised` — o'z yuzasi (`.el-cal`: `RAISED`, r 14, 12 px ichki oraliq) — sahifada ochiq namuna;
   * `plain` (sukut) — yuzasiz, popover yoki varaqa ichida.
   */
  surface?: "raised" | "plain";
  /** Taqvimda tanlov: `range` (sukut) — oraliq, `day` — bitta kun (bir bosishda qo'llanadi). */
  selection?: DateRangeSelection;
};

const PANEL_SURFACE = {
  raised: "rounded-[14px] border border-border bg-raised p-3 shadow-xl",
  plain: "",
} as const;

/** `.el-chip` (+ `aria-pressed`): 32 px (telefonda 44), pilyula, tanlangan — yumshoq ko'k. */
const CHIP =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-3 " +
  "text-[13px] font-medium text-text transition-[background-color,border-color,color,box-shadow] duration-150 " +
  "motion-reduce:transition-none hover:border-text-subtle aria-pressed:border-action aria-pressed:bg-action-soft " +
  "aria-pressed:font-semibold aria-pressed:text-action-fg max-md:h-11";

/**
 * Sana oralig'i paneli (`.el-cal`): tez tanlov + taqvim + oraliq. `DateRange` uni popover/varaqa
 * ichida ochadi; sahifada ochiq namuna sifatida ham ishlatiladi (`surface="raised"`).
 */
export const DateRangePanel = ({
  value,
  onChange,
  presets = DEFAULT_DATE_PRESETS,
  min,
  max,
  months = 2,
  today: todayProp,
  autoFocus = false,
  surface = "plain",
  selection = "range",
  preset: presetProp,
  className,
  ...rest
}: DateRangePanelProps) => {
  const { t } = useTranslation("ui");
  const { language } = useCalendarText();
  const range = normalizeRange(value);
  const today = normalizeISODay(todayProp) || todayISODay();
  // Qoralama: birinchi bosilgan kun (ikkinchisi kutilmoqda) va kursor ostidagi kun (oldindan ko'rinish).
  const [draftStart, setDraftStart] = useState<ISODay>("");
  const [preview, setPreview] = useState<ISODay>("");
  const presetList = presets === false ? [] : presets;
  const [ownPreset, setOwnPreset] = useState<DatePresetKey | null>(null);
  const chosen = presetProp === undefined ? ownPreset : presetProp;
  const pressed = presetList.length ? resolvePreset(range, presetList, chosen, today) : null;
  const dayMode = selection === "day";

  const select = (day: ISODay) => {
    if (dayMode) {
      onChange({ from: day, to: day }, "calendar");
      return;
    }
    if (!draftStart) {
      setDraftStart(day);
      setPreview("");
      return;
    }
    setDraftStart("");
    setPreview("");
    onChange(normalizeRange({ from: draftStart, to: day }), "calendar");
  };

  const applyPreset = (preset: DatePresetKey) => {
    setDraftStart("");
    setPreview("");
    setOwnPreset(preset);
    onChange(getPresetRange(preset, today), "preset", preset);
  };

  const full = formatRangeFull(range);
  // Kun rejimida taqvimda faqat bitta kun belgilanadi (davr — bosilgan tez tanlov chipida ko'rinadi).
  const singleDay = range.from && range.from === range.to ? range.from : "";
  let summary;
  if (dayMode && singleDay) {
    summary = <span className="font-semibold text-text">{formatDay(singleDay)}</span>;
  } else if (dayMode && !full) {
    summary = <span>{t("date.datePlaceholder")}</span>;
  } else if (draftStart) {
    summary = (
      <span>
        {`${formatDay(draftStart)}${RANGE_DASH}… · `}
        <span className="font-semibold text-text">{t("date.pickEnd")}</span>
      </span>
    );
  } else if (full) {
    const days = countDays(range.from, range.to);
    summary = (
      <span>
        {`${full} · `}
        <span className="font-semibold text-text">
          {t(`date.days.${pluralForm(language, days)}`, { count: formatNumberLocalized(days, { language }) })}
        </span>
      </span>
    );
  } else if (range.from || range.to) {
    summary = (
      <span>
        {range.from
          ? t("date.fromOnly", { date: formatDay(range.from) })
          : t("date.toOnly", { date: formatDay(range.to) })}
      </span>
    );
  } else {
    summary = <span>{t("date.pickStart")}</span>;
  }

  return (
    <div {...rest} data-date-range-panel="" className={cx("flex min-w-0 flex-col gap-3", PANEL_SURFACE[surface], className)}>
      {presetList.length ? (
        <>
          <div role="group" aria-label={t("date.presetsLabel")} className="flex flex-wrap gap-1.5">
            {presetList.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={pressed === preset}
                onClick={() => applyPreset(preset)}
                className={CHIP}
              >
                {t(`date.presets.${preset}`)}
              </button>
            ))}
          </div>
          <div aria-hidden="true" className="h-px shrink-0 bg-border" />
        </>
      ) : null}

      {dayMode ? (
        <Calendar
          mode="single"
          months={months}
          start={singleDay}
          defaultActive={range.to || range.from || undefined}
          onSelect={select}
          min={min}
          max={max}
          today={today}
          autoFocus={autoFocus}
        />
      ) : (
        <Calendar
          mode="range"
          months={months}
          start={draftStart || range.from}
          end={draftStart ? preview : range.to}
          defaultActive={range.from || range.to || undefined}
          onSelect={select}
          onPreview={(day) => {
            if (draftStart) setPreview(day ?? "");
          }}
          min={min}
          max={max}
          today={today}
          autoFocus={autoFocus}
        />
      )}

      <div
        aria-live="polite"
        className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[13px] text-text-muted"
      >
        {summary}
      </div>
    </div>
  );
};

export type DateRangeProps = {
  /** `{ from, to }` — `"YYYY-MM-DD"` yoki `""`. */
  value: Partial<ISODateRange> | null | undefined;
  onChange: (range: ISODateRange) => void;
  /** Bo'sh maydon matni (sukut «Sana oralig'ini tanlang»; dashboard — «Boshlanish → Tugash»). */
  placeholder?: string;
  /** Tez tanlov; `false` — yo'q (yonida davr segmenti bo'lsa, masalan dashboard sarlavhasi). */
  presets?: readonly DatePresetKey[] | false;
  min?: string;
  max?: string;
  /** × tugmasi (sukut `true`). */
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  id?: string;
  /** `Field` siz nom (sukut «Sana oralig'i») — tugma nomi «Sana oralig'i: 01.10.2026 dan 08.10.2026 gacha». */
  "aria-label"?: string;
  /** Panel nomi (sukut «Sana oralig'ini tanlash»; telefonda varaqa sarlavhasi). */
  dialogLabel?: string;
  /** Desktop/planshetda yonma-yon oylar (sukut 2; telefonda doim 1). */
  months?: 1 | 2;
  today?: string;
  /** Tashqi o'ram (kenglik: `w-full`, `max-w-[360px]` …). */
  className?: string;
  /** Maydon tugmasi klassi (masalan balandlik). */
  triggerClassName?: string;
  /**
   * `range` (sukut) — oraliq; `day` — bitta kun yoki tez tanlov davri (`/returns`: backend `period` | `date`).
   * Kun rejimida sukut nomlar: «Sana», panel «Sanani tanlash», × «Sanani tozalash».
   */
  selection?: DateRangeSelection;
  /** Maydon ichidagi kulrang yorliq («Sana:» — yorlig'i yashirin filtr, `Select` `inlineLabel` kabi). */
  inlineLabel?: string;
};

/**
 * Dizayn v2 sana oralig'i.
 *
 *   <DateRange value={{ from, to }} onChange={({ from, to }) => setRange(from, to)} className="w-full max-w-[360px]" />
 *   <Field label="Sana" labelAs="span"><DateRange value={range} onChange={setRange} /></Field>
 */
export const DateRange = ({
  value,
  onChange,
  placeholder,
  presets = DEFAULT_DATE_PRESETS,
  min,
  max,
  clearable = true,
  disabled,
  invalid,
  required,
  id,
  "aria-label": ariaLabel,
  dialogLabel,
  months = 2,
  today,
  className,
  triggerClassName,
  selection = "range",
  inlineLabel,
}: DateRangeProps) => {
  const { t } = useTranslation("ui");
  const picker = useDatePicker();
  const { close } = picker;
  const range = normalizeRange(value);
  const empty = !range.from && !range.to;
  const dayMode = selection === "day";
  // Oxirgi bosilgan chip (panel yopilsa ham): oraliq unga teng ekan chip ham, kun rejimidagi nom ham shu.
  const [chosen, setChosen] = useState<DatePresetKey | null>(null);
  // Kun rejimi: tez tanlovga mos qiymat — uning nomi («Bugun», «Bu hafta», «Bu oy»), «Barchasi» — bo'sh qiymat.
  const presetList = presets === false ? [] : presets.filter((preset) => preset !== "all");
  const matchedPreset =
    dayMode && !empty && presetList.length
      ? resolvePreset(range, presetList, chosen, normalizeISODay(today) || todayISODay())
      : null;
  const presetText = matchedPreset ? t(`date.presets.${matchedPreset}`) : null;

  const text =
    presetText ??
    formatRangeShort(range) ??
    (range.from
      ? t("date.fromOnly", { date: formatDay(range.from) })
      : range.to
        ? t("date.toOnly", { date: formatDay(range.to) })
        : (placeholder ?? t(dayMode ? "date.datePlaceholder" : "date.placeholder")));
  const spoken =
    presetText ??
    (range.from && range.to && range.from !== range.to
      ? t("date.spokenRange", { from: formatDay(range.from), to: formatDay(range.to) })
      : range.from && range.to
        ? formatDay(range.from)
        : text);

  return (
    <>
      <DateTrigger
        picker={picker}
        text={text}
        empty={empty}
        spoken={spoken}
        ariaLabel={ariaLabel ?? t(dayMode ? "date.dateLabel" : "date.rangeLabel")}
        clearLabel={t(dayMode ? "date.clearDate" : "date.clear")}
        onClear={
          clearable
            ? () => {
                setChosen(null);
                onChange({ ...EMPTY_RANGE });
              }
            : undefined
        }
        id={id}
        invalid={invalid}
        disabled={disabled}
        required={required}
        className={className}
        triggerClassName={triggerClassName}
        inlineLabel={inlineLabel}
      />
      <DatePickerLayer
        picker={picker}
        label={dialogLabel ?? t(dayMode ? "date.datePanelLabel" : "date.panelLabel")}
        popoverClassName={months === 2 ? "w-[652px]" : "w-[300px]"}
      >
        {({ phone }) => (
          <DateRangePanel
            value={range}
            onChange={(next, source, preset) => {
              setChosen(source === "preset" ? (preset ?? null) : null);
              onChange(next);
              close(true);
            }}
            preset={chosen}
            presets={presets}
            min={min}
            max={max}
            months={phone ? 1 : months}
            today={today}
            selection={selection}
            autoFocus
          />
        )}
      </DatePickerLayer>
    </>
  );
};

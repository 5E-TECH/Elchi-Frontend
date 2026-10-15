import type { ComponentProps, KeyboardEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/cx";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  SEGMENT — dizayn v2 (`.el-seg`, `.el-viewtoggle`)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  2–4 ta teng variantdan bittasi: davr («Bugun · Bu hafta · Bu oy · Barchasi»),
 *  grafik ko'rsatkichi, «Grafik | Jadval». Tanlov DARHOL qo'llanadi — «Qo'llash»
 *  tugmasi yo'q. Maket: `tizim-states-navigation` (03 «Segment»),
 *  `superadmin-dashboard-main`, `manager-branch-dashboard-main`. Klasslar:
 *  `design/CODE-MAP.md` 2.5.
 *
 *  Semantika — `radiogroup` + `radio` + `aria-checked` (maketdagi
 *  `group` + `aria-pressed` o'rniga). Sababi: variantlar bir-birini istisno
 *  qiladi va har doim aynan bittasi tanlangan — bu radio guruhi. Ekran o'quvchi
 *  «2 / 4, tanlangan» deb o'qiydi (`aria-pressed` esa har tugmani mustaqil
 *  almashtirgich deb o'qiydi va bittagina tanlov mumkinligini aytmaydi).
 *  Klaviatura radio guruhi kabi: guruhga bitta Tab bilan kiriladi (tanlangan
 *  variantga), ← → ↑ ↓ keyingisini tanlaydi (aylanma), Home / End — chetdagisi;
 *  Bo'sh joy / Enter fokusdagi variantni tanlaydi.
 *
 *  Telefonda (< 768) sukut bo'yicha to'liq enli, har variant ≥ 44 px.
 */

export type SegmentedOption<T extends string = string> = {
  value: T;
  label: ReactNode;
  /** Ikonka (16 px) matn oldida — masalan «Grafik | Jadval» (`ChartColumn`, `List`). */
  icon?: LucideIcon;
  disabled?: boolean;
};

export type SegmentedControlSize = "sm" | "md";

/** Qolgan atributlar (`className`, `ref`, `data-*`, `onKeyDown` …) guruh `<div>` iga o'tadi. */
export type SegmentedControlProps<T extends string = string> = Omit<
  ComponentProps<"div">,
  "children" | "onChange" | "defaultValue" | "role"
> & {
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Guruh nomi (ekran o'quvchi uchun), masalan «Davr». */
  ariaLabel: string;
  /**
   * `md` (sukut) — maketdagi `.el-seg`: variant 32 px, jami 40 px (sukutdagi
   * boshqaruv balandligi, yonidagi maydon bilan bir qatorda).
   * `sm` — ixcham: variant 24 px, jami 32 px.
   */
  size?: SegmentedControlSize;
  /**
   * `"phone"` (sukut) — faqat telefonda to'liq enli (maketdagi kabi);
   * `true` — har doim; `false` — hech qachon.
   */
  fullWidth?: boolean | "phone";
};

/** Iz (sunken fon, ingichka chegara). Variant + 2 × (3 px ichki oraliq + 1 px chegara). */
const TRACK: Record<SegmentedControlSize, string> = {
  md: "gap-0.5 rounded-[10px] border border-border bg-sunken p-[3px]",
  sm: "gap-0.5 rounded-lg border border-border bg-sunken p-[3px]",
};

/**
 * Variant. Burchak oddiy `rounded-*`: global `:focus-visible` dagi
 * `border-radius: 4px` `@layer base` da, utilita uni yutadi — fokusda burchak
 * 8 / 6 px qoladi. Fokus halqasining o'zi (2 px, 2 px oraliq) global
 * qoidadan; iz `overflow` siz, halqa kesilmaydi.
 */
const OPTION_BASE =
  "inline-flex items-center justify-center whitespace-nowrap font-semibold text-text-muted " +
  "transition-[background-color,border-color,color,box-shadow,opacity] duration-150 motion-reduce:transition-none enabled:hover:text-text " +
  "aria-checked:bg-surface aria-checked:text-text aria-checked:shadow-xs " +
  "disabled:cursor-not-allowed disabled:opacity-45 max-md:min-h-11";

const OPTION_SIZE: Record<SegmentedControlSize, string> = {
  md: "h-8 gap-1.5 rounded-lg text-[13px]",
  sm: "h-6 gap-1 rounded-md text-xs",
};

/** Yon oraliq: matnli / ikonkali variant (`.el-viewtoggle` 10 px). */
const OPTION_PADDING: Record<SegmentedControlSize, { text: string; icon: string }> = {
  md: { text: "px-3", icon: "px-2.5" },
  sm: { text: "px-2.5", icon: "px-2" },
};

/**
 * Kenglik rejimlari. To'liq enli bo'lsa variantlar teng (`flex-1`) va yon
 * oraliq 8 px (maket telefonda `padding: 0 8px`). Joy yetmasa (ruscha uzun
 * yorliqlar, tor ekran) variant torayadi va yorlig'i «…» bilan kesiladi —
 * sahifada gorizontal skroll paydo bo'lmaydi; to'liq nom ekran o'quvchida
 * qoladi. Bir xususiyatga ikki klass tushmasin (`cx` birlashtirmaydi) —
 * oraliq rejimga qarab bitta tanlanadi.
 */
const WIDTH = {
  always: { track: "flex w-full", option: "min-w-0 flex-1" },
  phone: { track: "inline-flex max-md:flex max-md:w-full", option: "max-md:min-w-0 max-md:flex-1 max-md:px-2" },
  never: { track: "inline-flex", option: "" },
} as const;

/** ← → ↑ ↓ Home End: keyingi faol variant indeksi, aylanma. */
const nextIndex = (key: string, current: number, total: number): number | null => {
  if (total === 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (current + 1) % total;
    case "ArrowLeft":
    case "ArrowUp":
      return (current - 1 + total) % total;
    case "Home":
      return 0;
    case "End":
      return total - 1;
    default:
      return null;
  }
};

/**
 * Segment (`.el-seg`):
 *
 *   <SegmentedControl ariaLabel={t("…period")} value={period} onValueChange={setPeriod}
 *     options={[{ value: "today", label: t("…today") }, …]} />
 */
export const SegmentedControl = <T extends string = string>({
  options,
  value,
  onValueChange,
  ariaLabel,
  size = "md",
  fullWidth = "phone",
  className,
  onKeyDown: onKeyDownProp,
  ...rest
}: SegmentedControlProps<T>) => {
  const mode = fullWidth === true ? "always" : fullWidth === "phone" ? "phone" : "never";
  const width = WIDTH[mode];
  const enabled = options.filter((option) => !option.disabled);
  // Roving tabindex: guruhga Tab bilan kirilganda fokus tanlangan variantga tushadi.
  const focusValue = enabled.some((option) => option.value === value) ? value : enabled[0]?.value;

  const select = (next: T) => {
    if (next !== value) onValueChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDownProp?.(event);
    if (event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    const current = enabled.findIndex((option) => option.value === target.dataset.value);
    if (current === -1) return;
    const index = nextIndex(event.key, current, enabled.length);
    if (index === null) return;
    event.preventDefault();
    const next = enabled[index];
    const radios = event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
    Array.from(radios)
      .find((radio) => radio.dataset.value === next.value)
      ?.focus();
    select(next.value);
  };

  return (
    <div
      {...rest}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cx("max-w-full", width.track, TRACK[size], className)}
    >
      {options.map((option) => {
        const checked = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            data-value={option.value}
            tabIndex={option.value === focusValue ? 0 : -1}
            disabled={option.disabled}
            onClick={() => select(option.value)}
            className={cx(
              OPTION_BASE,
              OPTION_SIZE[size],
              mode === "always" ? "px-2" : OPTION_PADDING[size][Icon ? "icon" : "text"],
              width.option,
            )}
          >
            {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
            <span className="min-w-0 truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};

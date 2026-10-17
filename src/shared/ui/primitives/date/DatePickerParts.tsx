import { useId, type KeyboardEvent, type ReactNode } from "react";
import { Calendar as CalendarIcon, ChevronDown, ChevronUp, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../lib/cx";
import { ButtonIcon } from "../Button";
import { useFieldControl } from "../fieldContext";
import { IconButton } from "../IconButton";
import { getFocusableElements } from "../overlay/focusable";
import { Portal } from "../overlay/Portal";
import type { PopoverSide } from "../overlay/usePopover";
import type { DatePickerState } from "./useDatePicker";

/**
 * SANA TANLAGICHLARI UMUMIY QISMI — `DateRange` va `DateInput` uchun (holat — `useDatePicker.ts`):
 *   `DateTrigger`   — maydon tugmasi (`.el-input.el-select` + `Calendar` ikonka, tozalash ×);
 *   `DatePickerLayer` — desktop/planshetda maydon ostidagi popover, telefonda pastki varaqa (`.el-sheet`).
 */

/* ─── Maydon tugmasi ──────────────────────────────────────────────────────────────────────────── */

/**
 * `.el-input.el-select` (yopiq holat) — `CODE-MAP` 2.2: `INPUT flex cursor-pointer items-center
 * justify-between gap-2 text-left`. Fokus va ochiq holat maydondagidek: `action` chegara + 3 px
 * `focus` halqa, ORALIQSIZ (`tizim-motion` 05 «Maydonlarda»), shuning uchun global kontur `outline-none!`.
 */
const TRIGGER_BASE =
  "flex h-10 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-[10px] border bg-input px-3 " +
  "text-left text-base text-text outline-none! md:text-sm max-md:h-11 " +
  "transition-[background-color,border-color,color,box-shadow] duration-150 motion-reduce:transition-none " +
  "focus-visible:ring-3 disabled:cursor-not-allowed disabled:bg-sunken disabled:text-text-subtle";

const triggerState = ({ open, invalid, disabled }: { open: boolean; invalid: boolean; disabled: boolean }) =>
  invalid
    ? cx("border-danger focus-visible:ring-danger-soft", open && "ring-3 ring-danger-soft")
    : open
      ? "border-action ring-3 ring-focus"
      : cx("border-border-strong focus-visible:border-action focus-visible:ring-focus", !disabled && "hover:border-text-subtle");

export type DateTriggerProps = {
  picker: Pick<DatePickerState, "open" | "toggle" | "triggerRef" | "anchorRef" | "panelId">;
  /** Ko'rinadigan matn (qiymat yoki namuna). */
  text: string;
  /** Qiymat bo'shmi (namuna `text-subtle`). */
  empty: boolean;
  /** Ekran o'quvchi uchun qiymat («01.10.2026 dan 08.10.2026 gacha»). */
  spoken: string;
  /** `Field` siz nom («Sana oralig'i») — `aria-label` = «nom: qiymat». */
  ariaLabel: string;
  /** × tugmasi (qiymat bo'lsa): nomi va amali. */
  clearLabel: string;
  onClear?: () => void;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  /**
   * Ichki yorliq (yorlig'i yashirin filtr, maket `superadmin-returns-list`: «Sana: Barchasi») — ikonkadan keyin
   * kulrang «Sana:», ekran o'quvchidan yashirin (nomi `Field` yorlig'idan). `Select` `inlineLabel` bilan bir xil;
   * bo'lsa bo'sh qiymat matni (`Barchasi`) `text-subtle` emas. Sukut — yo'q.
   */
  inlineLabel?: string;
};

/**
 * Maydon tugmasi: chapda `Calendar` (18, `text-subtle`), qiymat yoki namuna, o'ngda `ChevronDown`
 * (ochiq — `ChevronUp`, `action-fg`). Qiymat bo'lsa chevron o'rnida × (`IconButton sm`, maketdagi
 * «Tanlangan · tozalash»). Nomi: `Field` ichida — yorliq + qiymat (`aria-labelledby`), aks holda
 * `aria-label` «Sana oralig'i: 01.10.2026 dan 08.10.2026 gacha» (maket `superadmin-orders-filters-mobile`).
 */
export const DateTrigger = ({
  picker,
  text,
  empty,
  spoken,
  ariaLabel,
  clearLabel,
  onClear,
  id,
  invalid,
  disabled,
  required,
  className,
  triggerClassName,
  inlineLabel,
}: DateTriggerProps) => {
  const { t } = useTranslation("ui");
  const field = useFieldControl({ id, invalid, disabled, required });
  const valueId = useId();
  const requiredId = useId();
  // Majburiylik: `aria-required` `button` rolida yo'q (ARIA 1.2; ekran o'quvchi uni o'qimaydi, axe
  // `aria-allowed-attr`) — yorliqdagi `*` esa `aria-hidden`. Shuning uchun «majburiy» tavsif sifatida beriladi.
  const describedBy = [field["aria-describedby"], field["aria-required"] ? requiredId : null].filter(Boolean).join(" ") || undefined;
  const { open, toggle, triggerRef, anchorRef, panelId } = picker;
  const canClear = Boolean(onClear) && !empty && !field.disabled && !field.readOnly;
  const labelled = Boolean(field.labelId);

  return (
    <div ref={anchorRef} className={cx("relative flex min-w-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={field.id}
        disabled={field.disabled || field.readOnly}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-labelledby={labelled ? `${field.labelId} ${valueId}` : undefined}
        aria-label={labelled ? undefined : `${ariaLabel}: ${spoken}`}
        aria-describedby={describedBy}
        aria-invalid={field["aria-invalid"]}
        aria-errormessage={field["aria-errormessage"]}
        data-invalid={field.invalid || undefined}
        onClick={toggle}
        className={cx(
          TRIGGER_BASE,
          triggerState({ open, invalid: field.invalid, disabled: field.disabled }),
          canClear && "pr-11 max-md:pr-12",
          triggerClassName,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ButtonIcon icon={CalendarIcon} px={18} className="text-text-subtle" />
          {inlineLabel ? (
            <span aria-hidden="true" data-date-inline-label="" className="shrink-0 whitespace-nowrap text-text-muted">
              {`${inlineLabel}:`}
            </span>
          ) : null}
          <span aria-hidden="true" className={cx("truncate", empty && !inlineLabel && "text-text-subtle")}>
            {text}
          </span>
          <span id={valueId} className="sr-only">
            {spoken}
          </span>
          {field["aria-required"] ? (
            <span id={requiredId} className="sr-only">
              {t("date.required")}
            </span>
          ) : null}
        </span>
        {canClear ? null : (
          <ButtonIcon
            icon={open ? ChevronUp : ChevronDown}
            px={16}
            className={open ? "text-action-fg" : "text-text-subtle"}
          />
        )}
      </button>
      {canClear ? (
        <IconButton
          label={clearLabel}
          icon={X}
          size="sm"
          className="absolute top-1/2 right-1 -translate-y-1/2 text-text-subtle max-md:right-0"
          onClick={() => {
            onClear?.();
            triggerRef.current?.focus({ preventScroll: true });
          }}
        />
      ) : null}
    </div>
  );
};

/* ─── Popover / pastki varaqa ─────────────────────────────────────────────────────────────────── */

/** Desktop panelida Tab aylanadi (modal emas, lekin portalda — Tab sahifa oxiriga qochmasin). */
const cycleTab = (event: KeyboardEvent<HTMLDivElement>) => {
  if (event.key !== "Tab" || event.defaultPrevented) return;
  const items = getFocusableElements(event.currentTarget);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

/** `--dur-menu` 200 ms: shaffoflik + 4 px siljish (`tizim-motion` 01), kirish egri chizig'i. */
const POPOVER_MOTION: Record<PopoverSide, string> = {
  bottom:
    "transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.2,0,0,1)] starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none",
  top: "transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.2,0,0,1)] starting:translate-y-1 starting:opacity-0 motion-reduce:transition-none",
};

export type DatePickerLayerProps = {
  picker: Pick<
    DatePickerState,
    "phone" | "open" | "close" | "panelId" | "anchorRef" | "floatingRef" | "floatingStyles" | "side" | "sheetRef"
  >;
  /** Oyna nomi: «Sana oralig'ini tanlash» (desktop `aria-label`, telefonda varaqa sarlavhasi). */
  label: string;
  /**
   * Panel mazmuni. `surface` — desktop popover'da o'z yuzasi (`raised`), telefonda varaqa ichida
   * yuzasiz (`plain`); `months` — telefonda 1.
   */
  children: (layout: { phone: boolean }) => ReactNode;
  /** Desktop popover kengligi (`w-[652px]` — ikki oy, `w-[300px]` — bitta). */
  popoverClassName?: string;
};

/**
 * Desktop/planshet: maydon ostida `dropdown` qatlamidagi popover (`.el-cal`, `RAISED`), joy bo'lmasa —
 * tepaga ag'dariladi. Telefon: `overlay` qatlamida fon + pastki varaqa (`.el-sheet`: tutqich, sarlavha,
 * «Yopish»), `max-h-[92dvh]`, pastdan siljib chiqadi (250 ms).
 */
export const DatePickerLayer = ({ picker, label, children, popoverClassName }: DatePickerLayerProps) => {
  const { t } = useTranslation("ui");
  const titleId = useId();
  const { phone, open, close, panelId, anchorRef, floatingRef, floatingStyles, side, sheetRef } = picker;
  if (!open) return null;

  if (!phone) {
    return (
      <Portal layer="dropdown" anchor={anchorRef}>
        <div
          ref={floatingRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          style={floatingStyles}
          onKeyDown={cycleTab}
          className={cx(
            "overflow-y-auto overscroll-contain rounded-[14px] border border-border bg-raised p-3 text-text shadow-xl",
            POPOVER_MOTION[side],
            popoverClassName,
          )}
        >
          {children({ phone: false })}
        </div>
      </Portal>
    );
  }

  return (
    <Portal layer="overlay">
      <div className="fixed inset-0 flex items-end">
        {/* Fon — sichqoncha/teginish uchun (klaviaturada Esc va «Yopish»). */}
        <div
          aria-hidden="true"
          onClick={() => close(true)}
          className="absolute inset-0 bg-overlay transition-opacity duration-250 starting:opacity-0 motion-reduce:transition-none"
        />
        <div
          ref={sheetRef}
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cx(
            "relative flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-[20px] border border-b-0 border-border bg-raised",
            "px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-text shadow-xl",
            "transition-transform duration-250 ease-[cubic-bezier(0.2,0,0,1)] starting:translate-y-full motion-reduce:transition-none",
          )}
        >
          <div aria-hidden="true" className="mx-auto mt-1 h-1 w-10 shrink-0 rounded-full bg-border-strong" />
          <div className="-my-1 -mr-2 flex shrink-0 items-center justify-between gap-3">
            <h2 id={titleId} className="min-w-0 text-base font-bold text-text">
              {label}
            </h2>
            <IconButton size="lg" label={t("date.close")} icon={X} onClick={() => close(true)} />
          </div>
          {children({ phone: true })}
        </div>
      </div>
    </Portal>
  );
};

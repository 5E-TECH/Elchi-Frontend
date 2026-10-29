import { memo, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../lib/cx";
import { formatNumberLocalized } from "../lib/formatMoney";
import { Button, type ButtonSize } from "../ui/primitives/Button";
import { Dialog } from "../ui/primitives/Dialog";
import { IconButton, type IconButtonVariant } from "../ui/primitives/IconButton";
import { useIsPhone } from "../ui/primitives/date/useIsPhone";
import { Portal } from "../ui/primitives/overlay/Portal";
import { useDismiss } from "../ui/primitives/overlay/useDismiss";
import { usePopover } from "../ui/primitives/overlay/usePopover";

/**
 * CHOP ETISH MENYUSI — eski API, ichi dizayn v2 (`.el-btn-secondary` + `.el-tab-count` + `.el-menu`,
 * maketlar `superadmin-mails-detail`, `courier-mails-detail-print-menu`, `superadmin-neworders-market-orders`).
 *
 * WAI-ARIA «menu button»: tugma `aria-haspopup="menu"`; ochilganda fokus birinchi bandda, ↑ ↓ (aylanma)
 * Home End — yurish, Enter / Probel — tanlash, Esc — yopadi va fokus tugmaga qaytadi, Tab — yopadi.
 * Menyu `Portal` da (`dropdown` qatlami), tugma ostida (sig'masa — tepada), tashqariga bosish yopadi.
 *
 *   variant="header" — «Chop etish» + tanlanganlar soni + `ChevronDown` (soni 0 bo'lsa o'chiq);
 *   variant="icon"   — jadval qatoridagi `Printer` ikonka tugma (bitta buyurtma).
 *
 * `className` — faqat joylashuv (o'ram uchun); eski rang klasslari v2 tugmaga qo'yilmaydi.
 *
 * Qo'shimcha (ixtiyoriy, sukut o'zgarmaydi):
 *  - `sheetTitle` / `sheetDescription` — berilsa, telefonda (< 768) menyu o'rniga PASTKI VARAQA (`Dialog`):
 *    sarlavha, izoh va bandlar ro'yxati (maket `courier-mails-detail-print-menu`). Kompyuterda — oddiy menyu;
 *  - `hideCount` — `header` tugmasida son yo'q («Barchasini chop etish», maket `courier-mails-detail-refused`);
 *  - `ariaLabel` — tugma nomi (maket: «Barcha 5 ta buyurtma yorlig'ini chop etish»);
 *  - `iconSize` / `iconVariant` — `icon` tugmasi o'lchami va ko'rinishi (kuryer kartasi: `lg`, chegarali);
 *  - `compact` — `header` tugmasi ixcham (`Button compact`; tor qatorda, maket `courier-mails-detail-receive` telefon);
 *  - `loading` — chop etish fayli tayyorlanmoqda: tugmada spinner, menyu ochilmaydi (HJ5sLHiz);
 *  - `onOpen` — menyu (varaqa) ochilganda: chop etish modulini oldindan yuklash uchun;
 *  - `allowEmpty` — `header`: hech narsa tanlanmaganda (soni 0) ham tugma faol — tanlovsiz ishlaydigan band bor
 *    (pochta tafsilotida «Pochta cheki», HJ5sLHiz); tanlov kerak bo'lgan bandlar `disabled`.
 *
 * Band `disabled` — `aria-disabled` (WAI-ARIA: fokuslanadi, lekin tanlanmaydi), xira; izohida nega o'chiqligi.
 */
export type PrintSelectOption = {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  /** Hozir tanlab bo'lmaydi (masalan, buyurtma tanlanmagan) — ko'rinadi, lekin bosilmaydi. */
  disabled?: boolean;
};

type Props = {
  variant?: "header" | "icon";
  count?: number;
  disabled?: boolean;
  onSelect: (mode: string) => void;
  /** Joylashuv klassi (o'ram). */
  className?: string;
  buttonLabel?: string;
  /** Menyu nomi (`aria-label`). */
  menuLabel?: string;
  /** Menyu sarlavhasi (`.el-menu-label`); sukut — «N ta tanlangan» (faqat `header`). */
  menuTitle?: ReactNode;
  options: PrintSelectOption[];
  /** Telefondagi pastki varaqa sarlavhasi — berilsa, < 768 da menyu o'rniga varaqa ochiladi. */
  sheetTitle?: ReactNode;
  /** Varaqa izohi («2 ta tanlangan buyurtma yorlig'i chop etiladi»). */
  sheetDescription?: ReactNode;
  /** `header`: tugmada son ko'rsatilmaydi. */
  hideCount?: boolean;
  /** Tugmaning ekran o'quvchi nomi (ko'rinadigan matn o'rniga). */
  ariaLabel?: string;
  /** `icon` tugmasi o'lchami (sukut `sm`). */
  iconSize?: ButtonSize;
  /** `icon` tugmasi ko'rinishi (sukut `ghost`). */
  iconVariant?: IconButtonVariant;
  /** `header`: ixcham tugma (kichikroq chekka va ikonka). */
  compact?: boolean;
  /** Chop etish ketmoqda — tugma `loading`, menyu ochilmaydi. */
  loading?: boolean;
  /** Menyu ochilganda (oldindan yuklash). */
  onOpen?: () => void;
  /** `header`: soni 0 bo'lsa ham tugma faol (tanlovsiz ishlaydigan band bor). */
  allowEmpty?: boolean;
};

/** Varaqadagi band (`.el-menu-item` + o'ngda `ChevronRight`, maket `courier-mails-detail-print-menu`). */
const SHEET_ITEM =
  "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left text-sm text-text outline-none " +
  "transition-[background-color] duration-150 hover:bg-sunken focus-visible:bg-sunken motion-reduce:transition-none";

/** `.el-menu-item` (2 qatorli: nom + izoh), telefonda ≥ 44 px. */
const MENU_ITEM =
  "flex min-h-14 w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-text outline-none " +
  "transition-[background-color] duration-150 hover:bg-sunken focus-visible:bg-sunken motion-reduce:transition-none";

/** O'chiq band (`aria-disabled`): xira, bosilmaydi; fokus ko'rinadi (klaviatura bilan o'tib ketiladi). */
const ITEM_DISABLED = "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent";

const PrintModeSelect = ({
  variant = "header",
  count = 0,
  disabled = false,
  onSelect,
  className,
  buttonLabel,
  menuLabel,
  menuTitle,
  options,
  sheetTitle,
  sheetDescription,
  hideCount = false,
  ariaLabel,
  iconSize = "sm",
  iconVariant,
  compact = false,
  loading = false,
  onOpen,
  allowEmpty = false,
}: Props) => {
  const { t, i18n } = useTranslation("ui");
  const isPhone = useIsPhone();
  const asSheet = isPhone && sheetTitle != null;
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([]);
  /** Ochilganda qaysi bandga fokus (`first` — Enter/↓/bosish, `last` — ↑). */
  const focusTargetRef = useRef<"first" | "last">("first");
  const { anchorRef, floatingRef, floatingStyles, side, isPositioned } = usePopover<HTMLButtonElement, HTMLDivElement>({
    open: open && !asSheet,
    placement: variant === "icon" ? "bottom-end" : "bottom-start",
  });

  const label = buttonLabel ?? t("printMenu.button");
  const triggerDisabled =
    disabled ||
    options.length === 0 ||
    options.every((option) => option.disabled) ||
    (variant === "header" && count === 0 && !allowEmpty);
  const title = menuTitle ?? (variant === "header" && count > 0 ? t("printMenu.count", { count }) : null);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) anchorRef.current?.focus({ preventScroll: true });
  };

  const openWith = (target: "first" | "last") => {
    if (loading) return;
    focusTargetRef.current = target;
    setOpen(true);
    onOpen?.();
  };

  useDismiss({ open: open && !asSheet, refs: [anchorRef, floatingRef], onDismiss: () => close(false) });

  // Ochilganda fokus menyu ichiga (WAI-ARIA menu button). Joylashuv hisoblanguncha menyu `visibility: hidden`
  // (`usePopover`) — yashirin elementga `focus()` o'tmaydi, shuning uchun `isPositioned` dan keyin.
  useLayoutEffect(() => {
    if (!open || !isPositioned) return;
    const items = itemsRef.current.filter((item): item is HTMLButtonElement => Boolean(item));
    // Birinchi (oxirgi) faol bandga; o'chiq bandlar fokuslanadi, lekin ochilganda ulardan boshlanmaydi.
    const enabled = items.filter((item) => item.getAttribute("aria-disabled") !== "true");
    const pool = enabled.length ? enabled : items;
    (focusTargetRef.current === "last" ? pool[pool.length - 1] : pool[0])?.focus({ preventScroll: true });
  }, [open, isPositioned]);

  const isDisabled = (mode: string) => options.some((option) => option.id === mode && option.disabled);

  const pick = (mode: string) => {
    if (isDisabled(mode)) return;
    onSelect(mode);
    close(true);
  };

  // Varaqa: `Dialog` o'zi fokusni ochgan tugmaga qaytaradi.
  const pickFromSheet = (mode: string) => {
    if (isDisabled(mode)) return;
    onSelect(mode);
    setOpen(false);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openWith(event.key === "ArrowUp" ? "last" : "first");
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = itemsRef.current.filter((item): item is HTMLButtonElement => Boolean(item));
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (index: number) => items[(index + items.length) % items.length]?.focus();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(current + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(current === -1 ? items.length - 1 : current - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(items.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case "Tab":
        // Menyu portalda (sahifa oxirida): fokus avval tugmaga qaytadi, keyin brauzerning o'zi Tab'ni
        // undan keyingi (Shift — oldingi) elementga o'tkazadi (`preventDefault` yo'q) — WAI-ARIA menu button.
        close(true);
        break;
      default:
        break;
    }
  };

  const triggerAria = {
    "aria-haspopup": asSheet ? ("dialog" as const) : ("menu" as const),
    "aria-expanded": open,
    "aria-controls": open && !asSheet ? menuId : undefined,
  };

  return (
    <div className={cx("relative inline-flex", className)}>
      {variant === "header" ? (
        <Button
          ref={anchorRef}
          variant="secondary"
          compact={compact}
          disabled={triggerDisabled}
          loading={loading}
          aria-label={ariaLabel}
          {...triggerAria}
          onClick={() => (open ? close(false) : openWith("first"))}
          onKeyDown={onTriggerKeyDown}
          leftIcon={Printer}
          rightIcon={open ? ChevronUp : ChevronDown}
          // Ochiq menyu — bosilgan ko'rinish (maket `courier-mails-detail-print-menu`: tugma foni `sunken`).
          className="w-full aria-expanded:bg-sunken"
        >
          {label}
          {hideCount ? null : (
            <span
              className={cx(compact ? "ml-1.5" : "ml-2", "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-action-soft px-1.5 align-middle text-xs font-semibold text-action-fg")}
            >
              {formatNumberLocalized(count, { language: i18n.resolvedLanguage ?? i18n.language })}
            </span>
          )}
        </Button>
      ) : (
        <IconButton
          ref={anchorRef}
          label={ariaLabel ?? label}
          icon={Printer}
          size={iconSize}
          variant={iconVariant}
          disabled={triggerDisabled}
          loading={loading}
          {...triggerAria}
          onClick={() => (open ? close(false) : openWith("first"))}
          onKeyDown={onTriggerKeyDown}
        />
      )}

      {asSheet ? (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title={sheetTitle}
          description={sheetDescription}
          size="sm"
        >
          <div
            role="menu"
            aria-label={menuLabel ?? t("printMenu.menu")}
            className="flex flex-col overflow-hidden rounded-xl border border-border"
          >
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                aria-disabled={option.disabled ? true : undefined}
                onClick={() => pickFromSheet(option.id)}
                className={cx(SHEET_ITEM, ITEM_DISABLED, "border-b border-border last:border-b-0")}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
                >
                  {option.icon}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold text-text">{option.label}</span>
                  {option.hint ? <span className="text-[13px] text-text-muted">{option.hint}</span> : null}
                </span>
                <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-text-subtle" />
              </button>
            ))}
          </div>
        </Dialog>
      ) : open ? (
        <Portal layer="dropdown" anchor={anchorRef}>
          <div
            ref={floatingRef}
            id={menuId}
            role="menu"
            aria-label={menuLabel ?? t("printMenu.menu")}
            style={floatingStyles}
            data-side={side}
            onKeyDown={onMenuKeyDown}
            className={cx(
              "flex w-[min(296px,calc(100vw-32px))] flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-xl",
              "border border-border bg-raised p-1.5 shadow-xl transition-[opacity,translate] duration-200 ease-out",
              "starting:opacity-0 motion-reduce:transition-none",
              side === "top" ? "starting:translate-y-1" : "starting:-translate-y-1",
            )}
          >
            {title ? (
              <div role="presentation" className="px-2.5 pb-0.5 pt-1.5 text-xs font-semibold text-text-muted">
                {title}
              </div>
            ) : null}
            {options.map((option, index) => (
              <button
                key={option.id}
                ref={(element) => {
                  itemsRef.current[index] = element;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={option.disabled ? true : undefined}
                onClick={() => pick(option.id)}
                className={cx(MENU_ITEM, ITEM_DISABLED)}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
                >
                  {option.icon}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold text-text">{option.label}</span>
                  {option.hint ? <span className="text-xs text-text-muted">{option.hint}</span> : null}
                </span>
              </button>
            ))}
          </div>
        </Portal>
      ) : null}
    </div>
  );
};

export default memo(PrintModeSelect);

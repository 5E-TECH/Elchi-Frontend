import type { ComponentProps, MouseEvent } from "react";
import { cx } from "../../lib/cx";
import { ButtonIcon, type ButtonSize, type IconPx, type IconSlot } from "./Button";
import { Spinner, type SpinnerSize } from "./Spinner";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  IKONKA TUGMA — dizayn v2 (`.el-iconbtn`, `design/CODE-MAP.md` 2.1, taxta `tizim-states-buttons`)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Matnsiz tugma: asboblar paneli, karta sarlavhasi, jadval qatori. Nomi (`label`) MAJBURIY —
 *  `aria-label` va ustiga kelgandagi maslahat (`title`) shundan. Nomi tushunarsiz bo'lsa —
 *  ikonka va matnli `Button`.
 *
 *  Turlar:
 *    ghost     — sukut (`.el-iconbtn`): fonsiz, `text-muted`, hover'da `sunken`;
 *    secondary — chegarali (`.el-iconbtn-bordered`), matnli tugmalar yonida;
 *    primary   — to'liq ko'k (kamdan-kam: ekrandagi bosh amal ikonka bo'lsa);
 *    danger    — qizil ikonka, hover'da yumshoq qizil fon (`.el-menu-item-danger` kabi).
 *                Tinch holatda to'liq qizil fon ikonka tugmada YO'Q: maket qoidasi — to'liq qizil
 *                faqat tasdiqlash oynasida va aniq fe'lli matn bilan;
 *    danger-soft — yumshoq qizil fon doim (`.el-iconbtn` + `.el-btn-danger-soft`): ro'yxat qatoridan
 *                olib tashlash (maket `*-orders-detail-edit-order-dialog` — mahsulot qatori); hover va
 *                bosilganda `Button variant="danger-soft"` dagidek to'liq qizil + `on-solid`.
 *
 *  O'lchamlar: sm 32 (r 8, ikonka 16) · md 40 (sukut; r 10, ikonka 20) · lg 44 (r 12, ikonka 22).
 *  Telefonda (< 768) har o'lcham 44×44.
 */

export type IconButtonVariant = "ghost" | "secondary" | "primary" | "danger" | "danger-soft";

/** Fokus halqasi, fokusdagi burchak va kursor — `Button.tsx` dagi BASE izohiga qarang. */
const BASE =
  "inline-flex shrink-0 items-center justify-center border " +
  "transition-[background-color,border-color,color,box-shadow,opacity] duration-150 motion-reduce:transition-none max-md:size-11 " +
  "not-aria-busy:disabled:cursor-not-allowed not-aria-busy:disabled:opacity-45 aria-busy:cursor-progress";

/** Hover/bosilgan — `not-disabled:not-aria-busy:` (yuklanayotgan tugma rangi qotadi). */
const VARIANT: Record<IconButtonVariant, string> = {
  ghost:
    "border-transparent bg-transparent text-text-muted not-disabled:not-aria-busy:hover:bg-sunken " +
    "not-disabled:not-aria-busy:hover:text-text not-disabled:not-aria-busy:active:bg-border " +
    "not-disabled:not-aria-busy:active:text-text",
  secondary:
    "border-border-strong bg-surface text-text-muted not-disabled:not-aria-busy:hover:bg-sunken " +
    "not-disabled:not-aria-busy:hover:text-text not-disabled:not-aria-busy:active:bg-border " +
    "not-disabled:not-aria-busy:active:text-text",
  primary:
    "border-transparent bg-action text-on-solid not-disabled:not-aria-busy:hover:bg-action-hover " +
    "not-disabled:not-aria-busy:active:bg-action-hover not-disabled:not-aria-busy:active:inset-shadow-sm " +
    "not-disabled:not-aria-busy:active:inset-shadow-overlay/40",
  danger:
    "border-transparent bg-transparent text-danger-fg not-disabled:not-aria-busy:hover:bg-danger-soft " +
    "not-disabled:not-aria-busy:active:bg-danger-soft",
  "danger-soft":
    "border-transparent bg-danger-soft text-danger-fg not-disabled:not-aria-busy:hover:bg-danger " +
    "not-disabled:not-aria-busy:hover:text-on-solid not-disabled:not-aria-busy:active:bg-danger " +
    "not-disabled:not-aria-busy:active:text-on-solid",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "size-8 rounded-lg",
  md: "size-10 rounded-[10px]",
  lg: "size-11 rounded-xl",
};

/** Ikonka o'lchami (maket: sm 16, md 20, lg 22). */
const ICON_PX: Record<ButtonSize, IconPx> = { sm: 16, md: 20, lg: 22 };

/** Ikonka qutisi — spinner shu qutida, tugma o'lchami o'zgarmaydi. */
const ICON_BOX: Record<ButtonSize, string> = { sm: "size-4", md: "size-5", lg: "size-[22px]" };

/** Spinner (maket: `.el-spinner` 16; katta tugmada 18). */
const SPINNER_SIZE: Record<ButtonSize, SpinnerSize> = { sm: "sm", md: "sm", lg: "md" };

/** Yuklanish atributlari (`Button` dagidek: `disabled` emas — fokus saqlanadi). */
const BUSY_ATTRS = { "aria-busy": true, "aria-disabled": true } as const;

/** Yuklanayotgan tugma bosilsa: `onClick` chaqirilmaydi, forma yuborilmaydi. */
const blockWhileBusy = (event: MouseEvent<HTMLButtonElement>) => {
  event.preventDefault();
};

export type IconButtonProps = Omit<ComponentProps<"button">, "children" | "aria-label" | "title"> & {
  /**
   * Tugma nomi — MAJBURIY (DESIGN_SYSTEM §9: faqat ikonkali tugmada `aria-label` majburiy).
   * `aria-label` va `title` (maslahat) shundan olinadi. Fe'l bilan: «Yangilash», «Chek chop etish».
   */
  label: string;
  /** Ikonka: lucide komponenti (`RefreshCw`) yoki element. Doim `aria-hidden`. */
  icon: IconSlot;
  variant?: IconButtonVariant;
  size?: ButtonSize;
  /**
   * Yuklanmoqda: spinner ikonka o'rnida, `aria-busy` + `aria-disabled` (fokus tugmada qoladi),
   * rang saqlanadi, `onClick` chaqirilmaydi.
   */
  loading?: boolean;
  /**
   * Yuklanish paytidagi nom (`aria-label` + `title`): maketdagi «Yangilanmoqda», «Chek tayyorlanmoqda».
   * Berilmasa — `label` qoladi.
   */
  loadingLabel?: string;
};

/**
 * Dizayn v2 ikonka tugmasi.
 *
 *   <IconButton label={t("common.refresh")} icon={RefreshCw} onClick={refetch}
 *     loading={isFetching} loadingLabel={t("common.refreshing")} />
 *   <IconButton variant="secondary" label={t("orders.printReceipt")} icon={Printer} />
 */
export const IconButton = ({
  label,
  icon,
  variant = "ghost",
  size = "md",
  loading = false,
  loadingLabel,
  disabled,
  type = "button",
  className,
  onClick,
  ...rest
}: IconButtonProps) => {
  if (import.meta.env.DEV && !label?.trim()) {
    console.error("IconButton: `label` majburiy — u aria-label va maslahat (title) bo'ladi.");
  }

  const name = loading && loadingLabel ? loadingLabel : label;

  return (
    <button
      {...rest}
      type={type}
      aria-label={name}
      title={name}
      disabled={disabled}
      {...(loading ? BUSY_ATTRS : null)}
      onClick={loading ? blockWhileBusy : onClick}
      data-variant={variant}
      data-size={size}
      className={cx(BASE, VARIANT[variant], SIZE[size], className)}
    >
      {loading ? (
        <span aria-hidden="true" className={cx("inline-flex shrink-0 items-center justify-center", ICON_BOX[size])}>
          <Spinner size={SPINNER_SIZE[size]} />
        </span>
      ) : (
        <ButtonIcon icon={icon} px={ICON_PX[size]} />
      )}
    </button>
  );
};

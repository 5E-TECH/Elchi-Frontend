import { isValidElement, type ComponentProps, type ComponentType, type MouseEvent, type ReactNode } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { cx } from "../../lib/cx";
import { Spinner, type SpinnerSize } from "./Spinner";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  TUGMA — dizayn v2 (`.el-btn`, `design/CODE-MAP.md` 2.1, taxta `tizim-states-buttons`)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Turlar (maketdagi 8 tur):
 *    primary     — ekrandagi BITTA bosh amal (sarlavhada o'ngda yoki oyna oxirida);
 *    secondary   — yuklash, chop etish, filtr, «Bekor qilish»;
 *    ghost       — tozalash, orqaga, «Yana ko'rsatish»;
 *    link        — matn ichida yoki karta oxirida, joyida amal bajaradi
 *                  (boshqa sahifaga olib borsa — `<Link className={buttonClasses({ variant: "link" })}>`);
 *    success     — faqat sotish va pul tasdig'i;
 *    danger      — to'liq qizil, FAQAT tasdiqlash oynasi ichida;
 *    danger-soft — jadval qatori, menyu, pastki panel (hover'da to'liq qizil);
 *    success-soft — kuryer ro'yxatidagi «Sotish» (jadval qatori, telefon kartasi; maket `courier-orders-*`:
 *                  `.el-btn` + `success-soft` fon, `success-fg` matn; hover'da to'liq yashil).
 *
 *  O'lchamlar: sm 32 (r 8, 13px, ikonka 16) · md 40 (sukut; r 10, 14px, ikonka 18) ·
 *  lg 48 (r 12, 15px, ikonka 18). Telefonda (< 768) har o'lcham kamida 44px.
 *  Ixcham (`compact`): ichki oraliq 12 (sm 10), ikonka 16, oraliq 6 — maket `*-orders-list`
 *  sarlavhasidagi juftlik («Excelga yuklash» + «Buyurtma yaratish» 390px da bir qatorga sig'adi).
 *
 *  Holatlar: hover, `:active` (bosilgan), fokus — global `:focus-visible` halqasi
 *  (`index.css`, 2px `action`, 2px oraliq; yashil/qizilda ham ko'k), yuklanmoqda
 *  (rang saqlanadi, spinner ikonka o'rnida, `aria-busy` + `aria-disabled`, qayta bosilmaydi,
 *  fokus tugmada QOLADI — maketdagidek `disabled` emas), o'chirilgan (`disabled`, 45% shaffof).
 *  Hover/bosilgan uslublari `not-disabled:not-aria-busy:` bilan — o'chirilgan va yuklanayotgan
 *  tugma ustiga kelganda o'zgarmaydi.
 *
 *  To'liq yashil va qizil fon — `bg-success` / `bg-danger` + `on-solid` matn (maketdagi
 *  `.el-btn-success/-danger`). Tungi holat ranglari maketdagidek ochiq, shuning uchun
 *  ikkala mavzuda AA: kunduzgi 6.1 / 5.9, tungi 8.7 / 7.1 (≥ 4.5:1).
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "link"
  | "success"
  | "danger"
  | "danger-soft"
  | "success-soft";
export type ButtonSize = "sm" | "md" | "lg";

/** Ikonka: lucide komponenti (`Plus`) yoki tayyor element (`<Plus />`). Har doim `aria-hidden`. */
export type IconSlot = LucideIcon | ReactNode;

/**
 * Umumiy qism. Fokus halqasi bu yerda YO'Q — `index.css` dagi global `:focus-visible`
 * (maketdagi bilan bir xil: 2px `action`, 2px oraliq). `outline-none` yozilmaydi.
 * Fokusdagi burchak va sukut kursorlari `index.css` da `@layer base` ichida, shuning uchun
 * `rounded-*` va `aria-busy:cursor-progress` ularni `!` siz yutadi.
 *
 * O'tish (transition) — maketdagi ro'yxat aynan (`background-color, border-color, color,
 * box-shadow, opacity`). Tailwind `transition` / `transition-colors` `outline-color` ni ham
 * o'tkazadi: fokus halqasi 150 ms davomida matn rangidan (asosiy tugmada OQ) ko'kka
 * o'tib chiqardi. `filter` (yashil/qizil hover) maketdagidek darhol.
 */
const BASE =
  "inline-flex items-center justify-center whitespace-nowrap border font-semibold " +
  "transition-[background-color,border-color,color,box-shadow,opacity] duration-150 motion-reduce:transition-none max-md:min-h-11 " +
  "not-aria-busy:disabled:cursor-not-allowed not-aria-busy:disabled:opacity-45 aria-busy:cursor-progress";

/** Hover/bosilgan — faqat `not-disabled:not-aria-busy:` (yuklanayotgan tugma `disabled` emas, lekin rangi qotadi). */
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-action text-on-solid not-disabled:not-aria-busy:hover:bg-action-hover " +
    "not-disabled:not-aria-busy:active:bg-action-hover not-disabled:not-aria-busy:active:inset-shadow-sm " +
    "not-disabled:not-aria-busy:active:inset-shadow-overlay/40",
  secondary:
    "border-border-strong bg-surface text-text not-disabled:not-aria-busy:hover:bg-sunken " +
    "not-disabled:not-aria-busy:active:bg-border",
  ghost:
    "border-transparent bg-transparent text-text-muted not-disabled:not-aria-busy:hover:bg-sunken " +
    "not-disabled:not-aria-busy:hover:text-text not-disabled:not-aria-busy:active:bg-border " +
    "not-disabled:not-aria-busy:active:text-text",
  link:
    "border-transparent bg-transparent text-action-fg not-disabled:not-aria-busy:hover:underline " +
    "not-disabled:not-aria-busy:active:underline",
  success:
    "border-transparent bg-success text-on-solid not-disabled:not-aria-busy:hover:brightness-108 " +
    "not-disabled:not-aria-busy:active:brightness-108",
  danger:
    "border-transparent bg-danger text-on-solid not-disabled:not-aria-busy:hover:brightness-108 " +
    "not-disabled:not-aria-busy:active:brightness-108",
  "danger-soft":
    "border-transparent bg-danger-soft text-danger-fg not-disabled:not-aria-busy:hover:bg-danger " +
    "not-disabled:not-aria-busy:hover:text-on-solid not-disabled:not-aria-busy:active:bg-danger " +
    "not-disabled:not-aria-busy:active:text-on-solid",
  "success-soft":
    "border-transparent bg-success-soft text-success-fg not-disabled:not-aria-busy:hover:bg-success " +
    "not-disabled:not-aria-busy:hover:text-on-solid not-disabled:not-aria-busy:active:bg-success " +
    "not-disabled:not-aria-busy:active:text-on-solid",
};

/** Balandlik + ichki oraliq (havolada yo'q: `height:auto; padding:0 4px`). */
const BOX: Record<ButtonSize, string> = {
  sm: "h-8 px-3",
  md: "h-10 px-4",
  lg: "h-12 px-5",
};

/**
 * Ixcham: maketdagi `style="padding: 0 12px; gap: 6px"` (md, 55 joy) va `padding: 0 10px; gap: 6px` (sm).
 * lg uchun maketda namuna yo'q — bir qadam (4px) kichik.
 */
const BOX_COMPACT: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5",
  md: "h-10 px-3",
  lg: "h-12 px-4",
};

/** Shrift + radius (havola ham shu o'lchamdagi shriftni oladi; radius — fokus halqasi shakli ham). */
const TYPE: Record<ButtonSize, string> = {
  sm: "rounded-lg text-[13px]",
  md: "rounded-[10px] text-sm",
  lg: "rounded-xl text-[15px]",
};

/** Ikonka o'lchamlari (`design/icon-registry.json` → `sizes`; 24 — bo'sh holat, tugmada emas). */
export type IconPx = 16 | 18 | 20 | 22;

/** Matnli tugmadagi ikonka o'lchami (maket: sm 16, md/lg 18; ixcham — 16, lg 18). */
const BUTTON_ICON_PX: Record<ButtonSize, IconPx> = { sm: 16, md: 18, lg: 18 };
const COMPACT_ICON_PX: Record<ButtonSize, IconPx> = { sm: 16, md: 16, lg: 18 };

/** Ikonka o'rnidagi spinner (maket: `.el-spinner` 16, katta tugmada 18). */
const SPINNER_SIZE: Record<ButtonSize, SpinnerSize> = { sm: "sm", md: "sm", lg: "md" };

export type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** To'liq kenglik (telefon pastki paneli, kirish sahifasi). */
  fullWidth?: boolean;
  /**
   * Ixcham: ichki oraliq 12 (sm 10), ikonka 16, oraliq 6; balandlik o'zgarmaydi.
   * Maket: ro'yxat sahifasi sarlavhasidagi juft amal (`superadmin-orders-list`) — telefonda bir qatorga sig'adi.
   * `<Link>` da ikonkani o'zingiz 16 qiling (`<Plus size={16} />`).
   */
  compact?: boolean;
  className?: string;
};

/**
 * Tugma ko'rinishidagi klasslar — `<button>` bo'lmagan element uchun, masalan react-router `<Link>`:
 *
 *   <Link to="/orders/new" className={buttonClasses({ variant: "primary" })}>
 *     <Plus aria-hidden size={18} /> {t("orders.create")}
 *   </Link>
 *
 * Holat (yuklanish, o'chirilgan) `<a>` da yo'q: havola o'chirilmaydi, uni ko'rsatmaslik kerak.
 * Ikonka o'lchamini o'zingiz bering: sm va ixcham — 16, md/lg — 18.
 */
// eslint-disable-next-line react-refresh/only-export-components -- `<Link>` uchun klass yordamchisi tugma bilan birga turadi (CODE-MAP 2.1)
export const buttonClasses = ({
  variant = "primary",
  size = "md",
  fullWidth,
  compact,
  className,
}: ButtonClassOptions = {}) =>
  cx(
    BASE,
    VARIANT[variant],
    variant === "link" ? "px-1" : compact ? BOX_COMPACT[size] : BOX[size],
    compact ? "gap-1.5" : "gap-2",
    TYPE[size],
    fullWidth && "w-full",
    className,
  );

/** lucide komponentimi (forwardRef/memo obyekt yoki funksiya), yoki tayyor element/matnmi. */
const isIconComponent = (slot: unknown): slot is ComponentType<LucideProps> =>
  typeof slot === "function" ||
  (typeof slot === "object" && slot !== null && !isValidElement(slot) && ("render" in slot || "compare" in slot));

/** Ikonka qutisi o'lchami (px → klass). Spinner shu qutida turadi — kenglik o'zgarmaydi. */
const ICON_BOX: Record<IconPx, string> = {
  16: "size-4",
  18: "size-[18px]",
  20: "size-5",
  22: "size-[22px]",
};

export type ButtonIconProps = {
  icon: IconSlot;
  px: IconPx;
  className?: string;
};

/**
 * Tugma ichidagi ikonka (Button va IconButton uchun umumiy): har doim `aria-hidden`,
 * o'lchami qat'iy quti ichida. Element berilsa (`<Plus />`), ichidagi `svg` qutini to'ldiradi.
 */
export const ButtonIcon = ({ icon, px, className }: ButtonIconProps) => {
  if (isIconComponent(icon)) {
    const Icon = icon;
    return <Icon aria-hidden="true" focusable="false" size={px} strokeWidth={2} className={cx("shrink-0", className)} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex shrink-0 items-center justify-center [&>svg]:size-full", ICON_BOX[px], className)}
    >
      {icon}
    </span>
  );
};

/**
 * Yuklanayotgan tugma bosilsa (sichqoncha, Enter, Space): `onClick` chaqirilmaydi, `type="submit"`
 * formani yubormaydi. Tugma `disabled` emas — fokus va Tab tartibi saqlanadi.
 */
const blockWhileBusy = (event: MouseEvent<HTMLButtonElement>) => {
  event.preventDefault();
};

/** Yuklanish atributlari (faqat `loading` da qo'shiladi — aks holda chaqiruvchining `aria-*` i saqlanadi). */
const BUSY_ATTRS = { "aria-busy": true, "aria-disabled": true } as const;

export type ButtonProps = Omit<ComponentProps<"button">, "children"> &
  Omit<ButtonClassOptions, "className"> & {
    children?: ReactNode;
    /** Matndan chapdagi ikonka (bitta, ma'no qo'shsa; oddiy «Saqlash» ikonkasiz). */
    leftIcon?: IconSlot;
    /** Matndan o'ngdagi ikonka (masalan ochiladigan menyu `ChevronDown`). */
    rightIcon?: IconSlot;
    /**
     * Yuklanmoqda: `aria-busy` + `aria-disabled` (maketdagidek; `disabled` EMAS — fokus tugmada
     * qoladi, ekran o'quvchi yangi nomni aytadi), rang saqlanadi, `onClick` chaqirilmaydi va forma
     * yuborilmaydi. Spinner chap ikonka o'rnida turadi (kenglik o'zgarmaydi). Chap ikonka va
     * `loadingText` bo'lmasa — spinner markazda, matn joyida ko'rinmas qoladi (kenglik o'zgarmaydi).
     */
    loading?: boolean;
    /** Yuklanish paytidagi matn («Saqlanmoqda…»), tugmaning yangi nomi ham. Maketdagi ko'rinish: spinner + shu matn. */
    loadingText?: ReactNode;
  };

/**
 * Dizayn v2 tugmasi.
 *
 *   <Button onClick={save}>{t("common.save")}</Button>
 *   <Button variant="secondary" leftIcon={Download}>{t("orders.exportExcel")}</Button>
 *   <Button loading={isPending} loadingText={t("common.saving")} leftIcon={Check}>…</Button>
 *   <Button variant="success" size="lg" fullWidth leftIcon={Check}>…</Button>
 *   <Button variant="secondary" compact leftIcon={Download}>…</Button>   // sarlavhadagi juftlik
 *
 * `type` sukut bo'yicha `"button"` (formani tasodifan yubormaydi); formada `type="submit"` bering.
 */
export const Button = ({
  variant = "primary",
  size = "md",
  fullWidth,
  compact,
  leftIcon,
  rightIcon,
  loading = false,
  loadingText,
  disabled,
  type = "button",
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) => {
  const hasLeftIcon = leftIcon != null && leftIcon !== false;
  const hasRightIcon = rightIcon != null && rightIcon !== false;
  const hasLoadingText = loadingText != null && loadingText !== false;
  // Spinner ikonka o'rnida (chap ikonka yoki yuklanish matni bor) yoki markazda (ikkalasi ham yo'q).
  const spinnerInSlot = loading && (hasLeftIcon || hasLoadingText);
  const spinnerCentered = loading && !spinnerInSlot;
  const hiddenWhileCentered = spinnerCentered ? "opacity-0" : undefined;
  const label = loading && hasLoadingText ? loadingText : children;
  const iconPx = compact ? COMPACT_ICON_PX[size] : BUTTON_ICON_PX[size];

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      {...(loading ? BUSY_ATTRS : null)}
      onClick={loading ? blockWhileBusy : onClick}
      data-variant={variant}
      data-size={size}
      className={buttonClasses({
        variant,
        size,
        fullWidth,
        compact,
        className: cx(spinnerCentered && "relative", className),
      })}
    >
      {spinnerInSlot ? (
        <span aria-hidden="true" className={cx("inline-flex shrink-0 items-center justify-center", ICON_BOX[iconPx])}>
          <Spinner size={SPINNER_SIZE[size]} />
        </span>
      ) : hasLeftIcon ? (
        <ButtonIcon icon={leftIcon} px={iconPx} />
      ) : null}
      {label != null && label !== false ? (
        <span className={cx("min-w-0 truncate", hiddenWhileCentered)}>{label}</span>
      ) : null}
      {hasRightIcon ? <ButtonIcon icon={rightIcon} px={iconPx} className={hiddenWhileCentered} /> : null}
      {spinnerCentered ? (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <Spinner size={SPINNER_SIZE[size]} />
        </span>
      ) : null}
    </button>
  );
};

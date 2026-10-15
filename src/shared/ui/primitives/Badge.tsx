import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/cx";
import { TONE_FG, TONE_RING, TONE_SOFT, TONE_SOLID, type Tone } from "./tone";

/**
 * Ko'rinish:
 * - `soft` (sukut) — yumshoq fon + tonning matni (`.el-tone-*`); neytralda ichki chegara ham bor;
 * - `outline` — shaffof fon + matn rangidagi ichki chegara (`.el-badge-outline`,
 *   masalan «Bekor — jo'natilgan»);
 * - `solid` — to'liq rangli fon + `on-solid` matn (`tone.ts` → `TONE_SOLID`, ikkala mavzuda AA).
 */
export type BadgeVariant = "soft" | "outline" | "solid";

/** `md` — maketdagi `.el-badge` (24px); `sm` — zich joylar uchun 20px (son yorlig'i balandligi). */
export type BadgeSize = "sm" | "md";

export type BadgeProps = Omit<ComponentProps<"span">, "children"> & {
  /** Ma'no rangi (`docs/DESIGN_SYSTEM.md` §8). Sukut: `neutral` (rangsiz). */
  tone?: Tone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** `lucide-react` ikonkasi, matndan chapda, 14px (`design/icon-registry.json`: badge istisnosi). */
  icon?: LucideIcon;
  /** Holat nuqtasi (`.el-badge-dot`). `icon` berilsa, nuqta chizilmaydi. */
  dot?: boolean;
  /** Yorliq matni — MAJBURIY: badge hech qachon faqat rang bilan ma'no bermaydi. */
  children: ReactNode;
};

/**
 * `.el-badge`: inline-flex · 24px · 0 8px · radius 6 · 12px/1 · 600 · bir qatorda.
 * CODE-MAP: `BADGE` retsepti.
 */
const BASE = "inline-flex items-center whitespace-nowrap rounded-md text-xs font-semibold leading-none";

const SIZE: Record<BadgeSize, string> = {
  md: "h-6 gap-1.5 px-2",
  sm: "h-5 gap-1 px-1.5",
};

/** Badge va filtr chipi ichidagi ikonka — 14px (ikonka katalogidagi yagona istisno). */
const ICON_SIZE = 14;

const variantClass = (variant: BadgeVariant, tone: Tone): string => {
  if (variant === "outline") return cx(TONE_FG[tone], "bg-transparent ring-1 ring-inset ring-current");
  if (variant === "solid") return TONE_SOLID[tone];
  // `.el-tone-neutral` — yumshoq fon ustiga `border` rangidagi ichki chegara.
  return cx(TONE_SOFT[tone], tone === "neutral" && TONE_RING.neutral);
};

/**
 * BADGE — qisqa yorliq: holat, tur, toifa, son.
 *
 *   <Badge tone="success" dot>Faol</Badge>
 *   <Badge icon={ArrowDownLeft}>Kirim</Badge>
 *
 * Holat (buyurtma, foydalanuvchi, ulanish) — `StatusBadge` (nuqta yoki ikonka bilan);
 * tur va toifa (`Uygacha`, `Markazgacha`) — nuqtasiz neytral `Badge`.
 * Bosiladigan narsa emas: tugma yoki filtr kerak bo'lsa `Button` / chip ishlating.
 */
export const Badge = ({
  tone = "neutral",
  variant = "soft",
  size = "md",
  icon: Icon,
  dot = false,
  className,
  children,
  ...rest
}: BadgeProps) => (
  <span className={cx(BASE, SIZE[size], variantClass(variant, tone), className)} {...rest}>
    {Icon ? (
      <Icon size={ICON_SIZE} aria-hidden="true" className="shrink-0" />
    ) : dot ? (
      <span aria-hidden="true" data-badge-dot="" className="size-1.5 shrink-0 rounded-full bg-current" />
    ) : null}
    {children}
  </span>
);

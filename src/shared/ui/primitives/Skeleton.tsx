import type { ComponentProps, CSSProperties } from "react";
import { cx } from "../../lib/cx";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  SKELET — dizayn v2 (`.el-skel` · `.el-skel-line` · `.el-skel-block` · `.el-skel-circle` + `.el-shimmer`,
 *  `design/CODE-MAP.md` 2.7, taxta `tizim-loading` 02)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Ma'lumot o'rnidagi kulrang shakl: balandligi haqiqiy kontentga teng — ma'lumot kelganda sahifa
 *  sakramaydi. Sarlavha, tab va ustun nomlari skelet EMAS (darhol ko'rinadi), faqat qiymatlar.
 *
 *  Shakllar: line — matn qatori (12 px, r 6) · block — karta/rasm/maydon (r 10) · circle — avatar/ikonka.
 *  Ton: `sunken` (sukut, `helmet` dagi `.el-skel*`) · `border` — `surface` karta ustidagi sahifa
 *  skeleti (`tizim-loading`, `tizim-errors`: kartada `sunken` deyarli ko'rinmaydi).
 *  Yaltirash: maketdagi gradient o'rniga `animate-pulse` (CODE-MAP `.el-shimmer`; gradient taqiqlangan),
 *  «Harakatni kamaytirish» da harakatsiz kulrang blok (`tizim-motion` 04).
 *
 *  Bezak: doim `aria-hidden`. «Yuklanmoqda…» ni o'rab turgan konteyner aytadi
 *  (`aria-busy` + `role="status"` — QueryBoundary).
 */

export type SkeletonShape = "line" | "block" | "circle";
export type SkeletonTone = "sunken" | "border";

const SHAPE: Record<SkeletonShape, string> = {
  line: "h-3 rounded-md",
  block: "rounded-[10px]",
  circle: "rounded-full",
};

const SKELETON_TONE: Record<SkeletonTone, string> = {
  sunken: "bg-sunken",
  border: "bg-border",
};

export type SkeletonProps = Omit<ComponentProps<"span">, "children"> & {
  shape?: SkeletonShape;
  tone?: SkeletonTone;
  /** Eni: son — px, satr — CSS qiymati (`"60%"`). Berilmasa — `className` (`w-24`) yoki to'liq kenglik. */
  width?: number | string;
  /** Balandlik: `line` da sukut 12 px; `block`/`circle` da beriladi (son — px). */
  height?: number | string;
  /** Yaltirash (sukut `true`); `false` — harakatsiz (masalan bo'sh grafik foni). */
  animated?: boolean;
};

const toCss = (value: number | string | undefined) => (typeof value === "number" ? `${value}px` : value);

/**
 * Dizayn v2 skeleti.
 *
 *   <Skeleton width="60%" />                                   // matn qatori
 *   <Skeleton shape="circle" width={32} height={32} />         // avatar
 *   <Skeleton shape="block" height={40} tone="border" />       // jadval qatori kartada
 */
export const Skeleton = ({
  shape = "line",
  tone = "sunken",
  width,
  height,
  animated = true,
  className,
  style,
  ...rest
}: SkeletonProps) => {
  const size: CSSProperties = {
    width: toCss(width),
    height: toCss(height),
    ...style,
  };
  return (
    <span
      aria-hidden="true"
      data-skeleton={shape}
      className={cx(
        "block shrink-0",
        SHAPE[shape],
        SKELETON_TONE[tone],
        animated && "animate-pulse motion-reduce:animate-none",
        className,
      )}
      style={size}
      {...rest}
    />
  );
};

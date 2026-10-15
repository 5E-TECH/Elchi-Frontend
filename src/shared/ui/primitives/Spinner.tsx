import type { ComponentProps } from "react";
import { cx } from "../../lib/cx";

export type SpinnerSize = "sm" | "md" | "lg";

/**
 * O'lcham → klass. Maket: `.el-spinner` 16px / 2px chiziq, `.el-spinner-lg` 32px / 3px;
 * katta tugma ichida 18px (`tizim-states-buttons`, «Telefon: to'liq kenglik»).
 */
const SIZE: Record<SpinnerSize, string> = {
  sm: "size-4 border-2",
  md: "size-[18px] border-2",
  lg: "size-8 border-3",
};

/**
 * Halqa: rang `currentColor` (tugma ichida tugma matni rangini oladi), o'ng chorak shaffof.
 * Aylanish 0,7 s (maket `el-spin .7s`); «Harakatni kamaytirish» yoqilganda to'xtaydi
 * (`tizim-motion`: «To'xtaydi; yonidagi «Yuklanmoqda…» matni holatni aytadi»).
 */
const RING =
  "inline-block shrink-0 animate-[spin_0.7s_linear_infinite] rounded-full border-current border-r-transparent motion-reduce:animate-none";

export type SpinnerProps = Omit<ComponentProps<"span">, "children"> & {
  /** `sm` 16px (sukut, tugma ichida) · `md` 18px (katta tugma) · `lg` 32px (sahifa yoki blok yuklanishi). */
  size?: SpinnerSize;
  /**
   * Ekran o'quvchi uchun matn («Yuklanmoqda…»). Berilsa — `role="status"` va yashirin matn.
   * Berilmasa — bezak (`aria-hidden`): holatni yonidagi matn yoki `aria-busy` aytadi
   * (masalan `Button loading`).
   */
  label?: string;
};

/**
 * YUKLANISH HALQASI — dizayn v2 (`.el-spinner`, `design/CODE-MAP.md` 2.7).
 *
 *   <Spinner />                                  // tugma ichida, bezak
 *   <Spinner size="lg" label={t("common.loading")} />   // blok yuklanishi, ekran o'quvchiga aytiladi
 */
export const Spinner = ({ size = "sm", label, className, ...rest }: SpinnerProps) => {
  if (!label) {
    return <span aria-hidden="true" data-spinner="" className={cx(RING, SIZE[size], className)} {...rest} />;
  }

  return (
    <span role="status" className={cx("inline-flex shrink-0", className)} {...rest}>
      <span aria-hidden="true" data-spinner="" className={cx(RING, SIZE[size])} />
      <span className="sr-only">{label}</span>
    </span>
  );
};

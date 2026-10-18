/**
 * Segmentdagi TANLANGAN variantning ton foni (maket `courier-courier-bulk-main`: «Sotildi» — `success-soft`,
 * «Bekor» — `danger-soft`, «Ertaga» — `warning-soft`; belgilanmagan qator — oddiy `surface`).
 * `SegmentedControl` primitivida variant toni yo'q — guruh klassi orqali `[aria-checked=true]` variantga beriladi
 * (`!` — primitivning `aria-checked:bg-surface` klassidan ustun turishi uchun). Klass satrlari to'liq yozilgan
 * (Tailwind faqat manbadagi to'liq nomni yig'adi).
 */
export const SEGMENT_TINT = {
  none: "",
  success:
    "[&>[aria-checked=true]]:bg-success-soft! [&>[aria-checked=true]]:text-success-fg! [&>[aria-checked=true]]:shadow-none!",
  danger:
    "[&>[aria-checked=true]]:bg-danger-soft! [&>[aria-checked=true]]:text-danger-fg! [&>[aria-checked=true]]:shadow-none!",
  warning:
    "[&>[aria-checked=true]]:bg-warning-soft! [&>[aria-checked=true]]:text-warning-fg! [&>[aria-checked=true]]:shadow-none!",
} as const;

export type SegmentTint = keyof typeof SEGMENT_TINT;

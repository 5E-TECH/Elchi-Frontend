import { cx } from "../../../../shared/lib/cx";

/**
 * Qoldiq / natija tafsiloti qatori (maket `<dl>`: chapda nom, o'ngda qalin summa va ixtiyoriy izoh). «Qoldiq» bloki,
 * to'lov oynasi va «To'lov yozildi» natija oynasi bir xil qatorni ishlatadi.
 */
export const BalanceRow = ({
  label,
  value,
  note,
  strong,
  first,
  wrap,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
  first?: boolean;
  /** Uzun matn qiymati (to'lov raqami) — qatorga bo'linadi; summa (sukut) bo'linmaydi. */
  wrap?: boolean;
}) => (
  <div className={cx("flex items-center justify-between gap-3 py-2.5", !first && "border-t border-border")}>
    <dt className={cx("min-w-0 text-[13px] text-text", strong && "font-semibold", wrap && "shrink-0")}>{label}</dt>
    <dd className="m-0 flex min-w-0 flex-col items-end gap-0.5">
      <span className={cx("text-right font-semibold text-text proportional-nums", wrap ? "wrap-break-word" : "whitespace-nowrap")}>{value}</span>
      {note ? <span className="text-right text-xs text-text-subtle">{note}</span> : null}
    </dd>
  </div>
);

/** `<dl>` o'rami — `bg-sunken` blok (maket: `padding: 4px 14px; border-radius: 10px`). */
export const BALANCE_LIST_CLASS = "m-0 flex flex-col rounded-[10px] bg-sunken px-3.5 py-1";

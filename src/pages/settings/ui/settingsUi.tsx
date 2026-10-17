// dizayn-v2: common-settings-appearance, common-settings-dashboard, common-settings-interface, common-settings-scanner, common-settings-notifications
import { useId, type ReactNode } from "react";
import { cx } from "../../../shared/lib/cx";

/**
 * Sozlamalar sahifasining umumiy bo'laklari (maketlar `common-settings-*`, CODE-MAP: `.el-switch`,
 * `.el-choice-card`, `.el-card-pad`, `.el-card-foot`).
 */

/** Karta ichidagi bo'lim sarlavhasi: `.el-h2` + `.el-small .el-muted` izoh. */
export const SectionHead = ({
  id,
  title,
  hint,
  aside,
}: {
  id?: string;
  title: ReactNode;
  hint?: ReactNode;
  aside?: ReactNode;
}) => (
  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
    <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
      <h2 id={id} className="text-base font-bold text-text">
        {title}
      </h2>
      {hint ? <p className="text-[13px] text-text-muted">{hint}</p> : null}
    </div>
    {aside}
  </div>
);

/** `.el-switch` ko'rinishi: 36 × 20, yoqiq — `action`, o'chiq — `border-strong`. Bosish maydoni — ota qator. */
export const SwitchTrack = () => (
  <span
    aria-hidden="true"
    className={cx(
      "relative h-5 w-9 flex-none rounded-full bg-border-strong transition-colors duration-150 motion-reduce:transition-none",
      "group-aria-checked:bg-action group-disabled:opacity-45",
    )}
  >
    <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 group-aria-checked:translate-x-4 motion-reduce:transition-none" />
  </span>
);

/**
 * Kalit qatori (ro'yxatda): butun qator — `role="switch"` tugma, nomi faqat sarlavha (`aria-labelledby`),
 * izoh — `aria-describedby`. Telefonda ≥ 44 px, kalit o'ng chetda.
 */
export const SwitchRow = ({
  title,
  hint,
  checked,
  disabled,
  onToggle,
  leading,
  addon,
}: {
  title: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
  /** Chapdagi ikonka yoki rasmcha. */
  leading?: ReactNode;
  /** Sarlavha yonidagi badge («Yashirilgan»). */
  addon?: ReactNode;
}) => {
  const titleId = useId();
  const hintId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={titleId}
      aria-describedby={hint ? hintId : undefined}
      disabled={disabled}
      onClick={() => onToggle(!checked)}
      className={cx(
        "group flex min-h-16 w-full items-center gap-4 px-5 py-3.5 text-left transition-[background-color] duration-150",
        "motion-reduce:transition-none not-disabled:hover:bg-row-hover disabled:cursor-not-allowed max-md:gap-3 max-md:px-4",
      )}
    >
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            id={titleId}
            className={cx(
              "text-sm font-semibold",
              checked || disabled ? "text-text" : "text-text-muted",
            )}
          >
            {title}
          </span>
          {addon}
        </span>
        {hint ? (
          <span id={hintId} className="text-[13px] text-text-muted">
            {hint}
          </span>
        ) : null}
      </span>
      <SwitchTrack />
    </button>
  );
};

/** Kalitlar ro'yxati: qatorlar orasida chiziq (`border-t`), birinchisining ustida ham (karta sarlavhasidan ajraladi). */
export const SwitchList = ({
  children,
  labelledBy,
}: {
  children: ReactNode;
  labelledBy?: string;
}) => (
  <ul
    aria-labelledby={labelledBy}
    className="m-0 list-none p-0 [&>li]:border-t [&>li]:border-border"
  >
    {children}
  </ul>
);

/** Radio radio nuqtasi (`.el-choice-card` ichidagi 20 px doira). Holat — ota `label` dagi `:checked`. */
export const RadioDot = () => (
  <span
    aria-hidden="true"
    className={cx(
      "inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-border-strong",
      "group-has-[:checked]:border-action",
    )}
  >
    <span className="size-2.5 rounded-full bg-action opacity-0 group-has-[:checked]:opacity-100" />
  </span>
);

/**
 * Tanlov kartasi (`.el-choice-card`, radio): yashirin `<input type="radio">` (strelkalar bilan yurish — brauzer
 * o'zi), tanlanganda `action` chegara + `action-soft` fon, fokusda halqa.
 */
export const ChoiceCard = ({
  name,
  value,
  checked,
  onSelect,
  children,
  className,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
  className?: string;
}) => (
  <label
    className={cx(
      "group relative flex cursor-pointer rounded-xl border border-border-strong bg-surface text-text",
      "transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none hover:border-text-subtle",
      "has-[:checked]:border-action has-[:checked]:bg-action-soft has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-focus",
      className,
    )}
  >
    <input
      type="radio"
      name={name}
      value={value}
      checked={checked}
      onChange={onSelect}
      className="sr-only"
    />
    {children}
  </label>
);

/** `.el-card-foot` ichidagi izoh qatori (ikonka + matn). */
export const FootNote = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <span className="inline-flex items-start gap-2 text-[13px] text-text-muted">
    <span aria-hidden="true" className="mt-px inline-flex shrink-0">
      {icon}
    </span>
    {children}
  </span>
);

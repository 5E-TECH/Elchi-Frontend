import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Edit2, LockKeyhole, type LucideIcon } from "lucide-react";

// Presentational subcomponents extracted from new_orderUpdate.tsx. Pure (props →
// JSX, memoized); no coupling to the page's state.

const FIELD_CLS =
  "w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 text-gray-800 dark:text-white text-sm font-medium focus:outline-none focus:border-main focus:ring-1 focus:ring-main/30 transition-all";
const ICON_CLS =
  "absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white pointer-events-none";

export const Card = memo(
  ({ children, className = "" }: { children: ReactNode; className?: string }) => (
    <div
      className={`rounded-2xl bg-white dark:bg-white/4 border border-gray-200 dark:border-white/8 ${className}`}
    >
      {children}
    </div>
  ),
);

export const SectionHead = memo(
  ({
    icon,
    title,
    sub,
    iconCls: ic = "bg-main/20 text-main",
    action,
  }: {
    icon: ReactNode;
    title: string;
    sub?: string;
    iconCls?: string;
    action?: ReactNode;
  }) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${ic}`}>{icon}</div>
        <div>
          <p className="font-semibold text-sm text-gray-900 dark:text-white">{title}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-white">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  ),
);

export const InfoRow = memo(
  ({
    icon,
    label,
    value,
    iconCls: ic = "bg-main/20 text-main",
  }: {
    icon: ReactNode;
    label: string;
    value: string;
    iconCls?: string;
  }) => (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-white/6 last:border-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ic}`}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] text-gray-400 dark:text-white uppercase tracking-wider font-medium">
          {label}
        </span>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
      </div>
    </div>
  ),
);

export const EditBtn = memo(
  ({
    onClick,
    disabled = false,
    reason,
  }: {
    onClick: () => void;
    disabled?: boolean;
    reason?: string;
  }) => {
    const { t } = useTranslation("common");

    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={disabled ? reason : undefined}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white hover:text-main dark:hover:text-white hover:bg-main/10 dark:hover:bg-white/10 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Edit2 size={12} /> {t("edit")}
      </button>
    );
  },
);

export const LockNotice = memo(({ children }: { children: string }) => (
  <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
    <LockKeyhole size={14} className="mt-0.5 shrink-0" />
    <span>{children}</span>
  </div>
));

export const Skeleton = memo(() => (
  <div className="animate-pulse space-y-4">
    {[64, 200, 120].map((h) => (
      <div key={h} className="rounded-2xl bg-gray-100 dark:bg-white/5" style={{ height: h }} />
    ))}
  </div>
));

export const SelectField = memo(
  ({
    label,
    icon: Icon,
    value,
    onChange,
    placeholder,
    options,
    disabled = false,
  }: {
    label: string;
    icon: LucideIcon;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    options: ReadonlyArray<{ value: string; label: string }>;
    disabled?: boolean;
  }) => (
    <div className="space-y-1.5">
      <label className="text-sm text-gray-500 dark:text-white ml-1">{label}</label>
      <div className="relative">
        <div className={ICON_CLS}>
          <Icon size={16} />
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${FIELD_CLS} pl-10 pr-10 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <option value="" className="bg-sidebar dark:bg-maindark">
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-sidebar dark:bg-maindark">
              {o.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-white">
          <ChevronDown size={14} />
        </div>
      </div>
    </div>
  ),
);

export const InputField = memo(
  ({
    label,
    icon: Icon,
    value,
    onChange,
    placeholder,
    disabled = false,
  }: {
    label: string;
    icon: LucideIcon;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    disabled?: boolean;
  }) => (
    <div className="space-y-1.5">
      <label className="text-sm text-gray-500 dark:text-white ml-1">{label}</label>
      <div className="relative">
        <div className="absolute left-3.5 top-3.5 text-gray-400 dark:text-white pointer-events-none">
          <Icon size={16} />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`${FIELD_CLS} pl-10 pr-4 placeholder:text-gray-400 dark:placeholder:text-white/80 disabled:cursor-not-allowed disabled:opacity-60`}
        />
      </div>
    </div>
  ),
);

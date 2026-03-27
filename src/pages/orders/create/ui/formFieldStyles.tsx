import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Info, Loader2 } from "lucide-react";

export const getFieldClassName = (
  baseClassName: string,
  hasError?: boolean,
): string =>
  `${baseClassName} ${
    hasError
      ? "border-[var(--color-error)] bg-[color:color-mix(in_srgb,var(--color-error)_8%,transparent)] focus:ring-[color:color-mix(in_srgb,var(--color-error)_18%,transparent)] focus:border-[var(--color-error)]"
      : ""
  }`;

export const FormFieldError = ({ message }: { message?: string }) => {
  if (!message) return null;

  return (
    <div className="flex items-start gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--color-error)_18%,transparent)] bg-[color-mix(in_srgb,var(--color-error)_8%,transparent)] px-2.5 py-2 text-[11px] leading-4 text-error">
      <AlertCircle size={14} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
};

export const getDisabledFieldClassName = (baseClassName: string): string =>
  `${baseClassName} disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-[color:color-mix(in_srgb,var(--color-sidebar)_72%,transparent)]`;

export const getSelectFieldClassName = (
  baseClassName: string,
  hasError?: boolean,
): string =>
  getFieldClassName(
    `${baseClassName} min-h-11 appearance-none pr-11 [-webkit-appearance:none] [-moz-appearance:none]`,
    hasError,
  );

export const getActionButtonClassName = ({
  variant,
  disabled,
}: {
  variant: "primary" | "secondary";
  disabled?: boolean;
}): string => {
  const baseClassName =
    "flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200";

  if (variant === "secondary") {
    return `${baseClassName} border-2 px-5 py-2.5 ${
      disabled
        ? "border-gray-200 dark:border-primarydark text-gray-400 dark:text-gray-500 cursor-not-allowed"
        : "border-gray-200 dark:border-primarydark text-gray-500 dark:text-gray-400 hover:border-main/40 hover:text-main cursor-pointer"
    }`;
  }

  return `${baseClassName} px-6 py-2.5 font-bold shadow-md ${
    disabled
      ? "bg-[color:color-mix(in_srgb,var(--color-main)_22%,transparent)] text-primary/70 shadow-none cursor-not-allowed"
      : "bg-main text-primary shadow-main/20 hover:bg-primarydark hover:shadow-main/30 active:scale-95 cursor-pointer"
  }`;
};

export const FormStateNote = ({
  state,
  message,
}: {
  state: "info" | "success" | "loading";
  message: string;
}) => {
  const icon =
    state === "loading" ? (
      <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin" />
    ) : state === "success" ? (
      <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
    ) : (
      <Info size={14} className="mt-0.5 shrink-0" />
    );

  const toneClassName =
    state === "loading"
      ? "border-main/20 bg-main/8 text-main"
      : state === "success"
        ? "border-[color:color-mix(in_srgb,var(--color-success)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--color-success)_10%,transparent)] text-[var(--color-success)]"
        : "border-main/18 bg-main/8 text-main";

  return (
    <div
      className={`inline-flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] leading-4 ${toneClassName}`}
    >
      {icon}
      <span>{message}</span>
    </div>
  );
};

export const SelectFieldShell = ({
  children,
  hasError,
  disabled,
}: {
  children: ReactNode;
  hasError?: boolean;
  disabled?: boolean;
}) => (
  <div className="relative w-full">
    {children}
    <span
      className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
        disabled
          ? "text-gray-300 dark:text-gray-500"
          : hasError
            ? "text-error"
            : "text-gray-400 dark:text-gray-300"
      }`}
    >
      <ChevronDown size={16} />
    </span>
  </div>
);

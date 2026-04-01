import type { ReactNode } from "react";

interface ErrorActionButton {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

interface ErrorActionsProps {
  primary: ErrorActionButton;
  secondary: ErrorActionButton;
}

const ErrorActions = ({ primary, secondary }: ErrorActionsProps) => {
  return (
    <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
      <button
        type="button"
        onClick={primary.onClick}
        className="error-boundary-button inline-flex min-w-56 items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5"
      >
        {primary.icon}
        {primary.label}
      </button>

      <button
        type="button"
        onClick={secondary.onClick}
        className="error-page-card-strong inline-flex min-w-56 items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5"
      >
        {secondary.icon}
        {secondary.label}
      </button>
    </div>
  );
};

export default ErrorActions;

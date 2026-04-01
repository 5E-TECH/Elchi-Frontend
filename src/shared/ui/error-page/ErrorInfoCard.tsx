import type { ReactNode } from "react";

interface ErrorInfoCardProps {
  icon: ReactNode;
  label: string;
  value: string;
}

const ErrorInfoCard = ({ icon, label, value }: ErrorInfoCardProps) => {
  return (
    <article className="error-page-card rounded-3xl p-5">
      <div className="text-main">{icon}</div>
      <p className="error-page-muted mt-4 text-xs uppercase tracking-[0.22em]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-primary">
        {value}
      </p>
    </article>
  );
};

export default ErrorInfoCard;

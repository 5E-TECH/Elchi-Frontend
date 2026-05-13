import { memo } from "react";
import { ScanQrCode } from "lucide-react";

type ScannerActionButtonProps = {
  onClick: () => void;
  label: string;
  title?: string;
  showLabel?: boolean;
  className?: string;
};

const ScannerActionButton = ({
  onClick,
  label,
  title,
  showLabel = false,
  className = "",
}: ScannerActionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`el-glass-control group relative inline-flex h-10 cursor-pointer items-center justify-center rounded-2xl text-maindark transition-all duration-300 hover:border-[var(--color-border-strong)] hover:bg-main/10 dark:text-primary lg:h-11 ${showLabel ? "gap-2 px-4 font-extrabold" : "w-10 lg:w-11"} ${className}`}
    aria-label={label}
    title={title ?? label}
  >
    <span className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.18),transparent_55%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-main/12 text-main dark:bg-primary/10 dark:text-primary">
      <ScanQrCode className="h-4.5 w-4.5" />
    </span>
    {showLabel ? <span className="relative text-sm">{label}</span> : null}
  </button>
);

export default memo(ScannerActionButton);

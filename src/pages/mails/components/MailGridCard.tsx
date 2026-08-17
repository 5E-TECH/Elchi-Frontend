import { memo, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { ChevronRight, Package } from "lucide-react";
import { useTranslation } from "react-i18next";

type MailGridCardVariant = "today" | "return" | "refused" | "old" | "batch";

type MailGridCardProps = {
  title: ReactNode;
  statusLabel: ReactNode;
  statusIcon: ReactNode;
  leadingIcon: ReactNode;
  orders: number;
  amount: string;
  onOpen: () => void;
  variant?: MailGridCardVariant;
  subtitle?: ReactNode;
  footer?: ReactNode;
  actionLabel?: ReactNode;
  actionIcon?: ReactNode;
  actionLoading?: boolean;
  onAction?: () => void;
  statusBadgeClassName?: string;
};

export const MAIL_CARD_GRID_CLASS = "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
export const MAIL_CARD_SKELETON_CLASS = "h-[172px] rounded-2xl animate-pulse";

const variantClassName: Record<MailGridCardVariant, string> = {
  today:
    "border-emerald-300/20 bg-[linear-gradient(135deg,#10b981_0%,#059669_42%,#047857_100%)] shadow-[0_16px_34px_rgba(16,185,129,0.22)]",
  return:
    "border-amber-300/22 bg-[linear-gradient(135deg,var(--color-warning-start)_0%,var(--color-warning-end)_100%)] shadow-[0_16px_34px_rgba(245,158,11,0.20)]",
  refused:
    "border-rose-300/22 bg-[linear-gradient(135deg,#ef4444_0%,#b91c1c_100%)] shadow-[0_16px_34px_rgba(239,68,68,0.22)]",
  old:
    "border-slate-300/14 bg-[linear-gradient(180deg,rgba(67,78,101,0.98)_0%,rgba(47,56,76,0.99)_100%)] shadow-[0_16px_34px_rgba(20,25,38,0.28)]",
  batch:
    "border-cyan-300/25 bg-[linear-gradient(135deg,rgba(18,124,154,0.96)_0%,rgba(68,62,148,0.98)_55%,rgba(35,42,86,0.98)_100%)] shadow-[0_16px_34px_rgba(18,124,154,0.22)]",
};

const MailGridCard = ({
  title,
  statusLabel,
  statusIcon,
  leadingIcon,
  orders,
  amount,
  onOpen,
  variant = "today",
  subtitle,
  footer,
  actionLabel,
  actionIcon,
  actionLoading = false,
  onAction,
  statusBadgeClassName = "border-white/25 bg-white/18 text-white",
}: MailGridCardProps) => {
  const { t } = useTranslation("mails");
  const handleAction = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onAction?.();
  };
  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    onOpen();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleCardKeyDown}
      className={`group relative min-h-[172px] cursor-pointer overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl ${variantClassName[variant]}`}
    >
      <div className="mail-card-shimmer" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14)_0%,transparent_48%,rgba(255,255,255,0.06)_100%)]" />

      <div className="relative z-10 flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/16 text-white backdrop-blur-sm">
            {leadingIcon}
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <span className={`inline-flex max-w-[128px] items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold leading-none backdrop-blur-sm ${statusBadgeClassName}`}>
              {statusIcon}
              <span className="truncate">{statusLabel}</span>
            </span>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/12 text-white transition-colors group-hover:bg-white/22">
              <ChevronRight size={16} />
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-[17px] font-black leading-6 text-white">{title}</h3>
          {subtitle ? <div className="mt-1 truncate text-xs font-medium text-white/70">{subtitle}</div> : null}
        </div>

        <div className="h-px w-full bg-white/18" />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-sm font-medium text-white/72">
              <Package size={13} className="text-white/55" />
              {t("ordersLabel")}:
            </span>
            <span className="text-sm font-black text-white">
              {orders} <span className="font-semibold text-white/75">{t("piece")}</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-white/72">{t("amountLabel")}:</span>
            <span className="truncate text-right text-sm font-black text-white">{amount}</span>
          </div>
        </div>

        {footer || onAction ? (
          <div className="mt-auto space-y-3">
            {footer ? <div className="truncate text-xs font-medium text-white/62">{footer}</div> : null}
            {onAction ? (
              <button
                type="button"
                onClick={handleAction}
                disabled={actionLoading}
                className="flex min-h-9 w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/14 px-3 text-sm font-bold text-white transition hover:bg-white/22 disabled:cursor-not-allowed disabled:opacity-65"
              >
                {actionIcon}
                <span className="truncate">{actionLoading ? t("checking") : actionLabel}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default memo(MailGridCard);

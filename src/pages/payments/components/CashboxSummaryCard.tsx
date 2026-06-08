import { memo, type ReactNode } from "react";
import { Eye, EyeOff, Wallet2 } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("uz-UZ");

interface CashboxSummaryCardProps {
  accentClass: string;
  accentIcon: ReactNode;
  title: string;
  subtitle: string;
  holderName: string;
  balance: number;
  balanceLabel?: string;
  balanceVisible: boolean;
  onToggleVisibility: () => void;
}

const CashboxSummaryCard = ({
  accentClass,
  accentIcon,
  title,
  subtitle,
  holderName,
  balance,
  balanceLabel = "Umumiy balans",
  balanceVisible,
  onToggleVisibility,
}: CashboxSummaryCardProps) => {
  return (
    <div className="w-full max-w-[540px] xl:max-w-none">
      <div
        className="relative flex min-h-[12.5rem] w-full flex-col overflow-hidden rounded-[1.45rem] border border-white/10 p-3 shadow-[0_24px_54px_rgba(16,10,44,0.38)] sm:aspect-[1.75/1] sm:min-h-[13.5rem] sm:max-h-[18rem] sm:rounded-[1.7rem] sm:p-4 sm:shadow-[0_28px_60px_rgba(16,10,44,0.38)] xl:aspect-[1.7/1] xl:max-h-none"
        style={{
          background:
            "linear-gradient(145deg, color-mix(in srgb, var(--color-main) 28%, #201442) 0%, color-mix(in srgb, var(--color-maindark) 92%, #120d2f) 42%, color-mix(in srgb, var(--color-purple) 44%, #180d35) 100%)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_78%_78%,rgba(168,85,247,0.28),transparent_26%)]" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border border-white/10 bg-white/8" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-white/8" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/25" />

        <div className="relative z-10 mb-4 flex items-start justify-between sm:mb-5">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-[0.95rem] border border-white/10 text-white shadow-lg sm:h-11 sm:w-11 sm:rounded-[1.1rem] ${accentClass}`}
            >
              {accentIcon}
            </div>
            <div>
              <p className="text-[15px] font-black tracking-[0.1em] text-white sm:text-base sm:tracking-[0.12em]">{title}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 sm:text-[11px] sm:tracking-[0.18em]">
                {subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-9 w-14 rounded-[0.8rem] border border-white/15 bg-[linear-gradient(135deg,#f3df97_0%,#b88b2a_48%,#f3df97_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:h-11 sm:w-16 sm:rounded-xl" />
            <button
              type="button"
              onClick={onToggleVisibility}
              className="flex h-8 w-8 items-center justify-center rounded-[0.8rem] border border-white/10 bg-primary/12 text-white/70 transition-colors hover:bg-primary/20 sm:h-10 sm:w-10 sm:rounded-2xl"
            >
              {balanceVisible ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </div>
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center pt-2 text-left sm:pt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55 sm:mb-2 sm:text-[11px] sm:tracking-[0.16em]">
            <Wallet2 size={11} /> {balanceLabel}
          </p>
          <p className="break-words text-[clamp(1.8rem,6vw,3rem)] font-black tracking-tight text-white drop-shadow-[0_6px_16px_rgba(0,0,0,0.28)]">
            {balanceVisible ? `${fmt(balance)} UZS` : "••••••• UZS"}
          </p>
        </div>

        <div className="relative z-10 mt-auto flex items-end justify-between gap-3 pt-2 sm:gap-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40 sm:text-[10px] sm:tracking-[0.18em]">
              Card holder
            </p>
            <p className="mt-0.5 max-w-[11rem] truncate text-[13px] font-bold text-white/90 sm:mt-1 sm:max-w-[13rem] sm:text-sm">
              {holderName}
            </p>
          </div>
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-white/70 mix-blend-screen sm:h-10 sm:w-10" />
            <div className="-ml-2.5 h-8 w-8 rounded-full bg-white/30 mix-blend-screen sm:-ml-3 sm:h-10 sm:w-10" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(CashboxSummaryCard);

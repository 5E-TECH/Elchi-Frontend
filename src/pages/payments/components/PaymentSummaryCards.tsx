import { memo, useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, Landmark, Store, TrendingUp, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";

type PaymentSummaryCardsProps = {
  isManagerRole: boolean;
  marketTotal: number;
  mainTotal: number;
  courierTotal: number;
  loading: boolean;
  onCardClick: (path: string | null, action: "given" | "received" | null) => void;
};

const formatAmount = (value: number) => value.toLocaleString("uz-UZ");

const PaymentSummaryCards = ({
  isManagerRole,
  marketTotal,
  mainTotal,
  courierTotal,
  loading,
  onCardClick,
}: PaymentSummaryCardsProps) => {
  const { t } = useTranslation("payments");
  const cards = useMemo(() => [
    {
      label: t("toBeGiven"), amount: marketTotal,
      icon: isManagerRole ? <Landmark size={20} /> : <Store size={20} />,
      actionIcon: <ArrowUpRight size={16} />, bg: "bg-maindark", iconBg: "bg-main/20",
      badge: null, path: null, popup: "given" as const,
    },
    {
      label: t("amountInCashbox"), amount: mainTotal, icon: <Landmark size={20} />,
      actionIcon: <TrendingUp size={16} />,
      bg: "bg-gradient-to-br from-main to-main/80 shadow-main/30", iconBg: "bg-white/20",
      badge: t("mainCashboxBadge"), path: "main-cashbox", popup: null,
    },
    {
      label: t("toBeReceived"), amount: courierTotal, icon: <Truck size={20} />,
      actionIcon: <ArrowDownLeft size={16} />, bg: "bg-maindark", iconBg: "bg-main/20",
      badge: null, path: null, popup: "received" as const,
    },
  ], [courierTotal, isManagerRole, mainTotal, marketTotal, t]);

  return (
    <div className="flex flex-col items-stretch gap-3 sm:gap-4 lg:flex-row">
      {cards.map((card) => (
        <div
          key={card.label}
          onClick={() => onCardClick(card.path, card.popup)}
          className={`relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-glass-border p-4 shadow-lg transition-transform duration-300 hover:scale-[1.02] sm:p-5 lg:p-4 xl:p-6 ${card.bg} ${card.path || card.popup ? "cursor-pointer" : ""}`}
        >
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white opacity-[0.06]" />
          <div className="mb-4 flex items-start justify-between sm:mb-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white sm:h-11 sm:w-11 ${card.iconBg}`}>
              {card.icon}
            </div>
            <div className="flex min-w-0 items-center gap-1.5 xl:gap-2">
              {card.badge && (
                <div className="flex min-w-0 items-center gap-1 rounded-lg border border-glass-border bg-glass px-2 py-1 xl:gap-1.5 xl:px-2.5">
                  <TrendingUp size={11} className="hidden shrink-0 text-white/80 xl:block" />
                  <span className="whitespace-nowrap text-[10px] font-semibold text-white xl:text-xs">{card.badge}</span>
                </div>
              )}
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/70 sm:h-8 sm:w-8">
                {card.actionIcon}
              </div>
            </div>
          </div>
          <p className="mb-2 text-sm font-medium text-white/60">{card.label}</p>
          {loading ? (
            <div className="h-9 w-32 animate-pulse rounded-lg bg-white/10" />
          ) : (
            <p className="text-2xl font-extrabold text-white sm:text-3xl">{formatAmount(card.amount)}</p>
          )}
          <p className="mt-1.5 text-xs text-white/40">{t("currency")}</p>
        </div>
      ))}
    </div>
  );
};

export default memo(PaymentSummaryCards);

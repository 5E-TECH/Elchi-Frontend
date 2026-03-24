import { memo } from "react";
import HeaderName from "../../shared/components/headerName";
import { Scale, Briefcase, Store, Truck, RefreshCw } from "lucide-react";
import Statistics from "./components/Statistics";
import { useCashBox } from "../../entities/payments";

interface BalanceCard {
  label: string;
  subLabel: string;
  subType: "neutral" | "negative" | "positive";
  amount: number;
  icon: React.ReactNode;
  colorClass: "purple" | "red" | "green";
}



const colorMap = {
  purple: {
    icon: "bg-purple-500/20 border border-purple-500/30 text-purple-400",
    amount: "text-purple-300",
    bar: "bg-purple-400",
  },
  red: {
    icon: "bg-red-500/20 border border-red-500/30 text-red-400",
    amount: "text-red-300",
    bar: "bg-red-400",
  },
  green: {
    icon: "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400",
    amount: "text-emerald-300",
    bar: "bg-emerald-400",
  },
};

const subLabelColor = {
  neutral: "text-slate-400",
  negative: "text-red-400",
  positive: "text-emerald-400",
};


const FinancialBalance = () => {
  const { getFinancialBalance } = useCashBox();
  const { data: response, isLoading, refetch } = getFinancialBalance();
  const data = response?.data;

  const total = data?.currentSituation ?? 0;
  const isNegative = total < 0;

  const formatAmount = (val: number): string =>
    val.toLocaleString("ru-RU").replace(/\s/g, " ");

  const cards: BalanceCard[] = [
    {
      label: "Kassa",
      subLabel: "Mavjud mablag'",
      subType: "neutral",
      amount: data?.main?.balance ?? 0,
      icon: <Briefcase size={18} />,
      colorClass: "purple",
    },
    {
      label: "Markets",
      subLabel: "(-) Biz qarzmiz",
      subType: "negative",
      amount: data?.markets?.marketsTotalBalans ?? 0,
      icon: <Store size={18} />,
      colorClass: "red",
    },
    {
      label: "Couriers",
      subLabel: "(+) Bizning pul",
      subType: "positive",
      amount: data?.couriers?.couriersTotalBalanse ?? 0,
      icon: <Truck size={18} />,
      colorClass: "green",
    },
  ];

  return (
    <div className="rounded-2xl overflow-hidden bg-primary dark:bg-maindark">
      {/* Hero */}
      <div
        className={`relative px-6 py-5 overflow-hidden transition-colors duration-500 ${isNegative
          ? "bg-linear-to-br from-red-800 via-red-600 to-red-800"
          : "bg-linear-to-br from-emerald-800 via-emerald-600 to-emerald-800"
          }`}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative">
          <HeaderName
            name="Current situation"
            description="Markets and Couriers"
            icon={<Scale />}
          />
          <div className="flex items-end justify-between mt-3">
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <span
                className={`inline-block w-2 h-2 rounded-full animate-pulse ${isNegative ? "bg-red-300" : "bg-emerald-300"
                  }`}
              />
              {isNegative ? "Salbiy holat" : "Ijobiy holat"}
            </div>
            <div className="text-right">
              {isLoading ? (
                <div className="h-10 w-48 bg-white/10 animate-pulse rounded-lg" />
              ) : (
                <p
                  className={`font-black text-4xl tracking-wider leading-none ${isNegative ? "text-red-100" : "text-emerald-100"
                    }`}
                >
                  {formatAmount(total)}
                </p>
              )}
              <p className="text-white/50 text-xs tracking-widest mt-1">UZS</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4">
        {cards.map((card) => {
          const colors = colorMap[card.colorClass];
          const maxAbs = Math.max(...cards.map((c) => Math.abs(c.amount)), 1);
          const barWidth = Math.round((Math.abs(card.amount) / maxAbs) * 100);

          return (
            <div
              key={card.label}
              className="border dark:border-glass-border rounded-2xl p-4 hover:border-[#4A476A] hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors.icon}`}
                >
                  {card.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/90 leading-tight">
                    {card.label}
                  </p>
                  <p className={`text-xs mt-0.5 ${subLabelColor[card.subType]}`}>
                    {card.subLabel}
                  </p>
                </div>
              </div>

              {isLoading ? (
                <div className="h-8 w-32 bg-white/5 animate-pulse rounded-md" />
              ) : (
                <p
                  className={`font-black text-2xl tracking-wide leading-none ${colors.amount}`}
                >
                  {formatAmount(card.amount)}
                </p>
              )}
              <p className="text-[11px] text-slate-500 tracking-widest mt-1">
                UZS
              </p>

              <div className="mt-3 h-0.5 rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full ${colors.bar}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex justify-end px-4 pb-4">
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-xs text-slate-500 border border-[#2E2B3E] rounded-lg px-3 py-1.5 hover:border-[#4A476A] hover:text-slate-300 transition-all cursor-pointer"
        >
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
          Yangilash
        </button>
      </div>

      <div className="px-4 pb-4">
        <Statistics />
      </div>
    </div>
  );
};

export default memo(FinancialBalance);

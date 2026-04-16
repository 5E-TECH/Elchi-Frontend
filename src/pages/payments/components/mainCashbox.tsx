import { memo, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  Eye,
  EyeOff,
  Download,
  LogOut,
  Banknote,
  ArrowLeftRight,
  Truck,
  Store,
  Minus,
  Plus,
  DollarSign,
  User,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import LogoTextDark from "../../../shared/assets/logoo.png";
import DateRangePicker from "../../../shared/ui/DateRangePicker";
import PopupSelect from "../../../shared/components/popupSelect";
import CashboxFormPopup from "./CashboxFormPopup";
import CloseShiftPopup from "./CloseShiftPopup";
import { useUser } from "../../../entities/user/api/userApi";
import { useCashBox } from "../../../entities/payments";
import type { PaymentRow } from "./patmentHistoryTable";
import PaymentHistoryList from "./PaymentHistoryList";
import { exportMainCashboxReport } from "./lib/exportMainCashboxReport";
import { useTranslation } from "react-i18next";

// ─── Utils ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("uz-UZ", { maximumFractionDigits: 0 });

const toNumber = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const buildRangeStart = (type: "today" | "week" | "month") => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (type === "today") return toIsoDate(today);

  if (type === "week") {
    const weekStart = new Date(today);
    const weekday = weekStart.getDay();
    const diff = weekday === 0 ? 6 : weekday - 1;
    weekStart.setDate(weekStart.getDate() - diff);
    return toIsoDate(weekStart);
  }

  return toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
};

const summarizeHistory = (items: PaymentRow[] = []) =>
  items.reduce(
    (accumulator, item) => {
      const amount = Math.abs(toNumber(item.amount));
      if (item.operation_type === "income") accumulator.income += amount;
      else if (item.operation_type === "expense") accumulator.expense += amount;
      return accumulator;
    },
    { income: 0, expense: 0 },
  );

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionLabel =
  | "receiveFromCourier"
  | "payToMarket"
  | "spendFromCashbox"
  | "fillCashbox"
  | "paySalary";

const ACTIONS: {
  icon: React.ReactNode;
  label: ActionLabel;
  shortLabelKey: string;
  color: string;
  bg: string;
}[] = [
  {
    icon: <Truck size={20} />,
    label: "receiveFromCourier",
    shortLabelKey: "courierShort",
    color: "text-emerald-400",
    bg: "bg-emerald-500/15 hover:bg-emerald-500/25",
  },
  {
    icon: <Store size={20} />,
    label: "payToMarket",
    shortLabelKey: "marketShort",
    color: "text-blue-400",
    bg: "bg-blue-500/15 hover:bg-blue-500/25",
  },
  {
    icon: <Minus size={20} />,
    label: "spendFromCashbox",
    shortLabelKey: "expenseShort",
    color: "text-rose-400",
    bg: "bg-rose-500/15 hover:bg-rose-500/25",
  },
  {
    icon: <Plus size={20} />,
    label: "fillCashbox",
    shortLabelKey: "incomeShort",
    color: "text-teal-400",
    bg: "bg-teal-500/15 hover:bg-teal-500/25",
  },
  {
    icon: <DollarSign size={20} />,
    label: "paySalary",
    shortLabelKey: "salaryShort",
    color: "text-amber-400",
    bg: "bg-amber-500/15 hover:bg-amber-500/25",
  },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skeleton = ({ className }: { className?: string }) => (
  <span
    className={`inline-block rounded-lg bg-white/10 animate-pulse ${className}`}
  />
);

// ─── MainCashbox ──────────────────────────────────────────────────────────────

const MainCashbox = () => {
  const { t } = useTranslation("payments");
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [isSalaryPopupOpen, setIsSalaryPopupOpen] = useState(false);
  const [isCourierPopupOpen, setIsCourierPopupOpen] = useState(false);
  const [isMarketPopupOpen, setIsMarketPopupOpen] = useState(false);
  const [isSpendPopupOpen, setIsSpendPopupOpen] = useState(false);
  const [isRefillPopupOpen, setIsRefillPopupOpen] = useState(false);
  const [isCloseShiftPopupOpen, setIsCloseShiftPopupOpen] = useState(false);
  const [draftHistoryFrom, setDraftHistoryFrom] = useState("");
  const [draftHistoryTo, setDraftHistoryTo] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const navigate = useNavigate();

  const { getUser } = useUser();
  const {
    cashboxSpand,
    cashboxFill,
    closeShift,
    getCashBoxInfo,
    getFinanceHistory,
    getCashBoxMain,
  } = useCashBox();

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: usersData, isLoading: usersLoading } = getUser(
    { limit: 100 },
    isSalaryPopupOpen,
  );
  const { data: couriersData, isLoading: couriersLoading } = getUser(
    { role: "courier", limit: 100 },
    isCourierPopupOpen,
  );
  const { data: marketsData, isLoading: marketsLoading } = getUser(
    { role: "market", limit: 100 },
    isMarketPopupOpen,
  );
  const mainCashboxParams = useMemo(
    () => ({
      ...(draftHistoryFrom && draftHistoryTo && { fromDate: draftHistoryFrom, toDate: draftHistoryTo }),
    }),
    [draftHistoryFrom, draftHistoryTo],
  );

  const { data: cashboxInfoRes, isLoading: cashboxInfoLoading } = getCashBoxInfo();
  const { data: mainCashboxRes, isLoading: mainCashboxLoading } = getCashBoxMain(mainCashboxParams);
  const historyParams = useMemo(
    () => ({
      page: historyPage,
      limit: 10,
      ...(draftHistoryFrom && draftHistoryTo && { fromDate: draftHistoryFrom, toDate: draftHistoryTo }),
    }),
    [draftHistoryFrom, draftHistoryTo, historyPage],
  );
  const {
    data: historyRes,
    isLoading: historyLoading,
    isFetching: historyFetching,
  } = getFinanceHistory(historyParams);

  const todayRangeParams = useMemo(
    () => ({ page: 1, limit: 200, fromDate: buildRangeStart("today"), toDate: toIsoDate(new Date()) }),
    [],
  );
  const weekRangeParams = useMemo(
    () => ({ page: 1, limit: 500, fromDate: buildRangeStart("week"), toDate: toIsoDate(new Date()) }),
    [],
  );
  const monthRangeParams = useMemo(
    () => ({ page: 1, limit: 1000, fromDate: buildRangeStart("month"), toDate: toIsoDate(new Date()) }),
    [],
  );

  const { data: todayHistoryRes } = getFinanceHistory(todayRangeParams);
  const { data: weekHistoryRes } = getFinanceHistory(weekRangeParams);
  const { data: monthHistoryRes } = getFinanceHistory(monthRangeParams);

  const employees = useMemo(
    () =>
      (usersData?.data?.items ?? []).filter((employee: any) => {
        const role = String(employee?.role ?? "").toLowerCase();
        return role !== "market" && role !== "courier";
      }),
    [usersData?.data?.items],
  );
  const couriers = couriersData?.data?.items ?? [];
  const markets = marketsData?.data?.items ?? [];

  // ── Cashbox balances ───────────────────────────────────────────────────────
  const cashboxInfoData = cashboxInfoRes?.data ?? {};
  const mainCashboxData = mainCashboxRes?.data ?? {};
  const mainCashbox = mainCashboxData?.cashbox ?? {};
  const totalBalance = toNumber(
    (mainCashbox as any)?.balance ??
      (mainCashboxData as any)?.balance ??
      cashboxInfoData?.mainCashboxTotal ??
      (mainCashboxData as any)?.total,
  );
  const cashBalance = toNumber(
    (mainCashbox as any)?.balance_cash ??
      (mainCashboxData as any)?.balance_cash ??
      (mainCashboxData as any)?.balanceCash ??
      (mainCashboxData as any)?.cash,
  );
  const transferBalance = toNumber(
    (mainCashbox as any)?.balance_card ??
      (mainCashboxData as any)?.balance_card ??
      (mainCashboxData as any)?.balanceCard ??
      (mainCashboxData as any)?.transfer,
  );

  // ── History ────────────────────────────────────────────────────────────────
  const historyRows: PaymentRow[] = useMemo(
    () => ((historyRes?.data?.items ?? []) as PaymentRow[]),
    [historyRes?.data?.items],
  );
  const historyPagination = historyRes?.data?.pagination ?? historyRes?.data?.meta;
  const filteredIncome = summarizeHistory(todayHistoryRes?.data?.items).income;
  const filteredExpense = summarizeHistory(todayHistoryRes?.data?.items).expense;
  const weeklyStats = summarizeHistory(weekHistoryRes?.data?.items);
  const monthlyStats = summarizeHistory(monthHistoryRes?.data?.items);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleActionClick = useCallback((label: ActionLabel) => {
    const map: Record<ActionLabel, () => void> = {
      paySalary: () => setIsSalaryPopupOpen(true),
      receiveFromCourier: () => setIsCourierPopupOpen(true),
      payToMarket: () => setIsMarketPopupOpen(true),
      spendFromCashbox: () => setIsSpendPopupOpen(true),
      fillCashbox: () => setIsRefillPopupOpen(true),
    };
    map[label]?.();
  }, []);

  const handleCourierSelect = useCallback(
    (courier: any) => {
      setIsCourierPopupOpen(false);
      navigate(`/payments/cash-detail/${courier.id}`, { state: { type: "courier", entity: courier } });
    },
    [navigate],
  );

  const handleMarketSelect = useCallback(
    (market: any) => {
      setIsMarketPopupOpen(false);
      navigate(`/payments/cash-detail/${market.id}`, { state: { type: "market", entity: market } });
    },
    [navigate],
  );

  const handleExportExcel = useCallback(() => {
    exportMainCashboxReport({
      rows: historyRows,
      totalBalance,
      cashBalance,
      cardBalance: transferBalance,
      fromDate: draftHistoryFrom || undefined,
      toDate: draftHistoryTo || undefined,
    });
  }, [
    historyRows,
    totalBalance,
    cashBalance,
    transferBalance,
    draftHistoryFrom,
    draftHistoryTo,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-5 bg-sidebar dark:bg-maindark min-h-full flex flex-col gap-5 rounded-2xl">
      {/* ── Header ── */}
      <div className="bg-primary dark:bg-primarydark rounded-2xl border border-gray-200 dark:border-glass-border px-4 shadow-sm">
        <HeaderName
          name={t("mainCashboxTitle")}
          description={t("mainCashboxDescription")}
          icon={<Wallet />}
          onIconClick={() => navigate(-1)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ════ LEFT COLUMN ════ */}
        <div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-4">

          {/* ── Balance card ── */}
          <div className="relative overflow-hidden rounded-2xl p-5 bg-linear-to-br from-[#3b2f6e] via-[#2e2659] to-[#1e1a42] border border-white/10 shadow-2xl">
            {/* Glow blobs */}
            <div className="pointer-events-none absolute -top-12 -right-12 w-44 h-44 rounded-full bg-purple-500/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-blue-500/15 blur-2xl" />

            {/* Top row: logo + eye */}
            <div className="relative z-10 flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <img src={LogoTextDark} alt="Elchi" className="w-16 object-contain hidden dark:block" />
                <div className="text-white -ml-3">
                  <h2 className="font-extrabold text-xl leading-none">ELCHI</h2>
                  <p className="text-[10px] font-medium tracking-widest opacity-60">POCHTA</p>
                </div>
              </div>
              <button
                onClick={() => setBalanceVisible((v) => !v)}
                className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 transition-colors"
                aria-label={balanceVisible ? t("hide") : t("show")}
              >
                {balanceVisible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </div>

            {/* Total balance */}
            <div className="relative z-10 mb-5">
              <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Wallet size={11} /> {t("totalBalanceLabel")}
              </p>
              {mainCashboxLoading || cashboxInfoLoading ? (
                <Skeleton className="h-9 w-52" />
              ) : (
                <p className="text-[32px] font-black text-white tracking-tight leading-none">
                  {balanceVisible ? `${fmt(totalBalance)} ` : "••••••• "}
                  <span className="text-lg font-semibold text-white/40">UZS</span>
                </p>
              )}
            </div>

            {/* Cash / Transfer */}
            <div className="relative z-10 grid grid-cols-2 gap-2.5">
              {[
                { icon: <Banknote size={14} />, label: t("cash"), amount: cashBalance },
                { icon: <ArrowLeftRight size={14} />, label: t("card"), amount: transferBalance },
              ].map(({ icon, label, amount }) => (
                <div
                  key={label}
                  className="bg-white/[0.07] border border-white/10 rounded-xl p-3 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-1.5 text-white/50 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                    {icon} {label}
                  </div>
                  {mainCashboxLoading ? (
                    <Skeleton className="h-4 w-20" />
                  ) : (
                    <p className="text-white font-bold text-sm">
                      {balanceVisible ? `${fmt(amount)} UZS` : "••••••"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Quick actions ── */}
          <div className="bg-primary dark:bg-primarydark rounded-2xl border border-gray-200 dark:border-glass-border p-4">
            <p className="text-xs font-bold text-gray-500 dark:text-white/40 uppercase tracking-wider mb-3">
              {t("quickActions")}
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {ACTIONS.map(({ icon, label, shortLabelKey, color, bg }) => (
                <button
                  key={label}
                  onClick={() => handleActionClick(label)}
                  title={t(label)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl ${bg} ${color} transition-all duration-150 active:scale-95`}
                >
                  <span className="text-current">{icon}</span>
                  <span className="text-[10px] font-semibold text-center leading-tight text-gray-600 dark:text-white/60">
                    {t(shortLabelKey)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Export + Close Shift ── */}
          <div className="flex gap-2.5">
            <button
              onClick={handleExportExcel}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-main/60 text-main text-sm font-semibold hover:bg-main/10 transition-colors"
            >
              <Download size={15} />
              {t("excel")}
            </button>
            <button
              onClick={() => setIsCloseShiftPopupOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-orange-500/60 text-orange-400 text-sm font-semibold hover:bg-orange-500/10 transition-colors"
            >
              <LogOut size={15} />
              {t("closeShiftTitle")}
            </button>
          </div>
        </div>

        {/* ════ RIGHT COLUMN ════ */}
        <div className="flex flex-col gap-4 lg:col-span-7 xl:col-span-8">

          {/* ── Income / Expense summary cards ── */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl p-4 bg-linear-to-br from-emerald-500 to-emerald-700 shadow-lg border border-white/10 flex flex-col justify-between min-h-25">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/70 uppercase tracking-wider">{t("today")}</span>
                <TrendingUp size={16} className="text-white/50" />
              </div>
              <div>
                <p className="text-lg font-black text-white tabular-nums leading-none">
                  +{fmt(filteredIncome)}
                </p>
                <p className="mt-1 text-[11px] text-white/70">
                  -{fmt(filteredExpense)} UZS
                </p>
              </div>
            </div>

            <div className="rounded-2xl p-4 bg-linear-to-br from-main to-primarydark shadow-lg border border-white/10 flex flex-col justify-between min-h-25">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/70 uppercase tracking-wider">{t("thisWeek")}</span>
                <TrendingUp size={16} className="text-white/50" />
              </div>
              <div>
                <p className="text-lg font-black text-white tabular-nums leading-none">
                  +{fmt(weeklyStats.income)}
                </p>
                <p className="mt-1 text-[11px] text-white/70">
                  -{fmt(weeklyStats.expense)} UZS
                </p>
              </div>
            </div>

            <div className="rounded-2xl p-4 bg-linear-to-br from-rose-500 to-fuchsia-600 shadow-lg border border-white/10 flex flex-col justify-between min-h-25">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/70 uppercase tracking-wider">{t("thisMonth")}</span>
                <TrendingDown size={16} className="text-white/50" />
              </div>
              <div>
                <p className="text-lg font-black text-white tabular-nums leading-none">
                  +{fmt(monthlyStats.income)}
                </p>
                <p className="mt-1 text-[11px] text-white/70">
                  -{fmt(monthlyStats.expense)} UZS
                </p>
              </div>
            </div>
          </div>

          {/* ── Date filter ── */}
          <div className="bg-primary dark:bg-primarydark rounded-2xl border border-gray-200 dark:border-glass-border overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-glass-border flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {t("transactions")}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-white/40">
                  {t("filterByDate")}
                </p>
              </div>
              {(draftHistoryFrom || draftHistoryTo) && (
                <button
                  onClick={() => {
                    setDraftHistoryFrom("");
                    setDraftHistoryTo("");
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors"
                >
                  {t("clear")}
                </button>
              )}
            </div>
            <div className="p-4">
              <DateRangePicker
                value={{
                  startDate: draftHistoryFrom ? parseIsoDate(draftHistoryFrom) : null,
                  endDate: draftHistoryTo ? parseIsoDate(draftHistoryTo) : null,
                }}
                onChange={({ startDate, endDate }) => {
                  setDraftHistoryFrom(startDate ? toIsoDate(startDate) : "");
                  setDraftHistoryTo(endDate ? toIsoDate(endDate) : "");
                }}
                placeholder={`${t("startDate")} → ${t("endDate")}`}
                className="w-full"
              />
            </div>
            {((draftHistoryFrom && !draftHistoryTo) || (!draftHistoryFrom && draftHistoryTo)) && (
              <p className="px-4 pb-4 text-xs text-gray-500 dark:text-white/45">
                {t("dateRangeRequired")}
              </p>
            )}
          </div>

          {/* ── Payment history table ── */}
          <div className="bg-primary dark:bg-primarydark rounded-2xl border border-gray-200 dark:border-glass-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-glass-border">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {t("paymentHistoryTitle")}
              </p>
              {historyRows.length > 0 && (
                <span className="text-xs bg-main/15 text-main font-bold px-2.5 py-1 rounded-full">
                  {t("countLabel", { count: historyRows.length })}
                </span>
              )}
            </div>
            <PaymentHistoryList
              data={historyRows}
              isLoading={historyLoading}
              pagination={historyPagination}
              currentPage={historyPage}
              onPageChange={setHistoryPage}
              withContainer={false}
            />

            {historyFetching && historyRows.length > 0 && (
              <div className="px-5 pb-4 text-xs text-gray-500 dark:text-white/40">
                {t("transactionsUpdating")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════ POPUPS ════ */}

      {/* Pay Salary */}
      <PopupSelect
        isOpen={isSalaryPopupOpen}
        onClose={() => setIsSalaryPopupOpen(false)}
        data={usersLoading ? [] : employees}
        title={t("selectEmployee")}
        description={t("forSalaryPayment")}
        icon={<User size={20} />}
        keyExtractor={(emp: any) => emp.id}
        searchKeys={["name"]}
        labelKey="name"
        secondaryLabelKey="role"
        onSelect={(emp) => {
          setIsSalaryPopupOpen(false);
          console.log("Salary employee:", emp);
        }}
        placeholder={t("searchPlaceholder")}
        selectLabel={t("selectLabel")}
        cancelLabel={t("cancelShort")}
        renderItem={(emp: any, isSelected: boolean) => (
          <div className="flex items-center gap-3 w-full">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                isSelected ? "bg-white/20 text-white" : "bg-amber-500/15 text-amber-500"
              }`}
            >
              {emp.name?.charAt(0)?.toUpperCase() ?? <User size={16} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm truncate ${isSelected ? "text-white" : "text-gray-900 dark:text-white"}`}>
                {emp.name}
              </p>
              {emp.role && (
                <p className={`text-xs mt-0.5 capitalize ${isSelected ? "text-white/60" : "text-main"}`}>
                  {emp.role}
                </p>
              )}
            </div>
          </div>
        )}
      />

      {/* Receive from courier */}
      <PopupSelect
        isOpen={isCourierPopupOpen}
        onClose={() => setIsCourierPopupOpen(false)}
        data={couriersLoading ? [] : couriers}
        title={t("selectCourier")}
        description={t("receiveFromCourierDescription")}
        icon={<Truck size={20} />}
        keyExtractor={(c: any) => c.id}
        searchKeys={["name"]}
        onSelect={handleCourierSelect}
        placeholder={t("searchPlaceholder")}
        selectLabel={t("selectLabel")}
        cancelLabel={t("cancelShort")}
        renderItem={(c: any, isSelected: boolean) => (
          <div className="flex items-center gap-3 w-full">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${isSelected ? "bg-white/20 text-white" : "bg-emerald-500/15 text-emerald-500"}`}>
              {c.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm truncate ${isSelected ? "text-white" : "text-gray-900 dark:text-white"}`}>
                {c.name}
              </p>
              {c.role && (
                <p className={`text-xs mt-0.5 capitalize ${isSelected ? "text-white/60" : "text-emerald-500"}`}>
                  {c.role}
                </p>
              )}
            </div>
          </div>
        )}
      />

      {/* Pay to market */}
      <PopupSelect
        isOpen={isMarketPopupOpen}
        onClose={() => setIsMarketPopupOpen(false)}
        data={marketsLoading ? [] : markets}
        title={t("selectMarket")}
        description={t("payToMarketDescription")}
        icon={<Store size={20} />}
        keyExtractor={(m: any) => m.id}
        searchKeys={["name"]}
        onSelect={handleMarketSelect}
        placeholder={t("searchPlaceholder")}
        selectLabel={t("selectLabel")}
        cancelLabel={t("cancelShort")}
        renderItem={(m: any, isSelected: boolean) => (
          <div className="flex items-center gap-3 w-full">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${isSelected ? "bg-white/20 text-white" : "bg-blue-500/15 text-blue-500"}`}>
              {m.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm truncate ${isSelected ? "text-white" : "text-gray-900 dark:text-white"}`}>
                {m.name}
              </p>
              {m.role && (
                <p className={`text-xs mt-0.5 capitalize ${isSelected ? "text-white/60" : "text-blue-400"}`}>
                  {m.role}
                </p>
              )}
            </div>
          </div>
        )}
      />

      {/* Spend from cashbox */}
      <CashboxFormPopup
        isOpen={isSpendPopupOpen}
        onClose={() => setIsSpendPopupOpen(false)}
        title={t("spendFromCashbox")}
        description={t("spendOperation")}
        icon={<Minus size={20} />}
        accentColor="from-rose-500 to-rose-600"
        submitLabel={t("spendLabel")}
        submitIcon={<Minus size={16} />}
        isLoading={cashboxSpand.isPending}
        onSubmit={({ amount, source_type_id, comment }) => {
          cashboxSpand.mutate(
            { data: { amount, source_type_id, comment } },
            { onSuccess: () => setIsSpendPopupOpen(false) },
          );
        }}
      />

      {/* Refill cashbox */}
      <CashboxFormPopup
        isOpen={isRefillPopupOpen}
        onClose={() => setIsRefillPopupOpen(false)}
        title={t("fillCashbox")}
        description={t("incomeOperation")}
        icon={<Plus size={20} />}
        accentColor="from-emerald-500 to-teal-500"
        submitLabel={t("incomeLabel")}
        submitIcon={<Plus size={16} />}
        isLoading={cashboxFill.isPending}
        onSubmit={({ amount, source_type_id, comment }) => {
          cashboxFill.mutate(
            { data: { amount, source_type_id, comment } },
            { onSuccess: () => setIsRefillPopupOpen(false) },
          );
        }}
      />

      <CloseShiftPopup
        isOpen={isCloseShiftPopupOpen}
        onClose={() => setIsCloseShiftPopupOpen(false)}
        isLoading={closeShift.isPending}
        onConfirm={(comment) => {
          closeShift.mutate(comment || undefined, {
            onSuccess: () => {
              setIsCloseShiftPopupOpen(false);
              handleExportExcel();
            },
          });
        }}
      />
    </div>
  );
};

export default memo(MainCashbox);

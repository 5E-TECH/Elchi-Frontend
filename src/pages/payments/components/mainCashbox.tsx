import { memo, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  Wallet,
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
import DateRangePicker from "../../../shared/ui/DateRangePicker";
import PopupSelect from "../../../shared/components/popupSelect";
import CashboxFormPopup from "./CashboxFormPopup";
import CloseShiftPopup from "./CloseShiftPopup";
import CashboxSummaryCard from "./CashboxSummaryCard";
import { useUser } from "../../../entities/user/api/userApi";
import { useMarkets } from "../../../entities/markets";
import { useCashBox } from "../../../entities/payments";
import type { PaymentRow } from "./patmentHistoryTable";
import PaymentHistoryList from "./PaymentHistoryList";
import { exportMainCashboxReport } from "./lib/exportMainCashboxReport";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../app/config/store";
import { getUserBranchType } from "../../../widgets/Sidebar/model/menuConfig";

// ─── Utils ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("uz-UZ", { maximumFractionDigits: 0 });

const toNumber = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const toDataItems = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;

  const record = asRecord(value);
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.data)) return record.data;

  const data = asRecord(record.data);
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;

  return [];
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
  const navigate = useNavigate();
  const role = useSelector((state: RootState) => state.role.role);
  const user = useSelector((state: RootState) => state.user.user);
  const branchType = getUserBranchType(user);

  const { getUser, getCouriers } = useUser();
  const { getMarkets } = useMarkets();
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
  const { data: couriersData, isLoading: couriersLoading } = getCouriers(
    { status: "active", limit: 0 },
    isCourierPopupOpen,
  );
  const { data: marketsData, isLoading: marketsLoading } = getMarkets(
    { status: "active", limit: 0 },
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
      page: 1,
      limit: 0,
      ...(draftHistoryFrom && draftHistoryTo && { fromDate: draftHistoryFrom, toDate: draftHistoryTo }),
    }),
    [draftHistoryFrom, draftHistoryTo],
  );
  const {
    data: historyRes,
    isLoading: historyLoading,
    isFetching: historyFetching,
  } = getFinanceHistory(historyParams);

  const employees = useMemo(
    () =>
      (usersData?.data?.items ?? []).filter((employee: any) => {
        const role = String(employee?.role ?? "").toLowerCase();
        return role !== "market" && role !== "courier";
      }),
    [usersData?.data?.items],
  );
  const couriers = useMemo(
    () =>
      toDataItems(couriersData).map((courier) => {
        const item = asRecord(courier);
        const region = asRecord(item.region);
        const cashbox = asRecord(item.cashbox);

        return {
          ...item,
          id: String(item.id ?? ""),
          name: String(item.name ?? ""),
          region: String(region.name ?? t("unknown")),
          amount: toNumber(
            item.olinishi_kerak ??
              cashbox.olinishi_kerak ??
              cashbox.balance ??
              item.amount,
          ),
        };
      }).filter((courier) => courier.id),
    [couriersData, t],
  );
  const markets = useMemo(
    () =>
      (marketsData?.data?.items ?? []).map((market: any) => ({
        ...market,
        amount: toNumber(
          market.berilishi_kerak ??
            market.cashbox?.berilishi_kerak ??
            market.cashbox?.balance ??
            market.amount,
        ),
      })).filter((market: any) => market.amount !== 0),
    [marketsData?.data?.items],
  );

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
  const { filteredIncome, filteredExpense, weeklyStats, monthlyStats } = useMemo(() => {
    const todayStart = buildRangeStart("today");
    const weekStart = buildRangeStart("week");
    const monthStart = buildRangeStart("month");
    const todayEnd = toIsoDate(new Date());

    const safeRows = historyRows.filter((row) => {
      const rawDate = row.payment_date || row.createdAt || row.created_at;
      if (!rawDate) return false;
      const parsed = new Date(rawDate);
      return Number.isFinite(parsed.getTime());
    });

    const filterByRange = (fromDate: string) =>
      safeRows.filter((row) => {
        const rawDate = row.payment_date || row.createdAt || row.created_at;
        if (!rawDate) return false;
        const isoDate = toIsoDate(new Date(rawDate));
        return isoDate >= fromDate && isoDate <= todayEnd;
      });

    const todayStats = summarizeHistory(filterByRange(todayStart));
    return {
      filteredIncome: todayStats.income,
      filteredExpense: todayStats.expense,
      weeklyStats: summarizeHistory(filterByRange(weekStart)),
      monthlyStats: summarizeHistory(filterByRange(monthStart)),
    };
  }, [historyRows]);

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

  const visibleActions = useMemo(() => {
    const shouldHideMarketAction =
      role === "manager" &&
      (branchType === "REGIONAL" || branchType === "HYBRID");

    if (!shouldHideMarketAction) return ACTIONS;

    return ACTIONS.filter((action) => action.label !== "payToMarket");
  }, [role, branchType]);

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
      labels: {
        defaultReportTitle: t("report"),
        mainCashbox: t("mainCashbox"),
        income: t("income"),
        expense: t("expense"),
        expenseSection: t("expenseSection"),
        balance: t("balance"),
        cash: t("cash"),
        card: t("card"),
        total: t("total"),
        no: t("no"),
        fromWhere: t("fromWhere"),
        toWhere: t("toWhere"),
        other: t("other"),
        comment: t("comment"),
        summaryIncome: t("summaryIncome"),
        summaryExpense: t("summaryExpense"),
      },
    });
  }, [
    historyRows,
    totalBalance,
    cashBalance,
    transferBalance,
    draftHistoryFrom,
    draftHistoryTo,
    t,
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
          <div className="flex flex-col gap-3">
            <CashboxSummaryCard
              accentClass="bg-main/30"
              accentIcon={<Wallet size={18} className="text-white" />}
              title="ELCHI"
              subtitle={t("mainCashbox")}
              holderName={t("mainCashboxTitle")}
              balance={totalBalance}
              balanceVisible={balanceVisible}
              onToggleVisibility={() => setBalanceVisible((v) => !v)}
            />

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: <Banknote size={14} />, label: t("cash"), amount: cashBalance },
                { icon: <ArrowLeftRight size={14} />, label: t("card"), amount: transferBalance },
              ].map(({ icon, label, amount }) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-sm"
                >
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/55">
                    {icon} {label}
                  </div>
                  {mainCashboxLoading || cashboxInfoLoading ? (
                    <Skeleton className="h-4 w-20" />
                  ) : (
                    <p className="text-sm font-bold text-white">
                      {balanceVisible ? `${fmt(amount)} ${t("currency")}` : "••••••"}
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
              {visibleActions.map(({ icon, label, shortLabelKey, color, bg }) => (
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
                  -{fmt(filteredExpense)} {t("currency")}
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
                  -{fmt(weeklyStats.expense)} {t("currency")}
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
                  -{fmt(monthlyStats.expense)} {t("currency")}
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
        title={t("toBeReceived")}
        description={couriersLoading ? t("loadingLabel") : t("selectCourierDescription")}
        icon={<Truck size={20} />}
        keyExtractor={(c: any) => c.id}
        searchKeys={["name", "region"]}
        onSelect={handleCourierSelect}
        placeholder={t("searchPlaceholder")}
        selectLabel={t("selectLabel")}
        cancelLabel={t("cancelShort")}
        renderItem={(c: any, isSelected: boolean) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isSelected ? "bg-white/20" : "bg-orange-500/10"
                }`}
              >
                <Truck
                  size={16}
                  className={isSelected ? "text-white" : "text-orange-400"}
                />
              </div>
              <div>
                <p
                  className={`font-medium text-sm ${
                    isSelected ? "text-white" : "text-gray-800 dark:text-white"
                  }`}
                >
                  {c.name}
                </p>
                <p
                  className={`text-xs ${
                    isSelected ? "text-white/70" : "text-gray-500 dark:text-white/75"
                  }`}
                >
                  {c.region}
                </p>
              </div>
            </div>
            <span
              className={`text-sm font-semibold ${
                c.amount < 0
                  ? "text-rose-400"
                  : isSelected
                    ? "text-white/85"
                    : "text-gray-500 dark:text-white/80"
              }`}
            >
              {c.amount < 0 ? "-" : ""}
              {fmt(Math.abs(c.amount))} {t("currency")}
            </span>
          </div>
        )}
      />

      {/* Pay to market */}
      <PopupSelect
        isOpen={isMarketPopupOpen}
        onClose={() => setIsMarketPopupOpen(false)}
        data={marketsLoading ? [] : markets}
        title={t("toBeGiven")}
        description={marketsLoading ? t("loadingLabel") : t("selectMarketDescription")}
        icon={<Store size={20} />}
        keyExtractor={(m: any) => m.id}
        searchKeys={["name"]}
        onSelect={handleMarketSelect}
        placeholder={t("searchPlaceholder")}
        selectLabel={t("selectLabel")}
        cancelLabel={t("cancelShort")}
        renderItem={(m: any, isSelected: boolean) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
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
            <span
              className={`text-sm font-semibold ${
                m.amount < 0
                  ? "text-rose-400"
                  : isSelected
                    ? "text-white/85"
                    : "text-gray-500 dark:text-white/80"
              }`}
            >
              {m.amount < 0 ? "-" : ""}
              {fmt(Math.abs(m.amount))} {t("currency")}
            </span>
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
        typeLabel={t("operationType")}
        typePlaceholder={t("paymentTypePlaceholder")}
        sourceTypes={[
          { id: "cash", name: t("cash") },
          { id: "click", name: t("clickPayment") },
        ]}
        requireType
        requireComment
        isLoading={cashboxSpand.isPending}
        onSubmit={({ amount, type, comment }) => {
          cashboxSpand.mutate(
            { data: { amount, type, comment } },
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
        typeLabel={t("operationType")}
        typePlaceholder={t("paymentTypePlaceholder")}
        sourceTypes={[
          { id: "cash", name: t("cash") },
          { id: "click", name: t("clickPayment") },
        ]}
        requireType
        requireComment
        isLoading={cashboxFill.isPending}
        onSubmit={({ amount, type, comment }) => {
          cashboxFill.mutate(
            { data: { amount, type, comment } },
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

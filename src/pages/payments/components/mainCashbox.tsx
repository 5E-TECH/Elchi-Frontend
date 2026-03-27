import { memo, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  Eye,
  EyeOff,
  Download,
  LogOut,
  Clock,
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
  ChevronRight,
} from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import LogoTextDark from "../../../shared/assets/logoo.png";
import FilterDateRange from "../../../shared/ui/FilterDateRange";
import PopupSelect from "../../../shared/components/popupSelect";
import CashboxFormPopup from "./CashboxFormPopup";
import { useUser } from "../../../entities/user/api/userApi";
import { useCashBox } from "../../../entities/payments";
import type { PaymentRow, Pagination } from "./patmentHistoryTable";
import PaymentHistoryList from "./PaymentHistoryList";

// ─── Utils ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("uz-UZ", { maximumFractionDigits: 0 });

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const toNumber = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const sumHistoryByOp = (rows: PaymentRow[], op: "income" | "expense") =>
  rows.reduce(
    (sum, row) =>
      row.operation_type === op ? sum + Math.abs(toNumber(row.amount)) : sum,
    0,
  );

const pickHistoryTotals = (payload: unknown) => {
  if (!isRecord(payload)) return { income: 0, expense: 0 };
  const bases = [
    payload,
    isRecord(payload.summary) ? payload.summary : null,
    isRecord(payload.totals) ? payload.totals : null,
    isRecord(payload.meta) ? payload.meta : null,
  ].filter(Boolean);

  const getVal = (base: unknown, keys: string[]) => {
    if (!isRecord(base)) return 0;
    for (const k of keys) {
      const n = toNumber(base[k], 0);
      if (n) return n;
    }
    return 0;
  };

  let income = 0;
  let expense = 0;
  for (const base of bases) {
    income ||= getVal(base, ["income", "total_income", "totalIncome", "income_sum"]);
    expense ||= getVal(base, ["expense", "total_expense", "totalExpense", "expense_sum"]);
    if (income || expense) break;
  }
  return { income, expense };
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionLabel =
  | "Receive from courier"
  | "Pay to market"
  | "Spend from cashbox"
  | "Refill cashbox"
  | "Pay salary";

const ACTIONS: {
  icon: React.ReactNode;
  label: ActionLabel;
  shortLabel: string;
  color: string;
  bg: string;
}[] = [
  {
    icon: <Truck size={20} />,
    label: "Receive from courier",
    shortLabel: "Kuryer",
    color: "text-emerald-400",
    bg: "bg-emerald-500/15 hover:bg-emerald-500/25",
  },
  {
    icon: <Store size={20} />,
    label: "Pay to market",
    shortLabel: "Market",
    color: "text-blue-400",
    bg: "bg-blue-500/15 hover:bg-blue-500/25",
  },
  {
    icon: <Minus size={20} />,
    label: "Spend from cashbox",
    shortLabel: "Chiqim",
    color: "text-rose-400",
    bg: "bg-rose-500/15 hover:bg-rose-500/25",
  },
  {
    icon: <Plus size={20} />,
    label: "Refill cashbox",
    shortLabel: "Kirim",
    color: "text-teal-400",
    bg: "bg-teal-500/15 hover:bg-teal-500/25",
  },
  {
    icon: <DollarSign size={20} />,
    label: "Pay salary",
    shortLabel: "Maosh",
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
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [isSalaryPopupOpen, setIsSalaryPopupOpen] = useState(false);
  const [isCourierPopupOpen, setIsCourierPopupOpen] = useState(false);
  const [isMarketPopupOpen, setIsMarketPopupOpen] = useState(false);
  const [isSpendPopupOpen, setIsSpendPopupOpen] = useState(false);
  const [isRefillPopupOpen, setIsRefillPopupOpen] = useState(false);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const historyLimit = 10;
  const navigate = useNavigate();

  const { getUser } = useUser();
  const {
    cashboxSpand,
    cashboxFill,
    getSourceTypes,
    getCashBoxMain,
    getFinanceHistory,
    getCurrentShift,
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
  const { data: srcTypesData } = getSourceTypes();
  const { data: mainCashboxRes, isLoading: mainCashboxLoading } = getCashBoxMain();
  const { data: shiftRes, isLoading: shiftLoading } = getCurrentShift();

  const employees = usersData?.data?.items ?? [];
  const couriers = couriersData?.data?.items ?? [];
  const markets = marketsData?.data?.items ?? [];
  const sourceTypes = (srcTypesData?.data ?? []) as { id: string | number; name: string }[];

  // ── Cashbox balances ───────────────────────────────────────────────────────
  const mainCashboxData = mainCashboxRes?.data ?? {};
  const totalBalance = toNumber(
    (mainCashboxData as any)?.balance ??
      (mainCashboxData as any)?.total ??
      (mainCashboxData as any)?.main?.balance,
  );
  const cashBalance = toNumber(
    (mainCashboxData as any)?.balance_cash ??
      (mainCashboxData as any)?.balanceCash ??
      (mainCashboxData as any)?.cash,
  );
  const transferBalance = toNumber(
    (mainCashboxData as any)?.balance_card ??
      (mainCashboxData as any)?.balanceCard ??
      (mainCashboxData as any)?.transfer,
  );

  // ── History ────────────────────────────────────────────────────────────────
  const historyParams = useMemo(
    () => {
      const params: Record<string, string | number> = {
        page: historyPage,
        limit: historyLimit,
      };

      // `finance/history` endpoint strict bo‘lishi mumkin; aliaslarni (start_day/startDate/...) yubormaymiz.
      if (historyFrom) params.from_date = historyFrom;
      if (historyTo) params.to_date = historyTo;

      return params;
    },
    [historyFrom, historyPage, historyTo],
  );

  const { data: historyRes, isLoading: historyLoading } = getFinanceHistory(historyParams);
  const historyPayload = historyRes?.data;
  const historyRows: PaymentRow[] = (historyPayload?.items ?? historyPayload?.data ?? []) as PaymentRow[];
  const historyPagination: Pagination | undefined = (historyPayload?.pagination ?? historyPayload?.meta) as Pagination | undefined;

  const payloadTotals = useMemo(() => pickHistoryTotals(historyPayload), [historyPayload]);
  const filteredIncome = useMemo(
    () => payloadTotals.income || sumHistoryByOp(historyRows, "income"),
    [historyRows, payloadTotals.income],
  );
  const filteredExpense = useMemo(
    () => payloadTotals.expense || sumHistoryByOp(historyRows, "expense"),
    [historyRows, payloadTotals.expense],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleActionClick = useCallback((label: ActionLabel) => {
    const map: Record<ActionLabel, () => void> = {
      "Pay salary": () => setIsSalaryPopupOpen(true),
      "Receive from courier": () => setIsCourierPopupOpen(true),
      "Pay to market": () => setIsMarketPopupOpen(true),
      "Spend from cashbox": () => setIsSpendPopupOpen(true),
      "Refill cashbox": () => setIsRefillPopupOpen(true),
    };
    map[label]?.();
  }, []);

  const handleCourierSelect = useCallback(
    (courier: any) => {
      setIsCourierPopupOpen(false);
      navigate("/payments/cash-detail", { state: { type: "courier", entity: courier } });
    },
    [navigate],
  );

  const handleMarketSelect = useCallback(
    (market: any) => {
      setIsMarketPopupOpen(false);
      navigate("/payments/cash-detail", { state: { type: "market", entity: market } });
    },
    [navigate],
  );

  // ── Shift ──────────────────────────────────────────────────────────────────
  const shiftEmployee =
    (shiftRes?.data?.employee?.name as string | undefined) ??
    (shiftRes?.data?.user?.name as string | undefined) ??
    (shiftRes?.data?.opened_by?.name as string | undefined) ??
    (shiftRes?.data?.opened_by as string | undefined);
  const shiftIsOpen = Boolean(shiftRes?.data);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-5 bg-sidebar dark:bg-maindark min-h-full flex flex-col gap-5 rounded-2xl">
      {/* ── Header ── */}
      <div className="bg-primary dark:bg-primarydark rounded-2xl border border-gray-200 dark:border-glass-border px-4 shadow-sm">
        <HeaderName
          name="Main Cashbox"
          description="Asosiy kassa boshqaruvi"
          icon={<Wallet />}
          onIconClick={() => navigate(-1)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ════ LEFT COLUMN ════ */}
        <div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-4">

          {/* ── Balance card ── */}
          <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-[#3b2f6e] via-[#2e2659] to-[#1e1a42] border border-white/10 shadow-2xl">
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
                aria-label={balanceVisible ? "Yashirish" : "Ko'rsatish"}
              >
                {balanceVisible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </div>

            {/* Total balance */}
            <div className="relative z-10 mb-5">
              <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Wallet size={11} /> Umumiy balans
              </p>
              {mainCashboxLoading ? (
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
                { icon: <Banknote size={14} />, label: "NAQD", amount: cashBalance },
                { icon: <ArrowLeftRight size={14} />, label: "O'TKAZMA", amount: transferBalance },
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
              Tezkor amallar
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {ACTIONS.map(({ icon, label, shortLabel, color, bg }) => (
                <button
                  key={label}
                  onClick={() => handleActionClick(label)}
                  title={label}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl ${bg} ${color} transition-all duration-150 active:scale-95`}
                >
                  <span className="text-current">{icon}</span>
                  <span className="text-[10px] font-semibold text-center leading-tight text-gray-600 dark:text-white/60">
                    {shortLabel}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Shift status ── */}
          <div
            className={`flex items-center gap-3 p-4 rounded-2xl border ${
              shiftIsOpen
                ? "bg-emerald-500/10 border-emerald-500/25"
                : "bg-rose-500/10 border-rose-500/25"
            }`}
          >
            {/* Status dot */}
            <div className="relative shrink-0">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
                  shiftIsOpen ? "bg-emerald-500" : "bg-rose-500"
                }`}
              >
                <Clock size={17} />
              </div>
              {shiftIsOpen && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#1e1a42] animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 dark:text-white">
                {shiftLoading ? (
                  <Skeleton className="h-4 w-24" />
                ) : shiftIsOpen ? (
                  "Smena ochiq"
                ) : (
                  "Smena yopiq"
                )}
              </p>
              {shiftEmployee && (
                <p
                  className={`text-xs font-medium truncate mt-0.5 ${
                    shiftIsOpen ? "text-emerald-500" : "text-rose-400"
                  }`}
                >
                  {shiftEmployee}
                </p>
              )}
            </div>
            {!shiftLoading && (
              <ChevronRight
                size={16}
                className={shiftIsOpen ? "text-emerald-400" : "text-rose-400"}
              />
            )}
          </div>

          {/* ── Export + Close Shift ── */}
          <div className="flex gap-2.5">
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-main/60 text-main text-sm font-semibold hover:bg-main/10 transition-colors">
              <Download size={15} />
              Excel
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-orange-500/60 text-orange-400 text-sm font-semibold hover:bg-orange-500/10 transition-colors">
              <LogOut size={15} />
              Smenani yopish
            </button>
          </div>
        </div>

        {/* ════ RIGHT COLUMN ════ */}
        <div className="flex flex-col gap-4 lg:col-span-7 xl:col-span-8">

          {/* ── Income / Expense summary cards ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4 bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg border border-white/10 flex flex-col justify-between min-h-[100px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Kirim</span>
                <TrendingUp size={16} className="text-white/50" />
              </div>
              <div>
                <p className="text-2xl font-black text-white tabular-nums leading-none">
                  +{fmt(filteredIncome)}
                </p>
                <p className="text-[11px] text-white/60 mt-1">UZS</p>
              </div>
            </div>

            <div className="rounded-2xl p-4 bg-gradient-to-br from-rose-500 to-fuchsia-600 shadow-lg border border-white/10 flex flex-col justify-between min-h-[100px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Chiqim</span>
                <TrendingDown size={16} className="text-white/50" />
              </div>
              <div>
                <p className="text-2xl font-black text-white tabular-nums leading-none">
                  -{fmt(filteredExpense)}
                </p>
                <p className="text-[11px] text-white/60 mt-1">UZS</p>
              </div>
            </div>
          </div>

          {/* ── Today's transactions (date filter) ── */}
          <div className="bg-primary dark:bg-primarydark rounded-2xl border border-gray-200 dark:border-glass-border overflow-visible relative z-30">
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-glass-border flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-violet-500/15 text-violet-300 flex items-center justify-center shrink-0">
                  <Clock size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white/90 truncate">
                    Today&apos;s transactions
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-white/45 truncate">
                    Bugungi operatsiyalar (sana bo&apos;yicha)
                  </p>
                </div>
              </div>
              {(historyFrom || historyTo) && (
                <button
                  onClick={() => {
                    setHistoryFrom("");
                    setHistoryTo("");
                    setHistoryPage(1);
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors"
                >
                  Tozalash
                </button>
              )}
            </div>
            <div className="px-5 py-4">
              <FilterDateRange
                dateFrom={historyFrom}
                dateTo={historyTo}
                onChangeDateFrom={(val) => {
                  setHistoryFrom(val);
                  setHistoryPage(1);
                }}
                onChangeDateTo={(val) => {
                  setHistoryTo(val);
                  setHistoryPage(1);
                }}
                className="w-full gap-3"
                fromClassName="flex-1 min-w-[140px]"
                toClassName="flex-1 min-w-[140px]"
                iconClassName="text-gray-400 dark:text-white/50 shrink-0"
              />
            </div>
          </div>

          {/* ── Payment history table ── */}
          <div className="bg-primary dark:bg-primarydark rounded-2xl border border-gray-200 dark:border-glass-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-glass-border">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                To'lov tarixi
              </p>
              {historyPagination?.total !== undefined && (
                <span className="text-xs bg-violet-500/15 text-violet-300 font-bold px-2.5 py-1 rounded-full">
                  {historyPagination.total} ta
                </span>
              )}
            </div>
            <PaymentHistoryList
              data={historyRows}
              isLoading={historyLoading}
              pagination={historyPagination}
              onPageChange={(p) => setHistoryPage(p)}
              currentPage={historyPage}
              withContainer={false}
            />
          </div>
        </div>
      </div>

      {/* ════ POPUPS ════ */}

      {/* Pay Salary */}
      <PopupSelect
        isOpen={isSalaryPopupOpen}
        onClose={() => setIsSalaryPopupOpen(false)}
        data={usersLoading ? [] : employees}
        title="Xodimni tanlang"
        description="Maosh to'lash uchun"
        icon={<User size={20} />}
        keyExtractor={(emp: any) => emp.id}
        searchKeys={["name"]}
        labelKey="name"
        secondaryLabelKey="role"
        onSelect={(emp) => {
          setIsSalaryPopupOpen(false);
          console.log("Salary employee:", emp);
        }}
        placeholder="Qidirish..."
        selectLabel="Tanlash"
        cancelLabel="Bekor"
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
        title="Kuryer tanlang"
        description="Kuryerdan qabul qilish"
        icon={<Truck size={20} />}
        keyExtractor={(c: any) => c.id}
        searchKeys={["name"]}
        onSelect={handleCourierSelect}
        placeholder="Qidirish..."
        selectLabel="Tanlash"
        cancelLabel="Bekor"
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
        title="Market tanlang"
        description="Marketga to'lov qilish"
        icon={<Store size={20} />}
        keyExtractor={(m: any) => m.id}
        searchKeys={["name"]}
        onSelect={handleMarketSelect}
        placeholder="Qidirish..."
        selectLabel="Tanlash"
        cancelLabel="Bekor"
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
        title="Kassadan chiqim"
        description="Chiqim operatsiyasi"
        icon={<Minus size={20} />}
        accentColor="from-rose-500 to-rose-600"
        submitLabel="Chiqim"
        submitIcon={<Minus size={16} />}
        sourceTypes={sourceTypes}
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
        title="Kassani to'ldirish"
        description="Kirim operatsiyasi"
        icon={<Plus size={20} />}
        accentColor="from-emerald-500 to-teal-500"
        submitLabel="Kirim"
        submitIcon={<Plus size={16} />}
        sourceTypes={sourceTypes}
        isLoading={cashboxFill.isPending}
        onSubmit={({ amount, source_type_id, comment }) => {
          cashboxFill.mutate(
            { data: { amount, source_type_id, comment } },
            { onSuccess: () => setIsRefillPopupOpen(false) },
          );
        }}
      />
    </div>
  );
};

export default memo(MainCashbox);

import { memo, useEffect, useMemo, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  PackageCheck,
  Phone,
  Send,
  Store,
  TrendingDown,
  TrendingUp,
  Truck,
  UserRound,
  Wallet2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import HeaderName from "../../../shared/components/headerName";
import PaymentHistoryList from "./PaymentHistoryList";
import type { Pagination, PaymentRow } from "./patmentHistoryTable";
import DateRangePicker from "../../../shared/ui/DateRangePicker";
import { useCashBox } from "../../../entities/payments";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n";

const fmt = (n: number) => n.toLocaleString("uz-UZ");

const formatDisplayName = (value?: string | null) => {
  if (!value) return "";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

const normalizeType = (
  cashboxType?: string | null,
  role?: string | null,
): "market" | "courier" => {
  if (cashboxType === "couriers" || role === "courier") return "courier";
  return "market";
};

const HISTORY_PAGE_SIZE = 8;

const getHistoryDate = (row: PaymentRow) =>
  (row.payment_date || row.createdAt || row.created_at || "") as string;

const buildLast30DaysChart = (rows: PaymentRow[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const points = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (29 - index));

    return {
      key: date.toISOString().slice(0, 10),
      label: `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`,
      income: 0,
      expense: 0,
    };
  });

  const map = new Map(points.map((point) => [point.key, point]));

  rows.forEach((row) => {
    const rawDate = getHistoryDate(row);
    if (!rawDate) return;

    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;

    const point = map.get(date.toISOString().slice(0, 10));
    if (!point) return;

    const amount = Math.abs(toNumber(row.amount));
    const operationType =
      row.operation_type ?? (toNumber(row.amount) >= 0 ? "income" : "expense");

    if (operationType === "income") point.income += amount;
    else point.expense += amount;
  });

  return points;
};

const OwnerInfoItem = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="rounded-xl border border-gray-200 bg-sidebar px-4 py-3 dark:border-glass-border dark:bg-white/5">
    <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40">
      {icon}
      {label}
    </div>
    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
      {value}
    </p>
  </div>
);

const ChartTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-glass-border bg-primary/95 px-3 py-2 shadow-xl dark:bg-maindark/95">
      <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-white/50">
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between gap-4 text-xs"
          >
            <span className="font-medium" style={{ color: item.color }}>
              {item.name}
            </span>
            <span className="font-bold text-gray-900 dark:text-white">
              {fmt(toNumber(item.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export interface DetailState {
  type: "market" | "courier";
  entity?: {
    id?: string;
    name?: string;
    phone_number?: string;
    role?: string;
  };
}

const CONFIG = {
  market: {
    kassaLabel: "Market kassasi",
    brand: "BEEPOST",
    headerIcon: <Store size={20} />,
    entityIcon: <Store size={18} className="text-white" />,
    actionLabel: "Pay",
    actionSub: "Marketga to'lov",
    submitLabel: "Pay",
    actionGradient: "from-main to-primarydark",
    iconBg: "bg-main/30",
  },
  courier: {
    kassaLabel: "Kuryer kassasi",
    brand: "BEEPOST",
    headerIcon: <Truck size={20} />,
    entityIcon: <Truck size={18} className="text-white" />,
    actionLabel: "Receive",
    actionSub: "Kuryerdan qabul qilish",
    submitLabel: "Receive",
    actionGradient: "from-success to-info",
    iconBg: "bg-success/25",
  },
} as const;

interface CashDetailFormValues {
  amount: string;
  paymentType: string;
  comment: string;
}

const cashDetailSchema: yup.ObjectSchema<CashDetailFormValues> = yup.object({
  amount: yup
    .string()
    .required(i18n.t("payments:amountRequired"))
    .test("positive-number", i18n.t("payments:amountPositiveValidation"), (value) => {
      if (!value) return false;
      return Number(value) > 0;
    }),
  paymentType: yup.string().required(i18n.t("payments:paymentTypeRequired")),
  comment: yup.string().defined(),
});

const CashDetail = () => {
  const { t } = useTranslation("payments");
  const { id } = useParams<{ id: string }>();
  const { state } = useLocation() as { state: DetailState | null };
  const navigate = useNavigate();
  const { getCashBoxById } = useCashBox();

  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [balanceVisible, setBalanceVisible] = useState(true);

  useEffect(() => {
    if (draftDateFrom && draftDateTo) {
      setAppliedDateFrom(draftDateFrom);
      setAppliedDateTo(draftDateTo);
      return;
    }

    if (!draftDateFrom && !draftDateTo) {
      setAppliedDateFrom("");
      setAppliedDateTo("");
    }
  }, [draftDateFrom, draftDateTo]);

  const detailParams = useMemo(
    () => ({
      ...(appliedDateFrom && { fromDate: appliedDateFrom }),
      ...(appliedDateTo && { toDate: appliedDateTo }),
    }),
    [appliedDateFrom, appliedDateTo],
  );

  const {
    data: cashboxResponse,
    isLoading,
    isFetching,
  } = getCashBoxById(id || "", Boolean(id), detailParams);

  const detailData = cashboxResponse?.data;
  const cashbox = detailData?.cashbox;
  const user = cashbox?.user ?? state?.entity;

  const type =
    state?.type ?? normalizeType(cashbox?.cashbox_type, user?.role);
  const cfg = CONFIG[type];
  const paymentTypeOptions = [
    { value: "", label: t("paymentTypePlaceholder") },
    { value: "cash", label: t("cash") },
    { value: "click", label: "Click" },
    { value: "payme", label: "Payme" },
    { value: "transfer", label: "Transfer" },
  ];

  const entityName = user?.name?.trim() || "Foydalanuvchi";
  const totalBalance = toNumber(cashbox?.balance);
  const cashBalance = toNumber(cashbox?.balance_cash);
  const cardBalance = toNumber(cashbox?.balance_card);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CashDetailFormValues>({
    defaultValues: {
      amount: "",
      paymentType: "",
      comment: "",
    },
    resolver: yupResolver(cashDetailSchema) as Resolver<CashDetailFormValues>,
  });

  const historyRows = useMemo<PaymentRow[]>(() => {
    const rows = Array.isArray(detailData?.cashboxHistory)
      ? detailData.cashboxHistory
      : [];

    return rows.map((item: any, index: number) => {
      const amount = toNumber(item?.amount);
      const operationType =
        item?.operation_type ?? (amount >= 0 ? "income" : "expense");

      return {
        id: String(
          item?.id ?? `${index}-${item?.createdAt ?? item?.payment_date ?? "row"}`,
        ),
        amount,
        operation_type: operationType,
        source_type: item?.source_type ?? formatDisplayName(item?.type),
        source_id: item?.source_id,
        cashbox_type: item?.cashbox_type ?? cashbox?.cashbox_type,
        created_by:
          item?.created_by ??
          item?.createdBy ??
          item?.user?.name ??
          entityName,
        payment_method:
          item?.payment_method ?? formatDisplayName(item?.method),
        payment_date:
          item?.payment_date ?? item?.createdAt ?? item?.created_at,
        comment: item?.comment,
        createdAt: item?.createdAt,
        created_at: item?.created_at,
        cashbox: item?.cashbox,
      };
    });
  }, [cashbox?.cashbox_type, detailData?.cashboxHistory, entityName]);

  const income = toNumber(detailData?.income);
  const expense = toNumber(detailData?.outcome);

  const chartData = useMemo(
    () => buildLast30DaysChart(historyRows),
    [historyRows],
  );

  const paginatedHistoryRows = useMemo(
    () =>
      historyRows.slice(
        (currentPage - 1) * HISTORY_PAGE_SIZE,
        currentPage * HISTORY_PAGE_SIZE,
      ),
    [currentPage, historyRows],
  );

  const pagination = useMemo<Pagination>(
    () => ({
      page: currentPage,
      limit: HISTORY_PAGE_SIZE,
      total: historyRows.length,
      totalPages: Math.max(1, Math.ceil(historyRows.length / HISTORY_PAGE_SIZE)),
    }),
    [currentPage, historyRows.length],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedDateFrom, appliedDateTo, historyRows.length]);

  const onSubmit = (values: CashDetailFormValues) => {
    console.log({
      type,
      userId: user?.id ?? id,
      cashboxId: cashbox?.id,
      amount: values.amount,
      paymentType: values.paymentType,
      comment: values.comment,
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-main" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-6 rounded-2xl bg-sidebar p-6 dark:bg-maindark">
      <div className="rounded-2xl border border-gray-200 bg-primary px-4 shadow-sm dark:border-glass-border dark:bg-maindark">
        <HeaderName
          name={entityName}
          description={cfg.kassaLabel}
          icon={cfg.headerIcon}
          onIconClick={() => navigate(-1)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-4">
          <div
            className="relative overflow-hidden rounded-2xl border border-glass-border p-6 shadow-2xl"
            style={{
              background:
                "linear-gradient(135deg, var(--color-maindark) 0%, var(--color-background) 55%, var(--color-main) 100%)",
            }}
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-main/25 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-info/20 blur-2xl" />

            <div className="relative z-10 mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${cfg.iconBg}`}>
                  {cfg.entityIcon}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{cfg.brand}</p>
                  <p className="text-[11px] text-white/40">{entityName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBalanceVisible((prev) => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/60 transition-colors hover:bg-white/20"
              >
                {balanceVisible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </div>

            <div className="relative z-10">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-white/50">
                <Wallet2 size={11} /> {t("totalBalanceLabel")}
              </p>
              <p className="text-3xl font-black tracking-tight text-white">
                {balanceVisible ? `${fmt(totalBalance)} UZS` : "••••••• UZS"}
              </p>
            </div>

            <div className="relative z-10 mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="mb-1 text-[11px] text-white/50">{t("cashBalance")}</p>
                <p className="text-sm font-bold text-white">
                  {balanceVisible ? `${fmt(cashBalance)} UZS` : "•••••••"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="mb-1 text-[11px] text-white/50">{t("cardBalance")}</p>
                <p className="text-sm font-bold text-white">
                  {balanceVisible ? `${fmt(cardBalance)} UZS` : "•••••••"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-linear-to-br from-success to-main p-5 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-white/80">{t("income")}</span>
                <TrendingUp size={18} className="text-white/70" />
              </div>
              <p className="text-2xl font-black text-white">+{fmt(income)}</p>
              <p className="mt-1 text-xs text-white/60">UZS</p>
            </div>

            <div className="rounded-2xl bg-linear-to-br from-error to-warning p-5 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-white/80">{t("expense")}</span>
                <TrendingDown size={18} className="text-white/70" />
              </div>
              <p className="text-2xl font-black text-white">-{fmt(expense)}</p>
              <p className="mt-1 text-xs text-white/60">UZS</p>
            </div>
          </div>

          <button
            type="button"
            className={`w-full rounded-2xl bg-linear-to-r py-4 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 ${cfg.actionGradient} flex items-center justify-center gap-2.5`}
          >
            {type === "market" ? <CreditCard size={18} /> : <PackageCheck size={18} />}
          <span>{cfg.actionLabel}</span>
            <span className="text-xs font-normal text-white/60">
              — {type === "market" ? t("payToMarket") : t("receiveFromCourier")}
            </span>
          </button>

          <div>
            <label className="mb-1.5 ml-1 block text-xs font-bold uppercase tracking-wide text-white/50">
              {t("amountLabel")} <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder="0"
                {...register("amount")}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-16 text-sm font-semibold text-gray-900 transition-all placeholder-gray-400 focus:border-main focus:outline-none focus:ring-2 focus:ring-main/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-white/20"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 dark:text-white/30">
                UZS
              </span>
            </div>
            {errors.amount && (
              <p className="mt-1 text-xs text-error">{errors.amount.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 ml-1 block text-xs font-bold uppercase tracking-wide text-white/50">
              {t("paymentType")} <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Controller
                control={control}
                name="paymentType"
                render={({ field }) => (
                  <select
                    value={field.value}
                    onChange={field.onChange}
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 transition-all focus:border-main focus:outline-none focus:ring-2 focus:ring-main/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  >
                    {paymentTypeOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        className="dark:bg-primarydark"
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              />
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 4.5L6 8L9.5 4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
            {errors.paymentType && (
              <p className="mt-1 text-xs text-error">
                {errors.paymentType.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 ml-1 block text-xs font-bold uppercase tracking-wide text-white/50">
              {t("comment")}
            </label>
            <textarea
              placeholder={t("commentPlaceholder")}
              rows={3}
              {...register("comment")}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 transition-all placeholder-gray-400 focus:border-main focus:outline-none focus:ring-2 focus:ring-main/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-white/20"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            className={`flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] ${cfg.actionGradient}`}
          >
            <Send size={16} />
            {cfg.submitLabel}
          </button>
        </div>

        <div className="flex flex-col gap-4 xl:col-span-8">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-primary dark:border-glass-border dark:bg-primarydark">
            <div className="border-b border-gray-100 px-5 py-3 dark:border-glass-border">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {t("ownerInfoTitle")}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-white/40">
                {t("ownerInfoDescription")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
              <OwnerInfoItem
                icon={<UserRound size={12} />}
                label={t("name")}
                value={entityName}
              />
              <OwnerInfoItem
                icon={<Phone size={12} />}
                label={t("phone")}
                value={user?.phone_number || "-"}
              />
              <OwnerInfoItem
                icon={cfg.headerIcon}
                label={t("role")}
                value={formatDisplayName(user?.role) || type}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-primary dark:border-glass-border dark:bg-primarydark">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-glass-border">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {t("transactions")}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-white/40">
                  {t("filterByDate")}
                </p>
              </div>
              {(draftDateFrom || draftDateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftDateFrom("");
                    setDraftDateTo("");
                  }}
                  className="text-xs font-semibold text-main transition-opacity hover:opacity-80"
                >
                  {t("clear")}
                </button>
              )}
            </div>
            <div className="p-4">
              <DateRangePicker
                value={{
                  startDate: draftDateFrom ? parseIsoDate(draftDateFrom) : null,
                  endDate: draftDateTo ? parseIsoDate(draftDateTo) : null,
                }}
                onChange={({ startDate, endDate }) => {
                  setDraftDateFrom(startDate ? toIsoDate(startDate) : "");
                  setDraftDateTo(endDate ? toIsoDate(endDate) : "");
                }}
                placeholder={`${t("startDate")} → ${t("endDate")}`}
                className="w-full"
              />
            </div>
            {((draftDateFrom && !draftDateTo) ||
              (!draftDateFrom && draftDateTo)) && (
              <p className="px-4 pb-4 text-xs text-gray-500 dark:text-white/45">
                {t("dateRangeRequired")}
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-primary dark:border-glass-border dark:bg-primarydark">
            <div className="border-b border-gray-100 px-5 py-3 dark:border-glass-border">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {t("last30DaysChart")}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-white/40">
                {t("dailyDynamics")}
              </p>
            </div>
            <div className="h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="cash-detail-income" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="cash-detail-expense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-error)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-error)" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="var(--color-glass-border)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--color-main)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={18}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-main)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => fmt(toNumber(value))}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name={t("income")}
                    stroke="var(--color-success)"
                    fill="url(#cash-detail-income)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    name={t("expense")}
                    stroke="var(--color-error)"
                    fill="url(#cash-detail-expense)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {isFetching && !isLoading && (
            <div className="flex items-center gap-2 px-1 text-xs text-gray-500 dark:text-white/50">
              <Loader2 size={14} className="animate-spin text-main" />
              {t("transactionsUpdating")}
            </div>
          )}

          <PaymentHistoryList
            data={paginatedHistoryRows}
            isLoading={isFetching && historyRows.length === 0}
            pagination={pagination}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(CashDetail);

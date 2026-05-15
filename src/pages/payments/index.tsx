// Migrated to React Hook Form
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  BadgeDollarSign,
  Store,
  Landmark,
  Truck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  User,
} from "lucide-react";
import HeaderName from "../../shared/components/headerName";
import FilterSelect, { type FilterSelectOption } from "../../shared/ui/FilterSelect";
import FilterClearButton from "../../shared/ui/FilterClearButton";
import PaymentHistoryTable from "./components/patmentHistoryTable";
import PopupSelect from "../../shared/components/popupSelect";
import { useNavigate } from "react-router-dom";
import { useCashBox } from "../../entities/payments";
import { useUser } from "../../entities/user/api/userApi";
import { useMarkets } from "../../entities/markets";
import { useTranslation } from "react-i18next";
import { usePagination } from "../../shared/lib/usePagination";
import PageContainer from "../../shared/ui/PageContainer";

const fmt = (n: number) => n.toLocaleString("uz-UZ");
const DEFAULT_PAYMENTS_LIMIT = 10;

type UnknownRecord = Record<string, unknown>;

type PaymentMarketOption = {
  id: string;
  name: string;
  phone_number: string;
  role: string;
  cashbox?: unknown;
  amount: number;
};

type PaymentCourierOption = {
  id: string;
  name: string;
  phone_number: string;
  role: string;
  region: string;
  region_id: string;
  cashbox?: unknown;
  amount: number;
};

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" ? (value as UnknownRecord) : {};

const getRecordString = (record: UnknownRecord, key: string, fallback = "") => {
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return fallback;
};

const toPositiveNumber = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
};

const normalizePagination = (
  raw: Record<string, unknown> | undefined,
  fallbackPage: number,
  fallbackLimit: number,
) => {
  const total = toPositiveNumber(
    raw?.total ??
      raw?.totalItems ??
      raw?.itemCount ??
      raw?.count,
  ) ?? 0;

  const page = toPositiveNumber(
    raw?.page ??
      raw?.currentPage,
  ) ?? fallbackPage;

  const limit = toPositiveNumber(
    raw?.limit ??
      raw?.perPage ??
      raw?.pageSize,
  ) ?? fallbackLimit;

  const totalPages = toPositiveNumber(
    raw?.totalPages ??
      raw?.lastPage,
  ) ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));

  return {
    total,
    page,
    limit,
    totalPages,
  };
};

const DROPDOWN_FILTERS = [
  { name: "operation_type", labelKey: "operationType", icon: TrendingUp },
  { name: "source_type", labelKey: "sourceType", icon: BadgeDollarSign },
  { name: "cashbox_type", labelKey: "cashboxType", icon: Landmark },
  { name: "created_by", labelKey: "createdBy", icon: User },
] as const;

type DropdownKey = (typeof DROPDOWN_FILTERS)[number]["name"];

const INIT = {
  operation_type: "",
  source_type: "",
  cashbox_type: "",
  created_by: "",
};

type PaymentsFilterFormValues = typeof INIT;

const paymentsFilterSchema: yup.ObjectSchema<PaymentsFilterFormValues> =
  yup.object({
    operation_type: yup.string().defined(),
    source_type: yup.string().defined(),
    cashbox_type: yup.string().defined(),
    created_by: yup.string().defined(),
  });

const Payments = () => {
  const { t } = useTranslation("payments");
  const { page, limit, setPage, setLimit, resetPagination } = usePagination({
    key: "payments",
    defaultLimit: DEFAULT_PAYMENTS_LIMIT,
    pageParam: "paymentsPage",
    limitParam: "paymentsLimit",
  });
  const previousFiltersKeyRef = useRef("");
  const [isGivenPopupOpen, setIsGivenPopupOpen] = useState(false);
  const [isReceivedPopupOpen, setIsReceivedPopupOpen] = useState(false);
  const { control, watch, reset } = useForm<PaymentsFilterFormValues>({
    defaultValues: INIT,
    resolver: yupResolver(
      paymentsFilterSchema,
    ) as Resolver<PaymentsFilterFormValues>,
  });
  const operationType = watch("operation_type");
  const sourceType = watch("source_type");
  const cashboxType = watch("cashbox_type");
  const createdBy = watch("created_by");

  const filters = useMemo(
    () => ({
      operation_type: operationType,
      source_type: sourceType,
      cashbox_type: cashboxType,
      created_by: createdBy,
    }),
    [cashboxType, createdBy, operationType, sourceType],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const navigate = useNavigate();
  const { getFinanceHistory, getCashBoxInfo } = useCashBox();
  const { getUser, getCouriers } = useUser();
  const { getMarkets } = useMarkets();

  // ── API dan cashbox ma'lumotlarini olish ──────────────────────────────────
  const { data: cashboxInfo, isLoading: cashboxLoading } = getCashBoxInfo();

  // Faqat popup ochiq bo'lganda yuklanadi
  const { data: marketsData, isLoading: marketsLoading } = getMarkets(
    { status: "active", limit: 0 },
    isGivenPopupOpen,
  );
  const { data: couriersData, isLoading: couriersLoading } = getCouriers(
    { status: "active", limit: 0 },
    isReceivedPopupOpen,
  );

  // API response: { statusCode, message, data: { mainCashboxTotal, courierCashboxTotal, marketCashboxTotal, ... } }
  const cashboxData = cashboxInfo?.data;
  const mainCashboxTotal = cashboxData?.mainCashboxTotal ?? 0;
  const courierCashboxTotal = cashboxData?.courierCashboxTotal ?? 0;
  const marketCashboxTotal = cashboxData?.marketCashboxTotal ?? 0;

  // ── To be given popup uchun market list ───────────────────────────────────
  const marketsList = useMemo<PaymentMarketOption[]>(
    () =>
      (marketsData?.data?.items ?? []).map((market: unknown) => {
        const m = asRecord(market);
        const cashbox = asRecord(m.cashbox);

        return {
          id: getRecordString(m, "id"),
          name: getRecordString(m, "name"),
          phone_number: getRecordString(m, "phone_number", getRecordString(m, "phone")),
          role: getRecordString(m, "role", "market"),
          cashbox: m.cashbox,
          amount: Number(cashbox.balance ?? m.amount ?? 0),
        };
      }),
    [marketsData],
  );

  // ── To be received popup uchun kuryerlar list ─────────────────────────────
  const couriersList = useMemo<PaymentCourierOption[]>(
    () =>
      (couriersData?.data?.items ?? []).map((courier: unknown) => {
        const c = asRecord(courier);
        const region = asRecord(c.region);
        const cashbox = asRecord(c.cashbox);

        return {
          id: getRecordString(c, "id"),
          name: getRecordString(c, "name"),
          phone_number: getRecordString(c, "phone_number", getRecordString(c, "phone")),
          role: getRecordString(c, "role", "courier"),
          region: getRecordString(region, "name", "Noma'lum"),
          region_id: getRecordString(region, "id", getRecordString(c, "region_id")),
          cashbox: c.cashbox,
          amount: Number(cashbox.balance ?? 0),
        };
      }),
    [couriersData],
  );

  // ── Stat cardlar (API qiymatlari bilan) ───────────────────────────────────
  const CARDS = [
    {
      label: t("toBeGiven"),
      amount: marketCashboxTotal,
      icon: <Store size={20} />,
      action: <ArrowUpRight size={16} />,
      bg: "bg-maindark",
      iconBg: "bg-main/20",
      badge: null,
      path: null,
      showPopup: "given" as const,
    },
    {
      label: t("amountInCashbox"),
      amount: mainCashboxTotal,
      icon: <Landmark size={20} />,
      action: <TrendingUp size={16} />,
      bg: "bg-gradient-to-br from-main to-main/80 shadow-main/30",
      iconBg: "bg-white/20",
      badge: t("mainCashboxBadge"),
      path: "main-cashbox",
      showPopup: null as null,
    },
    {
      label: t("toBeReceived"),
      amount: courierCashboxTotal,
      icon: <Truck size={20} />,
      action: <ArrowDownLeft size={16} />,
      bg: "bg-maindark",
      iconBg: "bg-main/20",
      badge: null,
      path: null,
      showPopup: "received" as const,
    },
  ] as const;
  const staticFilterOptions: Record<
    "operation_type" | "source_type",
    { value: string; label: string }[]
  > = {
    operation_type: [
      { value: "income", label: t("income") },
      { value: "expense", label: t("expense") },
    ],
    source_type: [
      { value: "courier_payment", label: t("paymentCourier") },
      { value: "market_payment", label: t("paymentMarket") },
      { value: "manual_expense", label: t("financialBalanceSourceManualExpense") },
      { value: "manual_income", label: t("financialBalanceSourceManualIncome") },
      { value: "correction", label: t("financialBalanceSourceCorrection") },
      { value: "salary", label: t("financialBalanceSourceSalary") },
      { value: "sell", label: t("sell") },
      { value: "cancel", label: t("cancelOperation") },
      { value: "extra_cost", label: t("extraCost") },
      { value: "bills", label: t("financialBalanceSourceBills") },
    ],
  };

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit };
    (Object.entries(filters) as [keyof typeof INIT, string][]).forEach(
      ([key, value]) => {
        if (value) params[key] = value;
      },
    );
    return params;
  }, [page, limit, filters]);

  useEffect(() => {
    if (!previousFiltersKeyRef.current) {
      previousFiltersKeyRef.current = filtersKey;
      return;
    }

    if (previousFiltersKeyRef.current === filtersKey) {
      return;
    }

    previousFiltersKeyRef.current = filtersKey;
    resetPagination(limit);
  }, [filtersKey, limit, resetPagination]);

  const { data: historyData, isLoading: historyLoading } =
    getFinanceHistory(queryParams);
  const { data: creatorsData, isLoading: creatorsLoading } = getUser({
    limit: 100,
  });
  const creatorOptions = useMemo(
    () =>
      (creatorsData?.data?.items || []).map((user: unknown) => {
        const u = asRecord(user);

        return {
          value: getRecordString(u, "id"),
          label: getRecordString(u, "name"),
        };
      }).filter((u: { value: string; label: string }) => u.value),
    [creatorsData],
  );

  const cashboxTypeOptions = useMemo<FilterSelectOption[]>(
    () => [
      { value: "main", label: "Asosiy", icon: Landmark },
      { value: "couriers", label: "Courier", icon: Truck },
      { value: "markets", label: "Market", icon: Store },
    ],
    [],
  );

  const handleCardClick = (
    path: string | null,
    showPopup: "given" | "received" | null,
  ) => {
    if (showPopup === "given") setIsGivenPopupOpen(true);
    else if (showPopup === "received") setIsReceivedPopupOpen(true);
    else if (path) navigate(path);
  };

  const filterOptionsMap: Record<DropdownKey, FilterSelectOption[]> = {
    operation_type: staticFilterOptions.operation_type,
    source_type: staticFilterOptions.source_type,
    cashbox_type: cashboxTypeOptions,
    created_by: creatorOptions,
  };

  const loadingMap: Record<DropdownKey, boolean> = {
    operation_type: false,
    source_type: false,
    cashbox_type: false,
    created_by: creatorsLoading,
  };

  const pagination = useMemo(
    () =>
      normalizePagination(
        (historyData?.data?.pagination ?? historyData?.data?.meta) as Record<string, unknown> | undefined,
        page,
        limit,
      ),
    [historyData?.data?.meta, historyData?.data?.pagination, limit, page],
  );

  return (
    <PageContainer className="flex flex-col gap-4 sm:gap-6">
      {/* Header */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-glass-border px-4 shadow-sm">
        <HeaderName
          name={t("title")}
          description={t("pageDescription")}
          icon={<BadgeDollarSign />}
        />
      </div>

      {/* Stats */}
      <div className="flex flex-col items-stretch gap-3 sm:gap-4 lg:flex-row">
        {CARDS.map(
          ({
            label,
            amount,
            icon,
            action,
            bg,
            iconBg,
            badge,
            path,
            showPopup,
          }) => (
            <div
              key={label}
              onClick={() => handleCardClick(path, showPopup)}
              className={`relative flex-1 overflow-hidden rounded-2xl p-4 sm:p-5 lg:p-6 border border-glass-border shadow-lg hover:scale-[1.02] transition-transform duration-300 ${bg} ${path || showPopup ? "cursor-pointer" : ""}`}
            >
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white opacity-[0.06]" />
              <div className="mb-4 flex items-start justify-between sm:mb-5">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-white sm:h-11 sm:w-11 ${iconBg}`}
                >
                  {icon}
                </div>
                <div className="flex items-center gap-2">
                  {badge && (
                    <div className="flex items-center gap-1.5 bg-glass px-2.5 py-1 rounded-lg border border-glass-border">
                      <TrendingUp size={11} className="text-white/80" />
                      <span className="text-white text-xs font-semibold">
                        {badge}
                      </span>
                    </div>
                  )}
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/70 sm:h-8 sm:w-8">
                    {action}
                  </div>
                </div>
              </div>
              <p className="mb-2 text-sm font-medium text-white/60">{label}</p>
              {cashboxLoading ? (
                <div className="h-9 w-32 rounded-lg bg-white/10 animate-pulse" />
              ) : (
                <p className="text-2xl font-extrabold text-white sm:text-3xl">
                  {fmt(amount)}
                </p>
              )}
              <p className="text-xs text-white/40 mt-1.5">UZS</p>
            </div>
          ),
        )}
      </div>

      {/* Filters */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-glass-border p-5 shadow-sm">
        <p className="text-sm font-bold text-gray-700 dark:text-white/70 mb-4">
          {t("filters")}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {DROPDOWN_FILTERS.map(({ name, labelKey, icon }) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field }) => (
                <FilterSelect
                  name={field.name}
                  label={t(labelKey)}
                  value={field.value}
                  onChange={field.onChange}
                  options={filterOptionsMap[name] || []}
                  placeholder={
                    name === "cashbox_type"
                      ? t("all", { ns: "common" })
                      : t("selectPlaceholder")
                  }
                  icon={icon}
                  loading={loadingMap[name]}
                />
              )}
            />
          ))}
        </div>
        {Object.values(filters).some(Boolean) && (
          <div className="flex items-center justify-end mt-3">
            <FilterClearButton
              onClick={() => {
                reset(INIT);
                resetPagination(limit);
              }}
            />
          </div>
        )}
      </div>

      {/* History table */}
      <PaymentHistoryTable
        data={historyData?.data?.items ?? []}
        isLoading={historyLoading}
        pagination={pagination}
        onPageChange={setPage}
        onItemsPerPageChange={setLimit}
        currentPage={page}
      />

      {/* To be given popup — API dan marketlar */}
      <PopupSelect<PaymentMarketOption>
        isOpen={isGivenPopupOpen}
        onClose={() => setIsGivenPopupOpen(false)}
        data={marketsList}
        title={t("toBeGiven")}
        description={marketsLoading ? t("loadingLabel") : t("selectMarketDescription")}
        icon={<Store size={20} />}
        keyExtractor={(m) => m.id}
        searchKeys={["name"]}
        labelKey="name"
        secondaryLabelKey="amount"
        onSelect={(market) => {
          setIsGivenPopupOpen(false);
          navigate(`/payments/cash-detail/${market.id}`, {
            state: { type: "market", entity: market },
          });
        }}
        renderItem={(market, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${isSelected ? "bg-white/20 text-white" : "bg-main/10 text-main"}`}
              >
                <Store size={16} />
              </div>
              <p
                className={`font-medium ${isSelected ? "text-white" : "text-gray-800 dark:text-white"}`}
              >
                {market.name}
              </p>
            </div>
            <span
              className={`text-sm font-semibold ${isSelected ? "text-white/85" : "text-gray-500 dark:text-white/80"}`}
            >
              {fmt(market.amount)} UZS
            </span>
          </div>
        )}
      />

      {/* To be received popup */}
      <PopupSelect<PaymentCourierOption>
        isOpen={isReceivedPopupOpen}
        onClose={() => setIsReceivedPopupOpen(false)}
        data={couriersList}
        title={t("toBeReceived")}
        description={couriersLoading ? t("loadingLabel") : t("selectCourierDescription")}
        icon={<Truck size={20} />}
        keyExtractor={(c) => c.id}
        searchKeys={["name", "region"]}
        labelKey="name"
        onSelect={(courier) => {
          setIsReceivedPopupOpen(false);
          navigate(`/payments/cash-detail/${courier.id}`, {
            state: { type: "courier", entity: courier },
          });
        }}
        renderItem={(courier, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${isSelected ? "bg-white/20" : "bg-orange-500/10"}`}
              >
                <Truck
                  size={16}
                  className={isSelected ? "text-white" : "text-orange-400"}
                />
              </div>
              <div>
                <p
                  className={`font-medium text-sm ${isSelected ? "text-white" : "text-gray-800 dark:text-white"}`}
                >
                  {courier.name}
                </p>
                <p
                  className={`text-xs ${isSelected ? "text-white/70" : "text-gray-500 dark:text-white/75"}`}
                >
                  {courier.region}
                </p>
              </div>
            </div>
            <span
              className={`text-sm font-semibold ${courier.amount < 0 ? "text-rose-400" : isSelected ? "text-white/85" : "text-gray-500 dark:text-white/80"}`}
            >
              {courier.amount < 0 ? "-" : ""}
              {fmt(Math.abs(courier.amount))} UZS
            </span>
          </div>
        )}
      />
    </PageContainer>
  );
};

export default memo(Payments);

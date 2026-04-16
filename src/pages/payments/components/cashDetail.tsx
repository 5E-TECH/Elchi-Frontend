import { memo, useEffect, useMemo, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  CalendarClock,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  PackageCheck,
  Send,
  Store,
  List,
  ArrowLeftRight,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet2,
} from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import PaymentHistoryList from "./PaymentHistoryList";
import type { Pagination, PaymentRow } from "./patmentHistoryTable";
import DateRangePicker from "../../../shared/ui/DateRangePicker";
import { useCashBox } from "../../../entities/payments";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n";
import ElchiIconWhite from "../../../shared/assets/logo oq.png";

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

const sectionClassName =
  "overflow-hidden rounded-[1.5rem] border border-[color:var(--color-border-soft)] bg-primary shadow-sm dark:bg-primarydark";

const sectionHeaderClassName = "border-b border-[color:var(--color-border-soft)] px-4 py-3.5";

export interface DetailState {
  type: "market" | "courier";
  entity?: {
    id?: string;
    name?: string;
    phone_number?: string;
    role?: string;
    amount?: number;
  };
}

const CONFIG = {
  market: {
    kassaLabelKey: "marketCashboxLabel",
    brand: "ELCHI",
    headerIcon: <Store size={20} />,
    entityIcon: <Store size={18} className="text-white" />,
    actionLabelKey: "payAction",
    actionSubKey: "payToMarketDescription",
    submitLabelKey: "payAction",
    actionGradient: "from-main to-primarydark",
    iconBg: "bg-main/30",
  },
  courier: {
    kassaLabelKey: "courierCashboxLabel",
    brand: "ELCHI",
    headerIcon: <Truck size={20} />,
    entityIcon: <Truck size={18} className="text-white" />,
    actionLabelKey: "receiveAction",
    actionSubKey: "receiveFromCourierDescription",
    submitLabelKey: "receiveAction",
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
  } = getCashBoxById(id || "", Boolean(id) && !state?.entity, detailParams);

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

  const entityName = user?.name?.trim() || t("userFallback");
  const totalBalance = toNumber(cashbox?.balance ?? state?.entity?.amount);
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
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden rounded-2xl bg-sidebar p-3 dark:bg-maindark md:p-4">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(18rem,0.38fr)_minmax(24rem,0.62fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="px-1">
            <HeaderName
              name={entityName}
              description={t(cfg.kassaLabelKey)}
              icon={cfg.headerIcon}
              onIconClick={() => navigate(-1)}
            />
          </div>

          <div
            className="relative overflow-hidden rounded-[1.45rem] border border-border-soft p-4 shadow-xl"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--color-main) 18%, var(--color-maindark)) 0%, var(--color-maindark) 48%, color-mix(in srgb, var(--color-purple) 30%, var(--color-maindark)) 100%)",
            }}
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/12" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-primary/10" />

            <div className="relative z-10 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-11 w-11 items-center justify-center rounded-[1.2rem] ${cfg.iconBg}`}>
                  <img
                    src={ElchiIconWhite}
                    alt="Elchi"
                    className="h-5 w-5 object-contain"
                  />
                </div>
                <div>
                  <p className="text-base font-black tracking-wide text-white">{cfg.brand}</p>
                  <p className="text-xs text-white/50">{entityName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBalanceVisible((prev) => !prev)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-white/70 transition-colors hover:bg-primary/20"
              >
                {balanceVisible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            <div className="relative z-10">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/55">
                <Wallet2 size={11} /> {t("totalBalanceLabel")}
              </p>
              <p className="text-[2rem] font-black tracking-tight text-white">
                {balanceVisible ? `${fmt(totalBalance)} UZS` : "••••••• UZS"}
              </p>
            </div>

            <div className="relative z-10 mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[0.95rem] border border-white/10 bg-white/8 px-3 py-2">
                <p className="mb-1 text-[11px] text-white/50">{t("cashBalance")}</p>
                <p className="text-sm font-bold text-white">
                  {balanceVisible ? `${fmt(cashBalance)} UZS` : "•••••••"}
                </p>
              </div>
              <div className="rounded-[0.95rem] border border-white/10 bg-white/8 px-3 py-2">
                <p className="mb-1 text-[11px] text-white/50">{t("cardBalance")}</p>
                <p className="text-sm font-bold text-white">
                  {balanceVisible ? `${fmt(cardBalance)} UZS` : "•••••••"}
                </p>
              </div>
            </div>
          </div>

          <div className={sectionClassName}>
            <div className={`bg-linear-to-r ${cfg.actionGradient} px-4 py-3`}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  {type === "market" ? <CreditCard size={20} /> : <PackageCheck size={20} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-primary">{t(cfg.actionLabelKey)}</p>
                  <p className="text-xs text-primary/70">
                    {t(cfg.actionSubKey)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-3.5">
              <div>
                <label className="mb-1.5 ml-1 block text-xs font-bold uppercase tracking-wide text-text-muted dark:text-white/50">
                  {t("amountLabel")} <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0"
                    {...register("amount")}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 pr-16 text-sm font-semibold text-gray-900 transition-all placeholder-gray-400 focus:border-main focus:outline-none focus:ring-2 focus:ring-main/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-white/20"
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
                <label className="mb-1.5 ml-1 block text-xs font-bold uppercase tracking-wide text-text-muted dark:text-white/50">
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
                        className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-900 transition-all focus:border-main focus:outline-none focus:ring-2 focus:ring-main/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
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
                <label className="mb-1.5 ml-1 block text-xs font-bold uppercase tracking-wide text-text-muted dark:text-white/50">
                  {t("comment")}
                </label>
                <textarea
                  placeholder={t("commentPlaceholder")}
                  rows={2}
                  {...register("comment")}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 transition-all placeholder-gray-400 focus:border-main focus:outline-none focus:ring-2 focus:ring-main/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-white/20"
                />
              </div>

              <button
                type="button"
                onClick={handleSubmit(onSubmit)}
                className={`flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] ${cfg.actionGradient}`}
              >
                <Send size={16} />
                {t(cfg.submitLabelKey)}
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 pt-1">
          <div className={sectionClassName}>
            <div className={sectionHeaderClassName}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-main text-primary shadow-lg shadow-main/20">
                  <CalendarClock size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {t("todayTransactions")}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-white/40">
                    {t("todayOperations")}
                  </p>
                </div>
              </div>
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
              {(draftDateFrom || draftDateTo) && (
                <div className="mt-3 flex items-center justify-end">
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
                </div>
              )}
              {((draftDateFrom && !draftDateTo) ||
                (!draftDateFrom && draftDateTo)) && (
                <p className="pt-3 text-xs text-gray-500 dark:text-white/45">
                  {t("dateRangeRequired")}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <div className="rounded-[1.2rem] p-3.5 shadow-lg" style={{ background: "linear-gradient(135deg, var(--color-success) 0%, color-mix(in srgb, var(--color-success) 72%, var(--color-main)) 100%)" }}>
              <div className="mb-3.5 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <TrendingUp size={16} />
                </div>
                <TrendingUp size={14} className="text-primary/70" />
              </div>
              <p className="text-[13px] font-semibold text-primary/80">{t("income")}</p>
              <p className="mt-2.5 text-[1.35rem] font-black leading-none text-primary">
                +{fmt(income)}
              </p>
              <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary/65">
                UZS
              </p>
            </div>

            <div className="rounded-[1.2rem] p-3.5 shadow-lg" style={{ background: "linear-gradient(135deg, var(--color-error) 0%, color-mix(in srgb, var(--color-error) 60%, var(--color-purple)) 100%)" }}>
              <div className="mb-3.5 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <TrendingDown size={16} />
                </div>
                <TrendingDown size={14} className="text-primary/70" />
              </div>
              <p className="text-[13px] font-semibold text-primary/80">{t("expense")}</p>
              <p className="mt-2.5 text-[1.35rem] font-black leading-none text-primary">
                -{fmt(expense)}
              </p>
              <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary/65">
                UZS
              </p>
            </div>
          </div>

          {isFetching && !isLoading && (
            <div className="flex items-center gap-2 px-1 text-xs text-gray-500 dark:text-white/50">
              <Loader2 size={14} className="animate-spin text-main" />
              {t("transactionsUpdating")}
            </div>
          )}

          <div className={`${sectionClassName} min-h-0`}>
            <div className={`${sectionHeaderClassName} flex items-center justify-between`}>
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-main text-primary shadow-lg shadow-main/20">
                    <List size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {t("paymentHistoryTitle")}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-white/40">
                      {t("lastOperations")}
                    </p>
                  </div>
                </div>
              </div>
              <span className="rounded-full bg-main/12 px-3 py-1 text-xs font-bold text-main">
                {t("countLabel", { count: historyRows.length })}
              </span>
            </div>
            <div className="px-4 pt-2.5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-main to-purple px-4 py-2 text-sm font-semibold text-primary shadow-lg shadow-main/20"
                >
                  <List size={15} />
                  {t("allInfo")}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl border border-border-soft px-4 py-2 text-sm font-semibold text-text-muted transition-colors hover:text-maindark dark:text-text-muted-dark dark:hover:text-primary"
                >
                  <ArrowLeftRight size={15} />
                  {t("history")}
                </button>
              </div>
            </div>
            <PaymentHistoryList
              data={paginatedHistoryRows}
              isLoading={isFetching && historyRows.length === 0}
              pagination={pagination}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              withContainer={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(CashDetail);

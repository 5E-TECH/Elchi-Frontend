import { memo, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Eye,
  EyeOff,
  Store,
  Truck,
  Wallet2,
} from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import DateRangePicker from "../../../shared/ui/DateRangePicker";
import PaymentHistoryList from "./PaymentHistoryList";
import type { Pagination, PaymentRow } from "./patmentHistoryTable";
import { useCashBox } from "../../../entities/payments";
import type { RootState } from "../../../app/config/store";
import { useTranslation } from "react-i18next";

const HISTORY_PAGE_SIZE = 8;

const sectionClassName =
  "overflow-hidden rounded-[1.5rem] border border-[color:var(--color-border-soft)] bg-primary shadow-sm dark:bg-primarydark";

const sectionHeaderClassName =
  "border-b border-[color:var(--color-border-soft)] px-4 py-3.5";

const fmt = (n: number) => n.toLocaleString("uz-UZ");

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDisplayName = (value?: string | null) => {
  if (!value) return "";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toRangeBoundary = (date: string, boundary: "start" | "end") => {
  const suffix =
    boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  return `${date}${suffix}`;
};

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const MyCashboxPage = () => {
  const { t } = useTranslation("payments");
  const role = useSelector((state: RootState) => state.role.role);
  const { getCashboxMyCashbox } = useCashBox();

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

  const params = useMemo(
    () => ({
      ...(appliedDateFrom && { fromDate: toRangeBoundary(appliedDateFrom, "start") }),
      ...(appliedDateTo && { toDate: toRangeBoundary(appliedDateTo, "end") }),
    }),
    [appliedDateFrom, appliedDateTo],
  );

  const { data: cashboxResponse, isLoading } = getCashboxMyCashbox(params);

  const detailData = cashboxResponse?.data;
  const cashbox = detailData?.cashbox ?? detailData?.myCashbox;
  const currentRole = role === "market" ? "market" : "courier";
  const entityName =
    cashbox?.user?.name?.trim() ||
    (currentRole === "market" ? "Market cashbox" : "Courier cashbox");
  const totalBalance = toNumber(cashbox?.balance);
  const incomeAmount = toNumber(detailData?.income);
  const outcomeAmount = toNumber(detailData?.outcome);

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
        source_type: formatDisplayName(item?.source_type ?? item?.type),
        source_id: item?.source_id,
        cashbox_type: item?.cashbox_type ?? cashbox?.cashbox_type,
        created_by:
          item?.createdByUser?.name ??
          item?.created_by_user?.name ??
          item?.created_by ??
          item?.createdBy ??
          item?.user?.name ??
          entityName,
        payment_method:
          formatDisplayName(item?.payment_method ?? item?.method) || undefined,
        payment_date:
          item?.payment_date ?? item?.createdAt ?? item?.created_at,
        comment: item?.comment,
        balance_after: item?.balance_after,
        createdAt: item?.createdAt,
        created_at: item?.created_at,
        cashbox: item?.cashbox,
      };
    });
  }, [cashbox?.cashbox_type, detailData?.cashboxHistory, entityName]);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedDateFrom, appliedDateTo, historyRows.length]);

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

  const headerIcon = currentRole === "market" ? <Store size={20} /> : <Truck size={20} />;
  const accentIcon = currentRole === "market" ? <Store size={18} /> : <Truck size={18} />;
  const accentClass =
    currentRole === "market" ? "bg-main/30" : "bg-success/25";
  const description =
    currentRole === "market" ? "Market kassasi" : "Kuryer kassasi";

  if (isLoading) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-main/20 border-t-main" />
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
              description={description}
              icon={headerIcon}
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
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-[1.2rem] text-white ${accentClass}`}
                >
                  {accentIcon}
                </div>
                <div>
                  <p className="text-base font-black tracking-wide text-white">ELCHI</p>
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
                <p className="mb-1 text-[11px] text-white/50">{t("income")}</p>
                <p className="text-sm font-bold text-white">
                  {balanceVisible ? `+${fmt(incomeAmount)} UZS` : "•••••••"}
                </p>
              </div>
              <div className="rounded-[0.95rem] border border-white/10 bg-white/8 px-3 py-2">
                <p className="mb-1 text-[11px] text-white/50">{t("expense")}</p>
                <p className="text-sm font-bold text-white">
                  {balanceVisible ? `-${fmt(outcomeAmount)} UZS` : "•••••••"}
                </p>
              </div>
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
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                  <ArrowUpRight size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500/70">
                    {t("income")}
                  </p>
                  <p className="text-lg font-black text-emerald-500">
                    +{fmt(incomeAmount)} UZS
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/8 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
                  <ArrowDownRight size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-500/70">
                    {t("expense")}
                  </p>
                  <p className="text-lg font-black text-rose-400">
                    -{fmt(outcomeAmount)} UZS
                  </p>
                </div>
              </div>
            </div>
          </div>

          <PaymentHistoryList
            data={paginatedHistoryRows}
            pagination={pagination}
            onPageChange={setCurrentPage}
            currentPage={currentPage}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(MyCashboxPage);

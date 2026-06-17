import { memo, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Store, Truck } from "lucide-react";
import type { PaymentRow } from "./patmentHistoryTable";
import { useCashBox } from "../../../entities/payments";
import type { RootState } from "../../../app/config/store";
import { useTranslation } from "react-i18next";
import CashboxRolePageLayout from "./CashboxRolePageLayout";

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

  const [selectedDateFrom, setSelectedDateFrom] = useState("");
  const [selectedDateTo, setSelectedDateTo] = useState("");
  const [balanceVisible, setBalanceVisible] = useState(true);

  const params = useMemo(
    () => ({
      ...(selectedDateFrom && { fromDate: toRangeBoundary(selectedDateFrom, "start") }),
      ...(selectedDateTo && { toDate: toRangeBoundary(selectedDateTo, "end") }),
    }),
    [selectedDateFrom, selectedDateTo],
  );

  const { data: cashboxResponse, isLoading } = getCashboxMyCashbox(params);

  const detailData = cashboxResponse?.data;
  const cashbox = detailData?.cashbox ?? detailData?.myCashbox;
  const currentRole = role === "market" ? "market" : "courier";
  const entityName =
    cashbox?.user?.name?.trim() ||
    (currentRole === "market" ? t("marketCashboxLabel") : t("courierCashboxLabel"));
  const totalBalance = toNumber(cashbox?.balance);
  const incomeAmount = toNumber(detailData?.income);
  const outcomeAmount = toNumber(detailData?.outcome);

  const historyRows = useMemo<PaymentRow[]>(() => {
    const rows = Array.isArray(detailData?.cashboxHistory)
      ? detailData.cashboxHistory
      : [];

    return rows.map((item: Record<string, unknown>, index: number) => {
      const amount = toNumber(item["amount"]);
      const operationType =
        item["operation_type"] ?? (amount >= 0 ? "income" : "expense");

      return {
        id: String(
          item["id"] ?? `${index}-${item["createdAt"] ?? item["payment_date"] ?? "row"}`,
        ),
        amount,
        operation_type: operationType,
        source_type: (item["source_type"] ?? item["type"]) as string | undefined,
        source_id: item["source_id"],
        cashbox_type: (item["cashbox_type"] as string | undefined) ?? cashbox?.cashbox_type,
        created_by:
          ((item["createdByUser"] as { name?: string } | undefined)?.name) ??
          ((item["created_by_user"] as { name?: string } | undefined)?.name) ??
          (item["created_by"] as string | undefined) ??
          (item["createdBy"] as string | undefined) ??
          ((item["user"] as { name?: string } | undefined)?.name) ??
          entityName,
        payment_method: (item["payment_method"] ?? item["method"]) as string | undefined,
        payment_date:
          (item["payment_date"] as string | undefined) ?? (item["createdAt"] as string | undefined) ?? (item["created_at"] as string | undefined),
        comment: item["comment"],
        balance_after: item["balance_after"],
        createdAt: item["createdAt"],
        created_at: item["created_at"],
        cashbox: item["cashbox"],
      };
    });
  }, [cashbox?.cashbox_type, detailData, entityName]);

  const headerIcon = currentRole === "market" ? <Store size={20} /> : <Truck size={20} />;
  const accentIcon = currentRole === "market" ? <Store size={18} /> : <Truck size={18} />;
  const accentClass =
    currentRole === "market" ? "bg-main/30" : "bg-success/25";
  const description =
    currentRole === "market" ? t("marketCashboxLabel") : t("courierCashboxLabel");

  if (isLoading) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-main/20 border-t-main" />
      </div>
    );
  }

  return (
    <CashboxRolePageLayout
      entityName={entityName}
      description={description}
      headerIcon={headerIcon}
      accentClass={accentClass}
      accentIcon={accentIcon}
      summarySubtitle={currentRole === "market" ? t("marketCashboxLabel") : t("courierCashboxLabel")}
      balance={totalBalance}
      balanceVisible={balanceVisible}
      onToggleBalanceVisibility={() => setBalanceVisible((prev) => !prev)}
      dateRangeValue={{
        startDate: selectedDateFrom ? parseIsoDate(selectedDateFrom) : null,
        endDate: selectedDateTo ? parseIsoDate(selectedDateTo) : null,
      }}
      onDateRangeChange={({ startDate, endDate }) => {
        setSelectedDateFrom(startDate ? toIsoDate(startDate) : "");
        setSelectedDateTo(endDate ? toIsoDate(endDate) : "");
      }}
      dateRangePlaceholder={`${t("startDate")} → ${t("endDate")}`}
      incomeAmount={incomeAmount}
      expenseAmount={outcomeAmount}
      historyRows={historyRows}
      incomeLabel={t("income")}
      expenseLabel={t("expense")}
      todayTransactionsLabel={t("todayTransactions")}
      todayOperationsLabel={t("todayOperations")}
    />
  );
};

export default memo(MyCashboxPage);

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

const getActorName = (actor: unknown) => {
  const record = actor && typeof actor === "object" ? actor as Record<string, unknown> : {};
  return String(
    record["name"] ??
    record["full_name"] ??
    [record["first_name"], record["last_name"]].filter(Boolean).join(" ") ??
    "",
  ).trim();
};

const getHistoryDate = (item: Record<string, unknown>) =>
  String(item["payment_date"] ?? item["createdAt"] ?? item["created_at"] ?? "");

const toOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const text = String(value);
  return text ? text : undefined;
};

const PAYMENT_HISTORY_SOURCE_TYPES =
  "courier_payment,market_payment,branch_to_main";

const getCounterpartyLabel = (
  role: "market" | "manager" | "courier",
  entityName: string,
  item: Record<string, unknown>,
) => {
  if (role === "market" || role === "manager") {
    return `HQ → ${entityName}`;
  }

  const managerName =
    getActorName(item["createdByUser"]) ||
    getActorName(item["created_by_user"]) ||
    "Manager";

  return `${managerName} → ${entityName}`;
};

const MyCashboxPage = () => {
  const { t } = useTranslation("payments");
  const role = useSelector((state: RootState) => state.role.role);
  const { useGetCashboxMyCashbox } = useCashBox();

  const [selectedDateFrom, setSelectedDateFrom] = useState("");
  const [selectedDateTo, setSelectedDateTo] = useState("");
  const [historyTab, setHistoryTab] = useState<"all" | "payments">("all");
  const [balanceVisible, setBalanceVisible] = useState(true);

  const params = useMemo(
    () => ({
      ...(selectedDateFrom && { fromDate: toRangeBoundary(selectedDateFrom, "start") }),
      ...(selectedDateTo && { toDate: toRangeBoundary(selectedDateTo, "end") }),
      ...(historyTab === "payments" && { sourceTypes: PAYMENT_HISTORY_SOURCE_TYPES }),
    }),
    [historyTab, selectedDateFrom, selectedDateTo],
  );

  const { data: cashboxResponse, isLoading } = useGetCashboxMyCashbox(params);

  const detailData = cashboxResponse?.data;
  const cashbox = detailData?.cashbox ?? detailData?.myCashbox;
  const currentRole: "market" | "manager" | "courier" =
    role === "market" ? "market" : role === "manager" ? "manager" : "courier";
  const expectedCashboxType =
    currentRole === "market" ? "markets" : currentRole === "manager" ? "branch" : "couriers";
  const entityName =
    cashbox?.user?.name?.trim() ||
    (currentRole === "market"
      ? t("marketCashboxLabel")
      : currentRole === "manager"
        ? t("branchMainCashboxLabel")
        : t("courierCashboxLabel"));
  const roleCashboxLabel =
    currentRole === "market"
      ? t("marketCashboxLabel")
      : currentRole === "manager"
        ? t("branchMainCashboxLabel")
        : t("courierCashboxLabel");
  const totalBalance = toNumber(cashbox?.balance);
  const historyRows = useMemo<PaymentRow[]>(() => {
    const cashboxRows = Array.isArray(detailData?.cashboxHistory)
      ? detailData.cashboxHistory
      : [];
    const rows = [...cashboxRows].sort((left, right) => {
      const leftDate = Date.parse(getHistoryDate(left));
      const rightDate = Date.parse(getHistoryDate(right));

      return (
        (Number.isFinite(rightDate) ? rightDate : 0) -
        (Number.isFinite(leftDate) ? leftDate : 0)
      );
    });

    return rows
      .filter((item: Record<string, unknown>) => {
        const rowCashbox = item["cashbox"] as { cashbox_type?: string } | undefined;
        const rowCashboxType = String(
          item["cashbox_type"] ?? rowCashbox?.cashbox_type ?? cashbox?.cashbox_type ?? "",
        );

        return !rowCashboxType || rowCashboxType === expectedCashboxType;
      })
      .map((item: Record<string, unknown>, index: number) => {
        const amount = toNumber(item["amount"]);
        const sourceType = String(item["source_type"] ?? item["type"] ?? "");
        const isMarketIncomePerspective =
          currentRole === "market" && sourceType === "market_payment";
        const operationType = isMarketIncomePerspective
          ? "income"
          : toOptionalString(item["operation_type"]) ?? (amount >= 0 ? "income" : "expense");
        const counterpartyLabel = getCounterpartyLabel(currentRole, entityName, item);

        return {
          id: String(
            item["id"] ?? `${index}-${item["createdAt"] ?? item["payment_date"] ?? "row"}`,
          ),
          amount: isMarketIncomePerspective ? Math.abs(amount) : amount,
          operation_type: operationType,
          cashbox_id: toOptionalString(item["cashbox_id"]) ?? (cashbox?.id ? String(cashbox.id) : undefined),
          source_type: sourceType || undefined,
          source_id: toOptionalString(item["source_id"]),
          cashbox_type: toOptionalString(item["cashbox_type"]) ?? cashbox?.cashbox_type,
          created_by: counterpartyLabel,
          payment_method: toOptionalString(item["payment_method"] ?? item["method"]),
          payment_date:
            toOptionalString(item["payment_date"]) ?? toOptionalString(item["createdAt"]) ?? toOptionalString(item["created_at"]),
          comment: toOptionalString(item["comment"]),
          balance_after: item["balance_after"] === undefined ? undefined : toNumber(item["balance_after"]),
          createdAt: item["createdAt"] as string | undefined,
          created_at: item["created_at"] as string | undefined,
          cashbox: item["cashbox"] as PaymentRow["cashbox"],
          createdByUser: null,
          created_by_user: null,
          user: null,
        };
      });
  }, [
    cashbox?.cashbox_type,
    currentRole,
    detailData,
    entityName,
    expectedCashboxType,
  ]);

  const incomeAmount = historyRows.reduce(
    (sum, row) => row.operation_type === "income" ? sum + Math.abs(toNumber(row.amount)) : sum,
    0,
  );
  const outcomeAmount = historyRows.reduce(
    (sum, row) => row.operation_type === "expense" ? sum + Math.abs(toNumber(row.amount)) : sum,
    0,
  );

  const headerIcon = currentRole === "market" ? <Store size={20} /> : <Truck size={20} />;
  const accentIcon = currentRole === "market" ? <Store size={18} /> : <Truck size={18} />;
  const accentClass =
    currentRole === "market" ? "bg-main/30" : "bg-success/25";
  const description = roleCashboxLabel;

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
      summarySubtitle={roleCashboxLabel}
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
      historyTab={historyTab}
      onHistoryTabChange={setHistoryTab}
      allHistoryLabel={t("allHistory")}
      paymentsHistoryLabel={t("paymentTransfers")}
    />
  );
};

export default memo(MyCashboxPage);

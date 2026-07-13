import { memo, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { ArrowDownLeft, ArrowUpRight, Landmark, Loader2, Store, Truck, WalletCards } from "lucide-react";
import type { PaymentRow } from "./patmentHistoryTable";
import { useCashBox } from "../../../entities/payments";
import { useFinanceCoverage } from "../../../entities/payments/financeCoverage";
import { useMarkets } from "../../../entities/markets";
import { useUser } from "../../../entities/user/api/userApi";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n";
import { parseAmountInput } from "./lib/amountInput";
import CashboxRolePageLayout from "./CashboxRolePageLayout";
import CashboxActionFormCard, {
  type CashboxActionFormValues,
} from "./CashboxActionFormCard";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import type { RootState } from "../../../app/config/store";

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const FULL_LIST_LIMIT = 10000;

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

const getPersonName = (item: Record<string, unknown>, fallback: string) =>
  String(
    item.name ??
      item.full_name ??
      item.fullName ??
      [item.first_name, item.last_name].filter(Boolean).join(" ") ??
      fallback,
  ).trim() || fallback;

const toOptionalString = (value: unknown) => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
};

const toMeaningfulString = (value: unknown) => {
  const text = toOptionalString(value)?.trim();
  if (!text || text === "-" || text === "—" || /^\d+$/.test(text)) return undefined;
  return text;
};

const toActor = (value: unknown): PaymentRow["user"] => {
  if (!value || typeof value !== "object") return null;
  return value as PaymentRow["user"];
};

const getActorDisplayName = (actor: PaymentRow["user"]) =>
  actor?.name?.trim() ||
  actor?.full_name?.trim() ||
  [actor?.first_name, actor?.last_name].filter(Boolean).join(" ").trim();

const getHistoryDate = (item: Record<string, unknown>) =>
  toOptionalString(item["payment_date"]) ??
  toOptionalString(item["paymentDate"]) ??
  toOptionalString(item["createdAt"]) ??
  toOptionalString(item["created_at"]) ??
  toOptionalString(item["updatedAt"]) ??
  toOptionalString(item["updated_at"]) ??
  toOptionalString(item["date"]);

const reduceBalanceTowardsZero = (balance: number, amount: number) =>
  balance < 0 ? Math.min(0, balance + amount) : Math.max(0, balance - amount);

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

const getArrayFromResponse = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value as Record<string, unknown>[];

  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | Record<string, unknown>[] | undefined;

  if (Array.isArray(record.items)) return record.items as Record<string, unknown>[];
  if (Array.isArray(record.history)) return record.history as Record<string, unknown>[];
  if (Array.isArray(record.cashboxHistory)) return record.cashboxHistory as Record<string, unknown>[];
  if (Array.isArray(data)) return data;

  if (data && typeof data === "object") {
    if (Array.isArray(data.items)) return data.items as Record<string, unknown>[];
    if (Array.isArray(data.history)) return data.history as Record<string, unknown>[];
    if (Array.isArray(data.cashboxHistory)) return data.cashboxHistory as Record<string, unknown>[];
  }

  return [];
};

const isBranchToHqHistoryItem = (item: Record<string, unknown>) => {
  const sourceType = toOptionalString(item["source_type"]) ?? toOptionalString(item["type"]);
  const normalizedSourceType = sourceType?.trim().toLowerCase().replaceAll("-", "_");

  return normalizedSourceType === "branch_to_main" || normalizedSourceType === "branch_to_hq";
};

const hasActualPaymentTimestamp = (item: Record<string, unknown>) =>
  Boolean(
    toOptionalString(item["payment_date"]) ||
      toOptionalString(item["paymentDate"]) ||
      toOptionalString(item["createdAt"]) ||
      toOptionalString(item["created_at"]),
  );

const isPendingSettlementHistoryItem = (item: Record<string, unknown>) => {
  const text = [
    item["comment"],
    item["description"],
    item["note"],
    item["status"],
    item["source_type"],
    item["type"],
  ]
    .map((value) => toOptionalString(value)?.toLowerCase() ?? "")
    .join(" ");

  return (
    text.includes("berilishi kerak") ||
    text.includes("berish kerak") ||
    text.includes("payable") ||
    text.includes("to_be_given") ||
    text.includes("expected")
  );
};

const isActualBranchToHqPaymentItem = (item: Record<string, unknown>) =>
  isBranchToHqHistoryItem(item) &&
  hasActualPaymentTimestamp(item) &&
  !isPendingSettlementHistoryItem(item);

const isCourierToBranchHistoryItem = (item: Record<string, unknown>) => {
  const sourceType = toOptionalString(item["source_type"]) ?? toOptionalString(item["type"]);
  const normalizedSourceType = sourceType?.trim().toLowerCase().replaceAll("-", "_");

  return [
    "courier_payment",
    "courier_to_branch",
    "courier_to_manager",
    "courier_to_branch_manager",
  ].includes(normalizedSourceType ?? "");
};

const isIncomeHistoryItem = (item: Record<string, unknown>) =>
  String(item["operation_type"] ?? "").trim().toLowerCase() === "income";

type CashDetailType = "market" | "courier" | "branch";

const normalizeType = (
  cashboxType?: string | null,
  role?: string | null,
): CashDetailType => {
  if (cashboxType === "main" || role === "branch") return "branch";
  if (cashboxType === "couriers" || role === "courier") return "courier";
  return "market";
};

export interface DetailState {
  type: CashDetailType;
  entity?: {
    id?: string;
    name?: string;
    phone_number?: string;
    role?: string;
    amount?: number;
    type?: string;
  };
}

const CONFIG = {
  market: {
    kassaLabelKey: "marketCashboxLabel",
    actionLabelKey: "payAction",
    actionSubKey: "payToMarketDescription",
    submitLabelKey: "payAction",
    actionGradient: "from-main to-primarydark",
    iconBg: "bg-main/30",
    headerIcon: <Store size={20} />,
    entityIcon: <Store size={18} className="text-white" />,
  },
  courier: {
    kassaLabelKey: "courierCashboxLabel",
    actionLabelKey: "receiveAction",
    actionSubKey: "receiveFromCourierDescription",
    submitLabelKey: "receiveAction",
    actionGradient: "from-success to-info",
    iconBg: "bg-success/25",
    headerIcon: <Truck size={20} />,
    entityIcon: <Truck size={18} className="text-white" />,
  },
  branch: {
    kassaLabelKey: "branchMainCashboxLabel",
    actionLabelKey: "payToMainAction",
    actionSubKey: "payToMainDescription",
    submitLabelKey: "payToMainAction",
    actionGradient: "from-main to-primarydark",
    iconBg: "bg-main/25",
    headerIcon: <Landmark size={20} />,
    entityIcon: <Landmark size={18} className="text-white" />,
  },
} as const;

const cashDetailSchema: yup.ObjectSchema<CashboxActionFormValues> = yup.object({
  amount: yup
    .string()
    .required(i18n.t("payments:amountRequired"))
    .test("positive-number", i18n.t("payments:amountPositiveValidation"), (value) =>
      parseAmountInput(value) > 0),
  paymentType: yup.string().required(i18n.t("payments:paymentTypeRequired")),
  marketId: yup.string().defined().when("paymentType", {
    is: "click_to_market",
    then: (schema) => schema.required(i18n.t("payments:marketRequired")),
    otherwise: (schema) => schema.defined(),
  }),
  transferSourceId: yup.string().defined().when("paymentType", {
    is: "click",
    then: (schema) => schema.required(i18n.t("payments:transferSourceRequired")),
    otherwise: (schema) => schema.defined(),
  }),
  comment: yup.string().defined(),
});

const CashDetail = () => {
  const { t } = useTranslation("payments");
  const { id } = useParams<{ id: string }>();
  const { state } = useLocation() as { state: DetailState | null };
  const navigate = useNavigate();
  const {
    useGetCashBoxById,
    useGetFinanceHistory,
    createPaymentCourier,
    createPaymentBranchToMain,
    createPaymentMarket,
  } = useCashBox();
  const { useGetManagerPayableToHq, useGetCashboxUserMain } = useFinanceCoverage();
  const { useGetMarkets } = useMarkets();
  const { useGetUser } = useUser();
  const { apiRequest } = useAppNotification();

  const [selectedDateFrom, setSelectedDateFrom] = useState("");
  const [selectedDateTo, setSelectedDateTo] = useState("");
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [balanceOverride, setBalanceOverride] = useState<number | null>(null);
  const currentRole = useSelector((store: RootState) => store.role.role);
  const isCurrentManagerRole = String(currentRole).toLowerCase() === "manager";

  const isBranchDetailRequest = state?.type === "branch";
  const isMarketDetailRequest = state?.type === "market";
  const isHqBranchReceiveRequest = isBranchDetailRequest && !isCurrentManagerRole;
  const isCourierReceiveRequest = state?.type === "courier" && isCurrentManagerRole;
  const dateParams = useMemo(
    () => ({
      ...(selectedDateFrom && { fromDate: selectedDateFrom }),
      ...(selectedDateTo && { toDate: selectedDateTo }),
    }),
    [selectedDateFrom, selectedDateTo],
  );
  const detailParams = useMemo(
    () => ({
      with_history: true,
      page: 1,
      limit: 100,
      ...(isCourierReceiveRequest && {
        cashbox_type: "couriers",
      }),
      ...dateParams,
    }),
    [dateParams, isCourierReceiveRequest],
  );
  const branchHistoryParams = useMemo(
    () => ({
      page: 1,
      limit: 100,
      source_type: "branch_to_main",
      ...(id
        ? isHqBranchReceiveRequest
          ? { source_user_id: id, cashbox_type: "main" }
          : { user_id: id, cashbox_type: "branch" }
        : {}),
      ...dateParams,
    }),
    [dateParams, id, isHqBranchReceiveRequest],
  );
  const marketHistoryParams = useMemo(
    () => ({
      page: 1,
      limit: 100,
      source_type: "market_payment",
      ...(id ? { source_user_id: id, cashbox_type: "main" } : {}),
      ...dateParams,
    }),
    [dateParams, id],
  );
  const marketExtraCostHistoryParams = useMemo(
    () => ({
      page: 1,
      limit: 100,
      source_type: "extra_cost",
      ...(id ? { user_id: id, cashbox_type: "markets" } : {}),
      ...dateParams,
    }),
    [dateParams, id],
  );
  const byUserCashboxQuery = useGetCashBoxById(
    id || "",
    Boolean(id) && !isBranchDetailRequest,
    detailParams,
  );
  const managerPayableQuery = useGetManagerPayableToHq(
    isBranchDetailRequest && isCurrentManagerRole,
    dateParams,
  );
  const branchCashboxQuery = useGetCashboxUserMain(
    id || "",
    Boolean(id) && isBranchDetailRequest && !isCurrentManagerRole,
    dateParams,
  );
  const branchHistoryQuery = useGetFinanceHistory(branchHistoryParams, isBranchDetailRequest);
  const marketHistoryQuery = useGetFinanceHistory(marketHistoryParams, isMarketDetailRequest);
  const marketExtraCostHistoryQuery = useGetFinanceHistory(
    marketExtraCostHistoryParams,
    isMarketDetailRequest,
  );
  const activeCashboxQuery = isBranchDetailRequest
    ? isCurrentManagerRole
      ? managerPayableQuery
      : branchCashboxQuery
    : byUserCashboxQuery;
  const {
    data: cashboxResponse,
    isLoading,
    refetch: refetchCashbox,
  } = activeCashboxQuery;

  const detailData = cashboxResponse?.data;
  const detailEntry = Array.isArray(detailData) ? detailData[0] : detailData;
  const cashbox = detailEntry?.cashbox ?? detailEntry;
  const hasSettlementDetails =
    detailEntry?.kassadagi_summa !== undefined ||
    detailEntry?.berilishi_kerak !== undefined ||
    detailEntry?.olinishi_kerak !== undefined ||
    detailEntry?.counterparty !== undefined;
  const settlementDetails = {
    cashboxAmount: toNumber(detailEntry?.kassadagi_summa ?? cashbox?.balance),
    amountToGive: toNumber(detailEntry?.berilishi_kerak),
    amountToReceive: toNumber(detailEntry?.olinishi_kerak),
    counterparty:
      typeof detailEntry?.counterparty === "string" && detailEntry.counterparty.trim()
        ? detailEntry.counterparty.trim()
        : "—",
  };
  const cashboxHistory = useMemo(
    () => {
      if (isBranchDetailRequest) {
        return getArrayFromResponse(branchHistoryQuery.data);
      }
      if (isMarketDetailRequest) {
        return [
          ...getArrayFromResponse(marketHistoryQuery.data),
          ...getArrayFromResponse(marketExtraCostHistoryQuery.data),
        ].sort((left, right) => {
          const leftDate = Date.parse(getHistoryDate(left) ?? "");
          const rightDate = Date.parse(getHistoryDate(right) ?? "");
          return (
            (Number.isFinite(rightDate) ? rightDate : 0) -
            (Number.isFinite(leftDate) ? leftDate : 0)
          );
        });
      }

      return getArrayFromResponse(detailEntry);
    },
    [
      branchHistoryQuery.data,
      detailEntry,
      isBranchDetailRequest,
      isMarketDetailRequest,
      marketExtraCostHistoryQuery.data,
      marketHistoryQuery.data,
    ],
  );
  const user = detailEntry?.user ?? cashbox?.user ?? state?.entity;

  const type: CashDetailType = state?.type ?? normalizeType(cashbox?.cashbox_type, user?.role);
  const cfg = CONFIG[type];
  const entityName = user?.name?.trim() || t("userFallback");
  const stateAmount = toNumber(state?.entity?.amount);
  const hasStateAmount =
    state?.entity?.amount !== undefined && state?.entity?.amount !== null;
  const isCourierReceiveDetail = type === "courier" && isCurrentManagerRole;
  const isHqBranchReceiveDetail = type === "branch" && !isCurrentManagerRole && hasStateAmount;
  const apiBalance = toNumber(cashbox?.balance ?? stateAmount);
  const contextBalance =
    (isCourierReceiveDetail || isHqBranchReceiveDetail) && hasStateAmount
      ? stateAmount
      : apiBalance;
  const settlementBalance =
    (type === "market" || type === "branch") && detailEntry?.berilishi_kerak !== undefined
      ? settlementDetails.amountToGive
      : detailEntry?.olinishi_kerak !== undefined
        ? settlementDetails.amountToReceive
        : contextBalance;
  const displayBalance = balanceOverride ?? settlementBalance;
  const displayAmountToGive =
    (type === "market" || type === "branch") &&
    detailEntry?.berilishi_kerak !== undefined
      ? displayBalance
      : settlementDetails.amountToGive;
  const displayAmountToReceive =
    detailEntry?.olinishi_kerak !== undefined &&
    !(
      (type === "market" || type === "branch") &&
      detailEntry?.berilishi_kerak !== undefined
    )
      ? displayBalance
      : settlementDetails.amountToReceive;
  const balanceLabel =
    isHqBranchReceiveDetail
      ? t("toBeReceived")
      : (type === "market" || type === "branch") && detailEntry?.berilishi_kerak !== undefined
      ? t("toBeGiven")
      : detailEntry?.olinishi_kerak !== undefined
        ? t("toBeReceived")
        : t("totalBalanceLabel");

  useEffect(() => {
    setBalanceOverride(null);
  }, [id, settlementBalance]);

  const paymentTypeOptions = [
    { value: "cash", label: t("cash") },
    { value: "click", label: t("transferOption") },
    ...(type === "courier"
      ? [{ value: "click_to_market", label: t("toMarketTransferOption") }]
      : []),
  ];
  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<CashboxActionFormValues>({
      defaultValues: {
        amount: "",
        paymentType: "",
        marketId: "",
        transferSourceId: "",
        comment: "",
      },
      resolver: yupResolver(cashDetailSchema) as Resolver<CashboxActionFormValues>,
    });

  const selectedPaymentType = watch("paymentType");
  const selectedMarketId = watch("marketId");
  const selectedTransferSourceId = watch("transferSourceId");
  const isStoreTransfer = selectedPaymentType === "click_to_market";
  const isTransferSourceSelectVisible = selectedPaymentType === "click";
  const isSubmitting =
    createPaymentCourier.isPending ||
    createPaymentBranchToMain.isPending ||
    createPaymentMarket.isPending;
  const { data: marketsData, isLoading: marketsLoading } = useGetMarkets(
    { status: "active", limit: FULL_LIST_LIMIT },
    isStoreTransfer,
  );
  const { data: transferUsersData, isLoading: transferUsersLoading } = useGetUser(
    { limit: FULL_LIST_LIMIT },
    isTransferSourceSelectVisible,
  );
  const marketOptions = useMemo(
    () =>
      toDataItems(marketsData)
        .map((item) => {
          const market = asRecord(item);

          return {
            value: String(market.id ?? ""),
            label: String(market.name ?? ""),
          };
        })
        .filter((item) => item.value && item.label),
    [marketsData],
  );
  const transferSourceOptions = useMemo(() => {
    const adminRoles = new Set(["admin", "superadmin", "manager", "registrator"]);
    const sourceMap = new Map<string, { value: string; label: string }>();

    sourceMap.set("main", {
      value: "main",
      label: `${t("mainCard")} — ${toNumber(cashbox?.balance_card ?? cashbox?.balance).toLocaleString("uz-UZ")} ${t("currency")}`,
    });

    toDataItems(transferUsersData).forEach((source) => {
      const item = asRecord(source);
      const id = String(item.id ?? "");
      const role = String(item.role ?? "").toLowerCase();
      if (!id || !adminRoles.has(role)) return;

      const sourceCashbox = asRecord(item.cashbox ?? item.cashBox ?? item.cash_box ?? item.kassa);
      const balance = toNumber(
        sourceCashbox.balance_card ??
          item.balance_card ??
          sourceCashbox.balance ??
          item.balance ??
          item.amount,
      );

      sourceMap.set(id, {
        value: id,
        label: `${getPersonName(item, t("userFallback"))} — ${balance.toLocaleString("uz-UZ")} ${t("currency")}`,
      });
    });

    return Array.from(sourceMap.values());
  }, [cashbox?.balance, cashbox?.balance_card, t, transferUsersData]);

  useEffect(() => {
    if (!isStoreTransfer) {
      setValue("marketId", "");
    }
  }, [isStoreTransfer, setValue]);

  useEffect(() => {
    if (!isTransferSourceSelectVisible) {
      setValue("transferSourceId", "");
      return;
    }

    if (!selectedTransferSourceId && transferSourceOptions[0]?.value) {
      setValue("transferSourceId", transferSourceOptions[0].value);
    }
  }, [isTransferSourceSelectVisible, selectedTransferSourceId, setValue, transferSourceOptions]);

  const resetActionForm = () => {
    reset({
      amount: "",
      paymentType: "",
      marketId: "",
      transferSourceId: "",
      comment: "",
    });
  };

  const refreshAfterPayment = async (amount: number) => {
    setBalanceOverride(reduceBalanceTowardsZero(settlementBalance, amount));
    resetActionForm();

    const [refreshed] = await Promise.all([
      refetchCashbox(),
      isBranchDetailRequest ? branchHistoryQuery.refetch() : Promise.resolve(),
      isMarketDetailRequest ? marketHistoryQuery.refetch() : Promise.resolve(),
      isMarketDetailRequest ? marketExtraCostHistoryQuery.refetch() : Promise.resolve(),
    ]);

    if ((isCourierReceiveDetail || isHqBranchReceiveDetail) && hasStateAmount) {
      return;
    }

    const refreshedData = refreshed.data?.data;
    const refreshedEntry = Array.isArray(refreshedData) ? refreshedData[0] : refreshedData;
    const refreshedBalance =
      (type === "market" || type === "branch") && refreshedEntry?.berilishi_kerak !== undefined
        ? refreshedEntry.berilishi_kerak
        : refreshedEntry?.olinishi_kerak ??
          refreshedEntry?.cashbox?.balance ??
          refreshedEntry?.balance;

    if (
      refreshedBalance !== undefined &&
      refreshedBalance !== null &&
      toNumber(refreshedBalance) !== settlementBalance
    ) {
      setBalanceOverride(toNumber(refreshedBalance));
    }
  };

  const historyRows = useMemo<PaymentRow[]>(() => {
    const courierTransferHistory = cashboxHistory.filter(isCourierToBranchHistoryItem);
    const courierReceivedHistory = courierTransferHistory.filter(isIncomeHistoryItem);
    const visibleHistory = isBranchDetailRequest
      ? cashboxHistory.filter(isActualBranchToHqPaymentItem)
      : isMarketDetailRequest
        ? cashboxHistory.filter(
            (item) => {
              const sourceType = toOptionalString(item["source_type"]);
              return sourceType === "market_payment" || sourceType === "extra_cost";
            },
          )
      : isCourierReceiveDetail
        ? courierReceivedHistory.length
          ? courierReceivedHistory
          : courierTransferHistory
        : cashboxHistory;

    return visibleHistory.map((item: Record<string, unknown>, index: number) => {
      const amount = toNumber(item["amount"]);
      const createdByUser =
        toActor(item["created_by_user"]) ??
        toActor(item["createdByUser"]) ??
        toActor(item["created_user"]) ??
        toActor(item["createdUser"]) ??
        toActor(item["creator"]) ??
        toActor(item["admin"]) ??
        toActor(item["manager"]) ??
        toActor(item["createdBy"]);
      const sourceUser =
        toActor(item["source_user"]) ??
        toActor(item["sourceUser"]);
      const rowUser = toActor(item["user"]);
      const actorName =
        getActorDisplayName(createdByUser) ||
        getActorDisplayName(sourceUser) ||
        getActorDisplayName(rowUser);
      const createdByName =
        actorName ||
        toMeaningfulString(item["created_by"]) ||
        toMeaningfulString(item["createdBy"]) ||
        toMeaningfulString(item["created_user_name"]) ||
        toMeaningfulString(item["createdUserName"]) ||
        toMeaningfulString(item["creator_name"]) ||
        toMeaningfulString(item["creatorName"]) ||
        toMeaningfulString(item["admin_name"]) ||
        toMeaningfulString(item["manager_name"]) ||
        toMeaningfulString(item["created_by_name"]) ||
        toMeaningfulString(item["createdByName"]) ||
        toMeaningfulString(item["created_by_full_name"]) ||
        toMeaningfulString(item["createdByFullName"]) ||
        entityName;
      const operationType =
        typeof item["operation_type"] === "string"
          ? item["operation_type"]
          : amount >= 0
            ? "income"
            : "expense";

      return {
        id: String(
          item["id"] ?? `${index}-${getHistoryDate(item) ?? "row"}`,
        ),
        amount,
        operation_type: operationType,
        source_type: toOptionalString(item["source_type"]) ?? toOptionalString(item["type"]),
        source_id: toOptionalString(item["source_id"]),
        cashbox_type: toOptionalString(item["cashbox_type"]) ?? toOptionalString(cashbox?.cashbox_type),
        created_by: createdByName,
        created_by_user: createdByUser,
        createdByUser: toActor(item["createdByUser"]),
        user: rowUser,
        source_user: sourceUser,
        sourceUser: toActor(item["sourceUser"]),
        payment_method:
          toOptionalString(item["payment_method"]) ??
          toOptionalString(item["method"]),
        payment_date: getHistoryDate(item),
        comment: toOptionalString(item["comment"]),
        createdAt: toOptionalString(item["createdAt"]),
        created_at: toOptionalString(item["created_at"]),
        cashbox: item["cashbox"] as PaymentRow["cashbox"],
      };
    });
  }, [
    cashbox?.cashbox_type,
    cashboxHistory,
    entityName,
    isBranchDetailRequest,
    isCourierReceiveDetail,
    isMarketDetailRequest,
  ]);

  const income = useMemo(
    () =>
      historyRows.reduce((sum, row) => {
        if (row.operation_type !== "income") return sum;
        return sum + Math.abs(toNumber(row.amount));
      }, 0),
    [historyRows],
  );

  const expense = useMemo(
    () =>
      historyRows.reduce((sum, row) => {
        if (row.operation_type !== "expense") return sum;
        return sum + Math.abs(toNumber(row.amount));
      }, 0),
    [historyRows],
  );

  const onSubmit = async (values: CashboxActionFormValues) => {
    const amount = parseAmountInput(values.amount);
    const paymentDate = new Date().toISOString();
    const comment = values.comment?.trim() || "";
    const sourceUserId =
      values.paymentType === "click" && values.transferSourceId !== "main"
        ? values.transferSourceId
        : undefined;
    const normalizedPaymentMethod =
      values.paymentType === "transfer" ? "click" : values.paymentType;

    if (type === "branch") {
      if (!id) return;
      const result = await apiRequest({
        request: () =>
          createPaymentBranchToMain.mutateAsync({
            branch_id: id,
            amount,
            payment_method: normalizedPaymentMethod,
            payment_date: paymentDate,
            comment,
            source_user_id: sourceUserId,
          }),
        successMessage: t("branchToMainPaymentSuccess"),
        errorMessage: t("branchToMainPaymentError"),
      });
      if (result) await refreshAfterPayment(amount);
      return;
    }

    if (type === "courier") {
      if (!id) return;
      const result = await apiRequest({
        request: () =>
          createPaymentCourier.mutateAsync({
            courier_id: id,
            amount,
            payment_method: normalizedPaymentMethod,
            market_id: isStoreTransfer ? values.marketId : null,
            payment_date: paymentDate,
            comment,
          }),
        successMessage: t("receivePaymentSuccess"),
        errorMessage: t("receivePaymentError"),
      });
      if (result) await refreshAfterPayment(amount);
      return;
    }

    const result = await apiRequest({
      request: () =>
        createPaymentMarket.mutateAsync({
          market_id: id,
          amount,
          payment_method: normalizedPaymentMethod,
          payment_date: paymentDate,
          comment,
          source_user_id: sourceUserId,
        }),
      successMessage: t("marketPaymentSuccess"),
      errorMessage: t("marketPaymentError"),
    });
    if (result) await refreshAfterPayment(amount);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-main" />
      </div>
    );
  }

  return (
    <CashboxRolePageLayout
      entityName={entityName}
      description={t(cfg.kassaLabelKey)}
      headerIcon={cfg.headerIcon}
      onBack={() => navigate(-1)}
      accentClass={cfg.iconBg}
      accentIcon={cfg.entityIcon}
      summarySubtitle={t(cfg.kassaLabelKey)}
      balance={displayBalance}
      balanceLabel={balanceLabel}
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
      incomeAmount={income}
      expenseAmount={expense}
      historyRows={historyRows}
      incomeLabel={t("income")}
      expenseLabel={t("expense")}
      todayTransactionsLabel={t("todayTransactions")}
      todayOperationsLabel={t("todayOperations")}
      summaryDetails={
        hasSettlementDetails ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-[color:var(--color-border-soft)] bg-primary shadow-sm dark:bg-primarydark">
            <div className="border-b border-[color:var(--color-border-soft)] px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-main text-primary shadow-lg shadow-main/20">
                  <WalletCards size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {t("settlementStatus")}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-white/40">
                    {t("counterparty")}: {settlementDetails.counterparty}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-3">
              {[
                {
                  label: t("amountInCashbox"),
                  amount: settlementDetails.cashboxAmount,
                  icon: <WalletCards size={16} />,
                  className: "border-main/20 bg-main/8 text-main dark:text-primary",
                },
	                {
	                  label: t("toBeGiven"),
	                  amount: displayAmountToGive,
	                  icon: <ArrowUpRight size={16} />,
	                  className: "border-rose-500/20 bg-rose-500/8 text-rose-500",
	                },
	                {
	                  label: t("toBeReceived"),
	                  amount: displayAmountToReceive,
	                  icon: <ArrowDownLeft size={16} />,
	                  className: "border-emerald-500/20 bg-emerald-500/8 text-emerald-500",
                },
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl border p-3 ${item.className}`}>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  <p className="text-sm font-black tabular-nums">
                    {item.amount.toLocaleString("uz-UZ")} {t("currency")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null
      }
      actionForm={
        <CashboxActionFormCard
            type={type}
            actionGradient={cfg.actionGradient}
            actionLabel={t(cfg.actionLabelKey)}
            actionSubLabel={t(cfg.actionSubKey)}
            submitLabel={t(cfg.submitLabelKey)}
            amountLabel={t("amountLabel")}
            paymentTypeLabel={t("paymentType")}
            paymentTypePlaceholder={t("paymentTypePlaceholder")}
            showMarketSelect={isStoreTransfer}
            marketLabel={t("selectMarket")}
            marketPlaceholder={t("selectMarket")}
            marketOptions={marketOptions}
            marketLoading={marketsLoading}
            showTransferSourceSelect={isTransferSourceSelectVisible}
            transferSourceLabel={t("selectCard")}
            transferSourcePlaceholder={t("selectCard")}
            transferSourceOptions={transferSourceOptions}
            transferSourceLoading={transferUsersLoading}
            submitLoading={isSubmitting}
            submitDisabled={
              (isStoreTransfer && !selectedMarketId) ||
              (isTransferSourceSelectVisible && !selectedTransferSourceId)
            }
            commentLabel={t("comment")}
            commentPlaceholder={t("commentPlaceholder")}
            paymentTypeOptions={paymentTypeOptions}
            control={control}
            register={register}
            errors={errors}
            handleSubmit={handleSubmit}
            onSubmit={onSubmit}
        />
      }
    />
  );
};

export default memo(CashDetail);

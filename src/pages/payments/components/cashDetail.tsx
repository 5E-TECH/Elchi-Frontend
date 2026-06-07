import { memo, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Landmark, Loader2, Store, Truck } from "lucide-react";
import type { PaymentRow } from "./patmentHistoryTable";
import { useCashBox } from "../../../entities/payments";
import { useMarkets } from "../../../entities/markets";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n";
import { parseAmountInput } from "./lib/amountInput";
import CashboxRolePageLayout from "./CashboxRolePageLayout";
import CashboxActionFormCard, {
  type CashboxActionFormValues,
} from "./CashboxActionFormCard";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";

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

const formatDisplayName = (value?: string | null) => {
  if (!value) return "";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

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
  comment: yup.string().defined(),
});

const CashDetail = () => {
  const { t } = useTranslation("payments");
  const { id } = useParams<{ id: string }>();
  const { state } = useLocation() as { state: DetailState | null };
  const navigate = useNavigate();
  const { getCashBoxById, createPaymentCourier, createPaymentBranchToMain, createPaymentMarket } = useCashBox();
  const { getMarkets } = useMarkets();
  const { apiRequest } = useAppNotification();

  const [selectedDateFrom, setSelectedDateFrom] = useState("");
  const [selectedDateTo, setSelectedDateTo] = useState("");
  const [balanceVisible, setBalanceVisible] = useState(true);

  const detailParams = useMemo(
    () => ({
      with_history: true,
      page: 1,
      limit: 100,
      ...(selectedDateFrom && { fromDate: selectedDateFrom }),
      ...(selectedDateTo && { toDate: selectedDateTo }),
    }),
    [selectedDateFrom, selectedDateTo],
  );
  const isBranchToMainDetail = state?.type === "branch";

  const { data: cashboxResponse, isLoading } = getCashBoxById(
    id || "",
    Boolean(id) && !isBranchToMainDetail,
    detailParams,
  );

  const detailData = cashboxResponse?.data;
  const detailEntry = Array.isArray(detailData) ? detailData[0] : detailData;
  const cashbox = detailEntry?.cashbox ?? detailEntry;
  const cashboxHistory = useMemo(
    () =>
      Array.isArray(detailEntry?.cashboxHistory)
        ? detailEntry.cashboxHistory
        : Array.isArray(detailEntry?.history)
          ? detailEntry.history
          : [],
    [detailEntry],
  );
  const user = detailEntry?.user ?? cashbox?.user ?? state?.entity;

  const type: CashDetailType = state?.type ?? normalizeType(cashbox?.cashbox_type, user?.role);
  const cfg = CONFIG[type];
  const entityName = user?.name?.trim() || t("userFallback");
  const totalBalance = toNumber(cashbox?.balance ?? state?.entity?.amount);

  const paymentTypeOptions = [
    { value: "cash", label: `💵 ${t("cash")}` },
    { value: "click", label: `💳 ${t("transferOption")}` },
    ...(type === "courier"
      ? [{ value: "click_to_market", label: `🏪 ${t("toMarketTransferOption")}` }]
      : []),
  ];

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<CashboxActionFormValues>({
      defaultValues: {
        amount: "",
        paymentType: "",
        marketId: "",
        comment: "",
      },
      resolver: yupResolver(cashDetailSchema) as Resolver<CashboxActionFormValues>,
    });

  const selectedPaymentType = watch("paymentType");
  const selectedMarketId = watch("marketId");
  const isStoreTransfer = selectedPaymentType === "click_to_market";
  const isSubmitting =
    createPaymentCourier.isPending ||
    createPaymentBranchToMain.isPending ||
    createPaymentMarket.isPending;
  const { data: marketsData, isLoading: marketsLoading } = getMarkets(
    { status: "active", limit: 0 },
    isStoreTransfer,
  );
  const marketOptions = useMemo(
    () =>
      (marketsData?.data?.items ?? []).map((item: { id: string | number; name: string }) => ({
        value: String(item.id),
        label: item.name,
      })),
    [marketsData],
  );

  useEffect(() => {
    if (!isStoreTransfer) {
      setValue("marketId", "");
    }
  }, [isStoreTransfer, setValue]);

  const historyRows = useMemo<PaymentRow[]>(() => {
    return cashboxHistory.map((item: Record<string, unknown>, index: number) => {
      const amount = toNumber(item["amount"]);
      const operationType =
        item["operation_type"] ?? (amount >= 0 ? "income" : "expense");

      return {
        id: String(
          item["id"] ?? `${index}-${item["createdAt"] ?? item["payment_date"] ?? "row"}`,
        ),
        amount,
        operation_type: operationType,
        source_type: (item["source_type"] as string | undefined) ?? formatDisplayName(item["type"] as string | undefined),
        source_id: item["source_id"],
        cashbox_type: (item["cashbox_type"] as string | undefined) ?? cashbox?.cashbox_type,
        created_by:
          (item["created_by"] as string | undefined) ??
          (item["createdBy"] as string | undefined) ??
          ((item["user"] as { name?: string } | undefined)?.name) ??
          entityName,
        payment_method:
          (item["payment_method"] as string | undefined) ??
          formatDisplayName(item["method"] as string | undefined),
        payment_date:
          (item["payment_date"] as string | undefined) ?? (item["createdAt"] as string | undefined) ?? (item["created_at"] as string | undefined),
        comment: item["comment"],
        createdAt: item["createdAt"],
        created_at: item["created_at"],
        cashbox: item["cashbox"],
      };
    });
  }, [cashbox?.cashbox_type, cashboxHistory, entityName]);

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
    const normalizedPaymentMethod =
      values.paymentType === "transfer" ? "click" : values.paymentType;

    if (type === "courier") {
      if (!id) return;
      const isBranchToMain =
        user?.role === "branch" ||
        (!!state?.entity?.type && state?.entity?.type !== "courier");

      if (isBranchToMain) {
        await apiRequest({
          request: () =>
            createPaymentBranchToMain.mutateAsync({
              branch_id: id,
              amount,
              payment_method: normalizedPaymentMethod,
              payment_date: paymentDate,
              comment,
            }),
          successMessage: t("receivePaymentSuccess"),
          errorMessage: t("receivePaymentError"),
          onSuccess: () => {
            reset({
              amount: "",
              paymentType: "",
              marketId: "",
              comment: "",
            });
          },
        });
        return;
      }

      await apiRequest({
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
        onSuccess: () => {
          reset({
            amount: "",
            paymentType: "",
            marketId: "",
            comment: "",
          });
        },
      });
      return;
    }

    if (!id) return;
    await apiRequest({
      request: () =>
        createPaymentMarket.mutateAsync({
          market_id: id,
          amount,
          payment_method: normalizedPaymentMethod,
          payment_date: paymentDate,
          comment,
        }),
      successMessage: t("marketPaymentSuccess"),
      errorMessage: t("marketPaymentError"),
      onSuccess: () => {
        reset({
          amount: "",
          paymentType: "",
          marketId: "",
          comment: "",
        });
      },
    });
  };

  if (isLoading && !isBranchToMainDetail) {
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
      incomeAmount={income}
      expenseAmount={expense}
      historyRows={historyRows}
      incomeLabel={t("income")}
      expenseLabel={t("expense")}
      todayTransactionsLabel={t("todayTransactions")}
      todayOperationsLabel={t("todayOperations")}
      actionForm={
        type === "branch" ? null : (
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
            submitLoading={isSubmitting}
            submitDisabled={isStoreTransfer && !selectedMarketId}
            commentLabel={t("comment")}
            commentPlaceholder={t("commentPlaceholder")}
            paymentTypeOptions={paymentTypeOptions}
            control={control}
            register={register}
            errors={errors}
            handleSubmit={handleSubmit}
            onSubmit={onSubmit}
          />
        )
      }
    />
  );
};

export default memo(CashDetail);

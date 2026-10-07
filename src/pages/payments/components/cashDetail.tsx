import { memo, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { ArrowDownLeft, ArrowUpRight, Download, Landmark, Loader2, Store, Truck, WalletCards } from "lucide-react";
import type { PaymentRow } from "./patmentHistoryTable";
import { useCashBox, type CashboxPaymentResponse } from "../../../entities/payments";
import { useFinanceCoverage } from "../../../entities/payments/financeCoverage";
import { useMarkets } from "../../../entities/markets";
import { useBranches } from "../../../entities/branch/api/useBranches";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n";
import { parseAmountInput } from "./lib/amountInput";
import {
  branchToMainPaymentFingerprint,
  courierPaymentFingerprint,
  isIdempotentReplay,
  isUncertainPaymentError,
  marketPaymentFingerprint,
  settlePaymentKey,
  takePaymentKey,
  type CourierPaymentIdentity,
} from "./lib/paymentIdempotency";
import { RECEIVE_BRANCHES_PARAMS } from "./lib/receiveOptions";
import CashboxRolePageLayout from "./CashboxRolePageLayout";
import CashboxActionFormCard, {
  type CashboxActionFormValues,
} from "./CashboxActionFormCard";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import type { RootState } from "../../../app/config/store";
import { api, LONG_REQUEST_TIMEOUT_MS } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { getExportErrorMessage } from "../../../shared/lib/exportFile";

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

/** GET /branches qatoridan shu filialning HQ'ga qarzi (topilmasa — undefined). */
const findBranchPayable = (branches: unknown, branchId: string | undefined): number | undefined => {
  if (!branchId || !Array.isArray(branches)) return undefined;
  const row = branches.find((branch) => String(asRecord(branch).id ?? "") === String(branchId));
  if (!row) return undefined;
  const value = asRecord(row).berilishi_kerak;
  return value === undefined || value === null ? undefined : toNumber(value);
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

const getArrayFromResponse = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value as Record<string, unknown>[];

  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | Record<string, unknown>[] | undefined;

  if (Array.isArray(record.items)) return record.items as Record<string, unknown>[];
  if (Array.isArray(record.cashboxHistory)) return record.cashboxHistory as Record<string, unknown>[];
  if (Array.isArray(record.history)) return record.history as Record<string, unknown>[];
  if (Array.isArray(data)) return data;

  if (data && typeof data === "object") {
    if (Array.isArray(data.items)) return data.items as Record<string, unknown>[];
    if (Array.isArray(data.cashboxHistory)) return data.cashboxHistory as Record<string, unknown>[];
    if (Array.isArray(data.history)) return data.history as Record<string, unknown>[];
  }

  return [];
};

const mergeHistoryRows = (...groups: Record<string, unknown>[][]) => {
  const rows = new Map<string, Record<string, unknown>>();

  groups.flat().forEach((item, index) => {
    const id = toOptionalString(item["id"]);
    const key =
      id ??
      [
        item["source_type"],
        item["operation_type"],
        item["amount"],
        getHistoryDate(item),
        item["comment"],
        index,
      ].join("|");

    rows.set(key, item);
  });

  return Array.from(rows.values()).sort((left, right) => {
    const leftDate = Date.parse(getHistoryDate(left) ?? "");
    const rightDate = Date.parse(getHistoryDate(right) ?? "");

    return (
      (Number.isFinite(rightDate) ? rightDate : 0) -
      (Number.isFinite(leftDate) ? leftDate : 0)
    );
  });
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

const PAYMENT_HISTORY_SOURCE_TYPES =
  "courier_payment,market_payment,branch_to_main";

type CashDetailType = "market" | "courier" | "branch";

const CASH_DETAIL_TYPES: readonly CashDetailType[] = ["market", "courier", "branch"];

export const isCashDetailType = (value: unknown): value is CashDetailType =>
  CASH_DETAIL_TYPES.includes(value as CashDetailType);

/**
 * Ekran turi zaxirasi (state ham, `?type=` ham yo'q bo'lsa). ⚠️ Aniqlanmasa
 * `null` — ilgari default `"market"` edi va filial kassasi F5 dan keyin
 * "Marketga to'lov" formasi bo'lib ochilib, `market_id` ga filial ID sini
 * yuborardi. Pul ekranida noto'g'ri taxmindan ko'ra forma ko'rsatmaslik yaxshi.
 */
export const normalizeType = (
  cashboxType?: string | null,
  role?: string | null,
): CashDetailType | null => {
  if (cashboxType === "main" || cashboxType === "branch" || role === "branch") return "branch";
  if (cashboxType === "couriers" || role === "courier") return "courier";
  if (cashboxType === "markets" || role === "market") return "market";
  return null;
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
  // "Karta egasi" tanlovi yo'q (C14 / FE-PAY-08): kassa to'lovlarining
  // DTO'larida `source_user_id` yo'q — qiymat hech qachon yuborilmaydi.
  transferSourceId: yup.string().defined(),
  comment: yup.string().defined(),
});

const CashDetail = () => {
  const { t } = useTranslation("payments");
  const { id } = useParams<{ id: string }>();
  const { state } = useLocation() as { state: DetailState | null };
  // Tur URL'da ham turadi (`?type=branch`) — F5, ulashilgan havola va yangi
  // tabda `location.state` yo'qoladi, tur esa yo'qolmasin.
  const [searchParams] = useSearchParams();
  const urlType = searchParams.get("type");
  const requestedType: CashDetailType | undefined =
    state?.type ?? (isCashDetailType(urlType) ? urlType : undefined);
  const navigate = useNavigate();
  const {
    useGetCashBoxById,
    useGetFinanceHistory,
    createPaymentCourier,
    createPaymentBranchToMain,
    createPaymentMarket,
  } = useCashBox();
  const { useGetManagerPayableToHq } = useFinanceCoverage();
  const { useGetMarkets } = useMarkets();
  const { api: notify } = useAppNotification();

  const [selectedDateFrom, setSelectedDateFrom] = useState("");
  const [selectedDateTo, setSelectedDateTo] = useState("");
  const [historyTab, setHistoryTab] = useState<"all" | "payments">("all");
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [balanceOverride, setBalanceOverride] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const currentRole = useSelector((store: RootState) => store.role.role);
  const isCurrentManagerRole = String(currentRole).toLowerCase() === "manager";

  const isBranchDetailRequest = requestedType === "branch";
  const isMarketDetailRequest = requestedType === "market";
  const isHqBranchReceiveRequest = isBranchDetailRequest && !isCurrentManagerRole;
  // Kuryer kassasi HAR QANDAY rol uchun `cashbox_type=couriers` bilan so'raladi.
  // Busiz superadmin/admin so'rovida gateway kuryer ID si bilan filial
  // qidirardi (ID lar bitta fazoda) va `{cashboxes:[...]}` qaytarardi — state'siz
  // ochilganda (F5 / havola) "Umumiy balans 0" va "Foydalanuvchi" chiqardi.
  const isCourierDetailRequest = requestedType === "courier";
  const dateParams = useMemo(
    () => ({
      ...(selectedDateFrom && { fromDate: selectedDateFrom }),
      ...(selectedDateTo && { toDate: selectedDateTo }),
      ...(historyTab === "payments" && { sourceTypes: PAYMENT_HISTORY_SOURCE_TYPES }),
    }),
    [historyTab, selectedDateFrom, selectedDateTo],
  );
  const detailParams = useMemo(
    () => ({
      with_history: true,
      page: 1,
      limit: 100,
      ...(isCourierDetailRequest && {
        cashbox_type: "couriers",
      }),
      ...(isHqBranchReceiveRequest && {
        cashbox_type: "branch",
      }),
      ...(isMarketDetailRequest && {
        cashbox_type: "markets",
      }),
      ...dateParams,
    }),
    [dateParams, isCourierDetailRequest, isHqBranchReceiveRequest, isMarketDetailRequest],
  );
  const branchHistoryParams = useMemo(
    () => ({
      page: 1,
      limit: 100,
      ...(id
        ? isHqBranchReceiveRequest
          ? { source_user_id: id, cashbox_type: "main" }
          : { user_id: id, cashbox_type: "branch" }
        : {}),
      ...dateParams,
    }),
    [dateParams, id, isHqBranchReceiveRequest],
  );
  const branchOwnHistoryParams = useMemo(
    () => ({
      page: 1,
      limit: 100,
      ...(id ? { user_id: id, cashbox_type: "branch" } : {}),
      ...dateParams,
    }),
    [dateParams, id],
  );
  const byUserCashboxQuery = useGetCashBoxById(
    id || "",
    Boolean(id) && (!isBranchDetailRequest || isHqBranchReceiveRequest),
    detailParams,
  );
  const managerPayableQuery = useGetManagerPayableToHq(
    isBranchDetailRequest && isCurrentManagerRole,
    dateParams,
  );
  const branchHistoryQuery = useGetFinanceHistory(branchHistoryParams, isBranchDetailRequest);
  const branchOwnHistoryQuery = useGetFinanceHistory(
    branchOwnHistoryParams,
    isHqBranchReceiveRequest,
  );
  // FE-PAY-15: HQ (superadmin/admin) filialdan qabul qilganda "Qabul
  // qilinishi kerak" summasi serverdan — oynadagi qator va karta summasi
  // bilan bir manba (GET /branches → `berilishi_kerak`), router state'idagi
  // (ro'yxat ochilgan paytdagi, eskirgan bo'lishi mumkin) summadan emas.
  const hqBranchesQuery = useBranches(
    { ...RECEIVE_BRANCHES_PARAMS },
    isHqBranchReceiveRequest && Boolean(id),
  );
  const serverBranchPayable = useMemo(
    () => (isHqBranchReceiveRequest ? findBranchPayable(hqBranchesQuery.data?.data, id) : undefined),
    [hqBranchesQuery.data, id, isHqBranchReceiveRequest],
  );
  const activeCashboxQuery = isBranchDetailRequest
    ? isCurrentManagerRole
      ? managerPayableQuery
      : byUserCashboxQuery
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
        return mergeHistoryRows(
          getArrayFromResponse(branchHistoryQuery.data),
          getArrayFromResponse(branchOwnHistoryQuery.data),
        );
      }
      if (isMarketDetailRequest) {
        return mergeHistoryRows(getArrayFromResponse(detailEntry));
      }

      return getArrayFromResponse(detailEntry);
    },
    [
      branchHistoryQuery.data,
      branchOwnHistoryQuery.data,
      detailEntry,
      isBranchDetailRequest,
      isMarketDetailRequest,
    ],
  );
  const user = detailEntry?.user ?? cashbox?.user ?? state?.entity;
  // Ism avval backend javobidagi `data.user` dan (kuryer kassasi uchun gateway
  // qo'shadi), keyin state'dan; ism bo'lmasa telefon, oxiri "Foydalanuvchi".
  const nameSources = [detailEntry?.user, cashbox?.user, state?.entity];

  const resolvedType = requestedType ?? normalizeType(cashbox?.cashbox_type, user?.role);
  // Tur aniqlanmasa to'lov formasi umuman ko'rsatilmaydi (fail-closed);
  // `type` faqat sarlavha/ikonka konfiguratsiyasi uchun.
  const isTypeUnknown = resolvedType === null;
  const type: CashDetailType = resolvedType ?? "market";
  const cfg = CONFIG[type];
  const entityName =
    nameSources.map((source) => toOptionalString(source?.name)?.trim()).find(Boolean) ||
    nameSources.map((source) => toOptionalString(source?.phone_number)?.trim()).find(Boolean) ||
    t("userFallback");
  // C3 — superadmin/admin (sahifaga faqat ular va menejer kiradi) uchun
  // backend kuryer kassasiga `is_hq_courier`, `can_receive`,
  // `receive_check_failed`, `olinishi_kerak` qo'shadi; menejerga yubormaydi.
  const courierReceiveInfo =
    type === "courier" && !isCurrentManagerRole ? detailEntry : undefined;
  // `can_receive === false` — aniq "yo'q": forma yashiriladi (fail-closed).
  //   • HQ kuryeri, lekin filialga tegishli topshirilmagan savdosi bor —
  //     ularni filial menejeri qabul qiladi (backend 400 qaytaradi);
  //   • filial kuryeri — puli kuryer → filial menejeri → HQ yo'li bilan
  //     keladi (backend 403 qaytaradi).
  const isCourierReceiveBlocked = courierReceiveInfo?.can_receive === false;
  const courierReceiveBlockedMessage =
    courierReceiveInfo?.is_hq_courier === true
      ? t("hqCourierHasBranchSales")
      : t("branchCourierNotReceivable");
  // Tekshiruv xizmati javob bermadi (`is_hq_courier`/`can_receive` = null):
  // forma qoladi, to'lovni backend qayta tekshiradi (hali ishlamasa 503).
  const isCourierReceiveCheckFailed =
    !isCourierReceiveBlocked && courierReceiveInfo?.receive_check_failed === true;
  const stateAmount = toNumber(state?.entity?.amount);
  const hasStateAmount =
    state?.entity?.amount !== undefined && state?.entity?.amount !== null;
  const isCourierReceiveDetail = type === "courier" && isCurrentManagerRole;
  const isHqBranchView = type === "branch" && !isCurrentManagerRole;
  const hasServerBranchPayable = isHqBranchView && serverBranchPayable !== undefined;
  const isHqBranchReceiveDetail = isHqBranchView && (hasStateAmount || hasServerBranchPayable);
  // Ko'rsatilgan summa router state'idan va server uni qayta o'qib bera olmaydi
  // (to'lovdan keyin u mahalliy kamaytiriladi).
  const isAmountFromRouterState =
    hasStateAmount && (isCourierReceiveDetail || (isHqBranchView && !hasServerBranchPayable));
  const apiBalance = toNumber(cashbox?.balance ?? stateAmount);
  const contextBalance =
    (isCourierReceiveDetail || isHqBranchReceiveDetail) && hasStateAmount
      ? stateAmount
      : apiBalance;
  const settlementBalance =
    hasServerBranchPayable && serverBranchPayable !== undefined
      ? serverBranchPayable
      : (type === "market" || type === "branch") && detailEntry?.berilishi_kerak !== undefined
        ? settlementDetails.amountToGive
        : detailEntry?.olinishi_kerak !== undefined
          ? settlementDetails.amountToReceive
          : contextBalance;
  const displayBalance = balanceOverride ?? settlementBalance;
  // Summa chegarasi FAQAT server bergan "Qabul qilinishi kerak" bo'yicha
  // (C3 `olinishi_kerak`, superadmin/admin). Menejerda ko'rsatilgan summa
  // router state'idan kelishi va kuryer kassasidagi puldan kam bo'lishi
  // mumkin — to'g'ri to'lov bloklanmasin, chegara backendda (kuryer kassasi).
  const courierReceiveLimit =
    courierReceiveInfo?.olinishi_kerak !== undefined && courierReceiveInfo?.olinishi_kerak !== null
      ? displayBalance
      : null;
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
      : type === "market"
        ? t("toBeGiven")
      : type === "branch" && detailEntry?.berilishi_kerak !== undefined
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
    // "Marketga o'tkazma" faqat HQ kassasi orqali (superadmin/admin) —
    // menejerga backend 403 qaytaradi (audit M4), shuning uchun ko'rsatilmaydi.
    ...(type === "courier" && !isCurrentManagerRole
      ? [{ value: "click_to_market", label: t("toMarketTransferOption") }]
      : []),
  ];
  const { register, control, handleSubmit, watch, setValue, setError, reset, formState: { errors } } =
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
  const isStoreTransfer = selectedPaymentType === "click_to_market";
  // C14 / FE-PAY-08: "O'tkazma"da "karta egasi" tanlovi YO'Q — kuryer, market
  // va filial → HQ uchun ham. Kassa yagona (per-person karta yo'q), DTO'larda
  // `source_user_id` yo'q va qiymat hech qachon yuborilmasdi.
  const isSubmitting =
    createPaymentCourier.isPending ||
    createPaymentBranchToMain.isPending ||
    createPaymentMarket.isPending;
  const { data: marketsData, isLoading: marketsLoading } = useGetMarkets(
    { status: "active", limit: FULL_LIST_LIMIT },
    isStoreTransfer,
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

  useEffect(() => {
    if (!isStoreTransfer) {
      setValue("marketId", "");
    }
  }, [isStoreTransfer, setValue]);

  const resetActionForm = () => {
    reset({
      amount: "",
      paymentType: "",
      marketId: "",
      transferSourceId: "",
      comment: "",
    });
  };

  /** Kassa, tarix va (HQ filial sahifasida) filial summasini qayta o'qish. */
  const refetchPaymentState = () =>
    Promise.all([
      refetchCashbox(),
      isBranchDetailRequest ? branchHistoryQuery.refetch() : Promise.resolve(),
      isHqBranchReceiveRequest ? branchOwnHistoryQuery.refetch() : Promise.resolve(),
      isHqBranchReceiveRequest ? hqBranchesQuery.refetch() : Promise.resolve(undefined),
    ]);

  const refreshAfterPayment = async (amount: number) => {
    setBalanceOverride(reduceBalanceTowardsZero(settlementBalance, amount));
    resetActionForm();

    const [refreshed, , , refreshedBranches] = await refetchPaymentState();

    if (hasServerBranchPayable) {
      // Filial qarzi ledger'dan (to'lovdan keyin u asinxron yangilanadi):
      // server summasi o'zgargan bo'lsa — u, o'zgarmagan bo'lsa mahalliy
      // kamaytirilgan summa qoladi.
      const refreshedPayable = findBranchPayable(refreshedBranches?.data?.data, id);
      if (refreshedPayable !== undefined && refreshedPayable !== settlementBalance) {
        setBalanceOverride(refreshedPayable);
      }
      return;
    }

    if (isAmountFromRouterState) {
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
      ? historyTab === "payments"
        ? cashboxHistory.filter(isActualBranchToHqPaymentItem)
        : cashboxHistory
      : isMarketDetailRequest
        ? cashboxHistory
      : isCourierReceiveDetail
        ? historyTab === "payments" && courierReceivedHistory.length
          ? courierReceivedHistory
          : historyTab === "payments"
            ? courierTransferHistory
            : cashboxHistory
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
      const actorName = getActorDisplayName(createdByUser);
      const createdByName =
        actorName ||
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
        toOptionalString(item["created_by"]) ||
        toOptionalString(item["createdBy"]);
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
    historyTab,
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

  const handleExportExcel = async () => {
    const cashboxId = toOptionalString(cashbox?.id);
    if (!cashboxId || isExporting) return;

    setIsExporting(true);
    try {
      const response = await api.get(API_ENDPOINTS.EXPORT.CASHBOX_HISTORY_XLSX, {
        params: {
          cashbox_id: cashboxId,
          ...(selectedDateFrom && { from_date: selectedDateFrom }),
          ...(selectedDateTo && { to_date: selectedDateTo }),
          ...(historyTab === "payments" && { sourceTypes: PAYMENT_HISTORY_SOURCE_TYPES }),
        },
        responseType: "blob",
        timeout: LONG_REQUEST_TIMEOUT_MS,
      });
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cashbox-history-${entityName || cashboxId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      // FE-PAY-16: xato endi ko'rinadi (ilgari jim yutilardi).
      notify.error({
        message: t("common:error"),
        description: (await getExportErrorMessage(error)) ?? t("excelExportError"),
        placement: "topRight",
        duration: 5,
      });
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * C1 / FE-PAY-03: market to'lovi va filial → HQ — kuryer to'lovi kabi
   * `Idempotency-Key` bilan. Kalit to'lovning barmoq iziga bog'langan va javob
   * kelgunicha saqlanadi: 504 (gateway timeout — pul o'tgan bo'lishi mumkin)
   * dan keyin aynan shu to'lov qayta yuborilsa, backend uni ikkinchi marta
   * yozmaydi va `idempotent: true` qaytaradi.
   */
  const submitIdempotentPayment = async ({
    fingerprint,
    send,
    amount,
    successMessage,
    errorMessage,
  }: {
    fingerprint: string;
    send: (idempotencyKey: string) => Promise<{ data?: CashboxPaymentResponse }>;
    amount: number;
    successMessage: string;
    errorMessage: string;
  }) => {
    const idempotencyKey = takePaymentKey(fingerprint);
    let response: { data?: CashboxPaymentResponse };
    try {
      response = await send(idempotencyKey);
    } catch (error) {
      // Kalit saqlanadi: aynan shu to'lov qayta yuborilsa backend uni
      // faqat bir marta o'tkazadi.
      notify.error({
        message: t("common:error"),
        description: getBackendErrorMessage(error) ?? errorMessage,
        placement: "topRight",
        duration: 5,
      });
      if (isUncertainPaymentError(error)) {
        // Javob kelmadi — pul o'tgan bo'lishi mumkin: forma o'sha eski balans
        // bilan qolib, ko'r-ko'rona qayta bosilmasin.
        notify.warning({
          message: t("common:warning"),
          description: t("paymentOutcomeUnknown"),
          placement: "topRight",
          duration: 10,
        });
        await refetchPaymentState();
      }
      return;
    }

    settlePaymentKey(fingerprint);
    if (isIdempotentReplay(response)) {
      // Pul avvalgi (javobi yo'qolgan) urinishda o'tgan — "muvaffaqiyatli"
      // deyilmaydi va forma tozalanadi (bir bosishda yangi kalitli ikkinchi
      // to'lov ketib qolmasin); summa serverdan qayta o'qiladi.
      notify.warning({
        message: t("common:warning"),
        description: t("paymentAlreadyRecorded"),
        placement: "topRight",
        duration: 8,
      });
      if (isAmountFromRouterState) {
        setBalanceOverride(reduceBalanceTowardsZero(settlementBalance, amount));
      }
      resetActionForm();
      await refetchPaymentState();
      return;
    }

    notify.success({
      message: t("common:success"),
      description: successMessage,
      placement: "topRight",
      duration: 4,
    });
    await refreshAfterPayment(amount);
  };

  const onSubmit = async (values: CashboxActionFormValues) => {
    if (isTypeUnknown) return;
    const amount = parseAmountInput(values.amount);
    const paymentDate = new Date().toISOString();
    const comment = values.comment?.trim() || "";
    const normalizedPaymentMethod =
      values.paymentType === "transfer" ? "click" : values.paymentType;

    if (type === "branch") {
      // Filial ID si — URL'dagi `id` (fix3 dan oldingidek; FE-PAY-01
      // foydalanuvchi qarori #7 bilan qaytarilgan). `Idempotency-Key`
      // superadmin/admin'ning filialdan qabul qilishini himoya qiladi.
      const branchId = id;
      if (!branchId) return;
      const payment = { branch_id: branchId, amount, payment_method: normalizedPaymentMethod };
      // C14: `source_user_id` yuborilmaydi (DTO'da yo'q → 400).
      await submitIdempotentPayment({
        fingerprint: branchToMainPaymentFingerprint(payment),
        send: (idempotencyKey) =>
          createPaymentBranchToMain.mutateAsync({
            data: { ...payment, payment_date: paymentDate, comment },
            idempotencyKey,
          }),
        amount,
        successMessage: t("branchToMainPaymentSuccess"),
        errorMessage: t("branchToMainPaymentError"),
      });
      return;
    }

    if (type === "courier") {
      if (!id || isCourierReceiveBlocked) return;
      // Server bergan summadan ortig'i yuborilmaydi (backend ham kuryer
      // kassasidan ortig'ini rad etadi) — xato summa maydoni ostida chiqadi.
      if (courierReceiveLimit !== null && amount > courierReceiveLimit) {
        setError("amount", {
          type: "max",
          message: t("amountExceedsBalance", {
            amount: courierReceiveLimit.toLocaleString("uz-UZ"),
          }),
        });
        return;
      }
      const payment: CourierPaymentIdentity = {
        courier_id: id,
        amount,
        payment_method: normalizedPaymentMethod,
        market_id: isStoreTransfer ? values.marketId : null,
      };
      // Kalit to'lovning barmoq iziga bog'langan (kuryer ID si ham ichida) —
      // javobi kelmagan har bir to'lov o'z kalitini saqlaydi.
      const fingerprint = courierPaymentFingerprint(payment);
      const idempotencyKey = takePaymentKey(fingerprint);
      // `apiRequest` har qanday javobga "muvaffaqiyatli" deydi — takroriy
      // (idempotent) javobni ajratish uchun bildirishnomalar shu yerda.
      let response: Awaited<ReturnType<typeof createPaymentCourier.mutateAsync>>;
      try {
        response = await createPaymentCourier.mutateAsync({
          data: { ...payment, payment_date: paymentDate, comment },
          idempotencyKey,
        });
      } catch (error) {
        // Kalit saqlanadi: aynan shu to'lov qayta yuborilsa backend uni
        // faqat bir marta o'tkazadi.
        notify.error({
          message: t("common:error"),
          description: getBackendErrorMessage(error) ?? t("receivePaymentError"),
          placement: "topRight",
          duration: 5,
        });
        return;
      }

      // Javob keldi — faqat SHU to'lov yakunlandi; boshqa javobsiz to'lovlarning
      // kalitlari saqlanib qoladi.
      settlePaymentKey(fingerprint);
      if (isIdempotentReplay(response)) {
        // Pul avvalgi urinishda o'tgan: yangi summa bilan "muvaffaqiyatli"
        // ko'rsatilmaydi va balansdan qayta ayirilmaydi — serverdagi haqiqiy
        // holat qayta o'qiladi. Forma tozalanadi: bir bosishda ikkinchi
        // (endi yangi kalitli) to'lov ketib qolmasin.
        notify.warning({
          message: t("common:warning"),
          description: t("paymentAlreadyRecorded"),
          placement: "topRight",
          duration: 8,
        });
        // Menejer ro'yxatdan ochganda summa router state'dan keladi va qayta
        // o'qilgan kassa uni yangilamaydi — avvalgi (javobi yo'qolgan) urinish
        // shu summani allaqachon o'tkazgan, shuning uchun ekrandagi summa ham
        // shunga kamaytiriladi (barmoq izida summa bor — aynan o'sha to'lov).
        if (isAmountFromRouterState) {
          setBalanceOverride(reduceBalanceTowardsZero(settlementBalance, amount));
        }
        resetActionForm();
        await refetchCashbox();
        return;
      }
      notify.success({
        message: t("common:success"),
        description: t("receivePaymentSuccess"),
        placement: "topRight",
        duration: 4,
      });
      await refreshAfterPayment(amount);
      return;
    }

    // Marketga to'lov FAQAT market kassasiga — filial/kuryer ID si market_id
    // bo'lib ketmasin (ID lar bir xil raqamli fazoda).
    if (cashbox?.cashbox_type !== "markets" || !id) {
      notify.error({ message: t("marketPaymentError"), description: t("cashDetailNotMarketCashbox") });
      return;
    }
    const payment = { market_id: id, amount, payment_method: normalizedPaymentMethod };
    // C14: `source_user_id` yuborilmaydi (DTO'da yo'q → 400).
    await submitIdempotentPayment({
      fingerprint: marketPaymentFingerprint(payment),
      send: (idempotencyKey) =>
        createPaymentMarket.mutateAsync({
          data: { ...payment, payment_date: paymentDate, comment },
          idempotencyKey,
        }),
      amount,
      successMessage: t("marketPaymentSuccess"),
      errorMessage: t("marketPaymentError"),
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
      historyTab={historyTab}
      onHistoryTabChange={setHistoryTab}
      allHistoryLabel={t("allHistory")}
      paymentsHistoryLabel={t("paymentTransfers")}
      historyAction={
        // FE-PAY-16: cashbox-history.xlsx faqat ADMIN/SUPERADMIN uchun —
        // menejerga tugma ko'rsatilmaydi (403 olib, hech narsa bo'lmasdi).
        isCurrentManagerRole ? null : (
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting || !cashbox?.id}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Excel
          </button>
        )
      }
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
        isTypeUnknown ? (
          <div role="alert" className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-400/35 dark:bg-amber-400/10 dark:text-amber-100">
            {t("cashDetailTypeUnknown")}
          </div>
        ) : isCourierReceiveBlocked ? (
          <div role="alert" className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-400/35 dark:bg-amber-400/10 dark:text-amber-100">
            {courierReceiveBlockedMessage}
          </div>
        ) : (
        <>
        {isCourierReceiveCheckFailed ? (
          <div role="alert" className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-400/35 dark:bg-amber-400/10 dark:text-amber-100">
            {t("receiveCheckFailed")}
          </div>
        ) : null}
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
        </>
        )
      }
    />
  );
};

export default memo(CashDetail);

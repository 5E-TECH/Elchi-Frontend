// dizayn-v2: superadmin-payments-cash-detail-courier, superadmin-payments-cash-detail-market, superadmin-payments-cash-detail-branch, admin-payments-cash-detail-courier, admin-payments-cash-detail-market, admin-payments-cash-detail-branch, manager-payments-cash-detail-courier, manager-payments-cash-detail-branch
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  ArrowLeftRight,
  Banknote,
  Building2,
  ChartColumn,
  CircleCheck,
  Download,
  Eye,
  EyeOff,
  Info,
  List,
  Send,
  Store,
  TriangleAlert,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
import { toPaymentAck } from "./paymentAck";
import CashboxActionFormCard, {
  type CashboxActionFormValues,
} from "./CashboxActionFormCard";
import PaymentHistoryList, { historyRowView } from "./PaymentHistoryList";
import type { RootState } from "../../../app/config/store";
import { api, LONG_REQUEST_TIMEOUT_MS } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { getExportErrorMessage } from "../../../shared/lib/exportFile";
import { notify } from "../../../shared/lib/notify";
import { cx } from "../../../shared/lib/cx";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { formatDateLocalized, formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  CURRENCY_LABEL,
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatPercentLocalized,
  formatSignedMoneyLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  Card,
  DataTable,
  DateRange,
  ErrorState,
  IconButton,
  PageHeader,
  SegmentedControl,
  Skeleton,
  SkeletonLines,
  useConfirm,
  type ConfirmTransfer,
  type DataTableColumn,
} from "../../../shared/ui/primitives";

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

/** GET /branches qatoridan filial nomi (state'siz ochilganda sarlavha uchun). */
const findBranchName = (branches: unknown, branchId: string | undefined): string | undefined => {
  if (!branchId || !Array.isArray(branches)) return undefined;
  const row = branches.find((branch) => String(asRecord(branch).id ?? "") === String(branchId));
  return row ? toMeaningfulString(asRecord(row).name) : undefined;
};

/** Profil filiali nomi: menejer profilida `branch` — branch_users qatori, nom ichki `branch.branch.name` da. */
const readProfileBranchName = (profile: unknown): string | undefined => {
  const branch = asRecord(asRecord(profile).branch);
  return toMeaningfulString(asRecord(branch.branch).name) ?? toMeaningfulString(branch.name);
};

/** Raqamli qiymat (yo'q yoki raqam emas — `undefined`). */
const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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
    /** Filial qatori (superadmin/admin «Qabul qilinishi kerak» oynasi): filial nomi — sarlavha. */
    branch_name?: string;
    /** Market qatori: viloyat (bo'lsa — sarlavha izohida). */
    region?: string;
  };
}

/** Sahifa sarlavhasi badge'i (maket `.el-badge.el-tone-neutral` + ikonka). */
const TYPE_ICON: Record<CashDetailType, LucideIcon> = {
  courier: Truck,
  market: Store,
  branch: Building2,
};

const MASK = "••••••";

/** Tarix qatori ko'rinishi — ro'yxat (`PaymentHistoryList`) bilan bir manba. */
const {
  date: getHistoryRowDate,
  signedAmount: getHistoryRowSignedAmount,
  title: getHistoryRowTitle,
} = historyRowView;

const cashDetailSchema: yup.ObjectSchema<CashboxActionFormValues> = yup.object({
  amount: yup
    .string()
    .required(i18n.t("payments:amountRequired"))
    .test("positive-number", i18n.t("payments:amountPositiveValidation"), (value) =>
      parseAmountInput(value) > 0),
  paymentType: yup.string().required(i18n.t("payments:v2CashDetail.form.paymentTypeRequired")),
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
  const { useGetManagerPayableToHq, useGetManagerSettlement } = useFinanceCoverage();
  const { useGetMarkets } = useMarkets();

  const [selectedDateFrom, setSelectedDateFrom] = useState("");
  const [selectedDateTo, setSelectedDateTo] = useState("");
  const [historyTab, setHistoryTab] = useState<"all" | "payments">("all");
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [balanceOverride, setBalanceOverride] = useState<number | null>(null);
  /**
   * TASDIQLASH (5hBeDuyn): pul yuborish tugmasi darhol so'rov yubormaydi —
   * avval summa, yo'nalish (qayerdan → qayerga) va to'lov turi ko'rsatilib,
   * tasdiq so'raladi (`useConfirm`). "Bekor qilish" — hech qanday so'rov ketmaydi.
   * Qulf: tasdiq oynasi ochiq yoki to'lov ketayotganda ikkinchi oyna ochilmaydi.
   */
  const confirm = useConfirm();
  const paymentLockRef = useRef(false);
  const [isExporting, setIsExporting] = useState(false);
  const currentRole = useSelector((store: RootState) => store.role.role);
  const currentProfile = useSelector((store: RootState) => store.user.user);
  const isCurrentManagerRole = String(currentRole).toLowerCase() === "manager";
  const ownBranchName = readProfileBranchName(currentProfile);

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
  // Menejer → HQ: «Kassadagi summa» (naqd/karta) va «Qabul qilinishi kerak» — GET finance/cashbox/manager/settlement
  // (payable-to-hq faqat `berilishi_kerak` + `counterparty` qaytaradi). Ko'rsatish uchun; summa hisobi o'zgarmagan.
  // Paramsiz — /payments sahifasidagi so'rov bilan bitta kesh.
  const managerSettlementQuery = useGetManagerSettlement(isBranchDetailRequest && isCurrentManagerRole);
  const activeCashboxQuery = isBranchDetailRequest
    ? isCurrentManagerRole
      ? managerPayableQuery
      : byUserCashboxQuery
    : byUserCashboxQuery;
  const {
    data: freshCashboxResponse,
    isLoading,
    isError: isCashboxError,
    error: cashboxError,
    refetch: refetchCashbox,
  } = activeCashboxQuery;
  // Sana/tab o'zgarganda yangi so'rov kalit bilan yuklanadi — o'sha kassaning oldingi javobi ko'rinib turadi
  // (sahifa skeletga qaytmaydi), faqat tarix ro'yxati yuklanish holatida. Boshqa kassaga o'tilsa — ishlatilmaydi.
  const viewKey = `${id ?? ""}|${requestedType ?? ""}|${isCurrentManagerRole ? "manager" : "staff"}`;
  const [keptResponse, setKeptResponse] = useState<{ key: string; data: typeof freshCashboxResponse } | null>(null);
  if (
    freshCashboxResponse !== undefined &&
    (keptResponse?.data !== freshCashboxResponse || keptResponse?.key !== viewKey)
  ) {
    setKeptResponse({ key: viewKey, data: freshCashboxResponse });
  }
  const cashboxResponse =
    freshCashboxResponse ?? (keptResponse?.key === viewKey ? keptResponse.data : undefined);
  const isRefreshingCashbox = isLoading && cashboxResponse !== undefined;

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
  // Yorliq tanlovi o'zgarmagan; kalit qarama-qarshi qatorni («Berilishi kerak» ↔ «Qabul qilinishi kerak») tanlash uchun.
  const balanceLabelKey: "toBeReceived" | "toBeGiven" | "totalBalanceLabel" =
    isHqBranchReceiveDetail
      ? "toBeReceived"
      : type === "market"
        ? "toBeGiven"
      : type === "branch" && detailEntry?.berilishi_kerak !== undefined
      ? "toBeGiven"
      : detailEntry?.olinishi_kerak !== undefined
        ? "toBeReceived"
        : "totalBalanceLabel";
  const balanceLabel = t(balanceLabelKey);

  useEffect(() => {
    setBalanceOverride(null);
  }, [id, settlementBalance]);

  const paymentTypeOptions = [
    { value: "cash", label: t("v2Common.paymentMethod.cash") },
    { value: "click", label: t("v2Common.paymentMethod.transfer") },
    // "Marketga o'tkazma" faqat HQ kassasi orqali (superadmin/admin) —
    // menejerga backend 403 qaytaradi (audit M4), shuning uchun ko'rsatilmaydi.
    ...(type === "courier" && !isCurrentManagerRole
      ? [{ value: "click_to_market", label: t("v2Common.paymentMethod.toMarket") }]
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
        // «Balans harakati» uchun (additiv): qaysi kassa qatori va operatsiyadan keyingi qoldiq.
        cashbox_id: toOptionalString(item["cashbox_id"]) ?? toOptionalString(asRecord(item["cashbox"]).id),
        balance_after: toOptionalNumber(item["balance_after"]),
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
        payment_ack: toPaymentAck(item["payment_ack"]),
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

  // «Balans harakati» — faqat ko'rilayotgan kassaning qatorlari. Superadmin/admin filial sahifasida tarix ikki
  // manbadan yig'iladi (asosiy kassadagi filial to'lovlari + filialning o'z kassasi): asosiy kassa qatorining
  // qoldig'i (`balance_after`) filial kassasiniki emas. Kuryer, market va menejer sahifalarida — barcha qatorlar.
  const viewedCashboxId = toOptionalString(cashbox?.id);
  const movementRows = useMemo(
    () =>
      viewedCashboxId
        ? historyRows.filter((row) => !row.cashbox_id || String(row.cashbox_id) === viewedCashboxId)
        : historyRows,
    [historyRows, viewedCashboxId],
  );

  const income = useMemo(
    () =>
      movementRows.reduce((sum, row) => {
        if (row.operation_type !== "income") return sum;
        return sum + Math.abs(toNumber(row.amount));
      }, 0),
    [movementRows],
  );

  const expense = useMemo(
    () =>
      movementRows.reduce((sum, row) => {
        if (row.operation_type !== "expense") return sum;
        return sum + Math.abs(toNumber(row.amount));
      }, 0),
    [movementRows],
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
      notify.error(t("common:error"), {
        description: (await getExportErrorMessage(error)) ?? t("excelExportError"),
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
      notify.error(t("common:error"), { description: getBackendErrorMessage(error) ?? errorMessage });
      if (isUncertainPaymentError(error)) {
        // Javob kelmadi — pul o'tgan bo'lishi mumkin: forma o'sha eski balans
        // bilan qolib, ko'r-ko'rona qayta bosilmasin.
        notify.warning(t("common:warning"), { description: t("paymentOutcomeUnknown"), duration: 10000 });
        await refetchPaymentState();
      }
      return;
    }

    settlePaymentKey(fingerprint);
    if (isIdempotentReplay(response)) {
      // Pul avvalgi (javobi yo'qolgan) urinishda o'tgan — "muvaffaqiyatli"
      // deyilmaydi va forma tozalanadi (bir bosishda yangi kalitli ikkinchi
      // to'lov ketib qolmasin); summa serverdan qayta o'qiladi.
      notify.warning(t("common:warning"), { description: t("paymentAlreadyRecorded"), duration: 8000 });
      if (isAmountFromRouterState) {
        setBalanceOverride(reduceBalanceTowardsZero(settlementBalance, amount));
      }
      resetActionForm();
      await refetchPaymentState();
      return;
    }

    notify.success(t("common:success"), { description: successMessage });
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
            amount: formatMoneyLocalized(courierReceiveLimit, { withCurrency: false }),
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
        notify.error(t("common:error"), {
          description: getBackendErrorMessage(error) ?? t("receivePaymentError"),
        });
        if (isUncertainPaymentError(error)) {
          // Javob kelmadi (504 / tarmoq) — pul o'tgan bo'lishi mumkin: boshqa
          // oyoqlardagi kabi ogohlantirilib, kassa qayta o'qiladi.
          notify.warning(t("common:warning"), { description: t("paymentOutcomeUnknown"), duration: 10000 });
          await refetchCashbox();
        }
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
        notify.warning(t("common:warning"), { description: t("paymentAlreadyRecorded"), duration: 8000 });
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
      notify.success(t("common:success"), { description: t("receivePaymentSuccess") });
      await refreshAfterPayment(amount);
      return;
    }

    // Marketga to'lov FAQAT market kassasiga — filial/kuryer ID si market_id
    // bo'lib ketmasin (ID lar bir xil raqamli fazoda).
    if (cashbox?.cashbox_type !== "markets" || !id) {
      notify.error(t("marketPaymentError"), { description: t("cashDetailNotMarketCashbox") });
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

  const paymentMethodLabel = (value: CashboxActionFormValues["paymentType"]) =>
    paymentTypeOptions.find((option) => option.value === value)?.label ?? String(value ?? "");

  // ── Ko'rinish uchun hosilalar (pul hisobi yuqorida, o'zgarmagan) ─────────────────────────────────────────
  const isManagerBranchView = type === "branch" && isCurrentManagerRole;
  /** Summa (yashirilganda — «••••••»). */
  const money = (value: number) => (balanceVisible ? formatMoneyLocalized(value) : MASK);
  const cashboxLabel = (key: "main" | "courier" | "market" | "branch") => t(`v2Common.cashbox.${key}`);

  const hasEntityName = nameSources.some((source) => Boolean(toOptionalString(source?.name)?.trim()));
  const entityPhoneRaw = nameSources
    .map((source) => toOptionalString(source?.phone_number)?.trim())
    .find(Boolean);
  const entityPhone = entityPhoneRaw ? formatPhone(entityPhoneRaw) || entityPhoneRaw : undefined;
  const stateBranchName = toMeaningfulString(state?.entity?.branch_name);
  // Filial (superadmin/admin): sarlavha — filial nomi (state, F5 da GET /branches), aks holda «Filial kassasi».
  const branchTitle =
    stateBranchName ?? findBranchName(hqBranchesQuery.data?.data, id) ?? t("v2CashDetail.header.branchFallback");
  const stateEntityName = toMeaningfulString(state?.entity?.name);
  // Menejersiz filial qatorida `name` — filial nomining o'zi.
  const branchManagerName = stateEntityName && stateEntityName !== stateBranchName ? stateEntityName : undefined;
  // Menejer → HQ: state'dagi HQ nomi (`/payments` dagi «HQ'ga o'tkazish»), aks holda «Asosiy filial».
  const hqName = stateEntityName ?? t("mainBranchFallback");

  const pageTitle = isTypeUnknown
    ? entityName
    : type === "branch"
      ? isManagerBranchView
        ? hqName
        : branchTitle
      : entityName;
  const pageBadge = isTypeUnknown ? null : isManagerBranchView ? (
    <Badge icon={Building2}>{t("v2CashDetail.header.hqCashbox")}</Badge>
  ) : (
    <Badge icon={TYPE_ICON[type]}>{cashboxLabel(type)}</Badge>
  );
  const phonePart = hasEntityName ? entityPhone : undefined;
  const pageSubtitle = isTypeUnknown
    ? undefined
    : type === "courier"
      ? joinParts(
          isCurrentManagerRole
            ? ownBranchName && t("v2CashDetail.header.branchCourier", { branch: ownBranchName })
            : courierReceiveInfo?.is_hq_courier === true && t("v2CashDetail.header.hqCourier"),
          phonePart,
        )
      : type === "market"
        ? joinParts(phonePart, toMeaningfulString(state?.entity?.region))
        : isManagerBranchView
          ? ownBranchName
            ? t("v2CashDetail.header.hqTransfer", { branch: ownBranchName })
            : t("v2CashDetail.header.hqTransferFallback")
          : joinParts(
              branchManagerName && t("v2CashDetail.header.manager", { name: branchManagerName }),
              branchManagerName ? entityPhone : undefined,
            );

  // «Hisob-kitob holati» kartasi.
  const settlementTitle = isCourierReceiveDetail ? cashboxLabel("courier") : t("v2CashDetail.settlement.title");
  const settlementDescription = isTypeUnknown
    ? undefined
    : isManagerBranchView
      ? t("v2CashDetail.settlement.counterparty", { name: hqName })
      : isCourierReceiveDetail
        ? t("v2CashDetail.settlement.receiver", { name: joinParts(cashboxLabel("main"), ownBranchName) })
        : t("v2CashDetail.settlement.counterparty", { name: cashboxLabel("main") });
  const hasCashboxAmount =
    !isManagerBranchView && (detailEntry?.kassadagi_summa !== undefined || cashbox?.balance !== undefined);
  const cashboxSplit = {
    cash: toOptionalNumber(cashbox?.balance_cash),
    card: toOptionalNumber(cashbox?.balance_card),
  };
  // Qarama-qarshi qator (maket: «Berilishi kerak 0 so'm» / «Qabul qilinishi kerak …»). Superadmin/admin filial
  // sahifasida asosiy son allaqachon filialning `berilishi_kerak` i — u qatorda takrorlanmaydi; menejer → HQ
  // sahifasida «Qabul qilinishi kerak» settlement'dan (`HqCoverage`), payable-to-hq uni bermaydi.
  const counterRow = !hasSettlementDetails || isHqBranchView || isManagerBranchView
    ? null
    : balanceLabelKey === "toBeReceived"
      ? { label: t("toBeGiven"), value: displayAmountToGive }
      : balanceLabelKey === "toBeGiven"
        ? { label: t("toBeReceived"), value: displayAmountToReceive }
        : null;
  // Menejer → HQ: kassa (settlement) — faqat ko'rsatish uchun.
  const managerSettlement = asRecord(asRecord(managerSettlementQuery.data).data);
  const managerKassa = asRecord(managerSettlement.kassa);
  const managerKassaTotal = isManagerBranchView ? toOptionalNumber(managerKassa.total) : undefined;
  const managerReceivable = toOptionalNumber(managerSettlement.olinishi_kerak);

  // Amal formasi matnlari (maket).
  const typedAmount = parseAmountInput(watch("amount"));
  const formTitle =
    type === "courier"
      ? t("v2CashDetail.form.courierTitle")
      : type === "market"
        ? t("v2CashDetail.form.marketTitle")
        : isManagerBranchView
          ? t("v2CashDetail.form.hqTitle")
          : t("v2CashDetail.form.branchTitle");
  const formSubtitle =
    type === "courier"
      ? isCurrentManagerRole
        ? t("v2CashDetail.form.courierToBranch")
        : t("v2CashDetail.form.courierToMain")
      : type === "market"
        ? t("v2CashDetail.form.marketSubtitle")
        : isManagerBranchView
          ? t("v2CashDetail.form.hqSubtitle")
          : t("v2CashDetail.form.branchSubtitle");
  const amountHint =
    type === "courier" && courierReceiveLimit !== null
      ? t("v2CashDetail.form.limitHint", { amount: money(courierReceiveLimit) })
      : type === "market"
        ? t("v2CashDetail.form.payableHint", { amount: money(displayBalance) })
        : isManagerBranchView
          ? managerKassaTotal !== undefined
            ? t("v2CashDetail.form.payableCashboxHint", {
                amount: money(displayBalance),
                cashbox: money(managerKassaTotal),
              })
            : t("v2CashDetail.form.payableHint", { amount: money(displayBalance) })
          : t("v2CashDetail.form.receivableHint", { amount: money(displayBalance) });
  const submitLabel =
    type === "market"
      ? t("v2CashDetail.form.pay")
      : isManagerBranchView
        ? typedAmount > 0
          ? t("v2CashDetail.form.hqAmount", { amount: formatMoneyLocalized(typedAmount) })
          : t("v2CashDetail.form.hq")
        : typedAmount > 0
          ? t("v2CashDetail.form.receiveAmount", { amount: formatMoneyLocalized(typedAmount) })
          : t("v2CashDetail.form.receive");

  /** Tasdiq oynasidagi «Qayerdan → Qayerga» (maket matnlari). */
  const getPaymentTransfer = (): ConfirmTransfer => {
    if (type === "courier") {
      return {
        from: { title: cashboxLabel("courier"), meta: entityName },
        to: isCurrentManagerRole
          ? { title: cashboxLabel("branch"), meta: ownBranchName }
          : { title: cashboxLabel("main") },
      };
    }
    if (type === "market") {
      return { from: { title: cashboxLabel("main") }, to: { title: cashboxLabel("market"), meta: entityName } };
    }
    if (isManagerBranchView) {
      return {
        from: { title: cashboxLabel("branch"), meta: ownBranchName },
        to: { title: t("v2CashDetail.header.hqCashbox"), meta: hqName },
      };
    }
    return { from: { title: cashboxLabel("branch"), meta: branchTitle }, to: { title: cashboxLabel("main") } };
  };

  /**
   * Tasdiq oynasidan OLDIN — ochiq bo'lmasligi kerak bo'lgan holatlar: forma
   * xatosi tasdiqdan keyin emas, darhol, maydon ostida ko'rinsin.
   * Keyin `useConfirm` (summa, to'lov turi, qayerdan → qayerga, izoh); faqat «Tasdiqlash»
   * bosilsa — `onSubmit` (to'lov, idempotentlik va natija xabarlari o'zgarmagan).
   */
  const requestPaymentConfirm = async (values: CashboxActionFormValues) => {
    if (isTypeUnknown) return;
    if (type === "courier") {
      if (!id || isCourierReceiveBlocked) return;
      const amount = parseAmountInput(values.amount);
      if (courierReceiveLimit !== null && amount > courierReceiveLimit) {
        setError("amount", {
          type: "max",
          message: t("amountExceedsBalance", {
            amount: formatMoneyLocalized(courierReceiveLimit, { withCurrency: false }),
          }),
        });
        return;
      }
    }
    if (type === "market" && (cashbox?.cashbox_type !== "markets" || !id)) {
      notify.error(t("marketPaymentError"), { description: t("cashDetailNotMarketCashbox") });
      return;
    }
    if (type === "branch" && !id) return;
    // Ikki marta bosish: oyna ochiq yoki to'lov ketayotganda ikkinchi tasdiq ochilmaydi.
    if (paymentLockRef.current) return;
    paymentLockRef.current = true;
    try {
      const comment = values.comment?.trim() || "";
      const marketName =
        values.paymentType === "click_to_market"
          ? marketOptions.find((option) => option.value === values.marketId)?.label ?? values.marketId
          : "";
      const ok = await confirm({
        tone: "success",
        title: t("v2CashDetail.confirm.title"),
        description: t("v2CashDetail.confirm.description"),
        amount: {
          value: parseAmountInput(values.amount),
          badge: <Badge>{paymentMethodLabel(values.paymentType)}</Badge>,
        },
        transfer: getPaymentTransfer(),
        rows: [
          ...(marketName ? [{ label: t("v2CashDetail.confirm.market"), value: marketName }] : []),
          ...(comment ? [{ label: t("v2CashDetail.confirm.comment"), value: comment, stacked: true }] : []),
        ],
        confirmLabel: t("v2CashDetail.confirm.confirm"),
        confirmIcon: CircleCheck,
      });
      if (ok) await onSubmit(values);
    } finally {
      paymentLockRef.current = false;
    }
  };

  // Tarix ro'yxati holati: filial sahifasida — tarix so'rovlari, kuryer/market — kassa javobi (sana/tab almashganda).
  const branchHistoryLoading =
    branchHistoryQuery.isLoading || (isHqBranchReceiveRequest && branchOwnHistoryQuery.isLoading);
  const historyLoading = isBranchDetailRequest ? Boolean(branchHistoryLoading) : isRefreshingCashbox;
  const branchHistoryError = branchHistoryQuery.isError
    ? (branchHistoryQuery.error ?? true)
    : isHqBranchReceiveRequest && branchOwnHistoryQuery.isError
      ? (branchOwnHistoryQuery.error ?? true)
      : undefined;
  // Kuryer/market: sana/tab almashgach kassa so'rovi yiqilsa — oldingi filtrning tarixi (saqlangan javob)
  // yangi filtr natijasidek ko'rinmasin: ro'yxat o'rnida xato + «Qayta urinish».
  const historyError = isBranchDetailRequest
    ? branchHistoryError
    : isCashboxError && freshCashboxResponse === undefined
      ? (cashboxError ?? true)
      : undefined;
  const historySubtitle = isTypeUnknown
    ? undefined
    : type === "courier"
      ? t("v2CashDetail.history.courier")
      : type === "market"
        ? t("v2CashDetail.history.market")
        : isManagerBranchView && ownBranchName
          ? t("v2CashDetail.history.named", { name: ownBranchName })
          : t("v2CashDetail.history.branch");

  const backLabel = t("v2CashDetail.back");
  const goBack = () => navigate(-1);

  if (isLoading && cashboxResponse === undefined) {
    return <CashDetailSkeleton />;
  }

  if (isCashboxError && cashboxResponse === undefined) {
    return (
      <div className="flex flex-col gap-6 max-md:gap-4">
        <PageHeader back={goBack} backLabel={backLabel} title={pageTitle} meta={pageBadge} />
        <Card>
          <ErrorState size="card" error={cashboxError} onRetry={() => void refetchCashbox()} />
        </Card>
      </div>
    );
  }

  const eyeButton = (
    <IconButton
      variant="secondary"
      size="sm"
      icon={balanceVisible ? Eye : EyeOff}
      label={t("v2CashDetail.settlement.hide")}
      aria-pressed={!balanceVisible}
      onClick={() => setBalanceVisible((prev) => !prev)}
    />
  );

  const settlementCard = (
    <Card
      title={settlementTitle}
      description={settlementDescription}
      actions={eyeButton}
      bodyClassName="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-text-muted">{balanceLabel}</span>
        <MoneyFigure value={displayBalance} hidden={!balanceVisible} />
      </div>

      {isManagerBranchView && managerKassaTotal !== undefined ? (
        <HqCoverage
          payable={displayBalance}
          cashbox={managerKassaTotal}
          receivable={managerReceivable}
          hidden={!balanceVisible}
        />
      ) : null}

      {hasCashboxAmount ? (
        <div className="flex flex-col gap-1">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-semibold text-text">
            <span>{t("amountInCashbox")}</span>
            <span className="whitespace-nowrap">{money(settlementDetails.cashboxAmount)}</span>
          </div>
          <CashSplit
            cash={cashboxSplit.cash}
            card={cashboxSplit.card}
            total={settlementDetails.cashboxAmount}
            hidden={!balanceVisible}
          />
        </div>
      ) : null}

      {counterRow ? (
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3 text-sm">
          <span className="text-text-muted">{counterRow.label}</span>
          <span className="whitespace-nowrap font-semibold text-text">{money(counterRow.value)}</span>
        </div>
      ) : null}
    </Card>
  );

  const actionCard = isTypeUnknown ? (
    <Card>
      <PageAlert tone="warning">{t("cashDetailTypeUnknown")}</PageAlert>
    </Card>
  ) : isCourierReceiveBlocked ? (
    <Card title={formTitle} description={formSubtitle}>
      <PageAlert tone="warning">{courierReceiveBlockedMessage}</PageAlert>
    </Card>
  ) : (
    <CashboxActionFormCard
      type={type}
      actionLabel={formTitle}
      actionSubLabel={formSubtitle}
      alert={isCourierReceiveCheckFailed ? <PageAlert tone="info">{t("receiveCheckFailed")}</PageAlert> : null}
      submitLabel={submitLabel}
      submitIcon={isManagerBranchView ? Send : undefined}
      amountLabel={t("v2CashDetail.form.amount")}
      amountHint={amountHint}
      infoAlert={type === "market" ? t("v2CashDetail.form.marketInfo") : null}
      paymentTypeLabel={t("v2CashDetail.form.paymentType")}
      showMarketSelect={isStoreTransfer}
      marketLabel={t("v2CashDetail.form.market")}
      marketPlaceholder={t("v2CashDetail.form.marketPlaceholder")}
      marketHint={t("v2CashDetail.form.marketHint")}
      marketOptions={marketOptions}
      marketLoading={marketsLoading}
      submitLoading={isSubmitting}
      submitDisabled={isStoreTransfer && !selectedMarketId}
      commentLabel={t("v2CashDetail.form.comment")}
      commentPlaceholder={t("v2CashDetail.form.commentPlaceholder")}
      paymentTypeOptions={paymentTypeOptions}
      control={control}
      register={register}
      errors={errors}
      handleSubmit={handleSubmit}
      onSubmit={requestPaymentConfirm}
    />
  );

  const historyCard = (
    <Card
      padding="none"
      className="min-w-0 flex-[2_1_480px] overflow-hidden"
      title={t("v2CashDetail.history.title")}
      description={historySubtitle}
      actions={
        // FE-PAY-16: cashbox-history.xlsx faqat ADMIN/SUPERADMIN uchun —
        // menejerga tugma ko'rsatilmaydi (403 olib, hech narsa bo'lmasdi).
        isCurrentManagerRole ? null : (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={Download}
            loading={isExporting}
            disabled={!cashbox?.id}
            onClick={handleExportExcel}
          >
            {t("v2CashDetail.history.excel")}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4 max-md:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-[999_1_auto] max-md:w-full">
            <SegmentedControl<"all" | "payments">
              ariaLabel={t("v2CashDetail.history.tabsLabel")}
              fullWidth="phone"
              value={historyTab}
              onValueChange={setHistoryTab}
              options={[
                { value: "all", label: t("v2CashDetail.history.all") },
                { value: "payments", label: t("v2CashDetail.history.payments") },
              ]}
            />
          </div>
          <DateRange
            className="min-w-[200px] flex-[1_1_240px] md:max-w-[320px]"
            value={{ from: selectedDateFrom, to: selectedDateTo }}
            onChange={({ from, to }) => {
              setSelectedDateFrom(from);
              setSelectedDateTo(to);
            }}
          />
        </div>
        {!historyLoading && !historyError && movementRows.length > 0 ? (
          <BalanceMovement
            rows={movementRows}
            type={type}
            income={income}
            expense={expense}
            viewerRole={currentRole}
            continuous={historyTab === "all"}
          />
        ) : null}
      </div>
      <div className="border-t border-border">
        <PaymentHistoryList
          withContainer={false}
          data={historyRows}
          isLoading={historyLoading}
          error={historyError}
          onRetry={() => {
            if (!isBranchDetailRequest) {
              void refetchCashbox();
              return;
            }
            void branchHistoryQuery.refetch();
            if (isHqBranchReceiveRequest) void branchOwnHistoryQuery.refetch();
          }}
          showSourceUser={type === "branch"}
        />
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader back={goBack} backLabel={backLabel} title={pageTitle} meta={pageBadge} description={pageSubtitle} />
      <div className="flex flex-wrap items-start gap-6 max-md:gap-4">
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-6 max-md:gap-4">
          {settlementCard}
          {actionCard}
        </div>
        {historyCard}
      </div>
    </div>
  );
};

/** Bo'sh bo'lmagan qismlarni « · » bilan qo'shadi. */
const joinParts = (...parts: Array<string | false | null | undefined>) =>
  parts.filter((part): part is string => Boolean(part)).join(" · ") || undefined;

/** Katta summa (`.el-stat-value` + `.el-stat-unit`): «1 155 000 so'm». */
const MoneyFigure = ({ value, hidden }: { value: number; hidden: boolean }) => {
  const { i18n } = useTranslation();
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  return (
    <span className="whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] text-text proportional-nums max-md:text-[22px] max-md:leading-[30px]">
      {hidden ? MASK : formatMoneyLocalized(value, { language, withCurrency: false })}
      <span className="sr-only"> </span>
      <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted">{CURRENCY_LABEL[language]}</span>
    </span>
  );
};

/** Sahifa ogohlantirishi (`.el-alert` + ton): forma o'rnida yoki ustida. */
const PageAlert = ({ tone, children }: { tone: "warning" | "info"; children: ReactNode }) => {
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <div
      role="alert"
      className={cx(
        "flex items-start gap-3 rounded-xl px-4 py-3 text-sm",
        tone === "warning" ? "bg-warning-soft text-warning-fg" : "bg-info-soft text-info-fg",
      )}
    >
      <Icon aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-text">{children}</div>
    </div>
  );
};

/** «Kassadagi summa» taqsimoti: segment chizig'i + legenda (Naqd / O'tkazma). Ikkalasi ma'lum va ≥ 0 bo'lsa. */
const CashSplit = ({
  cash,
  card,
  total,
  hidden,
}: {
  cash?: number;
  card?: number;
  total: number;
  hidden: boolean;
}) => {
  const { t } = useTranslation("payments");
  if (cash === undefined || card === undefined || cash < 0 || card < 0 || cash + card <= 0) return null;
  const sum = cash + card;
  const cashShare = (cash / sum) * 100;
  const cardShare = 100 - cashShare;
  const shown = (value: number) => (hidden ? MASK : formatMoneyLocalized(value));
  const items = [
    { key: "cash", icon: Banknote, label: t("v2Common.paymentMethod.cash"), value: cash, share: cashShare, swatch: "bg-chart-1" },
    { key: "card", icon: ArrowLeftRight, label: t("v2Common.paymentMethod.transfer"), value: card, share: cardShare, swatch: "bg-chart-2" },
  ];
  return (
    <>
      <div
        role="img"
        aria-label={t("v2CashDetail.settlement.splitLabel", {
          total: shown(total),
          cash: shown(cash),
          cashShare: formatPercentLocalized(cashShare),
          card: shown(card),
          cardShare: formatPercentLocalized(cardShare),
        })}
        className="flex h-2.5 gap-0.5"
      >
        {items
          .filter((item) => item.value > 0)
          .map((item) => (
            <span
              key={item.key}
              className={cx("block h-full min-w-1 first:rounded-l-[4px] last:rounded-r-[4px]", item.swatch)}
              style={{ flex: `${item.value} 1 0` }}
            />
          ))}
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((item) => (
          <li
            key={item.key}
            className="grid min-h-10 grid-cols-[12px_minmax(0,1fr)_auto_52px] items-center gap-2.5 border-t border-border py-1.5 text-sm first:border-t-0"
          >
            <span aria-hidden="true" className={cx("size-3 rounded-[3px]", item.swatch)} />
            <span className="flex min-w-0 items-center gap-2 text-text">
              <item.icon aria-hidden="true" size={16} className="shrink-0 text-text-muted" />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="whitespace-nowrap font-semibold text-text">{shown(item.value)}</span>
            <span className="text-right text-[13px] text-text-muted">{formatPercentLocalized(item.share)}</span>
          </li>
        ))}
      </ul>
    </>
  );
};

/** Menejer → HQ: berilishi kerak summa kassadagi pulga nisbatan (maket `manager-payments-cash-detail-branch`). */
const HqCoverage = ({
  payable,
  cashbox,
  receivable,
  hidden,
}: {
  payable: number;
  cashbox: number;
  receivable?: number;
  hidden: boolean;
}) => {
  const { t } = useTranslation("payments");
  const enough = payable <= cashbox;
  const share = cashbox > 0 ? (payable / cashbox) * 100 : payable > 0 ? 100 : 0;
  const shown = (value: number) => (hidden ? MASK : formatMoneyLocalized(value));
  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-text-muted">{t("v2CashDetail.settlement.versusCashbox")}</span>
          <Badge tone={enough ? "success" : "warning"} icon={enough ? CircleCheck : TriangleAlert}>
            {enough ? t("v2CashDetail.settlement.enough") : t("v2CashDetail.settlement.notEnough")}
          </Badge>
        </div>
        <div
          role="meter"
          aria-label={t("v2CashDetail.settlement.meterLabel")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(100, share) * 10) / 10}
          className={cx("h-3 overflow-hidden rounded-full", enough ? "bg-action-soft" : "bg-warning-soft")}
        >
          <span
            className={cx("block h-full rounded-full", enough ? "bg-chart-1" : "bg-warning")}
            style={{ width: `${Math.min(100, share)}%` }}
          />
        </div>
        <ul className="m-0 flex list-none flex-wrap justify-between gap-x-4 gap-y-1 p-0 text-[13px] text-text-muted">
          <li className="inline-flex items-center gap-2">
            <span aria-hidden="true" className={cx("size-2.5 rounded-[3px]", enough ? "bg-chart-1" : "bg-warning")} />
            {t("v2CashDetail.settlement.payableShare", { share: formatPercentLocalized(share) })}
          </li>
          <li className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-action-soft ring-1 ring-inset ring-border" />
            {t("v2CashDetail.settlement.remains", { amount: shown(Math.max(0, cashbox - payable)) })}
          </li>
        </ul>
      </div>
      <dl className="m-0 flex flex-col border-t border-border">
        <div className="flex items-center justify-between gap-3 border-b border-border py-2.5">
          <dt className="inline-flex min-w-0 items-center gap-2 text-sm text-text-muted">
            <Wallet aria-hidden="true" size={16} className="shrink-0" />
            {t("amountInCashbox")}
          </dt>
          <dd className="m-0 whitespace-nowrap font-semibold text-text">{shown(cashbox)}</dd>
        </div>
        {receivable !== undefined ? (
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="inline-flex min-w-0 items-center gap-2 text-sm text-text-muted">
              <Truck aria-hidden="true" size={16} className="shrink-0" />
              {t("toBeReceived")}
            </dt>
            <dd className="m-0 whitespace-nowrap font-semibold text-text">{shown(receivable)}</dd>
          </div>
        ) : null}
      </dl>
    </>
  );
};

type MovementPoint = {
  key: string;
  axis: string;
  balance: number;
  title: string;
  change: number | null;
};

type MovementRow = { row: PaymentRow; index: number };

const createdTime = (row: PaymentRow) => {
  const time = Date.parse(row.createdAt || row.created_at || row.payment_date || "");
  return Number.isFinite(time) ? time : 0;
};

/** O'q yorlig'i: «Bugun» / «Kecha» yoki «06.10» (`formatDateTimeLocalized` ning kun qismi). */
const dayLabel = (value: string) => {
  const head = formatDateTimeLocalized(value).split(",")[0]?.trim() ?? "";
  return /\d/.test(head) ? head.slice(0, 5) : head;
};

/** Kun kaliti (mahalliy sana) — o'qda har kun bir marta yoziladi. */
const dayKey = (value: string) => formatDateLocalized(value);

/**
 * «Balans harakati» (maket SA `*-cash-detail-*`; ega qarori — barcha rollarga): davr boshi, kirim, chiqim, hozir +
 * har operatsiyadan keyingi qoldiqning pog'onali chizig'i («Grafik | Jadval»). Qatorlarda `balance_after` bo'lmasa —
 * grafik yashiriladi, ko'rsatkichlar qoladi. `continuous=false` («To'lov o'tkazmalari» — qatorlar ketma-ket emas,
 * oradagi sotuvlar tushib qolgan): qoldiq zanjiri («Davr boshida», «Hozir», grafik) chizilmaydi — faqat Kirim/Chiqim.
 */
const BalanceMovement = ({
  rows,
  type,
  income,
  expense,
  viewerRole,
  continuous = true,
}: {
  rows: PaymentRow[];
  type: CashDetailType;
  income: number;
  expense: number;
  viewerRole?: string | null;
  continuous?: boolean;
}) => {
  const { t, i18n } = useTranslation("payments");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const [view, setView] = useState<"chart" | "table">("chart");

  // Eskidan yangiga (bir xil vaqtda — ro'yxatdagi teskari tartib: ro'yxat yangisi yuqorida).
  const ordered: MovementRow[] = rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => createdTime(left.row) - createdTime(right.row) || right.index - left.index);
  const hasBalances = continuous && ordered.every(({ row }) => typeof row.balance_after === "number");
  const oldest = ordered[0]?.row;
  const newest = ordered.at(-1)?.row;
  const start =
    hasBalances && oldest ? (oldest.balance_after as number) - getHistoryRowSignedAmount(oldest, viewerRole) : undefined;
  const now = hasBalances && newest ? (newest.balance_after as number) : undefined;

  // O'qda har kun bir marta (kunning birinchi nuqtasida), oxirgi nuqta — «Hozir» (maket).
  let previousDay = "";
  const axisLabel = (date: string) => {
    const key = dayKey(date);
    if (key === previousDay) return "";
    previousDay = key;
    return dayLabel(date);
  };
  const points: MovementPoint[] =
    hasBalances && start !== undefined && oldest
      ? [
          {
            key: "start",
            axis: axisLabel(getHistoryRowDate(oldest)),
            balance: start,
            title: t("v2CashDetail.movement.start"),
            change: null,
          },
          ...ordered.map(({ row }, position) => {
            const date = getHistoryRowDate(row);
            const label = axisLabel(date);
            return {
              key: row.id,
              axis: position === ordered.length - 1 ? t("v2CashDetail.movement.now") : label,
              balance: row.balance_after as number,
              title: `${formatDateTimeLocalized(date)} · ${getHistoryRowTitle(row, t, viewerRole)}`,
              change: getHistoryRowSignedAmount(row, viewerRole),
            };
          }),
        ]
      : [];
  const shown = (value: number | undefined) => (value === undefined ? "—" : formatMoneyLocalized(value));

  const tableColumns: DataTableColumn<MovementRow>[] = [
    {
      id: "date",
      header: t("v2CashDetail.movement.date"),
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTimeLocalized(getHistoryRowDate(row))}</span>,
    },
    { id: "source", header: t("v2CashDetail.movement.source"), cell: ({ row }) => getHistoryRowTitle(row, t, viewerRole) },
    {
      id: "change",
      header: t("v2CashDetail.movement.change"),
      align: "end",
      cell: ({ row }) => {
        const change = getHistoryRowSignedAmount(row, viewerRole);
        return (
          <span className={cx("whitespace-nowrap font-semibold", change >= 0 ? "text-success-fg" : "text-danger-fg")}>
            {formatSignedMoneyLocalized(change)}
          </span>
        );
      },
    },
    {
      id: "balance",
      header: t("v2CashDetail.movement.balanceAfter"),
      align: "end",
      cell: ({ row }) => <span className="whitespace-nowrap">{shown(row.balance_after)}</span>,
    },
  ];

  const flowStats = [
    { key: "income", label: t("v2CashDetail.movement.income"), value: formatSignedMoneyLocalized(income), tone: "text-success-fg" },
    { key: "expense", label: t("v2CashDetail.movement.expense"), value: formatSignedMoneyLocalized(-expense), tone: "text-danger-fg" },
  ];
  const stats = continuous
    ? [
        { key: "start", label: t("v2CashDetail.movement.start"), value: shown(start), tone: "text-text" },
        ...flowStats,
        { key: "now", label: t("v2CashDetail.movement.now"), value: shown(now), tone: "text-text" },
      ]
    : flowStats;

  return (
    <section
      aria-label={t("v2CashDetail.movement.title")}
      className="flex flex-col gap-3.5 border-t border-border pt-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
          <h3 className="m-0 text-base font-bold text-text">{t("v2CashDetail.movement.title")}</h3>
          {continuous ? (
            <p className="m-0 text-[13px] text-text-muted">{t(`v2CashDetail.movement.${type}`)}</p>
          ) : null}
        </div>
        {points.length > 1 ? (
          <SegmentedControl<"chart" | "table">
            ariaLabel={t("v2CashDetail.movement.viewLabel")}
            value={view}
            onValueChange={setView}
            options={[
              { value: "chart", label: t("v2CashDetail.movement.chart"), icon: ChartColumn },
              { value: "table", label: t("v2CashDetail.movement.table"), icon: List },
            ]}
          />
        ) : null}
      </div>
      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(120px,100%),1fr))] gap-x-4 gap-y-3">
        {stats.map((stat) => (
          <div key={stat.key} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-text-muted">{stat.label}</dt>
            <dd className={cx("m-0 whitespace-nowrap text-sm font-semibold", stat.tone)}>{stat.value}</dd>
          </div>
        ))}
      </dl>
      {points.length > 1 ? (
        view === "chart" ? (
          <div
            role="img"
            aria-label={t("v2CashDetail.movement.chartLabel", {
              start: shown(start),
              income: formatMoneyLocalized(income),
              expense: formatMoneyLocalized(expense),
              now: shown(now),
            })}
            className="h-60 w-full min-w-0 max-md:h-[150px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="axis"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={12}
                  tick={{ fill: "var(--color-text-subtle)", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tickCount={4}
                  domain={[(dataMin: number) => Math.min(0, dataMin), "auto"]}
                  tick={{ fill: "var(--color-text-subtle)", fontSize: 12 }}
                  tickFormatter={(value: number) => formatCompactMoneyLocalized(value, { language, withCurrency: false })}
                />
                <Tooltip
                  cursor={{ stroke: "var(--color-border-strong)" }}
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as MovementPoint | undefined;
                    if (!active || !point) return null;
                    return (
                      <div className="rounded-xl border border-border bg-raised px-3 py-2 text-[13px] shadow-xl max-md:hidden">
                        <div className="font-semibold text-text">{point.title}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span aria-hidden="true" className="size-2.5 rounded-full bg-chart-1" />
                          <span className="font-semibold text-text">{formatMoneyLocalized(point.balance, { language })}</span>
                          <span className="text-text-muted">{t("v2CashDetail.movement.balance")}</span>
                        </div>
                        {point.change !== null ? (
                          <div
                            className={cx(
                              "mt-0.5 font-semibold",
                              point.change >= 0 ? "text-success-fg" : "text-danger-fg",
                            )}
                          >
                            {formatSignedMoneyLocalized(point.change, { language })}
                          </div>
                        ) : null}
                      </div>
                    );
                  }}
                />
                <Area
                  type="stepAfter"
                  dataKey="balance"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  fill="var(--color-chart-1)"
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <DataTable
            rows={[...ordered].reverse()}
            columns={tableColumns}
            getRowKey={({ row }) => row.id}
            label={t("v2CashDetail.movement.tableLabel")}
            density="compact"
            renderCard={({ row }) => {
              const change = getHistoryRowSignedAmount(row, viewerRole);
              return (
                <div className="flex flex-col gap-0.5 py-2.5 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 font-semibold text-text">{getHistoryRowTitle(row, t, viewerRole)}</span>
                    <span className={cx("whitespace-nowrap font-semibold", change >= 0 ? "text-success-fg" : "text-danger-fg")}>
                      {formatSignedMoneyLocalized(change)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-[13px] text-text-muted">
                    <span>{formatDateTimeLocalized(getHistoryRowDate(row))}</span>
                    <span className="whitespace-nowrap">{shown(row.balance_after)}</span>
                  </div>
                </div>
              );
            }}
          />
        )
      ) : null}
    </section>
  );
};

/** Sahifa yuklanishi — kartalar o'rnida skelet (maket tuzilmasi bilan). */
const CashDetailSkeleton = () => (
  <div className="flex flex-col gap-6 max-md:gap-4" aria-busy="true">
    <div className="flex flex-col gap-2">
      <Skeleton width={96} />
      <Skeleton shape="block" width={260} height={32} />
      <Skeleton width={200} />
    </div>
    <div className="flex flex-wrap items-start gap-6 max-md:gap-4">
      <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-6 max-md:gap-4">
        <Card>
          <SkeletonLines lines={4} />
        </Card>
        <Card>
          <SkeletonLines lines={6} />
        </Card>
      </div>
      <Card className="min-w-0 flex-[2_1_480px]">
        <SkeletonLines lines={8} />
      </Card>
    </div>
  </div>
);

export default memo(CashDetail);

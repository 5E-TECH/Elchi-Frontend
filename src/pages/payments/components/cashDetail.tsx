import { memo, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { ArrowDownLeft, ArrowUpRight, Download, Landmark, Loader2, Store, Truck, WalletCards } from "lucide-react";
import type { PaymentRow } from "./patmentHistoryTable";
import { useCashBox, type CourierPaymentResponse } from "../../../entities/payments";
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
import { api, LONG_REQUEST_TIMEOUT_MS } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";

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

/**
 * Kuryerdan qabul qilish uchun idempotentlik kaliti. `payment_date` har
 * submit'da yangi bo'lgani uchun gateway'ning 30 soniyalik dedup'i qayta
 * yuborishni ushlamaydi — kalit bilan pul faqat bir marta o'tadi.
 * `crypto.randomUUID` faqat xavfsiz kontekstda (https/localhost) bor —
 * aks holda sahifa yiqilmasin.
 */
const newIdempotencyKey = () =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

type CourierPaymentIdentity = {
  courier_id: string;
  amount: number;
  payment_method: string;
  market_id: string | null;
};

/**
 * Kuryer to'lovining "barmoq izi" (kuryer + summa + usul + market) — kalit
 * shunga bog'lanadi. Aynan shu to'lov qayta yuborilsa (javobi kelmay qolgan
 * urinish) o'sha kalit ketadi va backend pulni faqat bir marta o'tkazadi.
 * Biror maydon o'zgarsa — bu BOSHQA to'lov, yangi kalit: eski kalit bilan
 * backend yangi summani o'tkazmay "allaqachon qabul qilingan" deb qaytarardi.
 * `payment_date` va izoh kirmaydi (to'lovning o'zini o'zgartirmaydi).
 */
const courierPaymentFingerprint = (payment: CourierPaymentIdentity) =>
  JSON.stringify([payment.courier_id, payment.amount, payment.payment_method, payment.market_id]);

/**
 * Javobi kelmagan kuryer to'lovlarining kalitlari: barmoq izi → kalit.
 *
 * ⚠️ Bitta "joy" yetmaydi. To'lov A ning javobi yo'qolsa (server esa pulni
 * o'tkazgan), keyin B yuborilsa va u ham xato bersa, so'ng A qayta yuborilsa —
 * A yangi kalit olib, pul IKKINCHI marta o'tardi. Shuning uchun har bir to'lov
 * o'z kalitini alohida saqlaydi va kalit faqat AYNAN shu to'lovga javob
 * kelganda o'chiriladi. `sessionStorage` — sahifa qayta ochilsa (F5, orqaga
 * qaytish) ham kalit yo'qolmaydi. Saqlash imkoni bo'lmasa (xususiy rejim)
 * xotirada ishlaydi.
 */
const PENDING_COURIER_PAYMENT_KEYS = "elchi:pending-courier-payment-keys";
const MAX_PENDING_COURIER_PAYMENT_KEYS = 50;
let pendingCourierPaymentKeysFallback: Record<string, string> = {};

const readPendingCourierPaymentKeys = (): Record<string, string> => {
  try {
    const raw = globalThis.sessionStorage?.getItem(PENDING_COURIER_PAYMENT_KEYS);
    if (!raw) return { ...pendingCourierPaymentKeysFallback };
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? { ...(parsed as Record<string, string>) } : {};
  } catch {
    return { ...pendingCourierPaymentKeysFallback };
  }
};

const writePendingCourierPaymentKeys = (keys: Record<string, string>) => {
  // Eng eskilaridan boshlab kesiladi — cheksiz o'smasin.
  const entries = Object.entries(keys).slice(-MAX_PENDING_COURIER_PAYMENT_KEYS);
  const bounded = Object.fromEntries(entries);
  pendingCourierPaymentKeysFallback = bounded;
  try {
    globalThis.sessionStorage?.setItem(PENDING_COURIER_PAYMENT_KEYS, JSON.stringify(bounded));
  } catch {
    // Saqlab bo'lmadi — xotiradagi nusxa ishlatiladi.
  }
};

/** Shu to'lovning kaliti: avval yuborilgan (javobsiz) bo'lsa o'shani qaytaradi. */
export const takeCourierPaymentKey = (fingerprint: string): string => {
  const keys = readPendingCourierPaymentKeys();
  const existing = keys[fingerprint];
  if (existing) return existing;
  const key = newIdempotencyKey();
  keys[fingerprint] = key;
  writePendingCourierPaymentKeys(keys);
  return key;
};

/** Shu to'lovga javob keldi (muvaffaqiyat yoki takroriy) — faqat UNING kaliti o'chadi. */
export const settleCourierPaymentKey = (fingerprint: string) => {
  const keys = readPendingCourierPaymentKeys();
  if (!(fingerprint in keys)) return;
  delete keys[fingerprint];
  writePendingCourierPaymentKeys(keys);
};

/**
 * Takroriy `Idempotency-Key`: pul avvalgi (javobi yo'qolgan) urinishda
 * allaqachon o'tgan — finance-service `data.idempotent: true` qaytaradi va
 * pulni ikkinchi marta o'tkazmaydi (yangi to'lov emas).
 */
const isIdempotentReplay = (response: { data?: CourierPaymentResponse } | null | undefined) =>
  response?.data?.data?.idempotent === true;

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
  const { useGetUser } = useUser();
  const { apiRequest, api: notify } = useAppNotification();

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
    ...(type === "courier"
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
      isHqBranchReceiveRequest ? branchOwnHistoryQuery.refetch() : Promise.resolve(),
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
    } finally {
      setIsExporting(false);
    }
  };


  const onSubmit = async (values: CashboxActionFormValues) => {
    if (isTypeUnknown) return;
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
      const idempotencyKey = takeCourierPaymentKey(fingerprint);
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
      settleCourierPaymentKey(fingerprint);
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
        if ((isCourierReceiveDetail || isHqBranchReceiveDetail) && hasStateAmount) {
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
    if (cashbox?.cashbox_type !== "markets") {
      notify.error({ message: t("marketPaymentError"), description: t("cashDetailNotMarketCashbox") });
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
      historyTab={historyTab}
      onHistoryTabChange={setHistoryTab}
      allHistoryLabel={t("allHistory")}
      paymentsHistoryLabel={t("paymentTransfers")}
      historyAction={
        <button
          type="button"
          onClick={handleExportExcel}
          disabled={isExporting || !cashbox?.id}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Excel
        </button>
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
        </>
        )
      }
    />
  );
};

export default memo(CashDetail);

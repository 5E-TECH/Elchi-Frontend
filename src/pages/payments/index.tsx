// dizayn-v2: superadmin-payments-overview, admin-payments-overview, manager-payments-overview
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSelector } from "react-redux";
import { ArrowDownLeft, ArrowUpRight, CreditCard, ListFilter, User, Wallet, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCashBox } from "../../entities/payments";
import { useFinanceCoverage } from "../../entities/payments/financeCoverage";
import { useUser } from "../../entities/user/api/userApi";
import { usePagination } from "../../shared/lib/usePagination";
import { useQueryParams } from "../../shared/lib/useQueryParams";
import { formatNumberLocalized } from "../../shared/lib/formatMoney";
import { useIsPhone } from "../../shared/ui/primitives/date/useIsPhone";
import {
  Button,
  Card,
  DateRange,
  Dialog,
  Field,
  PageHeader,
  Select,
  Tabs,
  type SelectOption,
  type TabItem,
} from "../../shared/ui/primitives";
import type { RootState } from "../../app/config/store";
import PaymentHistoryTable from "./components/patmentHistoryTable";
import PaymentSummaryCards, { CourierMoneyCard } from "./components/PaymentSummaryCards";
import SettlementPickerDialog, {
  type SettlementPickerKind,
  type SettlementPickerTarget,
} from "./components/SettlementPickerDialog";
import { useReceiveOptions } from "./components/lib/receiveOptions";
import { getCashboxTypeLabel, getPaymentSourceTitle } from "./components/paymentSourceType";

const DEFAULT_PAYMENTS_LIMIT = 10;

type UnknownRecord = Record<string, unknown>;

type PaymentBranchToMainOption = {
  id: string;
  name: string;
  region: string;
  type: string;
  amount: number;
  role: "branch";
  phone_number: string;
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

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getNestedData = (value: unknown): UnknownRecord => {
  const root = asRecord(value);
  const data = asRecord(root.data);

  return Object.keys(data).length ? data : root;
};

const getResponseNumber = (
  response: unknown,
  keys: string[],
  fallback = 0,
) => {
  const root = asRecord(response);
  const rawData = root.data;

  if (typeof rawData === "number" || typeof rawData === "string") {
    return toNumber(rawData);
  }

  const dataRecord = asRecord(rawData);
  const source = Object.keys(dataRecord).length ? dataRecord : root;

  return getRecordNumber(source, keys, fallback);
};

const getRecordNumber = (
  record: UnknownRecord,
  keys: string[],
  fallback = 0,
) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") {
      return toNumber(value);
    }
  }

  return fallback;
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

/** Tarix filtrlari — URL yagona manba (F5, ulashilgan havola, orqaga/oldinga). */
type PaymentsFilters = {
  operation_type: string;
  source_type: string;
  cashbox_type: string;
  created_by: string;
  from_date: string;
  to_date: string;
};
type SelectFilterKey = "source_type" | "cashbox_type" | "created_by";
/** Tabdan tashqari filtrlar («Filtrlarni tozalash» shularni tozalaydi; tab — o'zining «Barchasi»). */
const CLEARABLE: Record<Exclude<keyof PaymentsFilters, "operation_type">, string> = {
  source_type: "",
  cashbox_type: "",
  created_by: "",
  from_date: "",
  to_date: "",
};

const SOURCE_TYPES = [
  "courier_payment",
  "market_payment",
  "branch_to_main",
  "manual_expense",
  "manual_income",
  "correction",
  "salary",
  "sell",
  "cancel",
  "extra_cost",
  "bills",
] as const;

const CASHBOX_TYPES = ["main", "couriers", "markets"] as const;

type OperationTab = "all" | "income" | "expense";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `.el-tab-count` ko'rinishidagi son (Filtrlar tugmasida faol filtrlar). */
const COUNT_PILL =
  "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-action-soft px-1.5 text-xs font-semibold text-action-fg";

/** `.el-chip.el-chip-active` (CODE-MAP 2.2); telefonda 44 px. */
const CHIP =
  "inline-flex h-8 max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-action " +
  "bg-action-soft pl-3 pr-1 text-[13px] font-semibold text-action-fg max-md:h-11 max-md:pr-0";
const CHIP_X =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-action-fg " +
  "transition-[background-color] duration-150 motion-reduce:transition-none hover:bg-action/15 " +
  "max-md:-ml-2.5 max-md:size-11";

const FILTER_ITEM = "min-w-0 flex-[1_1_220px]";

type FiltersSheetProps = {
  open: boolean;
  onClose: () => void;
  initial: PaymentsFilters;
  fields: ReadonlyArray<{ key: SelectFilterKey; label: string; options: readonly SelectOption[]; loading?: boolean }>;
  onApply: (values: Pick<PaymentsFilters, SelectFilterKey>) => void;
};

/**
 * Telefon (< 768) filtr varaqasi — `superadmin-orders-filters-mobile` naqshi (qoralama: «Natijalarni ko'rsatish»
 * URL'ga bir marta yozadi; ×, fon, tutqich — bekor; «Tozalash» — faqat qoralamani). Sana asboblar qatorida qoladi.
 */
const PaymentsFiltersSheet = ({ open, onClose, initial, fields, onApply }: FiltersSheetProps) => {
  const { t } = useTranslation(["ui", "payments"]);
  const pick = (values: PaymentsFilters) => ({
    source_type: values.source_type,
    cashbox_type: values.cashbox_type,
    created_by: values.created_by,
  });
  const [draft, setDraft] = useState(pick(initial));
  const [prevOpen, setPrevOpen] = useState(open);
  // Har ochilishda qoralama URL'dagi qiymatlardan boshlanadi.
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setDraft(pick(initial));
  }
  const selected = Object.values(draft).filter(Boolean).length;
  const all = t("ui:select.all");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("ui:filters.sheetTitle")}
      description={t("ui:filters.sheetSelected", { count: selected })}
      closeLabel={t("ui:filters.sheetClose")}
      footer={
        <>
          <Button
            variant="secondary"
            size="lg"
            className="max-md:flex-none!"
            onClick={() => setDraft({ source_type: "", cashbox_type: "", created_by: "" })}
          >
            {t("ui:filters.reset")}
          </Button>
          <Button
            size="lg"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            {t("ui:filters.apply")}
          </Button>
        </>
      }
    >
      {fields.map((field) => (
        // Varaqada oddiy ro'yxat (qidiruvsiz): telefon klaviaturasi varaqani yopib qo'ymasin.
        <Field key={field.key} label={field.label} labelAs="span">
          <Select
            options={[{ value: "", label: all }, ...field.options]}
            value={draft[field.key]}
            onChange={(next) => setDraft((current) => ({ ...current, [field.key]: next ?? "" }))}
            placeholder={all}
            loading={field.loading}
          />
        </Field>
      ))}
    </Dialog>
  );
};

/**
 * TO'LOVLAR — `/payments` (superadmin, admin, menejer `finance` qobiliyati bilan), dizayn v2.
 *
 * Maketlar: `superadmin-payments-overview` = `admin-payments-overview`, `manager-payments-overview`.
 *  - Sarlavha «To'lovlar» + amallar: superadmin/admin — «Marketga to'lov» (berilishi kerak oynasi) va asosiy
 *    «Pul qabul qilish» (qabul oynasi); menejer — «HQ'ga o'tkazish» (filial kassasi sahifasi, FE-PAY-01 — fix3
 *    dan oldingi filial ID si; ID bo'lmasa tugma yo'q) va asosiy «Kuryerdan qabul qilish» (kuryer oynasi).
 *  - Ko'rsatkichlar (`PaymentSummaryCards`) — manbalari o'zgarmagan: all-info, menejer settlement / payable-to-hq.
 *  - Menejer: «Kuryerlardagi pul» (o'z kuryerlari, `GET /couriers` — `status=active` YO'Q).
 *  - «Operatsiyalar tarixi»: tablar Barchasi / Kirim / Chiqim (`operation_type`), filtrlar — To'lov sanasi
 *    (`from_date`/`to_date`, `YYYY-MM-DD`, Toshkent kuni), Manba turi, Kassa turi, Yaratgan; telefonda sana +
 *    «Filtrlar» varaqasi va faol filtr chiplari. Har filtr 1-sahifa bilan BITTA URL yangilanishida yoziladi.
 *    Tab sonlari chizilmaydi (API faqat joriy so'rov jamini beradi).
 * Maketdagi «Pul oqimi», «Kassa holati», «Kassa oqimi» (Taklif) — chizilmaydi.
 */
const Payments = () => {
  const { t, i18n } = useTranslation(["payments", "ui"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const role = useSelector((state: RootState) => state.role.role);
  const currentUser = useSelector((state: RootState) => state.user.user);
  const isManagerRole = String(role).toLowerCase() === "manager";
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const { page, limit, setPage, setLimit, resetPagination } = usePagination({
    key: "payments",
    defaultLimit: DEFAULT_PAYMENTS_LIMIT,
    pageParam: "paymentsPage",
    limitParam: "paymentsLimit",
  });
  const previousFiltersKeyRef = useRef("");
  // Oyna turi yopilish harakati davomida saqlanadi (sarlavha almashib ketmasin).
  const [pickerKind, setPickerKind] = useState<SettlementPickerKind>(isManagerRole ? "courier" : "receive");
  const [pickerOpen, setPickerOpen] = useState(false);
  const openPicker = (kind: SettlementPickerKind) => {
    setPickerKind(kind);
    setPickerOpen(true);
  };
  const [sheetOpen, setSheetOpen] = useState(false);
  const [prevIsPhone, setPrevIsPhone] = useState(isPhone);
  if (prevIsPhone !== isPhone) {
    // Ekran telefondan kattalashsa varaqa yopiladi.
    setPrevIsPhone(isPhone);
    setSheetOpen(false);
  }

  const { getAllParams, setMultipleParams } = useQueryParams();
  const allParams = getAllParams();
  const filtersFromUrl = useMemo<PaymentsFilters>(
    () => ({
      operation_type: allParams.operation_type ?? "",
      source_type: allParams.source_type ?? "",
      cashbox_type: allParams.cashbox_type ?? "",
      created_by: allParams.created_by ?? "",
      // Noto'g'ri sana e'tiborsiz qoldiriladi (so'rovga ketmaydi).
      from_date: ISO_DAY.test(allParams.from_date ?? "") ? allParams.from_date : "",
      to_date: ISO_DAY.test(allParams.to_date ?? "") ? allParams.to_date : "",
    }),
    [
      allParams.cashbox_type,
      allParams.created_by,
      allParams.from_date,
      allParams.operation_type,
      allParams.source_type,
      allParams.to_date,
    ],
  );
  const filtersFromUrlKey = useMemo(() => JSON.stringify(filtersFromUrl), [filtersFromUrl]);

  // Filtr va 1-sahifa bitta URL yangilanishida yoziladi — aks holda avval yangi filtr + ESKI sahifa bilan
  // ortiqcha so'rov ketib, keyin pastdagi pagination-reset effekti uni 1-ga qaytarardi.
  const updateFilters = (patch: Partial<PaymentsFilters>) => {
    setMultipleParams({ ...patch, paymentsPage: "1" });
  };
  // Filtr va sahifa raqami BITTA setMultipleParams chaqiruvida birga yoziladi. Alohida resetPagination()
  // chaqirish XATO edi: ikkalasi mustaqil useSearchParams yangilanishi bo'lib, ikkinchisi o'zining eski
  // (hali tozalanmagan) `prev` asosida URL yasab, birinchisining filtrni o'chirishini bosib yuborardi.
  const clearFilters = () => setMultipleParams({ ...CLEARABLE, paymentsPage: "1" });

  const { useGetFinanceHistory, useGetCashBoxInfo } = useCashBox();
  const { useGetManagerSettlement, useGetManagerPayableToHq } = useFinanceCoverage();
  const { useGetUser } = useUser();

  // ── Ko'rsatkichlar manbai (o'zgarmagan) ──────────────────────────────────────
  const { data: cashboxInfo, isLoading: cashboxLoading } = useGetCashBoxInfo();
  const { data: managerSettlementInfo } = useGetManagerSettlement(isManagerRole);
  const { data: managerPayableInfo } = useGetManagerPayableToHq(isManagerRole);
  // Menejer: o'z kuryerlari sahifa ochilganda («Qabul qilinishi kerak» kartasi va «Kuryerlardagi pul»).
  // Superadmin/admin uchun ro'yxatlar faqat oyna ochilganda yuklanadi.
  const managerCouriers = useReceiveOptions({ isManagerRole: true, enabled: isManagerRole });

  // API response formatlari:
  // 1) oddiy: { data: { mainCashboxTotal, courierCashboxTotal, marketCashboxTotal } }
  // 2) manager: { data: { kassadagi_summa, berilishi_kerak, olinishi_kerak, ... } }
  // Superadmin/admin javobida ham kassadagi_summa bor, shuning uchun (2)-shox
  // ishlaydi va "Qabul qilinishi kerak" kartasi `olinishi_kerak` ni o'qiydi —
  // backend uni filial menejerlari + HQ kuryerlari yig'indisi qilib beradi
  // (branch_managers_receivable + hq_couriers_receivable = courierCashboxTotal).
  const cashboxData = cashboxInfo?.data;
  const hasManagerCashboxFields =
    !!cashboxData &&
    (
      "kassadagi_summa" in cashboxData ||
      "berilishi_kerak" in cashboxData ||
      "olinishi_kerak" in cashboxData
    );

  const managerSettlementData = getNestedData(managerSettlementInfo);

  const mainCashboxTotal = hasManagerCashboxFields
    ? getRecordNumber(
        managerSettlementData,
        ["kassadagi_summa", "cashbox_amount", "cashboxAmount", "balance", "total"],
        toNumber(cashboxData?.kassadagi_summa),
      )
    : toNumber(cashboxData?.mainCashboxTotal);

  const courierCashboxTotal = hasManagerCashboxFields
    ? getRecordNumber(
        managerSettlementData,
        ["olinishi_kerak", "to_be_received", "toBeReceived", "receivable", "courier_receivable"],
        toNumber(cashboxData?.olinishi_kerak),
      )
    : toNumber(cashboxData?.courierCashboxTotal);

  const marketCashboxTotal = hasManagerCashboxFields
    ? getResponseNumber(
        managerPayableInfo,
        [
          "berilishi_kerak",
          "payable_to_hq",
          "payableToHq",
          "payable",
          "to_be_given",
          "toBeGiven",
          "net_payable",
          "netPayable",
          "tariff_deducted_amount",
          "tariffDeductedAmount",
        ],
        toNumber(cashboxData?.berilishi_kerak),
      )
    : toNumber(cashboxData?.marketCashboxTotal);

  // Superadmin/admin: «Filiallar» / «HQ kuryerlari» bo'linishi (all-info, gateway C2).
  const receiveSplit = useMemo(() => {
    if (isManagerRole) return null;
    const data = asRecord(cashboxData);
    if (data.branch_managers_receivable === undefined && data.hq_couriers_receivable === undefined) return null;
    return {
      branches: toNumber(data.branch_managers_receivable),
      hqCouriers: toNumber(data.hq_couriers_receivable),
    };
  }, [cashboxData, isManagerRole]);

  const ownBranchRecord = useMemo(() => asRecord(asRecord(currentUser).branch), [currentUser]);
  // Menejer profili: `branch` — branch_users qatori, filial nomi ichki `branch.branch.name` da.
  const ownBranchName =
    getRecordString(asRecord(ownBranchRecord.branch), "name") || getRecordString(ownBranchRecord, "name") || undefined;

  const branchToMainOption = useMemo<PaymentBranchToMainOption | null>(() => {
    const data = asRecord(cashboxData);
    const profile = asRecord(currentUser);
    const ownBranch = asRecord(data.branch ?? profile.branch);
    const hqBranch = asRecord(
      data.hq ?? data.main_branch ?? data.mainBranch ?? ownBranch.parent,
    );
    const region = asRecord(hqBranch.region ?? ownBranch.region ?? profile.region);
    // FE-PAY-01 fix3 dan oldingi holatida qoldirilgan (foydalanuvchi qarori
    // #7): filial puli HQ ga faqat superadmin/admin "Qabul qilinishi kerak"
    // orqali qabul qilganda o'tadi — menejer o'zi topshirmaydi.
    const branchId =
      getRecordString(data, "branch_id") ||
      getRecordString(ownBranch, "id") ||
      getRecordString(profile, "branch_id");

    if (!branchId) return null;

    return {
      id: branchId,
      name:
        getRecordString(hqBranch, "name") ||
        getRecordString(data, "main_branch_name") ||
        t("mainBranchFallback"),
      phone_number:
        getRecordString(hqBranch, "phone_number") ||
        getRecordString(ownBranch, "phone_number"),
      role: "branch",
      region: getRecordString(region, "name", t("mainBranchFallback")),
      type: "branch",
      amount: marketCashboxTotal,
    };
  }, [cashboxData, currentUser, marketCashboxTotal, t]);

  // «Toshkent HQ'ga …» — faqat haqiqiy HQ nomi bo'lsa (zaxira «Asosiy filial» emas).
  const hqName = useMemo(() => {
    const data = asRecord(cashboxData);
    const ownBranch = asRecord(data.branch ?? asRecord(currentUser).branch);
    const hqBranch = asRecord(data.hq ?? data.main_branch ?? data.mainBranch ?? ownBranch.parent);
    return getRecordString(hqBranch, "name") || getRecordString(data, "main_branch_name") || null;
  }, [cashboxData, currentUser]);

  const openBranchToMain = () => {
    if (!branchToMainOption) return;
    navigate(`/payments/cash-detail/${branchToMainOption.id}?type=branch`, {
      state: {
        type: "branch",
        entity: branchToMainOption,
      },
    });
  };

  const handleCardClick = (path: string | null, action: "given" | "received" | null) => {
    if (action === "given") {
      if (isManagerRole) openBranchToMain();
      else openPicker("give");
      return;
    }
    if (action === "received") {
      openPicker(isManagerRole ? "courier" : "receive");
      return;
    }
    if (path) navigate(path);
  };

  const handlePickerSelect = (target: SettlementPickerTarget) => {
    setPickerOpen(false);
    navigate(target.path, { state: target.state });
  };

  // ── Tarix ────────────────────────────────────────────────────────────────────
  // API so'rovi va pagination-reset URL'dan (filtersFromUrl) olinadi — yagona manba.
  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit };
    (Object.entries(filtersFromUrl) as [keyof PaymentsFilters, string][]).forEach(([key, value]) => {
      if (value) params[key] = value;
    });
    return params;
  }, [page, limit, filtersFromUrl]);

  useEffect(() => {
    if (!previousFiltersKeyRef.current) {
      previousFiltersKeyRef.current = filtersFromUrlKey;
      return;
    }

    if (previousFiltersKeyRef.current === filtersFromUrlKey) {
      return;
    }

    previousFiltersKeyRef.current = filtersFromUrlKey;
    resetPagination(limit);
  }, [filtersFromUrlKey, limit, resetPagination]);

  const historyQuery = useGetFinanceHistory(queryParams);
  const { data: historyData, isLoading: historyLoading, isError: historyError, refetch: refetchHistory } = historyQuery;
  const { data: creatorsData, isLoading: creatorsLoading } = useGetUser({
    limit: 100,
  });

  const creatorOptions = useMemo<SelectOption[]>(
    () =>
      ((creatorsData?.data?.items || []) as unknown[])
        .map((user: unknown) => {
          const u = asRecord(user);
          return { value: getRecordString(u, "id"), label: getRecordString(u, "name") };
        })
        .filter((u) => u.value && u.label),
    [creatorsData],
  );
  const sourceTypeOptions = useMemo<SelectOption[]>(
    () => SOURCE_TYPES.map((value) => ({ value, label: getPaymentSourceTitle(value, t, { role }) })),
    [role, t],
  );
  const cashboxTypeOptions = useMemo<SelectOption[]>(
    () => CASHBOX_TYPES.map((value) => ({ value, label: getCashboxTypeLabel(value, t, role) })),
    [role, t],
  );

  const pagination = useMemo(
    () =>
      normalizePagination(
        (historyData?.data?.pagination ?? historyData?.data?.meta) as Record<string, unknown> | undefined,
        page,
        limit,
      ),
    [historyData?.data?.meta, historyData?.data?.pagination, limit, page],
  );
  const historyRows = historyData ? (historyData?.data?.items ?? []) : undefined;

  // ── Filtrlar ko'rinishi ──────────────────────────────────────────────────────
  const all = t("ui:select.all");
  const selectFields: ReadonlyArray<{
    key: SelectFilterKey;
    label: string;
    icon: typeof CreditCard;
    options: readonly SelectOption[];
    loading?: boolean;
    searchable?: boolean;
  }> = [
    { key: "source_type", label: t("v2Overview.history.sourceType"), icon: CreditCard, options: sourceTypeOptions },
    { key: "cashbox_type", label: t("v2Overview.history.cashboxType"), icon: Wallet, options: cashboxTypeOptions },
    {
      key: "created_by",
      label: t("v2Overview.history.createdBy"),
      icon: User,
      options: creatorOptions,
      loading: creatorsLoading,
      searchable: creatorOptions.length > 8,
    },
  ];
  const selectActive = selectFields.filter((field) => filtersFromUrl[field.key]).length;
  const dateActive = filtersFromUrl.from_date || filtersFromUrl.to_date ? 1 : 0;
  const activeCount = selectActive + dateActive;

  const operationTab: OperationTab =
    filtersFromUrl.operation_type === "income" || filtersFromUrl.operation_type === "expense"
      ? filtersFromUrl.operation_type
      : "all";
  const tabItems: TabItem<OperationTab>[] = [
    { value: "all", label: t("v2Overview.history.all") },
    { value: "income", label: t("v2Common.income") },
    { value: "expense", label: t("v2Common.expense") },
  ];

  const dateRange = (className?: string) => (
    <Field
      label={t("v2Overview.history.date")}
      hideLabel
      labelAs="span"
      className={className}
    >
      <DateRange
        value={{ from: filtersFromUrl.from_date, to: filtersFromUrl.to_date }}
        onChange={({ from, to }) => updateFilters({ from_date: from, to_date: to })}
        placeholder={all}
        inlineLabel={t("v2Overview.history.date")}
        triggerClassName="whitespace-nowrap"
      />
    </Field>
  );

  const selectFilter = (field: (typeof selectFields)[number]) => (
    <Field key={field.key} label={field.label} hideLabel labelAs="span" className={FILTER_ITEM}>
      <Select
        options={[{ value: "", label: all }, ...field.options]}
        value={filtersFromUrl[field.key]}
        onChange={(next) => updateFilters({ [field.key]: next ?? "" })}
        placeholder={all}
        inlineLabel={field.label}
        icon={field.icon}
        loading={field.loading}
        searchable={field.searchable}
      />
    </Field>
  );

  const clearLink =
    activeCount > 0 ? (
      <span className="shrink-0">
        <Button variant="link" size="sm" onClick={clearFilters}>
          {t("ui:filters.clearAll")}
        </Button>
      </span>
    ) : null;

  // Telefon: faol filtr chiplari (× — shu filtrni olib tashlash).
  const chips: { key: string; label: string; removeLabel: string; onRemove: () => void }[] = selectFields
    .filter((field) => filtersFromUrl[field.key])
    .map((field) => {
      const value = field.options.find((option) => option.value === filtersFromUrl[field.key])?.label ?? filtersFromUrl[field.key];
      return {
        key: field.key,
        label: t("ui:filters.chip", { label: field.label, value }),
        removeLabel: t("ui:filters.remove", { label: field.label }),
        onRemove: () => updateFilters({ [field.key]: "" }),
      };
    });

  const toolbar: ReactNode = isPhone ? (
    <div role="group" aria-label={t("v2Overview.history.filters")} className="flex flex-col gap-3 px-4 py-4">
      {dateRange("w-full")}
      <Button
        variant="secondary"
        leftIcon={ListFilter}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        onClick={() => setSheetOpen(true)}
        className="w-full"
      >
        <span className="inline-flex items-center gap-2">
          {t("ui:filters.button")}
          {selectActive > 0 ? (
            <span className={COUNT_PILL}>{formatNumberLocalized(selectActive, { language })}</span>
          ) : null}
        </span>
      </Button>
      {chips.length > 0 || activeCount > 0 ? (
        <div role="group" aria-label={t("ui:filters.active")} className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <span key={chip.key} className={CHIP}>
              <span className="min-w-0 truncate">{chip.label}</span>
              <button
                type="button"
                aria-label={chip.removeLabel}
                title={chip.removeLabel}
                onClick={chip.onRemove}
                className={CHIP_X}
              >
                <X aria-hidden="true" size={14} strokeWidth={2.25} />
              </button>
            </span>
          ))}
          {clearLink}
        </div>
      ) : null}
    </div>
  ) : (
    <div
      role="group"
      aria-label={t("v2Overview.history.filters")}
      className="flex flex-wrap items-center gap-3 px-5 py-4"
    >
      {dateRange("min-w-0 flex-[1_1_260px]")}
      {selectFields.map(selectFilter)}
      {clearLink}
    </div>
  );

  const headerActions = isManagerRole ? (
    <>
      {branchToMainOption ? (
        <Button variant="secondary" leftIcon={ArrowUpRight} onClick={openBranchToMain}>
          {t("v2Overview.transferToHq")}
        </Button>
      ) : null}
      <Button leftIcon={ArrowDownLeft} onClick={() => openPicker("courier")}>
        {t("v2Overview.receiveFromCourier")}
      </Button>
    </>
  ) : (
    <>
      <Button variant="secondary" leftIcon={ArrowUpRight} onClick={() => openPicker("give")}>
        {t("v2Overview.payMarket")}
      </Button>
      <Button leftIcon={ArrowDownLeft} onClick={() => openPicker("receive")}>
        {t("v2Overview.receive")}
      </Button>
    </>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("title")} description={t("pageDescription")} actions={headerActions} />

      <PaymentSummaryCards
        isManagerRole={isManagerRole}
        marketTotal={marketCashboxTotal}
        mainTotal={mainCashboxTotal}
        courierTotal={courierCashboxTotal}
        loading={cashboxLoading}
        onCardClick={handleCardClick}
        receiveSplit={receiveSplit}
        couriers={isManagerRole ? managerCouriers.options : undefined}
        couriersLoading={isManagerRole && managerCouriers.isLoading}
        hqName={hqName}
      />

      {isManagerRole ? (
        <CourierMoneyCard
          couriers={managerCouriers.options}
          total={courierCashboxTotal}
          loading={managerCouriers.isLoading}
          isError={managerCouriers.isError}
          onRetry={managerCouriers.refetch}
          onOpenAll={() => openPicker("courier")}
        />
      ) : null}

      <Card as="section" padding="none" aria-label={t("v2Overview.history.label")}>
        <Tabs<OperationTab>
          items={tabItems}
          value={operationTab}
          onValueChange={(next) => updateFilters({ operation_type: next === "all" ? "" : next })}
          ariaLabel={t("v2Overview.history.tabs")}
          listClassName="px-3"
        />
        {toolbar}
        <PaymentHistoryTable
          data={historyRows}
          isLoading={historyLoading}
          isError={historyError}
          error={historyQuery.error}
          isFetching={historyQuery.isFetching}
          onRetry={() => void refetchHistory()}
          pagination={pagination}
          onPageChange={setPage}
          onItemsPerPageChange={setLimit}
          currentPage={page}
          viewerRole={role}
          onClearFilters={activeCount > 0 ? clearFilters : undefined}
          clearFiltersLabel={t("ui:filters.clearAll")}
        />
      </Card>

      {isPhone ? (
        <PaymentsFiltersSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          initial={filtersFromUrl}
          fields={selectFields}
          onApply={(values) => updateFilters(values)}
        />
      ) : null}

      <SettlementPickerDialog
        kind={pickerKind}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
        total={pickerKind === "give" ? undefined : courierCashboxTotal}
        branchName={ownBranchName}
      />
    </div>
  );
};

export default memo(Payments);

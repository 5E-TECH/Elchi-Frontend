// dizayn-v2: superadmin-payments-main-cashbox, admin-payments-main-cashbox, manager-payments-main-cashbox, superadmin-payments-main-cashbox-shift-closed, admin-payments-main-cashbox-shift-closed, manager-payments-main-cashbox-shift-closed
import { memo, useCallback, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ChartColumn,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Inbox,
  Info,
  List,
  ListFilter,
  Minus,
  Plus,
  Timer,
  TrendingUp,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import PopupSelect from "../../../shared/components/popupSelect";
import { cx } from "../../../shared/lib/cx";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { formatDateTimeLocalized, formatTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  CURRENCY_LABEL,
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
  formatSignedMoneyLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { getApiErrorMessage } from "../../../shared/lib/apiError";
import { scrollShellContentToTop } from "../../../shared/lib/usePagination";
import {
  Badge,
  Button,
  Card,
  DataTable,
  DateRange,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Pagination,
  Pressable,
  QueryBoundary,
  SegmentedControl,
  Skeleton,
  SkeletonLines,
  SkeletonTable,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { useUser } from "../../../entities/user/api/userApi";
import { normalizeCashboxShift, useCashBox, type CashboxShift } from "../../../entities/payments";
import { dayOverDay, lastDaysRange, useFinanceHistoryDaily } from "../../../entities/payments/financeDaily";
import { useRefreshExpenseCategories } from "../../../entities/expense-category";
import type { RootState } from "../../../app/config/store";
import { canManageExpenseCategories } from "../../../app/lib/access";
import { EXPENSE_CATEGORIES_TAB, opsTabPath } from "../../ops/tabs";
import CashboxFormPopup, { type CashboxFormPayload } from "./CashboxFormPopup";
import CloseShiftPopup, { type CloseShiftPayload, type CloseShiftResult } from "./CloseShiftPopup";
import ExpenseCategoryBadge from "./ExpenseCategoryBadge";
import FinanceHistoryDetailPopup from "./FinanceHistoryDetailPopup";
import BalanceTrendCard from "./BalanceTrendCard";
import MainCashboxBalanceChart, { type BalanceChartView } from "./MainCashboxBalanceChart";
import OpenShiftDialog from "./OpenShiftDialog";
import ShiftBanner from "./ShiftBanner";
import ShiftResultDialog from "./ShiftResultDialog";
import SalaryPaymentPopup, { type SalaryCardSource } from "./SalaryPaymentPopup";
import SettlementPickerDialog, {
  type SettlementPickerKind,
  type SettlementPickerTarget,
} from "./SettlementPickerDialog";
import type { PaymentRow } from "./patmentHistoryTable";
import { resolvePaymentActorName, resolvePaymentCounterparty } from "./paymentHistoryActor";
import { getPaymentMethodLabel, getPaymentSourceTitle, getViewerOperationType } from "./paymentSourceType";
import { getExpenseCategoryName } from "./lib/expenseCategory";
import { exportMainCashboxReport } from "./lib/exportMainCashboxReport";
import { useCashboxShift } from "./lib/useCashboxShift";
import {
  buildDailyBalanceSeries,
  computePeriodStats,
  filterRowsFrom,
  groupBySource,
  PERIOD_KEYS,
  rowDateValue,
  toNumber,
  type FlowTotals,
  type PeriodKey,
  type PeriodStats,
  type SourceBucket,
} from "./lib/mainCashboxStats";
import {
  isIdempotentReplay,
  isUncertainPaymentError,
  settlePaymentKey,
  takePaymentKey,
} from "./lib/paymentIdempotency";

/**
 * «ASOSIY KASSA» — /payments/main-cashbox (dizayn v2; maketlar `superadmin-payments-main-cashbox` =
 * `admin-payments-main-cashbox`, `manager-payments-main-cashbox`; rollar orasida layout bir xil, xulq rolga qarab).
 *
 *  - Sarlavha: «← To'lovlar», «Asosiy kassa» + smena holati (menejerda filial nomi bilan); «Excelga yuklash»
 *    (hisobot AYNAN eskidek), smena holati ma'lum bo'lsagina — yopiq: «Smenani ochish» (asosiy), ochiq: «Smenani
 *    yopish» (ikkinchi darajali). Smena yopiq — «Smena boshlanmagan» banneri va «Tezkor amallar» qulfi.
 *    Xarajat kategoriyalari sozlamasi (Elchi Pochta №1) bu yerda emas — Ops vositalari → «Xarajat kategoriyalari»
 *    (`/ops?tab=expense-categories`, 2026-10-23 da sarlavhadagi tugma + oynadan ko'chirildi); «Kassadan xarajat»
 *    oynasida faol kategoriya yo'q bo'lsa superadminga o'sha tabga havola.
 *  - «Kassa balansi»: umumiy balans + bugungi sof oqim, naqd/karta segment chizig'i, kun oxiridagi qoldiq
 *    grafigi (`Grafik | Jadval`), ko'z tugmasi summalarni yashiradi. «Tezkor amallar»: qabul (SA/admin — filial
 *    yoki HQ kuryeri, menejer — kuryer), «Marketga to'lov» (faqat SA/admin — backend menejerga 403), xarajat,
 *    to'ldirish; smena ochiq — «Smena ochiq · … dan · Ochgan xodim: <ism>» bloki. Menejer (maket): sof oqim o'rnida
 *    «kechaga nisbatan», grafik alohida «Balans dinamikasi» kartasida (`BalanceTrendCard`, qzjTMWPb).
 *  - «Bugun / Bu hafta / Bu oy» (telefonda bitta karta + segment), «Pul qayerdan keldi, qayerga ketdi»
 *    (bu oy, manba turi bo'yicha), «Operatsiyalar tarixi» (sana filtri, jadval → telefonda kartalar, tafsilot).
 *
 * Ega qarorlari (2026-10-17): D1 — SA/admin tarixi FAQAT asosiy kassa (`GET finance/history?cashbox_type=main`),
 * jadval, davrlar, manbalar va Excel shu qatorlardan; menejer so'rovi o'zgarmagan (gateway filial kassasini o'zi
 * qo'yadi). D3 — «Kassani to'ldirish» / «Kassadan xarajat» `Idempotency-Key` bilan (`paymentIdempotency`
 * yordamchilari: kalit shu operatsiya javob olguncha saqlanadi — qayta yuborishda o'sha kalit, keyingi yangi
 * operatsiyaga yangi kalit).
 *
 * Smena (kfdfYDik, ega javoblari CB-S1…S5, 2026-10-19): holat — `GET finance/shift/current` (`useCashboxShift`;
 * SA/admin — asosiy kassa, menejer — o'z filiali kassasi). Smena HAMMA kassada majburiy (S4): `shift === null` da
 * `required` dan qat'i nazar qulf chiziladi. Ochish — `OpenShiftDialog` (`{ comment? }`), yopish — `CloseShiftPopup`
 * (sanalgan naqd/karta, farq ≠ 0 da izoh majburiy) → POST javobidan `ShiftResultDialog` + Excel avtomatik. Xatoda
 * oyna ochiq qoladi va `notify.error` (xom backend matni ko'rsatilmaydi). Oxirgi yopilgan smena kartasi
 * («Smena yopildi · … · Natija») va ochish oynasidagi «Oxirgi smena … bilan yopilgan» — `last_closed` kerak
 * (Taklif · backend kerak, CB-3) — chizilmaydi.
 */

const FULL_LIST_LIMIT = 10000;
const HISTORY_PAGE_SIZES = [10, 25, 50, 100] as const;
const MASK = "••••••";

type ActionLabel = "receiveFromBranchManager" | "payToMarket" | "spendFromCashbox" | "fillCashbox" | "paySalary";

const ACTION_ORDER: readonly ActionLabel[] = [
  "receiveFromBranchManager",
  "payToMarket",
  "spendFromCashbox",
  "fillCashbox",
  "paySalary",
];

/**
 * Backend'da hali ishlaydigan yo'li yo'q amallar — ko'rsatilmaydi (har bosishda
 * xato berardi):
 *  - "Maosh to'lash" (FE-PAY-07): POST /finance/salary maosh SOZLAMASINI
 *    yaratadi ({ user_id, salary_amount, have_to_pay?, payment_day? }), pul
 *    to'lamaydi; popup esa { amount, type, comment, source_user_id } yuborib
 *    har doim 400 olardi (menejer — 403). Maosh to'lovi endpoint'i paydo
 *    bo'lguncha vaqtincha "Kassadan chiqim" ishlatiladi.
 */
const UNAVAILABLE_ACTIONS: ReadonlySet<ActionLabel> = new Set<ActionLabel>(["paySalary"]);

type ManualOperation = "fill" | "spend";

/** «Maosh to'lash» oqimidagi xodim (`SalaryPaymentPopup` bilan bir xil shakl, qolgan maydonlar saqlanadi). */
type SalaryEmployee = Record<string, unknown> & { id: string; name?: string; role?: string };

/**
 * Qo'lda kassa operatsiyasining barmoq izi (D3): tur + kassa egasi + summa + to'lov turi. Izoh va xarajat
 * kategoriyasi kirmaydi (`paymentIdempotency` qoidasi — operatsiyaning o'zini o'zgartirmaydi: javobi kelmagan
 * chiqimni boshqa kategoriya bilan qayta yuborish YANGI kalit olib, pulni ikki marta yozmasin). Prefiks
 * kuryer/market/filial izlari bilan to'qnashmaydi.
 */
const manualOperationFingerprint = (operation: ManualOperation, scope: string, amount: number, type?: string) =>
  JSON.stringify([`cashbox-${operation}`, scope, amount, type ?? ""]);

// ─── Yordamchilar ─────────────────────────────────────────────────────────────

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

const getText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : "");

/** Server so'rovni rad etdi (4xx, 401/403 dan tashqari) — masalan o'chirilgan xarajat kategoriyasi (400). */
const isClientRejection = (error: unknown) => {
  const status = Number((error as { response?: { status?: unknown } } | null)?.response?.status);
  return status >= 400 && status < 500 && status !== 401 && status !== 403;
};

/** «01.10 – 08.10.2026» (bir yil ichida), bitta kun — «08.10.2026». */
const formatShortRange = (from: string, to: string) => {
  const [fy, fm, fd] = from.split("-");
  const [ty, tm, td] = to.split("-");
  if (!fy || !ty) return "";
  if (from === to) return `${td}.${tm}.${ty}`;
  return fy === ty ? `${fd}.${fm} – ${td}.${tm}.${ty}` : `${fd}.${fm}.${fy} – ${td}.${tm}.${ty}`;
};

/** Kirim yoki chiqim summasi (ishora va rang birga). */
const SignedAmount = ({ value, language, className }: { value: number; language: string; className?: string }) => (
  <span
    className={cx(
      "whitespace-nowrap font-semibold",
      value > 0 ? "text-success-fg" : value < 0 ? "text-danger-fg" : "text-text",
      className,
    )}
  >
    {formatSignedMoneyLocalized(value, { language })}
  </span>
);

/** `.el-kpi-value` + `.el-kpi-unit`. */
const KpiValue = ({ value, unit, className }: { value: ReactNode; unit?: ReactNode; className?: string }) => (
  <span
    className={cx(
      "whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] text-text proportional-nums max-md:text-[22px] max-md:leading-[30px]",
      className,
    )}
  >
    {value}
    {unit ? <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted max-md:text-[13px]">{unit}</span> : null}
  </span>
);

/** `.el-meter` — kirim (`chart-1`, trek `action-soft`) yoki chiqim (`chart-8`, trek `danger-soft`). */
const FlowMeter = ({ ratio, tone }: { ratio: number; tone: "income" | "expense" }) => (
  <span
    aria-hidden="true"
    className={cx("block h-2 w-full overflow-hidden rounded-full", tone === "income" ? "bg-action-soft" : "bg-danger-soft")}
  >
    <span
      className={cx("block h-full rounded-full", tone === "income" ? "bg-chart-1" : "bg-chart-8")}
      style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
    />
  </span>
);

/** «Kirim +X» / «Chiqim −Y» qatori + meter (davr kartalari). */
const FlowLines = ({ totals, language, labels }: { totals: FlowTotals; language: string; labels: { income: string; expense: string } }) => {
  const max = Math.max(totals.income, totals.expense);
  const lines: Array<{ key: "income" | "expense"; label: string; value: number }> = [
    { key: "income", label: labels.income, value: totals.income },
    { key: "expense", label: labels.expense, value: -totals.expense },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      {lines.map((line) => (
        <div key={line.key} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] text-text-muted">
              <span
                aria-hidden="true"
                className={cx("size-2.5 rounded-[3px]", line.key === "income" ? "bg-chart-1" : "bg-chart-8")}
              />
              {line.label}
            </span>
            <SignedAmount value={line.value} language={language} className="text-[13px]" />
          </div>
          <FlowMeter ratio={max > 0 ? Math.abs(line.value) / max : 0} tone={line.key} />
        </div>
      ))}
    </div>
  );
};

/** `.el-hbar` — manba nomi, chiziq, «18,4 mln · 45%». */
const SourceBars = ({
  buckets,
  tone,
  label,
  emptyText,
  sourceLabel,
  language,
}: {
  buckets: SourceBucket[];
  tone: "income" | "expense";
  label: string;
  emptyText: string;
  sourceLabel: (sourceType: string) => string;
  language: string;
}) => {
  if (buckets.length === 0) return <p className="m-0 text-[13px] text-text-muted">{emptyText}</p>;
  const max = buckets[0]?.amount ?? 0;
  return (
    <ol aria-label={label} className="m-0 flex list-none flex-col gap-3 p-0">
      {buckets.map((bucket) => {
        const ratio = max > 0 ? bucket.amount / max : 0;
        return (
          <li
            key={bucket.sourceType}
            className="grid min-h-6 grid-cols-[minmax(80px,32%)_minmax(0,1fr)] items-center gap-3 text-[13px]"
          >
            <span className="truncate text-text" title={sourceLabel(bucket.sourceType)}>
              {sourceLabel(bucket.sourceType)}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className={cx("block h-4 flex-none rounded-r-[4px]", tone === "income" ? "bg-chart-1" : "bg-chart-8")}
                style={{ width: `max(4px, calc((100% - 112px) * ${ratio.toFixed(4)}))` }}
              />
              <span className="whitespace-nowrap font-semibold text-text">
                {formatCompactMoneyLocalized(bucket.amount, { language, withCurrency: false })}{" "}
                <span className="font-normal text-text-muted">
                  · {formatPercentLocalized(bucket.share, { language, fractionDigits: 0 })}
                </span>
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
};

const ACTION_TILE =
  "flex min-h-16 w-full items-center gap-3 rounded-[10px] border border-border-strong bg-surface p-3 text-left text-sm font-semibold text-text " +
  "transition-[background-color,border-color,color,box-shadow,opacity] duration-150 motion-reduce:transition-none hover:bg-sunken active:bg-border";
/** Smena yopiq (maket `*-main-cashbox-shift-closed`): o'chirilgan tugma ko'rinishi — `.el-btn[disabled]`. */
const ACTION_TILE_LOCKED =
  "cursor-not-allowed border-border opacity-50 hover:bg-surface active:bg-surface";

// ─── MainCashbox ──────────────────────────────────────────────────────────────

const MainCashbox = () => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const currency = CURRENCY_LABEL[resolveMoneyLanguage(language)];
  const navigate = useNavigate();
  const balanceTitleId = useId();
  const actionsLockedId = useId();

  const [balanceVisible, setBalanceVisible] = useState(true);
  const [balanceView, setBalanceView] = useState<BalanceChartView>("chart");
  const [mobilePeriod, setMobilePeriod] = useState<PeriodKey>("today");
  const [isSalaryPopupOpen, setIsSalaryPopupOpen] = useState(false);
  const [selectedSalaryEmployee, setSelectedSalaryEmployee] = useState<SalaryEmployee | null>(null);
  const [pickerKind, setPickerKind] = useState<SettlementPickerKind>("receive");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isSpendPopupOpen, setIsSpendPopupOpen] = useState(false);
  const [isRefillPopupOpen, setIsRefillPopupOpen] = useState(false);
  // Yopilayotgan smena ID si — "Smenani yopish" bosilgan paytdagi ochiq smena
  // (oyna ochiq turganda fon so'rovi uni almashtirib yubormasin).
  const [closingShiftId, setClosingShiftId] = useState<string | null>(null);
  const [draftHistoryFrom, setDraftHistoryFrom] = useState("");
  const [draftHistoryTo, setDraftHistoryTo] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<number>(HISTORY_PAGE_SIZES[0]);
  const [selectedRow, setSelectedRow] = useState<PaymentRow | null>(null);
  // Tarix sahifasi almashganda karta boshi ko'rinsin (D-03; tarix balans, amallar va davrlar ostida).
  const historyCardRef = useRef<HTMLElement>(null);
  // Qo'lda operatsiya (to'ldirish/xarajat) yuborilmoqda — ikkinchi yuborish e'tiborsiz.
  const manualPendingRef = useRef(false);

  const role = useSelector((state: RootState) => state.role.role);
  const canManageCategories = useSelector(canManageExpenseCategories);
  const profile = useSelector((state: RootState) => state.user.user);
  const profileUserId = useSelector((state: RootState) => state.user.user?.id);
  const roleUserId = useSelector((state: RootState) => state.role.id);
  const normalizedRole = String(role).toLowerCase();
  const isManagerRole = normalizedRole === "manager";
  const isStaffRole = normalizedRole === "superadmin" || normalizedRole === "admin";
  const currentUserId = String(profileUserId ?? roleUserId ?? "").trim();

  const profileRecord = asRecord(profile);
  // Menejer profili: `branch` — branch_users qatori, filial nomi ichki `branch.branch.name` da.
  const ownBranch = asRecord(profileRecord.branch);
  const ownBranchName = getText(asRecord(ownBranch.branch).name) || getText(ownBranch.name) || undefined;

  const { useGetUser } = useUser();
  const refreshExpenseCategories = useRefreshExpenseCategories();
  const {
    cashboxSpand,
    cashboxFill,
    openShift,
    closeShift,
    useGetCashBoxInfo,
    useGetFinanceHistory,
    useGetCashBoxMain,
  } = useCashBox();

  // ── Smena ───────────────────────────────────────────────────────────────────
  // Holat noma'lum (so'rov kutilmoqda / xato — masalan filiali topilmagan menejerga 403) — smena amali taklif
  // qilinmaydi va qulf chizilmaydi; ochiq yoki yopiq aniq bo'lgandagina.
  const shiftState = useCashboxShift();
  const currentUserName = shiftState.currentUserName;
  const openShiftRow = shiftState.shift;
  const isShiftStateKnown = shiftState.status === "open" || shiftState.status === "closed";
  const isShiftLocked = shiftState.status === "closed";
  const openShiftId = openShiftRow?.id ?? null;
  const openShiftOpenedAt = openShiftRow?.opened_at || undefined;
  const [isOpenShiftDialogOpen, setIsOpenShiftDialogOpen] = useState(false);
  // Natija oynasi — `POST finance/shift/close` javobi (yakuniy qiymatlar faqat shu yerdan).
  // Ma'lumot oyna yopilganda tozalanmaydi — yopilish animatsiyasida jadval «0 / Sanalmadi» ga tushmasin.
  const [shiftResult, setShiftResult] = useState<{
    shift: CashboxShift;
    openedByName: string | null;
    reportHref?: string | null;
  } | null>(null);
  const [isShiftResultOpen, setIsShiftResultOpen] = useState(false);

  // ── Ma'lumot ────────────────────────────────────────────────────────────────
  const { data: usersData } = useGetUser({ limit: FULL_LIST_LIMIT }, isSalaryPopupOpen);
  const hasDateFilter = Boolean(draftHistoryFrom && draftHistoryTo);
  const mainCashboxParams = useMemo(
    () => ({
      ...(draftHistoryFrom && draftHistoryTo && { fromDate: draftHistoryFrom, toDate: draftHistoryTo }),
    }),
    [draftHistoryFrom, draftHistoryTo],
  );

  const cashboxInfoQuery = useGetCashBoxInfo();
  const mainCashboxQuery = useGetCashBoxMain(mainCashboxParams);
  const historyParams = useMemo(
    () => ({
      page: 1,
      limit: FULL_LIST_LIMIT,
      // D1: superadmin/admin — faqat asosiy kassa operatsiyalari (kuryer/market kassalaridagi sotuv va
      // bekorlar aralashmasin). Menejerda param yo'q — gateway o'z filiali kassasini qo'yadi.
      ...(isStaffRole ? { cashbox_type: "main" } : {}),
      ...(draftHistoryFrom && draftHistoryTo && { fromDate: draftHistoryFrom, toDate: draftHistoryTo }),
    }),
    [draftHistoryFrom, draftHistoryTo, isStaffRole],
  );
  const historyQuery = useGetFinanceHistory(historyParams);
  // Menejer (maket): «kechaga nisbatan» — bugungi − kechagi `closing_balance` (qzjTMWPb). Noma'lum bo'lsa chizilmaydi.
  const dayChangeParams = useMemo(() => {
    const range = lastDaysRange(2);
    return { from_date: range.from, to_date: range.to };
  }, []);
  const dayChangeQuery = useFinanceHistoryDaily(dayChangeParams, isManagerRole);
  const dayChange = useMemo(
    () => (dayChangeQuery.data ? dayOverDay(dayChangeQuery.data.days) : null),
    [dayChangeQuery.data],
  );
  const historyLoading = Boolean(historyQuery.isLoading);
  const historyFetching = Boolean(historyQuery.isFetching);
  const historyIsError = Boolean(historyQuery.isError);

  const userItems = useMemo(() => {
    const items = asRecord(asRecord(usersData).data).items;
    return Array.isArray(items) ? items.map(asRecord) : [];
  }, [usersData]);
  const employees = useMemo<SalaryEmployee[]>(
    () =>
      userItems
        .filter((employee) => {
          const employeeRole = String(employee.role ?? "").toLowerCase();
          return employeeRole !== "market" && employeeRole !== "courier";
        })
        .map((employee) => ({
          ...employee,
          id: String(employee.id ?? ""),
          name: getText(employee.name) || undefined,
          role: getText(employee.role) || undefined,
        })),
    [userItems],
  );

  // ── Kassa balansi ───────────────────────────────────────────────────────────
  const cashboxInfoData = asRecord(cashboxInfoQuery.data?.data);
  const mainCashboxData = useMemo(() => asRecord(mainCashboxQuery.data?.data), [mainCashboxQuery.data?.data]);
  const mainCashbox = useMemo(() => asRecord(mainCashboxData.cashbox), [mainCashboxData]);
  const totalBalance = toNumber(
    mainCashbox.balance ?? mainCashboxData.balance ?? cashboxInfoData.mainCashboxTotal ?? mainCashboxData.total,
  );
  const cashBalance = toNumber(
    mainCashbox.balance_cash ?? mainCashboxData.balance_cash ?? mainCashboxData.balanceCash ?? mainCashboxData.cash,
  );
  const transferBalance = toNumber(
    mainCashbox.balance_card ??
      mainCashboxData.balance_card ??
      mainCashboxData.balanceCard ??
      mainCashboxData.transfer,
  );
  const balanceLoading = Boolean(mainCashboxQuery.isLoading || cashboxInfoQuery.isLoading);
  // Smena oynalaridagi «Ochilish qoldig'i» / «Tizim bo'yicha kutilgan» — kassa javobi kelgandagina (aks holda «—»).
  const balanceKnown = Boolean(mainCashboxQuery.isSuccess);
  // «Qabul qilinishi kerak» oynasi izohidagi jami (SA/admin, /payments bilan bir xil manba).
  const receiveTotal = useMemo(() => {
    if (isManagerRole) return undefined;
    const value = cashboxInfoData.olinishi_kerak ?? cashboxInfoData.courierCashboxTotal;
    const parsed = Number(value);
    return value === undefined || value === null || value === "" || !Number.isFinite(parsed) ? undefined : parsed;
  }, [cashboxInfoData, isManagerRole]);

  const salaryCardSources = useMemo<SalaryCardSource[]>(() => {
    const adminRoles = new Set(["admin", "superadmin", "manager", "registrator"]);
    const selectedEmployeeId = String(selectedSalaryEmployee?.id ?? "");
    const sourceMap = new Map<string, SalaryCardSource>();

    sourceMap.set("main", {
      id: "main",
      name: t("mainCard"),
      balance: transferBalance,
    });

    userItems.forEach((item) => {
      const id = String(item.id ?? "");
      const sourceRole = String(item.role ?? "").toLowerCase();
      if (!id || id === selectedEmployeeId || !adminRoles.has(sourceRole)) return;

      const cashbox = asRecord(item.cashbox ?? item.cashBox ?? item.cash_box ?? item.kassa);
      sourceMap.set(id, {
        id,
        name: getPersonName(item, t("userFallback")),
        balance: toNumber(
          cashbox.balance_card ?? item.balance_card ?? cashbox.balance ?? item.balance ?? item.amount,
        ),
      });
    });

    return Array.from(sourceMap.values());
  }, [selectedSalaryEmployee?.id, t, transferBalance, userItems]);

  // ── Tarix ───────────────────────────────────────────────────────────────────
  const historyItems = asRecord(historyQuery.data?.data).items;
  const historyRows: PaymentRow[] = useMemo(
    () => (Array.isArray(historyItems) ? (historyItems as PaymentRow[]) : []),
    [historyItems],
  );
  const periods = useMemo(() => computePeriodStats(historyRows), [historyRows]);
  const todayNet = periods.today.income - periods.today.expense;
  const monthRows = useMemo(() => filterRowsFrom(historyRows, periods.month.from), [historyRows, periods.month.from]);
  const incomeSources = useMemo(() => groupBySource(monthRows, "income"), [monthRows]);
  const expenseSources = useMemo(() => groupBySource(monthRows, "expense"), [monthRows]);

  const cashboxHistory = useMemo(() => toDataItems(mainCashboxData.cashboxHistory), [mainCashboxData]);
  const balancePoints = useMemo(
    () => buildDailyBalanceSeries(cashboxHistory, { from: draftHistoryFrom, to: draftHistoryTo }),
    [cashboxHistory, draftHistoryFrom, draftHistoryTo],
  );

  const pageCount = Math.max(1, Math.ceil(historyRows.length / historyPageSize));
  const currentPage = Math.min(historyPage, pageCount);
  const pageRows = useMemo(
    () => historyRows.slice((currentPage - 1) * historyPageSize, currentPage * historyPageSize),
    [currentPage, historyPageSize, historyRows],
  );

  // ── Amallar ─────────────────────────────────────────────────────────────────
  const openPicker = useCallback((kind: SettlementPickerKind) => {
    setPickerKind(kind);
    setPickerOpen(true);
  }, []);

  const handleActionClick = useCallback(
    (label: ActionLabel) => {
      const map: Record<ActionLabel, () => void> = {
        paySalary: () => setIsSalaryPopupOpen(true),
        // Superadmin/admin: filial menejeri yoki HQ kuryeri; menejer: o'z filiali kuryerlari.
        receiveFromBranchManager: () => openPicker(isManagerRole ? "courier" : "receive"),
        payToMarket: () => openPicker("give"),
        spendFromCashbox: () => setIsSpendPopupOpen(true),
        fillCashbox: () => setIsRefillPopupOpen(true),
      };
      map[label]?.();
    },
    [isManagerRole, openPicker],
  );

  const visibleActions = useMemo(() => {
    const availableActions = ACTION_ORDER.filter((action) => !UNAVAILABLE_ACTIONS.has(action));
    // "Marketga to'lov" (POST /finance/cashbox/payment/market) faqat
    // SUPERADMIN/ADMIN uchun — menejerga (HQ menejeri ham) backend 403
    // qaytaradi, shuning uchun filial turidan qat'i nazar ko'rsatilmaydi.
    if (!isManagerRole) return availableActions;

    return availableActions.filter((action) => action !== "payToMarket");
  }, [isManagerRole]);

  const handlePickerSelect = useCallback(
    (target: SettlementPickerTarget) => {
      setPickerOpen(false);
      // Tur qatorning o'zidan (filial, kuryer yoki market) — roldan emas.
      navigate(target.path, { state: target.state });
    },
    [navigate],
  );

  const handleExportExcel = useCallback(() => {
    exportMainCashboxReport({
      rows: historyRows,
      totalBalance,
      cashBalance,
      cardBalance: transferBalance,
      fromDate: draftHistoryFrom || undefined,
      toDate: draftHistoryTo || undefined,
      labels: {
        defaultReportTitle: t("report"),
        mainCashbox: t("mainCashbox"),
        income: t("income"),
        expense: t("expense"),
        expenseSection: t("expenseSection"),
        balance: t("balance"),
        cash: t("cash"),
        card: t("card"),
        total: t("total"),
        no: t("no"),
        fromWhere: t("fromWhere"),
        toWhere: t("toWhere"),
        other: t("other"),
        comment: t("comment"),
        summaryIncome: t("summaryIncome"),
        summaryExpense: t("summaryExpense"),
      },
    });
  }, [historyRows, totalBalance, cashBalance, transferBalance, draftHistoryFrom, draftHistoryTo, t]);

  const refetchCashboxState = useCallback(async () => {
    await Promise.allSettled([
      mainCashboxQuery.refetch?.(),
      historyQuery.refetch?.(),
      cashboxInfoQuery.refetch?.(),
    ]);
  }, [cashboxInfoQuery, historyQuery, mainCashboxQuery]);

  /**
   * Qo'lda kirim/chiqim (tasdiqdan keyin). Payload `{ amount, type, comment? }` (bo'sh izoh yuborilmaydi —
   * chiqimda ixtiyoriy), chiqimda `+ expense_category_id` (majburiy; to'ldirishga hech qachon — backend 400). Backend
   * kategoriyasiz chiqimni 400 bilan rad etadi — uning matni xabarda chiqadi. D3 — `Idempotency-Key` barmoq iziga
   * bog'langan: javob kelmasa (504, tarmoq) kalit saqlanadi va aynan shu operatsiya qayta yuborilganda backend uni
   * bir marta yozadi (`idempotent: true` — «allaqachon yozilgan» ogohlantirishi). Kategoriya bilan chiqim rad
   * etilsa (o'chirilgan kategoriya — 400 va backend matni) tanlov ro'yxati qayta o'qiladi.
   */
  const submitManualOperation = useCallback(
    async (operation: ManualOperation, { amount, type, comment, expense_category_id }: CashboxFormPayload) => {
      if (manualPendingRef.current) return;
      manualPendingRef.current = true;
      const mutation = operation === "fill" ? cashboxFill : cashboxSpand;
      const close = operation === "fill" ? () => setIsRefillPopupOpen(false) : () => setIsSpendPopupOpen(false);
      const fingerprint = manualOperationFingerprint(operation, currentUserId || normalizedRole, amount, type);
      const categoryId = operation === "spend" ? expense_category_id : undefined;
      try {
        const idempotencyKey = takePaymentKey(fingerprint);
        let response: Awaited<ReturnType<typeof mutation.mutateAsync>>;
        try {
          response = await mutation.mutateAsync({
            data: {
              amount,
              type,
              ...(comment ? { comment } : {}),
              ...(categoryId ? { expense_category_id: categoryId } : {}),
            },
            idempotencyKey,
          });
        } catch (error) {
          // Kalit saqlanadi: aynan shu operatsiya qayta yuborilsa backend uni bir marta yozadi.
          notify.error(t("common:error"), {
            description: getBackendErrorMessage(error) ?? t(operation === "fill" ? "fillError" : "spendError"),
          });
          if (operation === "spend" && isClientRejection(error)) void refreshExpenseCategories();
          if (isUncertainPaymentError(error)) {
            notify.warning(t("common:warning"), {
              description: t("v2MainCashbox.notify.outcomeUnknown"),
              duration: 10000,
            });
            await refetchCashboxState();
          }
          return;
        }

        settlePaymentKey(fingerprint);
        if (isIdempotentReplay(response)) {
          notify.warning(t("common:warning"), { description: t("v2MainCashbox.notify.alreadyRecorded"), duration: 8000 });
          close();
          await refetchCashboxState();
          return;
        }
        notify.success(t("common:success"), {
          description: t(operation === "fill" ? "fillSuccess" : "spendSuccess"),
        });
        close();
      } finally {
        manualPendingRef.current = false;
      }
    },
    [cashboxFill, cashboxSpand, currentUserId, normalizedRole, refetchCashboxState, refreshExpenseCategories, t],
  );

  const handleSpend = useCallback(
    (payload: CashboxFormPayload) => submitManualOperation("spend", payload),
    [submitManualOperation],
  );
  const handleRefill = useCallback(
    // To'ldirishda kategoriya yo'q (oyna maydonni chizmaydi, backend `fill` uni 400 bilan rad etadi).
    ({ amount, type, comment }: CashboxFormPayload) => submitManualOperation("fill", { amount, type, comment }),
    [submitManualOperation],
  );

  const refetchShift = shiftState.refetch;

  const handleOpenShift = useCallback(
    async (comment: string) => {
      if (openShift.isPending) return;
      try {
        await openShift.mutateAsync({ comment: comment || undefined });
      } catch {
        // Oyna ochiq qoladi; xom backend matni ko'rsatilmaydi. Smenani boshqa xodim ochgan bo'lishi mumkin —
        // holat qayta o'qiladi, eskirgan amal qayta-qayta yuborilmaydi.
        notify.error(t("common:error"), { description: t("openShiftError") });
        refetchShift();
        return;
      }
      setIsOpenShiftDialogOpen(false);
      notify.success(t("common:success"), { description: t("openShiftSuccess") });
    },
    [openShift, refetchShift, t],
  );

  const handleCloseShift = useCallback(
    async ({ countedCash, countedCard, comment, accounts }: CloseShiftPayload): Promise<CloseShiftResult | undefined> => {
      if (!closingShiftId || closeShift.isPending) return undefined;
      const openedByName = shiftState.openedByName;
      let closed: CashboxShift | null = null;
      let closedResponse: unknown = null;
      try {
        const response = await closeShift.mutateAsync({
          shift_id: closingShiftId,
          closing_balance_cash: countedCash,
          closing_balance_card: countedCard,
          comment: comment || undefined,
          ...(accounts ? { accounts } : {}),
        });
        closedResponse = response;
        closed = normalizeCashboxShift(asRecord(response).data);
      } catch (error) {
        // kiZgTybn: kartalar tekshiruvining 400 xabari karta nomi bilan keladi («Humo: izoh majburiy») — kassir nimani
        // tuzatishini bilishi uchun shu matn ko'rsatiladi; boshqa xatolar — umumiy matn (avvalgidek).
        const status = (error as { response?: { status?: number } } | null)?.response?.status;
        const accountMessage = accounts?.length && status === 400 ? getApiErrorMessage(error) : "";
        notify.error(t("common:error"), { description: accountMessage || t("closeShiftError") });
        // Smena boshqa xodim tomonidan yopilgan bo'lishi mumkin — holat qayta o'qiladi.
        refetchShift();
        // Oyna kartani ajratadi va qoldiqlarni qayta o'qiydi («Humo»: … izoh majburiy).
        return accountMessage ? { error: accountMessage } : undefined;
      }
      setClosingShiftId(null);
      handleExportExcel();
      if (closed) {
        // kiZgTybn: kartalar tekshirilgan bo'lsa natija oynasida «Smena hisoboti» havolasi.
        const accountsChecked = Boolean(asRecord(asRecord(closedResponse).data).accounts_check);
        setShiftResult({ shift: closed, openedByName, reportHref: accountsChecked ? `/payments/shifts/${closed.id}` : null });
        setIsShiftResultOpen(true);
      } else {
        notify.success(t("common:success"), { description: t("closeShiftSuccess") });
      }
      return undefined;
    },
    [closeShift, closingShiftId, handleExportExcel, refetchShift, shiftState.openedByName, t],
  );

  const setHistoryRange = useCallback((from: string, to: string) => {
    setDraftHistoryFrom(from);
    setDraftHistoryTo(to);
    setHistoryPage(1);
  }, []);
  const clearHistoryRange = useCallback(() => setHistoryRange("", ""), [setHistoryRange]);

  // ── Ko'rinish yordamchilari ─────────────────────────────────────────────────
  const money = (value: number) => (balanceVisible ? formatMoneyLocalized(value, { language }) : MASK);
  const viewerCashboxType = isManagerRole ? "branch" : "main";
  const sourceLabel = (sourceType: string) =>
    getPaymentSourceTitle(sourceType === "unknown" ? "" : sourceType, t, {
      role: normalizedRole,
      cashboxType: viewerCashboxType,
    });
  const rowSourceTitle = (row: PaymentRow) =>
    getPaymentSourceTitle(row.source_type, t, {
      role: normalizedRole,
      cashboxType: row.cashbox_type || row.cashbox?.cashbox_type || viewerCashboxType,
    });
  // Asosiy kassa sahifasida `click` — «Karta (Click)» (maket), qolganlari umumiy yorliq.
  const paymentMethodLabel = (value?: string | null) =>
    String(value ?? "").trim().toLowerCase() === "click"
      ? t("v2Common.paymentMethod.cardClick")
      : getPaymentMethodLabel(value, t);
  const actorName = (row: PaymentRow) => {
    const name = resolvePaymentActorName(row);
    return name === "-" ? "—" : name;
  };
  const rowDateText = (row: PaymentRow) => {
    const value = rowDateValue(row);
    return value ? formatDateTimeLocalized(value, { language }) : "—";
  };
  const rowDirection = (row: PaymentRow) => getViewerOperationType(row, normalizedRole);
  const rowCounterparty = (row: PaymentRow) =>
    resolvePaymentCounterparty(row, (id) => t("v2Common.orderNumber", { id }));
  // Kartaning nomi (aria-label) ichidagini almashtiradi — xarajat kategoriyasi ham aytilsin.
  const openLabel = (row: PaymentRow) => {
    const category = getExpenseCategoryName(row);
    const title = rowSourceTitle(row);
    return t("v2Common.openDetail", { title: category ? `${title} · ${category}` : title, date: rowDateText(row) });
  };
  const categoryBadge = (row: PaymentRow) => {
    const category = getExpenseCategoryName(row);
    return category ? <ExpenseCategoryBadge name={category} /> : null;
  };

  const operationBadge = (row: PaymentRow) => {
    const direction = rowDirection(row);
    if (!direction) return <span className="text-text-muted">—</span>;
    return (
      <Badge icon={direction === "income" ? ArrowDownLeft : ArrowUpRight}>
        {t(direction === "income" ? "v2Common.income" : "v2Common.expense")}
      </Badge>
    );
  };
  const amountNode = (row: PaymentRow) => {
    const direction = rowDirection(row);
    const amount = Math.abs(toNumber(row.amount));
    return (
      <span
        className={cx(
          "whitespace-nowrap font-semibold",
          direction === "income" ? "text-success-fg" : direction === "expense" ? "text-danger-fg" : "text-text",
        )}
      >
        {formatSignedMoneyLocalized(direction === "expense" ? -amount : amount, { language })}
      </span>
    );
  };
  const balanceAfterText = (row: PaymentRow) => {
    const value = row.balance_after;
    if (value === undefined || value === null || !Number.isFinite(Number(value))) return null;
    return t("v2MainCashbox.history.balanceAfter", { amount: formatMoneyLocalized(value, { language }) });
  };

  const historyColumns: DataTableColumn<PaymentRow>[] = [
    {
      id: "date",
      header: t("v2MainCashbox.history.columns.date"),
      className: "whitespace-nowrap",
      cell: (row) => (
        <>
          <div>{rowDateText(row)}</div>
          <div className="hidden text-[13px] text-text-muted max-lg:block">{actorName(row)}</div>
        </>
      ),
    },
    {
      id: "createdBy",
      header: t("v2MainCashbox.history.columns.createdBy"),
      hideBelow: "lg",
      className: "whitespace-nowrap",
      cell: (row) => actorName(row),
    },
    {
      id: "source",
      header: t("v2MainCashbox.history.columns.source"),
      cell: (row) => {
        const sub = rowCounterparty(row);
        const category = categoryBadge(row);
        const title = (
          <Pressable
            onClick={() => setSelectedRow(row)}
            className="text-left font-semibold text-text hover:text-action-fg hover:underline"
          >
            {rowSourceTitle(row)}
          </Pressable>
        );
        return (
          <>
            {/* Xarajat kategoriyasi (Elchi Pochta №1) — manba nomi yonida neytral belgi, joy yetmasa ostida. */}
            {category ? (
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {title}
                {category}
              </div>
            ) : (
              title
            )}
            {sub ? <div className="text-[13px] text-text-muted [overflow-wrap:anywhere]">{sub}</div> : null}
            <div className="hidden text-[13px] text-text-muted max-lg:block">{paymentMethodLabel(row.payment_method)}</div>
          </>
        );
      },
    },
    {
      id: "paymentType",
      header: t("v2MainCashbox.history.columns.paymentType"),
      hideBelow: "lg",
      className: "whitespace-nowrap",
      cell: (row) => paymentMethodLabel(row.payment_method),
    },
    {
      id: "operation",
      header: t("v2MainCashbox.history.columns.operation"),
      cell: (row) => operationBadge(row),
    },
    {
      id: "amount",
      header: t("v2MainCashbox.history.columns.amount"),
      align: "end",
      cell: (row) => {
        const balance = balanceAfterText(row);
        return (
          <>
            {amountNode(row)}
            {balance ? <div className="text-[13px] text-text-muted">{balance}</div> : null}
          </>
        );
      },
    },
    {
      id: "detail",
      header: <span className="sr-only">{t("v2MainCashbox.history.columns.detail")}</span>,
      className: "w-14",
      cellClassName: "text-right",
      cell: (row) => (
        <IconButton
          size="sm"
          variant="ghost"
          icon={ChevronRight}
          label={openLabel(row)}
          onClick={() => setSelectedRow(row)}
          className="text-text-muted"
        />
      ),
    },
  ];

  // Telefon kartasi (maket `.el-list-item`): sarlavha + summa · qarshi tomon · to'lov turi · badge (+ xarajat kategoriyasi) +
  // sana · yaratgan.
  const renderHistoryCard = (row: PaymentRow) => {
    const sub = [rowCounterparty(row), paymentMethodLabel(row.payment_method)].filter(Boolean).join(" · ");
    return (
      <Pressable
        aria-label={openLabel(row)}
        onClick={() => setSelectedRow(row)}
        className="flex min-h-14 w-full flex-col gap-1 px-4 py-3 text-left text-sm text-text hover:bg-row-hover"
      >
        <span className="flex w-full min-w-0 justify-between gap-2">
          <span className="min-w-0 font-semibold">{rowSourceTitle(row)}</span>
          {amountNode(row)}
        </span>
        {sub ? <span className="text-[13px] text-text-muted [overflow-wrap:anywhere]">{sub}</span> : null}
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {operationBadge(row)}
          {categoryBadge(row)}
          <span className="text-[13px] text-text-muted">
            <span className="whitespace-nowrap">{rowDateText(row)}</span> · {actorName(row)}
          </span>
        </span>
      </Pressable>
    );
  };

  // ── Sarlavha ────────────────────────────────────────────────────────────────
  const headerDescription =
    isManagerRole && ownBranchName
      ? isShiftStateKnown
        ? t(openShiftId ? "v2MainCashbox.subtitleBranchShiftOpen" : "v2MainCashbox.subtitleBranchShiftClosed", {
            branch: ownBranchName,
          })
        : t("v2MainCashbox.subtitleBranch", { branch: ownBranchName })
      : isShiftStateKnown
        ? t(openShiftId ? "v2MainCashbox.subtitleShiftOpen" : "v2MainCashbox.subtitleShiftClosed")
        : t("v2MainCashbox.subtitle");

  // Smena yopiq — «Smenani ochish» asosiy tugma (ochish oynasi); ochiq — «Smenani yopish» ikkinchi darajali
  // (sanash oynasi). Holat noma'lum — tugma yo'q.
  const shiftAction = isShiftStateKnown ? (
    openShiftId ? (
      <Button variant="secondary" leftIcon={Timer} onClick={() => setClosingShiftId(openShiftId)}>
        {t("v2MainCashbox.closeShift")}
      </Button>
    ) : (
      <Button leftIcon={Timer} onClick={() => setIsOpenShiftDialogOpen(true)} aria-haspopup="dialog">
        {t("v2MainCashbox.openShift")}
      </Button>
    )
  ) : null;

  // ── Kassa balansi ───────────────────────────────────────────────────────────
  const updatedAt = Number(mainCashboxQuery.dataUpdatedAt) || Date.now();
  const timeText = formatTimeLocalized(updatedAt, { language });
  const balanceSubtitle = isManagerRole
    ? ownBranchName
      ? t("v2MainCashbox.balance.subtitleBranch", { time: timeText, branch: ownBranchName })
      : t("v2MainCashbox.balance.subtitle", { time: timeText })
    : t("v2MainCashbox.balance.subtitle", { time: timeText });
  const splitTotal = Math.max(0, cashBalance) + Math.max(0, transferBalance);
  const cashShare = splitTotal > 0 ? (Math.max(0, cashBalance) / splitTotal) * 100 : 0;
  const cardShare = splitTotal > 0 ? (Math.max(0, transferBalance) / splitTotal) * 100 : 0;
  const percent = (value: number) => formatPercentLocalized(value, { language });
  const splitRows: Array<{ key: string; icon: LucideIcon; label: string; value: number; share: number; color: string }> = [
    { key: "cash", icon: Banknote, label: t("v2MainCashbox.balance.cash"), value: cashBalance, share: cashShare, color: "bg-chart-1" },
    { key: "card", icon: CreditCard, label: t("v2MainCashbox.balance.card"), value: transferBalance, share: cardShare, color: "bg-chart-2" },
  ];

  const deltaClass =
    todayNet > 0 ? "bg-success-soft text-success-fg" : todayNet < 0 ? "bg-danger-soft text-danger-fg" : "bg-sunken text-text-muted";

  // Sarlavha qatori qo'lda (`.el-chart-head`): telefonda boshqaruvlar to'liq enli (ko'z + «Grafik | Jadval»).
  const balanceCard = (
    <Card
      divided={false}
      aria-labelledby={balanceTitleId}
      bodyClassName="flex flex-col gap-4"
      className="min-w-0"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
          <h2 id={balanceTitleId} className="text-base font-bold text-text">
            {t("v2MainCashbox.balance.title")}
          </h2>
          <p className="text-[13px] leading-[18px] text-text-muted">{balanceSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 max-md:w-full">
          <IconButton
            variant="secondary"
            size="sm"
            icon={balanceVisible ? Eye : EyeOff}
            label={t(balanceVisible ? "v2MainCashbox.balance.hide" : "v2MainCashbox.balance.show")}
            aria-pressed={!balanceVisible}
            onClick={() => setBalanceVisible((value) => !value)}
            className="shrink-0 max-md:size-11"
          />
          {/* Menejerda grafik alohida «Balans dinamikasi» kartasida (maket) — bu yerda egizak kerak emas. */}
          {isManagerRole ? null : (
            <SegmentedControl<BalanceChartView>
              ariaLabel={t("v2MainCashbox.balance.view")}
              value={balanceView}
              onValueChange={setBalanceView}
              className="max-md:min-w-0 max-md:flex-1"
              options={[
                { value: "chart", label: t("v2MainCashbox.balance.chart"), icon: ChartColumn },
                { value: "table", label: t("v2MainCashbox.balance.table"), icon: List },
              ]}
            />
          )}
        </div>
      </div>
      {/* Menejerda grafik yo'q: qiymat va taqsimot ustma-ust (maket), karta teng ikki ustunning birida. */}
      <div className={cx("flex items-start gap-x-8 gap-y-4", isManagerRole ? "flex-col [&>*]:w-full [&>*]:flex-none" : "flex-wrap")}>
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
          <span className="text-[13px] font-semibold text-text-muted">{t("v2MainCashbox.balance.total")}</span>
          {balanceLoading ? (
            <Skeleton shape="line" width={180} height={32} />
          ) : (
            <KpiValue
              value={balanceVisible ? formatMoneyLocalized(totalBalance, { language, withCurrency: false }) : MASK}
              unit={balanceVisible ? currency : undefined}
            />
          )}
          {isManagerRole ? (
            dayChange ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                <span
                  className="inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-md bg-sunken px-1.5 text-xs font-bold text-text-muted"
                >
                  <TrendingUp aria-hidden="true" size={14} className={dayChange.amount < 0 ? "-scale-y-100" : undefined} />
                  {balanceVisible ? formatSignedMoneyLocalized(dayChange.amount, { language, withCurrency: false }) : MASK}
                </span>
                <span>{t("v2Daily.vsYesterday")}</span>
              </span>
            ) : null
          ) : (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
              {historyLoading ? (
                <Skeleton shape="line" width={96} height={22} />
              ) : historyIsError ? (
                // Tarix yuklanmadi — bugungi oqim noma'lum («0 so'm» deb ko'rsatilmaydi).
                <span className="inline-flex h-[22px] items-center rounded-md bg-sunken px-1.5 text-xs font-bold text-text-muted">
                  —
                </span>
              ) : (
                <span
                  className={cx(
                    "inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-xs font-bold",
                    deltaClass,
                  )}
                >
                  <TrendingUp aria-hidden="true" size={14} className={todayNet < 0 ? "-scale-y-100" : undefined} />
                  {balanceVisible ? formatSignedMoneyLocalized(todayNet, { language }) : MASK}
                </span>
              )}
              <span>{t("v2MainCashbox.balance.todayNet")}</span>
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
          {balanceLoading ? (
            <SkeletonLines lines={3} />
          ) : (
            <>
              <div
                role="img"
                aria-label={t("v2MainCashbox.balance.split", {
                  cash: money(cashBalance),
                  cashShare: percent(cashShare),
                  card: money(transferBalance),
                  cardShare: percent(cardShare),
                })}
                className="flex h-2.5 gap-0.5 overflow-hidden rounded-[4px] bg-sunken"
              >
                {splitTotal > 0
                  ? splitRows
                      .filter((row) => row.share > 0)
                      .map((row) => (
                        <span
                          key={row.key}
                          className={cx("block h-full min-w-1 first:rounded-l-[4px] last:rounded-r-[4px]", row.color)}
                          style={{ flex: `${row.share} 1 0` }}
                        />
                      ))
                  : null}
              </div>
              <ul className="m-0 flex list-none flex-col p-0">
                {splitRows.map((row) => {
                  const Icon = row.icon;
                  return (
                    <li
                      key={row.key}
                      className="grid min-h-10 grid-cols-[12px_minmax(0,1fr)_auto_52px] items-center gap-2.5 border-t border-border py-1.5 text-sm first:border-t-0"
                    >
                      <span aria-hidden="true" className={cx("size-3 rounded-[3px]", row.color)} />
                      <span className="inline-flex min-w-0 items-center gap-2 text-text">
                        <Icon aria-hidden="true" size={16} className="shrink-0 text-text-muted" />
                        <span className="truncate">{row.label}</span>
                      </span>
                      <span className="whitespace-nowrap font-semibold text-text">{money(row.value)}</span>
                      <span className="text-right text-[13px] text-text-muted">{percent(row.share)}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
      {isManagerRole ? null : (
        <MainCashboxBalanceChart
          points={balancePoints}
          view={balanceView}
          hidden={!balanceVisible}
          isLoading={Boolean(mainCashboxQuery.isLoading)}
          isError={Boolean(mainCashboxQuery.isError)}
          error={mainCashboxQuery.error}
          onRetry={() => void mainCashboxQuery.refetch?.()}
        />
      )}
    </Card>
  );

  // ── Tezkor amallar ──────────────────────────────────────────────────────────
  const actionCopy: Record<Exclude<ActionLabel, "paySalary">, { icon: LucideIcon; title: string; hint: string }> = {
    receiveFromBranchManager: isManagerRole
      ? {
          icon: Truck,
          title: t("v2MainCashbox.actions.receiveCourier"),
          hint: t("v2MainCashbox.actions.receiveCourierHint"),
        }
      : { icon: ArrowDownLeft, title: t("v2MainCashbox.actions.receive"), hint: t("v2MainCashbox.actions.receiveHint") },
    payToMarket: { icon: ArrowUpRight, title: t("v2MainCashbox.actions.payMarket"), hint: t("v2MainCashbox.actions.payMarketHint") },
    spendFromCashbox: { icon: Minus, title: t("v2MainCashbox.actions.spend"), hint: t("v2MainCashbox.actions.spendHint") },
    fillCashbox: { icon: Plus, title: t("v2MainCashbox.actions.fill"), hint: t("v2MainCashbox.actions.fillHint") },
  };

  const shiftStatus = openShiftRow ? (
    <div className="mt-auto flex items-center gap-2.5 rounded-xl bg-sunken px-3.5 py-3">
      <Clock aria-hidden="true" size={18} className="shrink-0 text-text-subtle" />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold text-text">
          {openShiftOpenedAt
            ? t("v2MainCashbox.actions.shiftOpen", {
                time: formatDateTimeLocalized(openShiftOpenedAt, { language }),
              })
            : t("v2MainCashbox.actions.shiftOpenNoTime")}
        </span>
        {shiftState.openedByName ? (
          <span className="text-xs text-text-muted">
            {t("v2MainCashbox.actions.shiftOpenedBy", { name: shiftState.openedByName })}
          </span>
        ) : null}
      </span>
    </div>
  ) : null;

  const actionsCard = (
    <Card
      divided={false}
      title={t("v2MainCashbox.actions.title")}
      description={
        isShiftLocked ? (
          <span id={actionsLockedId}>{t("v2MainCashbox.shift.locked")}</span>
        ) : (
          t("v2MainCashbox.actions.subtitle")
        )
      }
      bodyClassName="flex flex-1 flex-col gap-4"
      className="min-w-0"
    >
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
        {visibleActions.map((label) => {
          if (label === "paySalary") return null;
          const copy = actionCopy[label];
          const Icon = copy.icon;
          return (
            <Pressable
              key={label}
              onClick={() => handleActionClick(label)}
              disabled={isShiftLocked}
              aria-describedby={isShiftLocked ? actionsLockedId : undefined}
              className={cx(ACTION_TILE, isShiftLocked && ACTION_TILE_LOCKED)}
            >
              <span
                aria-hidden="true"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
              >
                <Icon size={18} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span>{copy.title}</span>
                <span className="text-xs font-normal text-text-muted">{copy.hint}</span>
              </span>
            </Pressable>
          );
        })}
      </div>
      {shiftStatus}
    </Card>
  );

  // ── Davrlar ─────────────────────────────────────────────────────────────────
  const periodLabel = (key: PeriodKey) => t(`v2MainCashbox.periods.${key}`);
  const flowLabels = { income: t("v2MainCashbox.periods.income"), expense: t("v2MainCashbox.periods.expense") };
  const netMeta = (stats: PeriodStats) => {
    const net = stats.income - stats.expense;
    if (stats.income > 0 && net >= 0) {
      return t("v2MainCashbox.periods.netFlowKept", {
        percent: formatPercentLocalized(Math.round((net / stats.income) * 100), { language, fractionDigits: 0 }),
      });
    }
    return t("v2MainCashbox.periods.netFlow");
  };
  const periodSummary = (key: PeriodKey, stats: PeriodStats) =>
    t("v2MainCashbox.periods.summary", {
      period: periodLabel(key),
      income: formatMoneyLocalized(stats.income, { language }),
      expense: formatMoneyLocalized(stats.expense, { language }),
      net: formatSignedMoneyLocalized(stats.income - stats.expense, { language }),
    });
  const netValue = (stats: PeriodStats) =>
    historyIsError ? "—" : formatSignedMoneyLocalized(stats.income - stats.expense, { language, withCurrency: false });

  const periodCards = (
    <section
      aria-label={t("v2MainCashbox.periods.label")}
      className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))] max-md:hidden"
    >
      {PERIOD_KEYS.map((key) => {
        const stats = periods[key];
        return (
          <div
            key={key}
            className="flex min-w-0 flex-col gap-1.5 rounded-[14px] border border-border bg-surface px-5 py-4"
          >
            <div className="flex min-h-9 items-center justify-between gap-2">
              <span className="min-w-0 text-[13px] font-semibold text-text-muted">{periodLabel(key)}</span>
              <span className="whitespace-nowrap text-xs text-text-subtle">{formatShortRange(stats.from, stats.to)}</span>
            </div>
            {historyLoading ? (
              <>
                <Skeleton shape="line" width={160} height={32} />
                <SkeletonLines lines={3} />
              </>
            ) : (
              <>
                <KpiValue value={netValue(stats)} unit={historyIsError ? undefined : currency} />
                {historyIsError ? null : (
                  <>
                    <span className="text-xs text-text-muted">{netMeta(stats)}</span>
                    <div role="img" aria-label={periodSummary(key, stats)} className="mt-2">
                      <FlowLines totals={stats} language={language} labels={flowLabels} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        );
      })}
    </section>
  );

  const mobileStats = periods[mobilePeriod];
  const mobilePeriodCard = (
    <div className="md:hidden">
      <Card
        divided={false}
        title={t("v2MainCashbox.periods.mobileTitle")}
        description={t("v2MainCashbox.periods.mobileSubtitle", {
          period: periodLabel(mobilePeriod),
          range: formatShortRange(mobileStats.from, mobileStats.to),
        })}
        bodyClassName="flex flex-col gap-3.5"
      >
        <SegmentedControl<PeriodKey>
          ariaLabel={t("v2MainCashbox.periods.segment")}
          value={mobilePeriod}
          onValueChange={setMobilePeriod}
          fullWidth
          options={PERIOD_KEYS.map((key) => ({ value: key, label: periodLabel(key) }))}
        />
        {historyLoading ? (
          <SkeletonLines lines={3} />
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <KpiValue value={netValue(mobileStats)} unit={historyIsError ? undefined : currency} />
              <span className="text-xs text-text-muted">{t("v2MainCashbox.periods.netChange")}</span>
            </div>
            {historyIsError ? null : (
              <div role="img" aria-label={periodSummary(mobilePeriod, mobileStats)}>
                <FlowLines totals={mobileStats} language={language} labels={flowLabels} />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );

  // ── Pul qayerdan keldi, qayerga ketdi ───────────────────────────────────────
  const sourcesCard = (
    <Card
      divided={false}
      title={t("v2MainCashbox.sources.title")}
      description={t("v2MainCashbox.sources.subtitle", {
        range: formatShortRange(periods.month.from, periods.month.to),
      })}
      bodyClassName="flex flex-col gap-4"
    >
      {historyLoading ? (
        <SkeletonLines lines={6} />
      ) : historyIsError ? (
        <ErrorState
          error={historyQuery.error}
          title={t("v2MainCashbox.sources.loadError")}
          onRetry={() => void historyQuery.refetch?.()}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-x-12 gap-y-6">
            {(
              [
                { key: "income", label: t("v2MainCashbox.sources.income"), total: periods.month.income, buckets: incomeSources, empty: t("v2MainCashbox.sources.noIncome") },
                { key: "expense", label: t("v2MainCashbox.sources.expense"), total: -periods.month.expense, buckets: expenseSources, empty: t("v2MainCashbox.sources.noExpense") },
              ] as const
            ).map((column) => (
              <div key={column.key} className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5">
                <div className="flex items-baseline justify-between gap-2 border-b border-border pb-2.5">
                  <h3 className="m-0 inline-flex items-center gap-2 text-sm font-semibold text-text">
                    <span
                      aria-hidden="true"
                      className={cx("size-2.5 rounded-[3px]", column.key === "income" ? "bg-chart-1" : "bg-chart-8")}
                    />
                    {column.label}
                  </h3>
                  <SignedAmount value={column.total} language={language} />
                </div>
                <SourceBars
                  buckets={[...column.buckets]}
                  tone={column.key}
                  label={column.label}
                  emptyText={column.empty}
                  sourceLabel={sourceLabel}
                  language={language}
                />
              </div>
            ))}
          </div>
          <p className="m-0 flex items-start gap-2 text-xs text-text-subtle">
            <Info aria-hidden="true" size={14} className="mt-px shrink-0" />
            {t("v2MainCashbox.sources.note")}
          </p>
        </>
      )}
    </Card>
  );

  // ── Operatsiyalar tarixi ────────────────────────────────────────────────────
  const historyCountText = t("v2MainCashbox.history.count", {
    n: formatNumberLocalized(historyRows.length, { language }),
  });
  const historyRangeText = hasDateFilter
    ? formatShortRange(draftHistoryFrom, draftHistoryTo)
    : t("v2MainCashbox.history.allTime");
  // Soni faqat ro'yxat yuklangach (yuklanish / xato paytida «0 ta operatsiya» deyilmaydi).
  const historyDescription =
    historyQuery.data && !historyIsError ? `${historyCountText} · ${historyRangeText}` : historyRangeText;
  const dateFilter = (className?: string) => (
    <DateRange
      value={{ from: draftHistoryFrom, to: draftHistoryTo }}
      onChange={({ from, to }) => setHistoryRange(from, to)}
      aria-label={t("v2MainCashbox.history.dateFilter")}
      className={className}
    />
  );
  const clearButton = hasDateFilter ? (
    <Button variant="link" size="sm" onClick={clearHistoryRange} className="max-md:min-h-11">
      {t("v2MainCashbox.history.clearFilters")}
    </Button>
  ) : null;

  const historyEmpty = hasDateFilter ? (
    <EmptyState
      icon={ListFilter}
      title={t("v2MainCashbox.history.empty")}
      description={t("v2MainCashbox.history.filteredEmptyDescription")}
      action={
        <Button variant="secondary" onClick={clearHistoryRange}>
          {t("v2MainCashbox.history.clearFilters")}
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={Inbox}
      title={t("v2MainCashbox.history.empty")}
      description={t("v2MainCashbox.history.emptyDescription")}
    />
  );

  const historyCard = (
    <Card
      ref={historyCardRef}
      padding="none"
      title={t("v2MainCashbox.history.title")}
      description={historyDescription}
      actions={
        <div className="flex flex-wrap items-center gap-2 max-md:hidden">
          {dateFilter("w-[260px]")}
          {clearButton}
        </div>
      }
      footer={
        historyRows.length > 0 && !historyIsError ? (
          <Pagination
            page={currentPage}
            pageSize={historyPageSize}
            total={historyRows.length}
            onPageChange={(next) => {
              setHistoryPage(next);
              scrollShellContentToTop(historyCardRef.current);
            }}
            onPageSizeChange={(size) => {
              setHistoryPageSize(size);
              setHistoryPage(1);
              scrollShellContentToTop(historyCardRef.current);
            }}
            pageSizeOptions={HISTORY_PAGE_SIZES}
            summary={(range) => t("v2Common.paginationOperations", range)}
            className="w-full"
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 md:hidden">
        {dateFilter("w-full")}
        {clearButton ? <div>{clearButton}</div> : null}
      </div>
      {historyFetching && historyRows.length > 0 ? (
        <div role="status" className="flex items-center gap-2 border-b border-border bg-sunken px-5 py-2 max-md:px-4">
          <span
            aria-hidden="true"
            className="size-3.5 animate-spin rounded-full border-2 border-border-strong border-t-transparent motion-reduce:animate-none"
          />
          <span className="text-xs text-text-muted">{t("v2MainCashbox.history.updating")}</span>
        </div>
      ) : null}
      <QueryBoundary
        query={{
          data: historyQuery.data ? pageRows : undefined,
          isLoading: historyLoading,
          isError: historyIsError,
          error: historyQuery.error,
          refetch: historyQuery.refetch,
          isFetching: historyFetching,
        }}
        loadingLabel={t("v2MainCashbox.history.loading")}
        loading={
          <SkeletonTable
            framed={false}
            rows={8}
            columns={[
              t("v2MainCashbox.history.columns.date"),
              t("v2MainCashbox.history.columns.createdBy"),
              t("v2MainCashbox.history.columns.source"),
              t("v2MainCashbox.history.columns.operation"),
              t("v2MainCashbox.history.columns.amount"),
            ]}
          />
        }
        empty={historyEmpty}
        error={(queryError, retry) => (
          <ErrorState error={queryError} title={t("v2MainCashbox.history.loadError")} onRetry={retry} />
        )}
      >
        {(rows, { isRefetching }) => (
          <DataTable
            rows={rows}
            columns={historyColumns}
            getRowKey={(row, index) => String(row.id ?? index)}
            label={t("v2MainCashbox.history.label")}
            cardsLabel={t("v2MainCashbox.history.cardsLabel")}
            onRowClick={(row) => setSelectedRow(row)}
            renderCard={renderHistoryCard}
            busy={isRefetching}
          />
        )}
      </QueryBoundary>
    </Card>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const manualFormProps = {
    sourceTypes: [
      { id: "cash", name: t("v2MainCashbox.form.cash") },
      { id: "click", name: t("v2MainCashbox.form.card") },
    ],
    typeLabel: t("v2MainCashbox.form.paymentType"),
    typeRequiredMessage: t("v2MainCashbox.form.typeRequired"),
    requireType: true,
    requireComment: true,
  };
  const confirmCashboxLabel = isManagerRole && ownBranchName ? ownBranchName : t("v2MainCashbox.confirm.mainCashbox");
  // Smena oynalari: «Asosiy kassa» / «Urgut filiali kassasi»; karta yorlig'i — asosiy kassada «Karta (Click)».
  const shiftCashboxLabel = isManagerRole
    ? ownBranchName
      ? t("v2MainCashbox.shift.branchCashbox", { branch: ownBranchName })
      : t("v2MainCashbox.shift.branchCashboxFallback")
    : t("v2MainCashbox.shift.mainCashbox");
  const shiftCardLabel = isManagerRole ? t("v2MainCashbox.shift.card") : t("v2MainCashbox.shift.cardClick");

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back={() => navigate(-1)}
        backLabel={t("v2MainCashbox.back")}
        title={t("v2MainCashbox.title")}
        description={headerDescription}
        actions={
          <>
            <Button variant="secondary" leftIcon={Download} onClick={handleExportExcel}>
              {t("v2MainCashbox.exportExcel")}
            </Button>
            {shiftAction}
          </>
        }
      />

      {isShiftLocked ? (
        <ShiftBanner
          description={t(isManagerRole ? "v2MainCashbox.shift.banner.branch" : "v2MainCashbox.shift.banner.main")}
        />
      ) : null}

      <div className={cx("grid gap-4", isManagerRole ? "lg:grid-cols-2" : "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}>
        {balanceCard}
        {actionsCard}
      </div>

      {periodCards}
      {mobilePeriodCard}
      {isManagerRole ? (
        <BalanceTrendCard cashboxLabel={t("v2Overview.mainCashbox")} hidden={!balanceVisible} />
      ) : null}
      {sourcesCard}
      {historyCard}

      {/* ════ Oynalar ════ */}

      <SettlementPickerDialog
        kind={pickerKind}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
        total={pickerKind === "receive" ? receiveTotal : undefined}
        branchName={ownBranchName}
      />

      <CashboxFormPopup
        isOpen={isSpendPopupOpen}
        onClose={() => setIsSpendPopupOpen(false)}
        variant="spend"
        title={t("v2MainCashbox.form.spendTitle")}
        description={t("v2MainCashbox.form.spendSubtitle")}
        submitLabel={t("v2MainCashbox.form.spendSubmit")}
        commentPlaceholder={t("v2MainCashbox.form.spendPlaceholder")}
        confirm={{ title: t("v2MainCashbox.confirm.spendTitle"), cashboxLabel: confirmCashboxLabel }}
        isLoading={cashboxSpand.isPending}
        onSubmit={handleSpend}
        {...manualFormProps}
        // Xarajat kategoriya orqali (majburiy, oynaning o'zida) — izoh ixtiyoriy (ega 2026-10-22).
        requireComment={false}
        categoryRequiredMessage={t("v2MainCashbox.form.categoryRequired")}
        // Faol kategoriya yo'q — superadminga Ops → «Xarajat kategoriyalari» havolasi (sozlama o'sha yerda).
        manageCategoriesTo={canManageCategories ? opsTabPath(EXPENSE_CATEGORIES_TAB) : undefined}
      />

      <CashboxFormPopup
        isOpen={isRefillPopupOpen}
        onClose={() => setIsRefillPopupOpen(false)}
        variant="fill"
        title={t("v2MainCashbox.form.fillTitle")}
        description={t("v2MainCashbox.form.fillSubtitle")}
        submitLabel={t("v2MainCashbox.form.fillSubmit")}
        commentPlaceholder={t("v2MainCashbox.form.fillPlaceholder")}
        commentRequiredMessage={t("v2MainCashbox.form.fillCommentRequired")}
        confirm={{ title: t("v2MainCashbox.confirm.fillTitle"), cashboxLabel: confirmCashboxLabel }}
        isLoading={cashboxFill.isPending}
        onSubmit={handleRefill}
        {...manualFormProps}
      />

      <OpenShiftDialog
        open={isOpenShiftDialogOpen}
        onClose={() => setIsOpenShiftDialogOpen(false)}
        onSubmit={handleOpenShift}
        isLoading={openShift.isPending}
        openerName={currentUserName}
        cashboxLabel={shiftCashboxLabel}
        cash={balanceKnown ? cashBalance : null}
        card={balanceKnown ? transferBalance : null}
        cardLabel={shiftCardLabel}
      />

      <CloseShiftPopup
        isOpen={Boolean(closingShiftId)}
        onClose={() => setClosingShiftId(null)}
        isLoading={closeShift.isPending}
        onConfirm={handleCloseShift}
        openedAt={openShiftOpenedAt}
        openedByName={shiftState.openedByName}
        expectedCash={balanceKnown ? cashBalance : null}
        expectedCard={balanceKnown ? transferBalance : null}
        shiftId={closingShiftId}
      />

      <ShiftResultDialog
        open={isShiftResultOpen && Boolean(shiftResult)}
        onClose={() => setIsShiftResultOpen(false)}
        shift={shiftResult?.shift ?? null}
        openedByName={shiftResult?.openedByName}
        reportHref={shiftResult?.reportHref ?? null}
        closedByName={currentUserName}
        cashboxLabel={shiftCashboxLabel}
        cardLabel={shiftCardLabel}
        onExport={handleExportExcel}
      />

      <FinanceHistoryDetailPopup row={selectedRow} onClose={() => setSelectedRow(null)} />

      {/* «Maosh to'lash» yashirin (UNAVAILABLE_ACTIONS) — oqim o'chirilmagan, endpoint paydo bo'lguncha yetib bo'lmaydi. */}
      <PopupSelect
        isOpen={isSalaryPopupOpen}
        onClose={() => setIsSalaryPopupOpen(false)}
        data={employees}
        title={t("selectEmployee")}
        description={t("forSalaryPayment")}
        keyExtractor={(emp) => emp.id}
        searchKeys={["name"]}
        labelKey="name"
        secondaryLabelKey="role"
        onSelect={(employee) => {
          setSelectedSalaryEmployee(employee);
          setIsSalaryPopupOpen(false);
        }}
        immediateSelection
        placeholder={t("searchPlaceholder")}
        selectLabel={t("selectLabel")}
        cancelLabel={t("cancelShort")}
      />

      <SalaryPaymentPopup
        employee={selectedSalaryEmployee}
        isOpen={Boolean(selectedSalaryEmployee)}
        onClose={() => setSelectedSalaryEmployee(null)}
        cardSources={salaryCardSources}
      />
    </div>
  );
};

export default memo(MainCashbox);

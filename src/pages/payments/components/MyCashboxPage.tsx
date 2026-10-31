// dizayn-v2: market-cashbox-my, courier-cashbox-my-all, courier-cashbox-my-transfers, courier-cashbox-my-transfers-ack
// Menejer varianti: maket yo'q — eng yaqini market-cashbox-my (route-map roleNotes; «(maket yo'q) market-cashbox-my»).
import { memo, useCallback, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Eye,
  EyeOff,
  Inbox,
  Info,
  Landmark,
  MessageSquare,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { useCashBox } from "../../../entities/payments";
import { toDailyRange, useFinanceHistoryDaily } from "../../../entities/payments/financeDaily";
import { cx } from "../../../shared/lib/cx";
import { toISODate } from "../../../shared/lib/dateRange";
import { formatDateTimeLocalized, toValidDate } from "../../../shared/lib/formatDateTime";
import {
  CURRENCY_LABEL,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatSignedMoneyLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
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
  Skeleton,
  SkeletonLines,
  SkeletonTable,
  Tabs,
  type DataTableColumn,
  type DataTableSort,
} from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import { ViewToggle, type ChartView } from "../../../shared/ui/charts";
import { formatRangeShort } from "../../../shared/ui/primitives/date/calendarMath";
import { readBranchName, readDisplayName } from "../../../widgets/header/model/userIdentity";
import FinanceHistoryDetailPopup from "./FinanceHistoryDetailPopup";
import type { PaymentHistoryActor, PaymentRow } from "./patmentHistoryTable";
import { getPaymentActorName } from "./paymentHistoryActor";
import {
  getPaymentMethodLabel,
  getPaymentSourceTitle,
  getViewerOperationType,
  isOrderLinkedSource,
} from "./paymentSourceType";
import { paymentAckAudienceOf, paymentAckKeys, toPaymentAck } from "./paymentAck";
import { PaymentAckBadge } from "./PaymentAckBadge";
import ExpenseCategoryBadge from "./ExpenseCategoryBadge";
import { getExpenseCategoryName } from "./lib/expenseCategory";
import {
  ClosingSpark,
  MyBalanceDelta,
  MyBalanceTrend,
  MyCashFlow,
  isDailyAvailable,
  type DailyQueryState,
} from "./MyCashboxDaily";

/**
 * O'Z KASSAM — `/cash-box` (dizayn v2): market («To'lovlar»), kuryer («Kassa») va menejer (filial kassasi).
 *
 * Maketlar: `market-cashbox-my`, `courier-cashbox-my-all` / `courier-cashbox-my-transfers`; tafsilot oynasi —
 * `FinanceHistoryDetailPopup` (`market-cashbox-history-detail-dialog`, `courier-cashbox-history-detail`).
 * Menejerga maket yo'q — eng yaqini `market-cashbox-my` (ayni tuzilma, matnlari «Filial kassasi»).
 *
 * Tuzilma: sarlavha + sana oralig'i (bo'sh — «Barchasi»); «Umumiy balans» kartasi (balans + ko'z, izoh, «Kassa
 * egasi» / «Qarshi tomon» | «Kassa turi», «Bugun» kirim/chiqim chiziqlari); «Operatsiyalar tarixi» — tablar
 * «Barchasi» / «To'lov o'tkazmalari» (`sourceTypes`), jadval (telefonda kartalar), mijoz tomonida 10 tadan
 * sahifalash, qatordan tafsilot. Balans chizig'i, «kechaga nisbatan» / «davr boshiga nisbatan», «Kassa oqimi» / «Davr
 * oqimi» — `GET finance/history/daily` (qzjTMWPb, `MyCashboxDaily.tsx`); kuryerda chiziq telefonda yashirin (maket).
 * «Filialga topshirildi» grafigi («Taklif») API'da yo'q — chizilmaydi.
 *
 * Ma'lumot: `GET finance/cashbox/my-cashbox` — `{ cashbox, cashboxHistory }`; sana `YYYY-MM-DD` (backend Toshkent
 * kuni deb oladi, C2 / CODE-22). «Bugun» bloki filtrga bog'liq emas: asosiy so'rov bugunni to'liq qamrasa (tab
 * «Barchasi», oraliq bugunni o'z ichiga oladi) — o'sha javob, aks holda bugungi kun so'rovi (bir xil kalit —
 * React Query bitta so'rov yuboradi).
 *
 * Yo'nalish ko'ruvchi nuqtai nazaridan (`getViewerOperationType`, ega qarori D2, 2026-10-17): marketning o'z
 * kassasida HQ → market o'tkazmasi (`market_payment`) — «Chiqim −» (market balansi = Elchining qarzi, to'lov uni
 * kamaytiradi; backend ham market kassasiga `expense` yozadi). Tafsilot oynasi ham shu yo'nalishni ko'rsatadi.
 */

type CashboxRole = "market" | "manager" | "courier";
type HistoryTab = "all" | "payments";
type Direction = "income" | "expense";

/** «To'lov o'tkazmalari» (Oldi-berdi) manbalari — backend `sourceTypes` (o'zgarmaydi). */
const PAYMENT_HISTORY_SOURCE_TYPES = "courier_payment,market_payment,branch_to_main";

const PAGE_SIZE = 10;
const MASK = "••••••";
const DEFAULT_SORT: DataTableSort = { key: "date", direction: "desc" };

const EXPECTED_CASHBOX_TYPE: Record<CashboxRole, string> = {
  market: "markets",
  manager: "branch",
  courier: "couriers",
};

const ROLE_ICON: Record<CashboxRole, LucideIcon> = {
  market: Store,
  manager: Landmark,
  courier: Truck,
};

const ROLE_CASHBOX_KEY: Record<CashboxRole, string> = {
  market: "v2Common.cashbox.market",
  manager: "v2Common.cashbox.branch",
  courier: "v2Common.cashbox.courier",
};

type CashboxResponse = {
  data?: {
    cashbox?: Record<string, unknown> | null;
    myCashbox?: Record<string, unknown> | null;
    cashboxHistory?: Record<string, unknown>[];
  };
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const text = String(value);
  return text ? text : undefined;
};

const getHistoryDate = (item: Record<string, unknown>) =>
  String(item["payment_date"] ?? item["createdAt"] ?? item["created_at"] ?? "");

const rowDate = (row: PaymentRow) => row.payment_date || row.createdAt || row.created_at || "";

const rowTime = (row: PaymentRow) => {
  const time = Date.parse(rowDate(row));
  return Number.isFinite(time) ? time : 0;
};

const asActor = (value: unknown): PaymentHistoryActor | null =>
  value && typeof value === "object" ? (value as PaymentHistoryActor) : null;

const getCashboxRecord = (response: CashboxResponse | undefined) =>
  response?.data?.cashbox ?? response?.data?.myCashbox ?? null;

/**
 * Javob qatorlari → `PaymentRow` (yangisi tepada). Boshqa kassa qatori tashlanadi (rol kassasi turi bo'yicha),
 * yo'nalish — ko'ruvchi nuqtai nazaridan (D2), summa — musbat (ishora yo'nalishda).
 */
const toPaymentRows = (response: CashboxResponse | undefined, role: CashboxRole): PaymentRow[] => {
  const cashbox = getCashboxRecord(response) as { id?: unknown; cashbox_type?: string } | null;
  const history = Array.isArray(response?.data?.cashboxHistory) ? response.data.cashboxHistory : [];
  const expectedType = EXPECTED_CASHBOX_TYPE[role];

  return [...history]
    .sort((left, right) => {
      const leftDate = Date.parse(getHistoryDate(left));
      const rightDate = Date.parse(getHistoryDate(right));
      return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
    })
    .filter((item) => {
      const rowCashbox = item["cashbox"] as { cashbox_type?: string } | undefined;
      const rowCashboxType = String(item["cashbox_type"] ?? rowCashbox?.cashbox_type ?? cashbox?.cashbox_type ?? "");
      return !rowCashboxType || rowCashboxType === expectedType;
    })
    .map((item, index): PaymentRow => {
      const amount = toNumber(item["amount"]);
      const sourceType = String(item["source_type"] ?? item["type"] ?? "");
      const operation =
        getViewerOperationType(
          { operation_type: toOptionalString(item["operation_type"]), source_type: sourceType },
          role,
        ) ?? (amount >= 0 ? "income" : "expense");
      const createdByUser = asActor(item["created_by_user"] ?? item["createdByUser"]);

      return {
        id: String(item["id"] ?? `${index}-${item["createdAt"] ?? item["payment_date"] ?? "row"}`),
        amount: Math.abs(amount),
        operation_type: operation,
        cashbox_id: toOptionalString(item["cashbox_id"]) ?? (cashbox?.id ? String(cashbox.id) : undefined),
        source_type: sourceType || undefined,
        source_id: toOptionalString(item["source_id"]),
        cashbox_type: toOptionalString(item["cashbox_type"]) ?? cashbox?.cashbox_type,
        created_by: toOptionalString(item["created_by"]),
        created_by_user: createdByUser,
        createdByUser,
        source_user: asActor(item["source_user"] ?? item["sourceUser"]),
        payment_method: toOptionalString(item["payment_method"] ?? item["method"]),
        payment_date:
          toOptionalString(item["payment_date"]) ??
          toOptionalString(item["createdAt"]) ??
          toOptionalString(item["created_at"]),
        comment: toOptionalString(item["comment"]),
        payment_ack: toPaymentAck(item["payment_ack"]),
        // Menejer (filial kassasi) qo'lda chiqimining xarajat kategoriyasi — Elchi Pochta №1.
        expense_category_id: toOptionalString(item["expense_category_id"]) ?? null,
        expense_category_name: toOptionalString(item["expense_category_name"]) ?? null,
        balance_after: item["balance_after"] === undefined || item["balance_after"] === null
          ? undefined
          : toNumber(item["balance_after"]),
        createdAt: item["createdAt"] as string | undefined,
        created_at: item["created_at"] as string | undefined,
        cashbox: item["cashbox"] as PaymentRow["cashbox"],
        user: null,
      };
    });
};

/** Mahalliy kalendar kuni (`formatDateTimeLocalized` dagi «Bugun» bilan bir xil qoida). */
const rowDay = (row: PaymentRow) => {
  const date = toValidDate(rowDate(row));
  return date ? toISODate(date) : "";
};

type TodayTotals = { income: number; expense: number };

const sumToday = (rows: PaymentRow[], today: string): TodayTotals =>
  rows.reduce<TodayTotals>(
    (acc, row) => {
      if (rowDay(row) !== today) return acc;
      const amount = Math.abs(toNumber(row.amount));
      if (row.operation_type === "income") acc.income += amount;
      else if (row.operation_type === "expense") acc.expense += amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );

/* ─── «Bugun» bloki: Kirim / Chiqim chiziqlari (maket `courier-cashbox-my-all`, telefon kartasi) ───────── */

const TodayBars = ({
  totals,
  unavailable = false,
  language,
}: {
  totals: TodayTotals | null;
  /** So'rov yiqildi va oldingi qiymat yo'q — summalar o'rnida «—» (0 deb ko'rsatilmaydi). */
  unavailable?: boolean;
  language: string;
}) => {
  const { t } = useTranslation("payments");

  if (!totals && unavailable) {
    return (
      <dl className="m-0 flex min-w-0 flex-col gap-2 text-[13px]">
        {(["income", "expense"] as const).map((key) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <dt className="text-text-muted">{t(`v2MyCashbox.balance.${key}`)}</dt>
            <dd className="m-0 font-semibold text-text-muted">—</dd>
          </div>
        ))}
      </dl>
    );
  }

  if (!totals) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        <Skeleton width="100%" height={8} />
        <Skeleton width="70%" height={8} />
      </div>
    );
  }

  const max = Math.max(totals.income, totals.expense, 1);
  const incomeText = formatSignedMoneyLocalized(totals.income, { language });
  const expenseText = formatSignedMoneyLocalized(-totals.expense, { language });
  const bars: Array<{ key: Direction; label: string; text: string; value: number; color: string; tone: string }> = [
    {
      key: "income",
      label: t("v2MyCashbox.balance.income"),
      text: incomeText,
      value: totals.income,
      color: "bg-chart-1",
      tone: "text-success-fg",
    },
    {
      key: "expense",
      label: t("v2MyCashbox.balance.expense"),
      text: expenseText,
      value: totals.expense,
      color: "bg-chart-8",
      tone: "text-danger-fg",
    },
  ];

  return (
    <div
      role="img"
      aria-label={t("v2MyCashbox.balance.todayLabel", { income: incomeText, expense: expenseText })}
      className="flex min-w-0 flex-col gap-3"
    >
      {bars.map((bar) => (
        <div key={bar.key} className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 whitespace-nowrap text-[13px] text-text-muted">
              <span aria-hidden="true" className={cx("size-2.5 shrink-0 rounded-[3px]", bar.color)} />
              {bar.label}
            </span>
            {/* Nol summa ishorasiz («0 so'm») — rangsiz: rang faqat yo'nalish bor bo'lsa. */}
            <span className={cx("whitespace-nowrap text-sm font-semibold", bar.value > 0 ? bar.tone : "text-text")}>
              {bar.text}
            </span>
          </div>
          <span
            aria-hidden="true"
            className={cx("block h-2 rounded-full", bar.color)}
            style={{ width: `max(${(bar.value / max) * 100}%, 4px)` }}
          />
        </div>
      ))}
    </div>
  );
};

/* ─── «Umumiy balans» kartasi ───────────────────────────────────────────────────────────────────────── */

type BalanceCardProps = {
  role: CashboxRole;
  balance: number;
  ownerName: string;
  today: TodayTotals | null;
  todayUnavailable: boolean;
  language: string;
  daily: DailyQueryState;
  /** Tarix qatorlari — sharshara manbalari uchun. */
  rows: readonly PaymentRow[];
};

const BalanceCard = ({ role, balance, ownerName, today, todayUnavailable, language, daily, rows }: BalanceCardProps) => {
  const { t } = useTranslation("payments");
  const [visible, setVisible] = useState(true);
  const [view, setView] = useState<ChartView>("chart");
  const dailyAvailable = isDailyAvailable(daily);
  const dailyRange = daily.data ? formatRangeShort({ from: daily.data.from, to: daily.data.to }) : null;
  const titleId = useId();
  const todayId = useId();
  const OwnerIcon = ROLE_ICON[role];
  const currency = CURRENCY_LABEL[resolveMoneyLanguage(language)];
  const note = role === "manager" ? null : t(`v2MyCashbox.balance.note.${role}`);

  return (
    <Card as="section" padding="none" aria-labelledby={titleId}>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(280px,360px)] max-lg:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-4 p-5 max-md:gap-3.5 max-md:p-4">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
              <h2 id={titleId} className="text-base font-bold text-text">
                {t("v2MyCashbox.balance.title")}
              </h2>
              <p className="text-[13px] text-text-muted">
                {t(`v2MyCashbox.balance.hint.${role}`)}
                {dailyRange ? ` · ${t("v2Daily.my.balanceChart", { range: dailyRange })}` : ""}
              </p>
            </div>
            {dailyAvailable && daily.data ? (
              <span className={role === "courier" ? "max-md:hidden" : undefined}>
                <ViewToggle value={view} onChange={setView} ariaLabel={t("v2Daily.my.viewLabel")} />
              </span>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <span
              data-balance-value=""
              className="whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] text-text proportional-nums max-md:text-[22px] max-md:leading-[30px]"
            >
              {visible ? (
                <>
                  {formatMoneyLocalized(balance, { language, withCurrency: false })}
                  <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted max-md:text-[13px]">
                    {currency}
                  </span>
                </>
              ) : (
                <>
                  <span aria-hidden="true">{MASK}</span>
                  <span className="sr-only">{t("v2MyCashbox.balance.hidden")}</span>
                </>
              )}
            </span>
            <IconButton
              size="sm"
              variant="secondary"
              icon={visible ? Eye : EyeOff}
              label={t(visible ? "v2MyCashbox.balance.hide" : "v2MyCashbox.balance.show")}
              aria-pressed={!visible}
              onClick={() => setVisible((value) => !value)}
            />
          </div>

          <MyBalanceDelta query={daily} role={role} hidden={!visible} language={language} />

          <div className={role === "courier" ? "min-w-0 max-md:hidden" : "min-w-0"}>
            <MyBalanceTrend query={daily} view={view} hidden={!visible} />
          </div>

          {/* Kuryer telefonda grafik o'rnida — chiziq (maket `courier-cashbox-my-all`, «kechaga nisbatan» ostida). */}
          {role === "courier" && visible && !daily.isError && daily.data ? (
            <ClosingSpark
              days={daily.data.days}
              name={t("v2MyCashbox.balance.title")}
              caption={t("v2Daily.sparkCaption")}
              language={language}
              className="md:hidden"
            />
          ) : null}

          {note ? (
            <p className="flex items-start gap-2 text-xs text-text-subtle">
              <Info aria-hidden="true" size={16} className="mt-px shrink-0" />
              <span>{note}</span>
            </p>
          ) : null}

          <dl className="m-0 grid grid-cols-[minmax(110px,40%)_minmax(0,1fr)] gap-x-4 gap-y-2.5 rounded-xl bg-sunken px-4 py-3 text-sm">
            <dt className="text-text-muted">{t("v2MyCashbox.balance.owner")}</dt>
            <dd className="m-0 flex min-w-0 items-center gap-2 font-semibold text-text">
              <OwnerIcon aria-hidden="true" size={16} className="shrink-0 text-text-muted" />
              <span className="min-w-0 break-words">{ownerName}</span>
            </dd>
            {role === "market" ? (
              <>
                <dt className="text-text-muted">{t("v2MyCashbox.balance.counterparty")}</dt>
                <dd className="m-0 min-w-0 font-semibold text-text">{t("v2MyCashbox.balance.counterpartyHq")}</dd>
              </>
            ) : (
              <>
                <dt className="text-text-muted">{t("v2MyCashbox.balance.cashboxType")}</dt>
                <dd className="m-0 min-w-0 font-semibold text-text">{t(ROLE_CASHBOX_KEY[role])}</dd>
              </>
            )}
          </dl>
        </div>

        <section
          aria-labelledby={todayId}
          className="flex min-w-0 flex-col gap-3 border-l border-border p-5 max-lg:border-l-0 max-lg:border-t max-md:p-4"
        >
          <h3 id={todayId} className="text-sm font-semibold text-text">
            {t("v2MyCashbox.balance.today")}
          </h3>
          <TodayBars totals={today} unavailable={todayUnavailable} language={language} />
          <MyCashFlow query={daily} rows={rows} role={role} hidden={!visible} language={language} />
        </section>
      </div>
    </Card>
  );
};

/* ─── Sahifa ────────────────────────────────────────────────────────────────────────────────────────── */

const MyCashboxPage = () => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const roleState = useSelector((state: RootState) => state.role);
  const profile = useSelector((state: RootState) => state.user.user);
  const { useGetCashboxMyCashbox } = useCashBox();
  const isPhone = useIsPhone();

  const role: CashboxRole =
    roleState.role === "market" ? "market" : roleState.role === "manager" ? "manager" : "courier";
  const isCourier = role === "courier";

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [historyTab, setHistoryTab] = useState<HistoryTab>("all");
  const [sort, setSort] = useState<DataTableSort | null>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<PaymentRow | null>(null);
  // Sahifa almashganda tarix kartasining boshi ko'rinsin (D-03; karta balans kartasi ostida).
  const historyCardRef = useRef<HTMLElement>(null);
  const handlePageChange = (next: number) => {
    setPage(next);
    scrollShellContentToTop(historyCardRef.current);
  };

  // C2 / CODE-22: sana oddiy `YYYY-MM-DD` — backend uni Toshkent kuni
  // (00:00–23:59:59.999, +05:00) deb oladi. Ilgari `T00:00:00.000Z` (UTC)
  // qo'shilardi va Toshkent bo'yicha 00:00–05:00 dagi yozuv oldingi kunga tushardi.
  const params = useMemo(
    () => ({
      ...(dateFrom && { fromDate: dateFrom }),
      ...(dateTo && { toDate: dateTo }),
      ...(historyTab === "payments" && { sourceTypes: PAYMENT_HISTORY_SOURCE_TYPES }),
    }),
    [dateFrom, dateTo, historyTab],
  );

  // «Bugun» bloki: asosiy javob bugunni to'liq qamrasa — o'sha so'rov (kalit bir xil), aks holda bugungi kun.
  const today = toISODate(new Date());
  const coversToday = historyTab === "all" && (!dateFrom || dateFrom <= today) && (!dateTo || dateTo >= today);
  const todayParams = useMemo(
    () => (coversToday ? params : { fromDate: today, toDate: today }),
    [coversToday, params, today],
  );

  const historyQuery = useGetCashboxMyCashbox(params);
  const todayQuery = useGetCashboxMyCashbox(todayParams);

  // qzjTMWPb: balans chizig'i va oqimi. Sana tanlanmasa — kuryerda 8 kun (maket), boshqalarda 14 kun.
  const dailyParams = useMemo(() => {
    const range = toDailyRange({ from: dateFrom, to: dateTo }, isCourier ? 8 : 14);
    return { from_date: range.from, to_date: range.to };
  }, [dateFrom, dateTo, isCourier]);
  const dailyQuery = useFinanceHistoryDaily(dailyParams);

  const todayData = todayQuery.data as CashboxResponse | undefined;
  const todayTotals = useMemo(
    () => (todayData ? sumToday(toPaymentRows(todayData, role), today) : null),
    [role, today, todayData],
  );
  // Kalit almashganda (filtr) oldingi bugungi qiymat turadi — blok skeletga sakramaydi.
  const [lastToday, setLastToday] = useState<TodayTotals | null>(null);
  if (
    todayTotals &&
    (!lastToday || lastToday.income !== todayTotals.income || lastToday.expense !== todayTotals.expense)
  ) {
    setLastToday(todayTotals);
  }
  const shownToday = todayTotals ?? lastToday;

  const ownerName = useCallback(
    (response: CashboxResponse) => {
      const cashbox = getCashboxRecord(response) as { user?: { name?: string } | null } | null;
      const cashboxOwner = cashbox?.user?.name?.trim();
      if (role === "manager") return readBranchName(profile) ?? cashboxOwner ?? t(ROLE_CASHBOX_KEY.manager);
      return cashboxOwner || readDisplayName(profile, roleState.name) || t(ROLE_CASHBOX_KEY[role]);
    },
    [profile, role, roleState.name, t],
  );

  const changeTab = (next: HistoryTab) => {
    setHistoryTab(next);
    setPage(1);
  };
  const changeDates = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    setPage(1);
  };
  const changeSort = (next: DataTableSort | null) => {
    setSort(next);
    setPage(1);
  };

  /* ── Qator ko'rinishi ── */

  const dateText = useCallback(
    (row: PaymentRow) => {
      const value = rowDate(row);
      return value ? formatDateTimeLocalized(value, { language }) : "—";
    },
    [language],
  );
  const sourceTitle = useCallback(
    (row: PaymentRow) => getPaymentSourceTitle(row.source_type, t, { role, cashboxType: row.cashbox_type }),
    [role, t],
  );
  const orderId = (row: PaymentRow) =>
    isOrderLinkedSource(row.source_type) ? String(row.source_id ?? "").trim() : "";
  const methodText = useCallback((row: PaymentRow) => getPaymentMethodLabel(row.payment_method, t), [t]);
  /** Kuryer → filial o'tkazmasini qabul qilgan xodim (kuryer kassasi yozuvini yaratgan). */
  const receiverName = (row: PaymentRow) =>
    isCourier && row.source_type === "courier_payment"
      ? getPaymentActorName(row.created_by_user ?? row.createdByUser)
      : "";
  const direction = (row: PaymentRow): Direction | null =>
    row.operation_type === "income" || row.operation_type === "expense" ? row.operation_type : null;
  const signedAmount = (row: PaymentRow) => {
    const amount = Math.abs(toNumber(row.amount));
    return direction(row) === "expense" ? -amount : amount;
  };
  const amountText = (row: PaymentRow) => formatSignedMoneyLocalized(signedAmount(row), { language });
  const balanceText = (row: PaymentRow) =>
    row.balance_after === undefined ? "—" : formatMoneyLocalized(row.balance_after, { language });
  const isCorrection = (row: PaymentRow) => row.source_type === "cancel";

  const amountNode = (row: PaymentRow) => {
    const value = direction(row);
    return (
      <span
        className={cx(
          "whitespace-nowrap font-semibold",
          value === "income" ? "text-success-fg" : value === "expense" ? "text-danger-fg" : "text-text",
        )}
      >
        {amountText(row)}
      </span>
    );
  };

  const operationBadge = (row: PaymentRow) => {
    const value = direction(row);
    if (!value) return <span className="text-text-muted">—</span>;
    return (
      <Badge icon={value === "income" ? ArrowDownLeft : ArrowUpRight}>
        {t(value === "income" ? "v2Common.income" : "v2Common.expense")}
      </Badge>
    );
  };

  const correctionBadge = (row: PaymentRow) =>
    isCorrection(row) ? (
      <Badge variant="outline">
        {t("v2MyCashbox.history.correction")}
      </Badge>
    ) : null;

  /**
   * Kuryer kvitansiyasi javobi (2crjWf7v): faqat `courier_payment` qatorida, javob bo'lsa. Matn ko'ruvchiga qarab
   * (KI-S1): kuryer — o'z javobi («Siz tasdiqlagansiz» / «Siz: noto'g'ri», maket `courier-cashbox-my-transfers-ack`),
   * market va menejer — «Kuryer tasdiqladi» / «Kuryer: noto'g'ri». Balandligi «Tuzatish» bilan birga maketdagi
   * `.el-badge` — 24px (`md`).
   */
  const ackAudience = paymentAckAudienceOf(role);
  const ackBadge = (row: PaymentRow) => <PaymentAckBadge ack={row.payment_ack} audience={ackAudience} />;
  const categoryBadge = (row: PaymentRow) => {
    const category = getExpenseCategoryName(row);
    return category ? <ExpenseCategoryBadge name={category} /> : null;
  };
  const ackText = (row: PaymentRow) => {
    const keys = paymentAckKeys(row.payment_ack, ackAudience);
    return keys ? t(keys.label) : "";
  };

  const receivedByNode = (row: PaymentRow) => {
    const name = receiverName(row);
    if (!name) return null;
    return (
      <span>
        {t("v2MyCashbox.history.receivedBy")} <strong className="font-semibold text-text">{name}</strong>
      </span>
    );
  };

  /** «Manba» ostidagi qator: «Buyurtma №…» · «Qabul qildi: …» · izoh (maket). */
  const subParts = (row: PaymentRow) => {
    const parts: ReactNode[] = [];
    const id = orderId(row);
    if (id) parts.push(t("v2Common.orderNumber", { id }));
    const received = receivedByNode(row);
    if (received) parts.push(received);
    const comment = row.comment?.trim();
    if (comment) parts.push(comment);
    return parts;
  };

  const joinParts = (parts: ReactNode[]) =>
    parts.map((part, index) => (
      <span key={index}>
        {index > 0 ? " · " : null}
        {part}
      </span>
    ));

  const subPlainText = (row: PaymentRow) => {
    const id = orderId(row);
    const received = receiverName(row);
    // Telefon kartasining nomi (aria-label) belgilarni ham aytsin — «Tuzatish», kvitansiya javobi (2crjWf7v).
    // Kuryerda — kartadagi tartibda (maket `courier-cashbox-my-transfers-ack`): «Qabul qildi» → izoh → javob oxirida.
    const ack = ackText(row);
    const comment = row.comment?.trim() ?? "";
    return [
      isCorrection(row) ? t("v2MyCashbox.history.correction") : "",
      isCourier ? "" : ack,
      id ? t("v2Common.orderNumber", { id }) : "",
      received ? `${t("v2MyCashbox.history.receivedBy")} ${received}` : "",
      comment,
      isCourier ? ack : "",
    ]
      .filter(Boolean)
      .join(" · ");
  };

  const openTitle = (row: PaymentRow) => {
    const id = orderId(row);
    return id ? t("v2MyCashbox.history.openTitleWithOrder", { title: sourceTitle(row), id }) : sourceTitle(row);
  };
  const openLabel = (row: PaymentRow) => t("v2Common.openDetail", { title: openTitle(row), date: dateText(row) });

  const cardLabel = (row: PaymentRow) => {
    const sub = subPlainText(row);
    const value = direction(row);
    const category = getExpenseCategoryName(row);
    const title = category ? `${sourceTitle(row)} · ${category}` : sourceTitle(row);
    return t("v2MyCashbox.history.cardLabel", {
      title: sub ? `${title} (${sub})` : title,
      method: methodText(row),
      direction: value ? t(value === "income" ? "v2Common.income" : "v2Common.expense") : "",
      amount: amountText(row),
      balance: balanceText(row),
      date: dateText(row),
    });
  };

  const columns: DataTableColumn<PaymentRow>[] = [
    {
      id: "date",
      header: t("v2MyCashbox.history.columns.date"),
      sortable: true,
      firstDirection: "desc",
      sortTitle: t("v2MyCashbox.history.sortDate"),
      cell: (row) => (
        <>
          <div className="whitespace-nowrap">{dateText(row)}</div>
          {/* Planshetda «To'lov turi» ustuni yashirin: kuryer maketida sana ostida, market maketida «Manba» ostida. */}
          {isCourier ? (
            <div className="hidden whitespace-nowrap text-[13px] text-text-muted max-lg:block">{methodText(row)}</div>
          ) : null}
        </>
      ),
    },
    {
      id: "source",
      header: t(isCourier ? "v2MyCashbox.history.columns.operation" : "v2MyCashbox.history.columns.source"),
      cell: (row) => {
        const parts = subParts(row);
        return (
          <>
            <span className="inline-flex flex-wrap items-center gap-2">
              <Pressable
                aria-haspopup="dialog"
                onClick={() => setSelectedRow(row)}
                className="text-left font-semibold text-text hover:text-action-fg hover:underline"
              >
                {sourceTitle(row)}
              </Pressable>
              {categoryBadge(row)}
              {correctionBadge(row)}
              {ackBadge(row)}
            </span>
            {parts.length ? (
              <div className="text-[13px] text-text-muted [overflow-wrap:anywhere]">
                {joinParts(parts)}
                {isCourier ? null : <span className="hidden max-lg:inline">{` · ${methodText(row)}`}</span>}
              </div>
            ) : isCourier ? null : (
              <div className="hidden text-[13px] text-text-muted max-lg:block">{methodText(row)}</div>
            )}
          </>
        );
      },
    },
    {
      id: "method",
      header: t("v2MyCashbox.history.columns.paymentType"),
      hideBelow: "lg",
      className: "whitespace-nowrap",
      cell: (row) => methodText(row),
    },
    {
      id: "operation",
      header: t(isCourier ? "v2MyCashbox.history.columns.type" : "v2MyCashbox.history.columns.operation"),
      hideBelow: "lg",
      cell: operationBadge,
    },
    {
      id: "amount",
      header: t("v2MyCashbox.history.columns.amount"),
      align: "end",
      sortable: true,
      firstDirection: "desc",
      sortTitle: t("v2MyCashbox.history.sortAmount"),
      cell: amountNode,
    },
    {
      id: "balance",
      header: t("v2MyCashbox.history.columns.balance"),
      align: "end",
      cell: (row) => <span className="whitespace-nowrap text-text-muted">{balanceText(row)}</span>,
    },
    {
      id: "detail",
      header: <span className="sr-only">{t("v2MyCashbox.history.columns.detail")}</span>,
      className: "w-14",
      cellClassName: "text-right",
      cell: (row) => (
        <IconButton
          size="sm"
          variant="ghost"
          icon={ChevronRight}
          label={openLabel(row)}
          aria-haspopup="dialog"
          onClick={() => setSelectedRow(row)}
          className="text-text-muted"
        />
      ),
    },
  ];

  // Telefon kartasi. Kuryer (maket `courier-cashbox-my-*`): «Sotuv · №…» + summa / «to'lov turi · sana» +
  // «Balans: …» / «Tuzatish», «Qabul qildi: …», izoh, kvitansiya javobi (oxirida). Market va menejer (`market-cashbox-my`): sarlavha (+ badge)
  // + summa / «Buyurtma №… · izoh · to'lov turi» / sana + «Balans: …».
  const renderCard = (row: PaymentRow) => {
    const id = orderId(row);
    const balanceLine = (
      <span className="whitespace-nowrap text-xs text-text-muted">
        {t("v2MyCashbox.history.balanceAfter", { amount: balanceText(row) })}
      </span>
    );
    const body = isCourier ? (
      <>
        <span className="flex w-full min-w-0 items-baseline justify-between gap-3">
          <span className="min-w-0 font-semibold">
            {id ? t("v2MyCashbox.history.titleWithOrder", { title: sourceTitle(row), id }) : sourceTitle(row)}
          </span>
          {amountNode(row)}
        </span>
        <span className="flex w-full min-w-0 items-baseline justify-between gap-3">
          <span className="min-w-0 text-[13px] text-text-muted">
            {methodText(row)} · <span className="whitespace-nowrap">{dateText(row)}</span>
          </span>
          {balanceLine}
        </span>
        {isCorrection(row) || row.payment_ack || receiverName(row) || row.comment?.trim() ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-muted">
            {correctionBadge(row)}
            {receivedByNode(row)}
            {row.comment?.trim() ? (
              <span className="inline-flex min-w-0 items-center gap-1.5 [overflow-wrap:anywhere]">
                <span className="sr-only">{t("v2MyCashbox.history.comment")} </span>
                <MessageSquare aria-hidden="true" size={14} className="shrink-0" />
                {row.comment.trim()}
              </span>
            ) : null}
            {/* Kvitansiya javobi — oxirida (maket `courier-cashbox-my-transfers-ack`: «Qabul qildi» → izoh → belgi). */}
            {ackBadge(row)}
          </span>
        ) : null}
      </>
    ) : (
      <>
        <span className="flex w-full min-w-0 items-start justify-between gap-2">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-semibold">{sourceTitle(row)}</span>
            {categoryBadge(row)}
            {correctionBadge(row)}
            {ackBadge(row)}
          </span>
          {amountNode(row)}
        </span>
        <span className="text-[13px] text-text-muted [overflow-wrap:anywhere]">
          {joinParts([...subParts(row), methodText(row)])}
        </span>
        <span className="flex w-full min-w-0 items-center justify-between gap-3">
          <span className="whitespace-nowrap text-[13px] text-text-muted">{dateText(row)}</span>
          {balanceLine}
        </span>
      </>
    );
    return (
      <Pressable
        aria-haspopup="dialog"
        aria-label={cardLabel(row)}
        onClick={() => setSelectedRow(row)}
        className="flex min-h-14 w-full flex-col gap-1 px-4 py-3 text-left text-sm text-text hover:bg-row-hover"
      >
        {body}
      </Pressable>
    );
  };

  const sortRows = (rows: PaymentRow[]) => {
    if (!sort) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    const value = sort.key === "amount" ? signedAmount : rowTime;
    return [...rows].sort((left, right) => (value(left) - value(right)) * factor);
  };

  /* ── Holatlar ── */

  const loadingSkeleton = (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <Card padding="lg">
        <SkeletonLines lines={4} />
      </Card>
      <Card padding="none">
        <SkeletonTable
          framed={false}
          rows={6}
          columns={[
            t("v2MyCashbox.history.columns.date"),
            t("v2MyCashbox.history.columns.source"),
            t("v2MyCashbox.history.columns.amount"),
            t("v2MyCashbox.history.columns.balance"),
          ]}
        />
      </Card>
    </div>
  );

  const hasDateFilter = Boolean(dateFrom || dateTo);
  const emptyState = (
    <EmptyState
      icon={Inbox}
      title={t("v2MyCashbox.history.empty")}
      description={t(
        hasDateFilter
          ? "v2MyCashbox.history.filteredEmptyDescription"
          : historyTab === "payments"
            ? "v2MyCashbox.history.transfersEmptyDescription"
            : "v2MyCashbox.history.emptyDescription",
      )}
      action={
        hasDateFilter ? (
          <Button variant="secondary" onClick={() => changeDates("", "")}>
            {t("v2MyCashbox.history.clearDates")}
          </Button>
        ) : undefined
      }
    />
  );

  const historyFooter = (total: number, currentPage: number) => {
    if (total <= 0) return undefined;
    const formatted = formatNumberLocalized(total, { language });
    if (total <= PAGE_SIZE) {
      return (
        <span className="text-[13px] text-text-muted tabular-nums">
          {t(
            historyTab === "payments" ? "v2MyCashbox.history.totalTransfers" : "v2MyCashbox.history.totalOperations",
            { total: formatted },
          )}
        </span>
      );
    }
    return (
      <Pagination
        page={currentPage}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={handlePageChange}
        summary={(range) =>
          t(
            historyTab === "payments" ? "v2MyCashbox.history.paginationTransfers" : "v2Common.paginationOperations",
            range,
          )
        }
      />
    );
  };

  const historyQueryLike = {
    data: historyQuery.data as CashboxResponse | undefined,
    isLoading: historyQuery.isLoading,
    isFetching: historyQuery.isFetching,
    isError: historyQuery.isError,
    error: historyQuery.error,
    refetch: historyQuery.refetch,
  };

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t(`v2MyCashbox.title.${role}`)}
        description={t(`v2MyCashbox.subtitle.${role}`)}
        // Kuryer telefon maketida izoh yo'q (`el-hide-mobile`).
        className={isCourier ? "max-md:[&_p]:hidden" : undefined}
        actions={
          <DateRange
            value={{ from: dateFrom, to: dateTo }}
            onChange={({ from, to }) => changeDates(from, to)}
            placeholder={t("v2MyCashbox.dateAll")}
            className="w-[260px] max-md:w-full"
            triggerClassName="whitespace-nowrap"
          />
        }
      />

      <QueryBoundary
        query={historyQueryLike}
        isEmpty={() => false}
        loading={loadingSkeleton}
        loadingLabel={t("v2MyCashbox.loading")}
        error={(queryError, retry) => (
          <ErrorState framed error={queryError} title={t("v2MyCashbox.loadError")} onRetry={retry} />
        )}
        className="flex min-w-0 flex-col gap-6 max-md:gap-4"
      >
        {(response, { isRefetching }) => {
          const rows = sortRows(toPaymentRows(response, role));
          const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
          const currentPage = Math.min(page, totalPages);
          const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
          const balance = toNumber((getCashboxRecord(response) as { balance?: unknown } | null)?.balance);

          return (
            <>
              <BalanceCard
                role={role}
                balance={balance}
                ownerName={ownerName(response)}
                today={shownToday}
                todayUnavailable={todayQuery.isError}
                language={language}
                daily={dailyQuery}
                rows={rows}
              />

              <Card
                ref={historyCardRef}
                as="section"
                padding="none"
                title={t("v2MyCashbox.history.title")}
                description={
                  <span className={isCourier ? "max-md:hidden" : undefined}>
                    {t(isCourier ? "v2MyCashbox.history.subtitleCourier" : "v2MyCashbox.history.subtitle")}
                  </span>
                }
                footer={historyFooter(rows.length, currentPage)}
              >
                <Tabs<HistoryTab>
                  items={[
                    { value: "all", label: t("v2MyCashbox.history.all") },
                    { value: "payments", label: t("v2MyCashbox.history.transfers") },
                  ]}
                  value={historyTab}
                  onValueChange={changeTab}
                  ariaLabel={t("v2MyCashbox.history.tabs")}
                  fullWidth={isPhone}
                  listClassName="px-3 max-md:px-2"
                />
                {rows.length === 0 ? (
                  emptyState
                ) : (
                  <DataTable
                    rows={pageRows}
                    columns={columns}
                    getRowKey={(row, index) => String(row.id ?? index)}
                    label={t("v2MyCashbox.history.label")}
                    cardsLabel={t("v2MyCashbox.history.cardsLabel")}
                    sort={sort}
                    onSortChange={changeSort}
                    onRowClick={(row) => setSelectedRow(row)}
                    renderCard={renderCard}
                    busy={isRefetching}
                  />
                )}
              </Card>
            </>
          );
        }}
      </QueryBoundary>

      <FinanceHistoryDetailPopup
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        hideCashboxType={isCourier}
      />
    </div>
  );
};

export default memo(MyCashboxPage);

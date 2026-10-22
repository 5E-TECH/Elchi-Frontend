// dizayn-v2: superadmin-payments-overview, admin-payments-overview, manager-payments-overview
import { memo, useMemo, type ReactNode } from "react";
import { Building2, ChevronRight, CircleAlert, Info, Store, Truck, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { normalizeCashboxShift, useCashBox } from "../../../entities/payments";
import { cx } from "../../../shared/lib/cx";
import { getTodayRange } from "../../../shared/lib/dateRange";
import {
  CURRENCY_LABEL,
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Pressable,
  Skeleton,
  StatCard,
} from "../../../shared/ui/primitives";
import type { ReceiveOption } from "./lib/receiveOptions";

/**
 * TO'LOVLAR — KO'RSATKICHLAR (dizayn v2, maketlar `*-payments-overview`).
 *
 * Tartib maketdagidek: «Kassadagi summa» (→ asosiy kassa) · «Qabul qilinishi kerak» (→ qabul oynasi) ·
 * «Berilishi kerak» (superadmin/admin — market oynasi; menejer — HQ'ga o'tkazish sahifasi).
 *  - superadmin/admin: qiymatlar ixcham («24,6 mln so'm»); 1-kartada smena holati va naqd/karta chizig'i,
 *    2-kartada filiallar / HQ kuryerlari chizig'i (all-info); 3-karta — faqat summa (top marketlar «Taklif»
 *    emas, lekin sahifa ochilishida to'liq ro'yxat so'ralmaydi — spec §7).
 *  - menejer: qiymatlar to'liq; 2-kartada kuryerlar soni va ulush chizig'i (top-2 + «Boshqa»), 3-kartada
 *    kassaga nisbat (o'lchagich) va «Kassada qoladi» + «Yetarli» / «Yetarli emas». Telefonda — bitta «Kassa
 *    xulosasi» kartasi (maket `el-show-mobile`). Delta «kechaga nisbatan» va sparkline chizilmaydi (API yo'q).
 * Yuklanishda qiymat o'rnida skelet; xato — sahifa ishlayveradi (qiymat 0, avvalgidek jim).
 *
 * `CourierMoneyCard` — menejerning «Kuryerlardagi pul» reytingi.
 */

type CardAction = "given" | "received" | null;

type PaymentSummaryCardsProps = {
  isManagerRole: boolean;
  marketTotal: number;
  mainTotal: number;
  courierTotal: number;
  loading: boolean;
  /** `path` — asosiy kassa; `action` — qabul / berish oynasi (yoki menejerda HQ'ga o'tkazish). */
  onCardClick: (path: string | null, action: CardAction) => void;
  /** Superadmin/admin: filial menejerlaridan / HQ kuryerlaridan (all-info). */
  receiveSplit?: { branches: number; hqCouriers: number } | null;
  /** Menejer: o'z filiali kuryerlari (`useReceiveOptions`). */
  couriers?: readonly ReceiveOption[];
  couriersLoading?: boolean;
  /** Menejer: HQ filiali nomi («Toshkent HQ'ga …»); noma'lum — «HQ'ga …». */
  hqName?: string | null;
};

/** «Bekzod Normurodov» → «Bekzod N.» (maket legendasi). */
const shortPersonName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name.trim();
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
};

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

/** Musbat qoldiqli kuryerlar (kamayish tartibida) va ulushlar. */
const courierShares = (couriers: readonly ReceiveOption[]) => {
  const positive = couriers.filter((courier) => courier.amount > 0).sort((a, b) => b.amount - a.amount);
  const positiveTotal = positive.reduce((sum, courier) => sum + courier.amount, 0);
  return {
    positive,
    positiveTotal,
    share: (amount: number) => (positiveTotal > 0 ? (amount / positiveTotal) * 100 : 0),
  };
};

const SEGMENT_COLORS = ["bg-chart-1", "bg-chart-2", "bg-chart-3"] as const;

const NO_COURIERS: readonly ReceiveOption[] = [];

type Segment = { key: string; value: number; color: string; label: ReactNode };

/** `.el-segbar` — bo'laklar orasi 2 px, uchlari yumaloq; ma'no `aria-label` da (rang yolg'iz emas). */
const SegmentBar = ({ segments, label, thin = false }: { segments: Segment[]; label?: string; thin?: boolean }) => (
  <span
    role={label ? "img" : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    className={cx("flex w-full gap-0.5", thin ? "h-1.5" : "h-2.5")}
  >
    {segments.map((segment, index) => (
      <span
        key={segment.key}
        className={cx(
          "block min-w-1",
          segment.color,
          index === 0 && "rounded-l-[4px]",
          index === segments.length - 1 && "rounded-r-[4px]",
        )}
        style={{ flex: `${Math.max(segment.value, 0)} 1 0` }}
      />
    ))}
  </span>
);

const Legend = ({ segments, small = false }: { segments: Segment[]; small?: boolean }) => (
  <span className={cx("flex flex-wrap items-center gap-x-3 gap-y-1.5 text-text-muted", small ? "text-xs" : "text-[13px]")}>
    {segments.map((segment) => (
      <span key={segment.key} className="inline-flex items-center gap-2 whitespace-nowrap">
        <span aria-hidden="true" className={cx("size-2.5 shrink-0 rounded-[3px]", segment.color)} />
        {segment.label}
      </span>
    ))}
  </span>
);

/** `.el-meter` — trek `action-soft`, to'ldirish `chart-1`. */
const Meter = ({ percent, label, thin = false }: { percent: number; label?: string; thin?: boolean }) => (
  <span
    role={label ? "meter" : undefined}
    aria-label={label}
    aria-valuemin={label ? 0 : undefined}
    aria-valuemax={label ? 100 : undefined}
    aria-valuenow={label ? Math.round(Math.min(Math.max(percent, 0), 100) * 10) / 10 : undefined}
    aria-hidden={label ? undefined : true}
    className={cx("block w-full overflow-hidden rounded-full bg-action-soft", thin ? "h-1.5" : "h-2")}
  >
    <span
      className="block h-full rounded-full bg-chart-1"
      style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
    />
  </span>
);

const PaymentSummaryCards = ({
  isManagerRole,
  marketTotal,
  mainTotal,
  courierTotal,
  loading,
  onCardClick,
  receiveSplit = null,
  couriers = NO_COURIERS,
  couriersLoading = false,
  hqName = null,
}: PaymentSummaryCardsProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsPhone();
  const currency = CURRENCY_LABEL[resolveMoneyLanguage(language)];

  const full = (value: number) => formatMoneyLocalized(value, { language, withCurrency: false });
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const percent = (value: number) => formatPercentLocalized(value, { language });

  const shares = useMemo(() => courierShares(couriers), [couriers]);

  // ─── Menejer: kuryerlar chizig'i (top-2 + «Boshqa») ──────────────────────────
  const courierSegments = useMemo<Segment[]>(() => {
    const top = shares.positive.slice(0, 2);
    const rest = shares.positive.slice(2).reduce((sum, courier) => sum + courier.amount, 0);
    const segments: Segment[] = top.map((courier, index) => ({
      key: courier.key,
      value: courier.amount,
      color: SEGMENT_COLORS[index],
      label: shortPersonName(courier.name),
    }));
    if (rest > 0) segments.push({ key: "rest", value: rest, color: "bg-chart-muted", label: t("v2Overview.otherCouriers") });
    return segments;
  }, [shares.positive, t]);
  const withShare = (segments: Segment[]) =>
    segments.map((segment) => ({
      ...segment,
      label: (
        <>
          {segment.label} · {percent(shares.share(segment.value))}
        </>
      ),
    }));
  const courierShareLabel = t("v2Overview.courierShare", {
    list: courierSegments
      .map((segment) => `${typeof segment.label === "string" ? segment.label : ""} ${percent(shares.share(segment.value))}`)
      .join(", "),
  });
  const holdersCount = shares.positive.length;

  // ─── Menejer: berilishi kerak / kassa ────────────────────────────────────────
  const givePercent = mainTotal > 0 ? (marketTotal / mainTotal) * 100 : null;
  const remains = mainTotal - marketTotal;
  const enough = marketTotal <= mainTotal;
  const giveMeta =
    givePercent !== null
      ? hqName
        ? t("v2Overview.giveMeta", { hq: hqName, percent: percent(givePercent) })
        : t("v2Overview.giveMetaHq", { percent: percent(givePercent) })
      : null;

  if (isManagerRole) {
    if (isPhone) {
      // Telefon: bitta «Kassa xulosasi» kartasi (maket `el-show-mobile`).
      return (
        <section
          aria-label={t("v2Overview.cashboxSummary")}
          className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-surface"
        >
          <Link
            to="/payments/main-cashbox"
            className="flex flex-col gap-1 px-4 pb-3 pt-3.5 text-text hover:bg-row-hover"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-text-muted">{t("v2Overview.cashboxAmount")}</span>
              <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-text-subtle" />
            </span>
            {loading ? (
              <Skeleton width={140} height={28} />
            ) : (
              <span className="whitespace-nowrap text-2xl leading-8 font-bold proportional-nums">
                {full(mainTotal)}
                <span className="ml-1 text-[13px] font-semibold text-text-muted">{currency}</span>
              </span>
            )}
          </Link>
          <div className="flex flex-col px-4">
            <Pressable
              onClick={() => onCardClick(null, "received")}
              className="flex min-h-14 flex-col gap-2 border-t border-border py-3 text-left text-text"
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold">{t("v2Overview.toReceive")}</span>
                  {holdersCount > 0 ? (
                    <span className="text-xs text-text-muted">
                      {t("v2Overview.courierCountShort", { count: holdersCount })}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {loading ? (
                    <Skeleton width={96} height={18} />
                  ) : (
                    <span className="whitespace-nowrap text-sm font-semibold">{money(courierTotal)}</span>
                  )}
                  <ChevronRight aria-hidden="true" size={16} className="text-text-subtle" />
                </span>
              </span>
              {courierSegments.length > 0 ? (
                <>
                  <SegmentBar segments={courierSegments} thin />
                  <Legend segments={withShare(courierSegments)} small />
                </>
              ) : null}
            </Pressable>
            <Pressable
              onClick={() => onCardClick(null, "given")}
              className="flex min-h-14 flex-col gap-2 border-t border-border py-3 text-left text-text"
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold">{t("v2Overview.toGive")}</span>
                  {givePercent !== null ? (
                    <span className="text-xs text-text-muted">
                      {t("v2Overview.giveMetaHq", { percent: percent(givePercent) })}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {loading ? (
                    <Skeleton width={96} height={18} />
                  ) : (
                    <span className="whitespace-nowrap text-sm font-semibold">{money(marketTotal)}</span>
                  )}
                  <ChevronRight aria-hidden="true" size={16} className="text-text-subtle" />
                </span>
              </span>
              {givePercent !== null ? <Meter percent={givePercent} thin /> : null}
            </Pressable>
          </div>
        </section>
      );
    }

    return (
      <section
        aria-label={t("v2Overview.kpiLabel")}
        className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4"
      >
        <StatCard
          label={t("v2Overview.cashboxAmount")}
          icon={Wallet}
          value={full(mainTotal)}
          unit={currency}
          loading={loading}
          href="/payments/main-cashbox"
        />
        <StatCard
          label={t("v2Overview.toReceive")}
          icon={Truck}
          value={full(courierTotal)}
          unit={currency}
          loading={loading}
          hint={holdersCount > 0 ? t("v2Overview.courierCount", { count: holdersCount }) : undefined}
          onClick={() => onCardClick(null, "received")}
        >
          {courierSegments.length > 0 ? (
            <span className="flex flex-col gap-2">
              <SegmentBar segments={courierSegments} label={courierShareLabel} thin />
              <Legend segments={courierSegments} small />
            </span>
          ) : couriersLoading ? (
            <Skeleton width="100%" height={8} />
          ) : null}
        </StatCard>
        <StatCard
          label={t("v2Overview.toGive")}
          icon={Building2}
          value={full(marketTotal)}
          unit={currency}
          loading={loading}
          hint={giveMeta ?? undefined}
          onClick={() => onCardClick(null, "given")}
        >
          {givePercent !== null ? (
            <span className="flex flex-col gap-2">
              <Meter percent={givePercent} label={t("v2Overview.giveMeter")} />
              <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
                <span>{t("v2Overview.remains", { amount: money(remains) })}</span>
                <Badge tone={enough ? "success" : "warning"} dot>
                  {t(enough ? "v2Overview.enough" : "v2Overview.notEnough")}
                </Badge>
              </span>
            </span>
          ) : null}
        </StatCard>
      </section>
    );
  }

  return (
    <StaffSummaryCards
      marketTotal={marketTotal}
      mainTotal={mainTotal}
      courierTotal={courierTotal}
      loading={loading}
      onCardClick={onCardClick}
      receiveSplit={receiveSplit}
    />
  );
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" ? (value as UnknownRecord) : {};

const toFinite = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type StaffSummaryCardsProps = Pick<
  PaymentSummaryCardsProps,
  "marketTotal" | "mainTotal" | "courierTotal" | "loading" | "onCardClick" | "receiveSplit"
>;

/**
 * Superadmin/admin kartalari. Qo'shimcha yengil so'rovlar faqat shu rollarda:
 *  - smena holati — `GET /finance/shift/current` (asosiy kassa smenasi, «Asosiy kassa» sahifasi bilan bir xil
 *    so'rov va kesh; javob kelmaguncha / xatoda meta faqat «Asosiy kassa»);
 *  - naqd / karta — `GET /finance/cashbox/main?fromDate=toDate=bugun` (`cashbox.balance_cash/balance_card`;
 *    tarix qatorlari bugungi kun bilan cheklangan — javob yengil).
 */
const StaffSummaryCards = ({
  marketTotal,
  mainTotal,
  courierTotal,
  loading,
  onCardClick,
  receiveSplit = null,
}: StaffSummaryCardsProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const currency = CURRENCY_LABEL[resolveMoneyLanguage(language)];
  const role = useSelector((state: RootState) => state.role.role);
  const normalizedRole = String(role).toLowerCase();
  const isStaff = normalizedRole === "superadmin" || normalizedRole === "admin";
  const { useGetCurrentShift, useGetCashBoxMain } = useCashBox();
  const currentShiftQuery = useGetCurrentShift(isStaff);
  const today = useMemo(() => getTodayRange(), []);
  const mainCashboxQuery = useGetCashBoxMain({ fromDate: today.from, toDate: today.to });

  const currentShift = normalizeCashboxShift(asRecord(asRecord(currentShiftQuery.data).data).shift);
  const shiftState: "open" | "closed" | null =
    isStaff && currentShiftQuery.isSuccess ? (currentShift?.status === "open" ? "open" : "closed") : null;

  const mainCashbox = asRecord(asRecord(asRecord(mainCashboxQuery.data).data).cashbox);
  const splitCash = toFinite(mainCashbox.balance_cash);
  const splitCard = toFinite(mainCashbox.balance_card);
  const mainSplit = splitCash !== null && splitCard !== null ? { cash: splitCash, card: splitCard } : null;

  const money = (value: number) => formatMoneyLocalized(value, { language });
  const compactNumber = (value: number) => formatCompactMoneyLocalized(value, { language, withCurrency: false });
  /** Ixcham qiymat: raqam `value` ga, «mln so'm» `unit` ga (maket: `24,6` + `mln so'm`). */
  const compactParts = (value: number) => {
    const text = compactNumber(value);
    const match = /^(.*\d)\s*([^\d\s]+\.?)$/.exec(text);
    return match ? { value: match[1], unit: `${match[2]} ${currency}` } : { value: text, unit: currency };
  };

  const main = compactParts(mainTotal);
  const receive = compactParts(courierTotal);
  const give = compactParts(marketTotal);
  const mainMeta =
    shiftState === "open"
      ? t("v2Overview.mainCashboxShiftOpen")
      : shiftState === "closed"
        ? t("v2Overview.mainCashboxShiftClosed")
        : t("v2Overview.mainCashbox");

  const cashSegments: Segment[] | null =
    mainSplit && mainSplit.cash + mainSplit.card > 0
      ? [
          {
            key: "cash",
            value: mainSplit.cash,
            color: "bg-chart-1",
            label: (
              <>
                {t("v2Overview.cash")} <span className="font-semibold text-text">{compactNumber(mainSplit.cash)}</span>
              </>
            ),
          },
          {
            key: "card",
            value: mainSplit.card,
            color: "bg-chart-2",
            label: (
              <>
                {t("v2Overview.card")} <span className="font-semibold text-text">{compactNumber(mainSplit.card)}</span>
              </>
            ),
          },
        ]
      : null;
  const receiveSegments: Segment[] | null =
    receiveSplit && receiveSplit.branches + receiveSplit.hqCouriers > 0
      ? [
          {
            key: "branches",
            value: receiveSplit.branches,
            color: "bg-chart-1",
            label: (
              <>
                {t("v2Overview.branches")}{" "}
                <span className="font-semibold text-text">{compactNumber(receiveSplit.branches)}</span>
              </>
            ),
          },
          {
            key: "hqCouriers",
            value: receiveSplit.hqCouriers,
            color: "bg-chart-2",
            label: (
              <>
                {t("v2Overview.hqCouriers")}{" "}
                <span className="font-semibold text-text">{compactNumber(receiveSplit.hqCouriers)}</span>
              </>
            ),
          },
        ]
      : null;

  return (
    <section
      aria-label={t("v2Overview.kpiLabel")}
      className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4 max-md:gap-3"
    >
      <StatCard
        label={t("v2Overview.cashboxAmount")}
        icon={Wallet}
        value={main.value}
        unit={main.unit}
        loading={loading}
        hint={mainMeta}
        href="/payments/main-cashbox"
      >
        {cashSegments ? (
          <span className="flex flex-col gap-2">
            <SegmentBar
              segments={cashSegments}
              label={t("v2Overview.cashSplit", { cash: money(mainSplit?.cash ?? 0), card: money(mainSplit?.card ?? 0) })}
            />
            <Legend segments={cashSegments} />
          </span>
        ) : null}
      </StatCard>
      <StatCard
        label={t("v2Overview.toReceive")}
        icon={Truck}
        value={receive.value}
        unit={receive.unit}
        loading={loading}
        onClick={() => onCardClick(null, "received")}
      >
        {receiveSegments ? (
          <span className="flex flex-col gap-2">
            <SegmentBar
              segments={receiveSegments}
              label={t("v2Overview.receiveSplit", {
                branches: money(receiveSplit?.branches ?? 0),
                couriers: money(receiveSplit?.hqCouriers ?? 0),
              })}
            />
            <Legend segments={receiveSegments} />
          </span>
        ) : null}
      </StatCard>
      <StatCard
        label={t("v2Overview.toGive")}
        icon={Store}
        value={give.value}
        unit={give.unit}
        loading={loading}
        onClick={() => onCardClick(null, "given")}
      />
    </section>
  );
};

export default memo(PaymentSummaryCards);

// ─── «Kuryerlardagi pul» (menejer) ─────────────────────────────────────────────

type CourierMoneyCardProps = {
  couriers: readonly ReceiveOption[];
  /** «Qabul qilinishi kerak» jami (karta bilan bir xil manba). */
  total: number;
  loading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** «Barcha kuryerlar · N ta» — kuryer tanlash oynasi. */
  onOpenAll: () => void;
};

/**
 * «KURYERLARDAGI PUL» — menejer maketi (`manager-payments-overview`, Taklif emas): reyting (o'rin, bosh harflar,
 * ism, ulush o'lchagichi, summa + ulush %), manfiy yoki nofaol kuryer alohida qator (danger-soft), izoh va
 * «Barcha kuryerlar · N ta». Ulush = kuryer summasi / musbat qoldiqlar jami. Kompyuterda 5, telefonda 3 qator.
 */
export const CourierMoneyCard = memo(({ couriers, total, loading = false, isError = false, onRetry, onOpenAll }: CourierMoneyCardProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsPhone();
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const percent = (value: number) => formatPercentLocalized(value, { language });

  const { positive, share } = useMemo(() => courierShares(couriers), [couriers]);
  const ranked = positive.slice(0, isPhone ? 3 : 5);
  // Manfiy (qarzdor) kuryerlar — alohida qatorlar (nofaol bo'lsa ham shu yerda).
  const debtors = couriers.filter((courier) => courier.amount < 0);
  const zeroCount = couriers.filter((courier) => courier.amount === 0).length;

  let body: ReactNode;
  if (loading) {
    body = (
      <div className="flex flex-col gap-3" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton shape="circle" width={24} height={24} />
            <span className="flex flex-1 flex-col gap-1.5">
              <Skeleton width="50%" />
              <Skeleton width="80%" height={6} />
            </span>
            <Skeleton width={72} />
          </div>
        ))}
      </div>
    );
  } else if (isError) {
    body = <ErrorState title={t("v2Overview.couriers.loadError")} onRetry={onRetry} />;
  } else if (positive.length === 0 && debtors.length === 0) {
    body = <EmptyState icon={Truck} title={t("v2Overview.couriers.empty")} />;
  } else {
    body = (
      <>
        {ranked.length > 0 ? (
          <ol aria-label={t("v2Overview.couriers.listLabel")} className="m-0 flex list-none flex-col p-0">
            {ranked.map((courier, index) => {
              const value = share(courier.amount);
              return (
                <li
                  key={courier.key}
                  className="grid grid-cols-[24px_32px_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-border py-2.5 first:border-t-0 max-md:grid-cols-[24px_minmax(0,1fr)_auto]"
                >
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-sunken text-xs font-bold text-text-muted">
                    {formatNumberLocalized(index + 1, { language })}
                  </span>
                  <span
                    aria-hidden="true"
                    className="inline-flex size-8 items-center justify-center rounded-full bg-sunken text-xs font-bold text-text-muted ring-1 ring-inset ring-border max-md:hidden"
                  >
                    {initials(courier.name)}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="truncate text-sm font-semibold text-text">{courier.name}</span>
                    <Meter percent={value} label={t("v2Overview.couriers.share", { name: courier.name })} thin />
                  </span>
                  <span className="flex min-w-16 flex-col items-end">
                    <span className="whitespace-nowrap text-sm font-bold text-text">{money(courier.amount)}</span>
                    <span className="text-xs text-text-muted">{percent(value)}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}
        {debtors.map((courier) => (
          <div
            key={courier.key}
            className="flex items-center justify-between gap-3 rounded-[10px] bg-danger-soft px-3 py-2.5"
          >
            <span className="flex min-w-0 items-center gap-2">
              <CircleAlert aria-hidden="true" size={16} className="shrink-0 text-danger-fg" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-semibold text-text">{courier.name}</span>
                <span className="text-xs text-text-muted">
                  {t(courier.is_inactive ? "v2Overview.couriers.inactiveDebtor" : "v2Overview.couriers.debtor")}
                </span>
              </span>
            </span>
            <span className="whitespace-nowrap text-sm font-semibold text-danger-fg">{money(courier.amount)}</span>
          </div>
        ))}
        <p className="m-0 flex items-start gap-1.5 text-xs text-text-muted">
          <Info aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
          <span>
            {zeroCount > 0
              ? t("v2Overview.couriers.note", { count: zeroCount })
              : t("v2Overview.couriers.noteShare")}
          </span>
        </p>
      </>
    );
  }

  return (
    <Card
      as="section"
      title={t("v2Overview.couriers.title")}
      description={t("v2Overview.couriers.subtitle", { amount: money(total) })}
      divided={false}
      bodyClassName="flex flex-col gap-3"
    >
      {body}
      {couriers.length > 0 ? (
        <div className="mt-auto">
          <Button variant="secondary" size="sm" rightIcon={ChevronRight} onClick={onOpenAll}>
            {t("v2Overview.couriers.all", { count: couriers.length })}
          </Button>
        </div>
      ) : null}
    </Card>
  );
});

CourierMoneyCard.displayName = "CourierMoneyCard";

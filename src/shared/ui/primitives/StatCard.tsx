import { ChevronRight, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { HTMLAttributes, MouseEventHandler, ReactNode, Ref } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cx } from "../../lib/cx";
import { MINUS_SIGN, formatPercentLocalized } from "../../lib/formatMoney";
import { TONE_FG, TONE_SOFT, type Tone } from "./tone";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  StatCard — ko'rsatkich (KPI) kartasi, dizayn v2 (maket: `.el-kpi`,
 *  oltin sahifa `superadmin-dashboard-main`, taxtalar `tizim-charts`, `tizim-loading`)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Eski `shared/ui/MetricCard.tsx` (v1: rangli chiziq, rangli ikonka, `TYPO`) o'rniga.
 *
 *   yorliq ············ [ikonka]     ← ikonka DOIM neytral (icon-registry qoidasi), telefonda yashirin
 *   48,6 mln so'm                     ← qiymat: oddiy (proportional) raqamlar, 28px · telefonda 22px
 *   [↗ +6,4%] kechaga nisbatan  ›     ← delta (yo'nalish × yaxshi/yomon) + izoh; bosiladiganida «›»
 *   (children: sparkline, meter)
 *
 *  Pul/son/foizni chaqiruvchi `formatMoney.ts` orqali formatlab beradi (`value`, `unit`);
 *  delta foizini karta o'zi `formatPercentLocalized` bilan yozadi (`+6,4%`, `−10,7%`).
 *
 *    <StatCard
 *      label={t("cards.cancelled")}
 *      value={formatNumberLocalized(cancelled)}
 *      unit={t("unit.orders")}
 *      icon={CircleX}
 *      delta={12.5}
 *      goodWhen="down"            // bekor qilinganlar o'sishi — yomon (qizil)
 *      hint={t("comparison.vsYesterday")}
 *      href="/orders?status=cancelled"
 *    />
 */

/**
 * Qaysi yo'nalish yaxshi: `up` — daromad, sotuvlar; `down` — bekor qilinganlar, yo'qotish,
 * yetkazish vaqti; `none` — yaxshi/yomon emas (neytral kulrang).
 */
export type StatCardGoodWhen = "up" | "down" | "none";

export type StatCardProps = Omit<HTMLAttributes<HTMLElement>, "children" | "onClick"> & {
  /** Ildiz elementga (`a` · `button` · `div`) — boshqa primitivlardagi kabi `ref` prop sifatida (React 19). */
  ref?: Ref<HTMLElement>;
  /** Ko'rsatkich nomi (yuklanishda ham ko'rinadi). */
  label: ReactNode;
  /** Formatlangan qiymat (`formatCompactMoneyLocalized`, `formatNumberLocalized` …). */
  value?: ReactNode;
  /** Qiymatdan keyingi kichik birlik: `so'm`, `ta`. */
  unit?: ReactNode;
  /** `lucide-react` ikonkasi (18px, neytral chip). Telefonda yashiriladi (maket). */
  icon?: LucideIcon;
  /**
   * O'zgarish foizda (6.4 → `+6,4%`). `null`/`undefined`/`NaN` — delta ko'rsatilmaydi.
   * Ishora yo'nalishni beradi; rang `goodWhen` bo'yicha.
   */
  delta?: number | null;
  /** Qaysi yo'nalish yaxshi. Sukut `up`. */
  goodWhen?: StatCardGoodWhen;
  /** Delta matnini almashtirish (`+1,2 p.p.`, `−25 daq`); yo'nalish va rang baribir `delta` dan. */
  deltaText?: ReactNode;
  /** Izoh qatori (`.el-kpi-meta`): `kechaga nisbatan`, `oldingi: 54,1 mln`. Yuklanishda ham ko'rinadi. */
  hint?: ReactNode;
  /**
   * Qiymat rangi — faqat ishorali pul uchun (DESIGN_SYSTEM §7: qarz/manfiy `danger-fg`,
   * kirim `success-fg`). Ishora (`−` / `+`) qiymat matnida bo'lsin — rang yolg'iz ma'no bermaydi.
   */
  valueTone?: Extract<Tone, "success" | "danger">;
  /** Yuklanish: qiymat o'rnida chiziq, `aria-busy`. Yorliq, ikonka va izoh joyida qoladi (`tizim-loading`). */
  loading?: boolean;
  /** Ichki havola (react-router `Link`). Butun karta bosiladi. */
  href?: string;
  /** `href` bo'lmasa — butun karta `<button>`. */
  onClick?: MouseEventHandler<HTMLElement>;
  /**
   * Pastki qism: sparkline, meter, segment chiziq (`.el-kpi .el-spark`, `margin-top: 6px`). Yuklanishda
   * chizilmaydi. `onClick` (tugma) rejimida faqat satr ichidagi kontent (`svg`, `span`) — `div`/`ul`
   * tugma ichida HTML qoidasiga zid; bunday tarkib uchun `href` (havola) ishlating.
   */
  children?: ReactNode;
};

type DeltaDirection = "up" | "down" | "flat";
type DeltaQuality = "good" | "bad" | "neutral";

const QUALITY_TONE: Record<DeltaQuality, Tone> = { good: "success", bad: "danger", neutral: "neutral" };


const ROOT =
  "flex min-w-0 flex-col gap-1.5 rounded-[14px] border border-border bg-surface px-5 py-4 text-left text-text " +
  "max-md:gap-1 max-md:px-4 max-md:py-3.5";
const INTERACTIVE =
  "cursor-pointer no-underline transition-[background-color] duration-150 hover:bg-row-hover motion-reduce:transition-none";
const VALUE =
  "block whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] proportional-nums " +
  "max-md:text-[22px] max-md:leading-[30px]";
const UNIT = "ml-1 text-sm font-semibold tracking-normal text-text-muted max-md:text-[13px]";
const DELTA =
  "inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-xs font-bold leading-none";

const resolveDelta = (
  delta: number,
  goodWhen: StatCardGoodWhen,
  hasCustomText: boolean,
): { direction: DeltaDirection; quality: DeltaQuality } => {
  // Ko'rsatiladigan qiymat 0 ga yaxlitlansa («0%») — o'q va rang yo'q.
  const shownZero = hasCustomText ? delta === 0 : Math.round(Math.abs(delta) * 10) === 0;
  const direction: DeltaDirection = shownZero ? "flat" : delta > 0 ? "up" : "down";
  if (direction === "flat" || goodWhen === "none") return { direction, quality: "neutral" };
  return { direction, quality: direction === goodWhen ? "good" : "bad" };
};

export const StatCard = ({
  label,
  value,
  unit,
  icon: Icon,
  delta,
  goodWhen = "up",
  deltaText,
  hint,
  valueTone,
  loading = false,
  href,
  onClick,
  children,
  className,
  ref,
  ...rest
}: StatCardProps) => {
  const { t, i18n } = useTranslation("ui");
  const clickable = href != null || onClick != null;
  const hasDelta = !loading && typeof delta === "number" && Number.isFinite(delta);

  let deltaNode: ReactNode = null;
  if (hasDelta) {
    const { direction, quality } = resolveDelta(delta, goodWhen, deltaText != null);
    const sign = direction === "up" ? "+" : direction === "down" ? MINUS_SIGN : "";
    const text = deltaText ?? `${sign}${formatPercentLocalized(Math.abs(delta), { language: i18n.language })}`;
    const DirectionIcon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : null;
    deltaNode = (
      <span
        data-stat-delta=""
        data-direction={direction}
        data-quality={quality}
        className={cx(DELTA, TONE_SOFT[QUALITY_TONE[quality]])}
      >
        {DirectionIcon ? <DirectionIcon size={14} aria-hidden="true" className="shrink-0" /> : null}
        {text}
      </span>
    );
  }

  const hasMeta = deltaNode != null || hint != null || clickable;

  const content = (
    <>
      <span className="flex min-h-9 items-center justify-between gap-2 max-md:min-h-0">
        <span className="min-w-0 text-[13px] font-semibold text-text-muted">{label}</span>
        {Icon ? (
          <span
            className={cx(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] max-md:hidden",
              TONE_SOFT.neutral,
            )}
          >
            <Icon size={18} aria-hidden="true" />
          </span>
        ) : null}
      </span>

      {loading ? (
        <span data-stat-skeleton="" className="flex h-9 items-center max-md:h-[30px]">
          <span className="block h-7 w-32 max-w-full rounded-lg bg-border motion-safe:animate-pulse max-md:h-6 max-md:w-24" />
          <span className="sr-only">{t("common.loading")}</span>
        </span>
      ) : (
        <span data-stat-value="" className={cx(VALUE, valueTone ? TONE_FG[valueTone] : "text-text")}>
          {value}
          {unit != null ? (
            <>
              <span className="sr-only"> </span>
              <span className={UNIT}>{unit}</span>
            </>
          ) : null}
        </span>
      )}

      {hasMeta ? (
        // «›» o'ngda, delta va izoh bilan bir qatorda (maket: `justify-content: space-between; nowrap`);
        // o'ramga faqat delta + izoh tushadi.
        <span className="flex min-w-0 items-center gap-2 text-xs leading-[18px] text-text-muted">
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            {deltaNode}
            {hint != null ? <span className="min-w-0">{hint}</span> : null}
          </span>
          {clickable ? <ChevronRight size={16} aria-hidden="true" className="ml-auto shrink-0 text-text-subtle" /> : null}
        </span>
      ) : null}

      {!loading && children != null ? <span className="mt-1.5 block min-w-0">{children}</span> : null}
    </>
  );

  const shared = {
    ...rest,
    "aria-busy": loading || undefined,
    className: cx(ROOT, clickable && INTERACTIVE, className),
  };

  if (href != null) {
    return (
      <Link ref={ref as Ref<HTMLAnchorElement>} to={href} onClick={onClick} {...shared}>
        {content}
      </Link>
    );
  }
  if (onClick != null) {
    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        onClick={onClick}
        {...shared}
        className={cx(shared.className, "w-full")}
      >
        {content}
      </button>
    );
  }
  return (
    <div ref={ref as Ref<HTMLDivElement>} {...shared}>
      {content}
    </div>
  );
};

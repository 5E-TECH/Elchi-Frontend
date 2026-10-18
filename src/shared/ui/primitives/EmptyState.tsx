import { isValidElement, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { Inbox, type LucideProps } from "lucide-react";
import { cx } from "../../lib/cx";
import type { IconSlot } from "./Button";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  BO'SH HOLAT — dizayn v2 (`.el-empty` · `.el-empty-icon` · `.el-empty-title` · `.el-empty-text`,
 *  `.el-chart-empty`; `design/CODE-MAP.md` 2.7 / 2.9, taxtalar `tizim-errors` 01–02, `tizim-charts` 05)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Bitta tuzilish: doira ichida ikonka (lucide, emoji EMAS), sarlavha, bir jumla sabab va keyingi qadam
 *  (ixtiyoriy tugma). Faqat ma'lumot turgan joy almashadi — sarlavha, qidiruv va filtrlar ishlayveradi.
 *
 *  O'lchamlar:
 *    card  — ro'yxat/karta ichida (sukut): ikonka 48 (22), sarlavha 16 px, bitta tugma (`mt-2`);
 *    page  — sahifa umuman ochilmaganda: ikonka 56 (26), ustida «Xato kodi 404» (`overline`), sarlavha
 *            24 px (telefonda 20), 2 ta tugma (`action` ga ikkalasini bering — teng enli, o'raladi);
 *    chart — grafik kartasi ichida (`.el-chart-empty`): kulrang yuza, kamida 200 px, kichik tugma;
 *    inline — ixcham, gorizontal (ikonka 40 chapda, matn o'ngda; ≈ 64 px): kichik grafik/reyting
 *             kartasida bo'sh joyni cho'zmaslik uchun (dashboard reytingi, 9zbSDkUI).
 *
 *  Ton: `neutral` (sukut; bo'sh, filtr natija yo'q, ruxsat yo'q) · `danger` — FAQAT tizim xatosi
 *  (taxta: «Qizil rang — faqat tizim xatosida»), bu `ErrorState` da.
 *
 *  `framed` — o'z kartasi bilan (`surface` + chegara + 14 px): sahifada yolg'iz turganda. Karta ichida
 *  ramka bermang (karta ichida karta yo'q).
 */

export type StateSize = "card" | "page" | "chart" | "inline";
export type StateTone = "neutral" | "danger";

export type EmptyStateProps = Omit<ComponentProps<"div">, "title"> & {
  /** Ikonka: lucide komponenti (`ShoppingBag`) yoki element. Sukut — `Inbox`. Doim `aria-hidden`. */
  icon?: IconSlot;
  /** Sarlavha: nima bo'ldi («Hali buyurtma yo'q»). */
  title: ReactNode;
  /** Bir jumla: sabab va keyingi qadam. */
  description?: ReactNode;
  /** Tugma(lar): `card` — bitta; `page` — asosiy + chiqish yo'li. */
  action?: ReactNode;
  size?: StateSize;
  tone?: StateTone;
  /** Sahifa holati uchun ustki yozuv («Xato kodi 404», «Kutilmagan xato») — faqat `page`. */
  overline?: ReactNode;
  /** Sarlavha tegi: sukut `p` (karta ichida), `page` da `h2`. Sahifaning yagona sarlavhasi bo'lsa — `h1`. */
  titleAs?: "p" | "h1" | "h2" | "h3" | "h4";
  /** O'z kartasi bilan (sahifada yolg'iz). */
  framed?: boolean;
  /** Tugmadan keyingi qo'shimcha (masalan «Xato tafsilotlari» ochiladigan bloki). */
  footer?: ReactNode;
};

const ROOT: Record<StateSize, string> = {
  card: "flex min-w-0 flex-col items-center gap-2 px-6 py-12 text-center",
  page: "flex min-h-[360px] min-w-0 flex-col items-center justify-center gap-5 px-8 py-12 text-center max-md:px-4 max-md:py-10",
  chart: "flex min-h-[200px] min-w-0 flex-col items-center justify-center gap-2 rounded-xl bg-sunken p-6 text-center",
  inline: "flex min-w-0 items-center gap-3 rounded-xl bg-sunken px-4 py-3 text-left",
};

const ICON_BOX: Record<StateSize, string> = {
  card: "mb-1 size-12",
  page: "size-14",
  chart: "mb-1 size-12",
  inline: "size-10",
};

const ICON_PX: Record<StateSize, number> = { card: 22, page: 26, chart: 22, inline: 20 };

const ICON_TONE: Record<StateTone, string> = {
  neutral: "bg-sunken text-text-muted",
  danger: "bg-danger-soft text-danger-fg",
};

/** `inline` ning o'zi `bg-sunken` — neytral doira unda ko'rinishi uchun `surface`. */
const iconTone = (size: StateSize, tone: StateTone) =>
  size === "inline" && tone === "neutral" ? "bg-surface text-text-muted" : ICON_TONE[tone];

const TITLE: Record<StateSize, string> = {
  card: "text-base font-bold text-text",
  page: "text-2xl leading-8 font-bold tracking-[-0.01em] text-text max-md:text-xl max-md:leading-7",
  chart: "text-base font-bold text-text",
  inline: "text-sm font-semibold text-text",
};

const TEXT: Record<StateSize, string> = {
  card: "max-w-[460px] text-sm text-text-muted",
  page: "max-w-[480px] text-sm text-text-muted",
  chart: "max-w-[380px] text-sm text-text-muted",
  inline: "text-[13px] text-text-muted",
};

const ACTIONS: Record<StateSize, string> = {
  card: "mt-2 flex flex-wrap items-center justify-center gap-2",
  page: "flex w-full max-w-[440px] flex-wrap items-center justify-center gap-2 [&>*]:flex-[1_1_180px]",
  chart: "mt-1 flex flex-wrap items-center justify-center gap-2",
  inline: "ml-auto flex shrink-0 flex-wrap items-center gap-2",
};

const FRAME = "rounded-[14px] border border-border bg-surface";

/** lucide komponentimi (forwardRef/memo obyekt yoki funksiya), yoki tayyor element. */
const isIconComponent = (slot: unknown): slot is ComponentType<LucideProps> =>
  typeof slot === "function" ||
  (typeof slot === "object" && slot !== null && !isValidElement(slot) && ("render" in slot || "compare" in slot));

/** Doiradagi ikonka (`.el-empty-icon`). */
export const StateIcon = ({
  icon,
  size = "card",
  tone = "neutral",
}: {
  icon: IconSlot;
  size?: StateSize;
  tone?: StateTone;
}) => {
  const px = ICON_PX[size];
  const Glyph = isIconComponent(icon) ? icon : null;
  return (
    <span
      aria-hidden="true"
      data-state-icon={tone}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        ICON_BOX[size],
        iconTone(size, tone),
      )}
    >
      {Glyph ? (
        <Glyph aria-hidden="true" focusable="false" size={px} strokeWidth={2} />
      ) : (
        <span className="inline-flex items-center justify-center [&>svg]:size-full" style={{ width: px, height: px }}>
          {icon as ReactNode}
        </span>
      )}
    </span>
  );
};

/**
 * Dizayn v2 bo'sh holati.
 *
 *   <EmptyState icon={ShoppingBag} title={t("orders.emptyTitle")} description={t("orders.emptyText")}
 *     action={<Button leftIcon={Plus}>{t("orders.create")}</Button>} />
 *   <EmptyState icon={SearchX} title={…} action={<Button variant="secondary">{t("filters.clear")}</Button>} />
 *   <EmptyState size="chart" icon={ChartColumn} title={…} action={<Button size="sm" variant="secondary">…</Button>} />
 */
export const EmptyState = ({
  icon = Inbox,
  title,
  description,
  action,
  size = "card",
  tone = "neutral",
  overline,
  titleAs,
  framed = false,
  footer,
  className,
  ...rest
}: EmptyStateProps) => {
  const Title = titleAs ?? (size === "page" ? "h2" : "p");
  const hasDescription = description != null && description !== false;
  const hasAction = action != null && action !== false;

  const text = (
    <>
      {size === "page" && overline != null ? (
        <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{overline}</span>
      ) : null}
      <Title className={cx("m-0", TITLE[size])}>{title}</Title>
      {hasDescription ? <p className={cx("m-0", TEXT[size])}>{description}</p> : null}
    </>
  );

  return (
    <div
      data-state-size={size}
      data-state-tone={tone}
      className={cx(ROOT[size], framed && size !== "chart" && FRAME, className)}
      {...rest}
    >
      <StateIcon icon={icon} size={size} tone={tone} />
      {size === "page" ? (
        <div className="flex min-w-0 flex-col items-center gap-2">{text}</div>
      ) : size === "inline" ? (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">{text}</div>
      ) : (
        text
      )}
      {hasAction ? <div className={ACTIONS[size]}>{action}</div> : null}
      {footer}
    </div>
  );
};

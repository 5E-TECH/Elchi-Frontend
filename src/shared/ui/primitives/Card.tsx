import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "../../lib/cx";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  Card — dizayn v2 sahifa bo'limi yuzasi (maket: `.el-card`, `.el-card-head`,
 *  `.el-card-pad`, `.el-card-foot`, grafik kartasi `.el-card.el-chart`)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  `bg-surface` + `border-border` + 14px radius, soya va gradient YO'Q.
 *  Ixtiyoriy sarlavha: `title` (daraja `titleAs`, o'lcham `titleSize` — maketda ular alohida:
 *  `h3.el-h2`, `h2.el-h3` ham bor), `description`, o'ngda `actions`
 *  (tor kenglikda pastki qatorga o'tadi), `titleAddon` (sarlavha yonidagi badge).
 *
 *  Ikki xil sarlavha (ikkalasi ham maketda bor):
 *   - `divided` (sukut) — `.el-card-head`: sarlavha ostida chiziq, tana alohida chekka bilan;
 *   - `divided={false}` — `.el-chart-head`: chiziqsiz, sarlavha va tana bitta chekka ichida
 *     (dashboard grafik kartalari).
 *
 *  Karta ichida karta YO'Q (DESIGN_SYSTEM §5, ko'pi bilan 2 qavat): ichki `Card`
 *  avtomatik `variant="inset"` bo'ladi (`bg-sunken`, chegarasiz, soyasiz). Uchinchi
 *  qavat yoki ichkarida `variant="default"` — dev rejimda ogohlantirish.
 *
 *    <Card title={t("…")} description={t("…")} actions={<Button size="sm" … />}>…</Card>
 */

export type CardVariant = "default" | "inset";

/**
 * Ichki chekka:
 *  - `lg` — standart: 20px (`.el-card-pad`, telefonda ham 20 — maket). Chiziqsiz sarlavhali
 *    (grafik) kartada telefonda 16px (`.el-chart`). `default` kartada sukut.
 *  - `md` — ixcham: 16×20 (maketdagi `padding: 16px 20px` — bosiladigan kartalar, filtr/xulosa
 *    qatorlari); `inset` kartada 14×16 va sukut.
 *  - `none` — tana chekkasiz (jadval, ro'yxat). Sarlavha va pastki qism o'z chekkasini saqlaydi
 *    (chiziqsiz sarlavhali kartada ham: sarlavha 20px, telefonda 16px; tana chetma-chet).
 */
export type CardPadding = "none" | "md" | "lg";

export type CardProps = Omit<ComponentProps<"section">, "title"> & {
  /** Ildiz element. `section`/`article` da `title` bo'lsa, `aria-labelledby` avtomatik. */
  as?: "section" | "div" | "article";
  /** Sukut: tashqi kartada `default`, karta ichida `inset`. */
  variant?: CardVariant;
  padding?: CardPadding;
  title?: ReactNode;
  /** Sarlavha darajasi (faqat semantika, sahifa tuzilmasiga qarab). Sukut `h2`. */
  titleAs?: "h2" | "h3" | "h4";
  /** Sarlavha o'lchami: `md` — 16/24 · 700 (`.el-h2`, maketdagi karta sarlavhasi, sukut), `sm` — 14/20 · 600 (`.el-h3`). */
  titleSize?: "md" | "sm";
  /** Sarlavha yonida (sarlavhaga kirmaydi): son badge'i, holat. */
  titleAddon?: ReactNode;
  description?: ReactNode;
  /** O'ngdagi amallar (kichik tugmalar, havola). Joy yetmasa pastga o'tadi. */
  actions?: ReactNode;
  /** `true` — sarlavha ostida chiziq (`.el-card-head`); `false` — chiziqsiz (`.el-chart-head`). */
  divided?: boolean;
  /** Pastki qism (`.el-card-foot`): sahifalash, «Barchasini ko'rish». */
  footer?: ReactNode;
  /** Tana o'ramiga qo'shimcha klass (masalan `flex flex-col gap-4`). */
  bodyClassName?: string;
};

/** Ichma-ich kartalar chuqurligi: 0 — sahifa, 1 — karta ichida, 2 — ichki karta ichida. */
const CardLevelContext = createContext(0);

const SURFACE: Record<CardVariant, string> = {
  default: "rounded-[14px] border border-border bg-surface",
  inset: "rounded-xl bg-sunken",
};

const PADDING: Record<CardVariant, Record<CardPadding, string>> = {
  default: { none: "", md: "px-5 py-4", lg: "p-5" },
  inset: { none: "", md: "px-4 py-3.5", lg: "p-4" },
};

/** `.el-chart` telefonda (< 768) chekkani 16px ga tushiradi; `.el-card-pad` / `.el-card-head` esa 20 da qoladi. */
const CHART_PHONE_PADDING: Record<CardPadding, string> = { none: "", md: "max-md:px-4", lg: "max-md:p-4" };

/**
 * Chiziqsiz sarlavha + `padding="none"`: ildizda faqat tepa chekka, sarlavha va pastki qism
 * o'z yon chekkasini oladi — tana (jadval) chetma-chet, sarlavha esa karta chetiga yopishmaydi.
 */
const CHART_NONE_ROOT = "pt-5 max-md:pt-4";
const CHART_NONE_EDGE = "px-5 max-md:px-4";

/** `.el-card-head` / `.el-card-foot` gorizontal chekkasi tana bilan bir chiziqda. */
const HEAD_PADDING: Record<CardVariant, string> = {
  default: "px-5 py-4",
  inset: "px-4 py-3",
};

const FOOT_PADDING: Record<CardVariant, string> = {
  default: "px-5 py-3",
  inset: "px-4 py-3",
};

const TITLE: Record<NonNullable<CardProps["titleSize"]>, string> = {
  md: "text-base font-bold text-text",
  sm: "text-sm font-semibold text-text",
};

const warnNesting = (level: number, variant: CardVariant | undefined) => {
  if (!import.meta.env.DEV) return;
  if (level >= 2) {
    console.warn("[Card] 2 qavatdan chuqur karta: ichki bo'limni chiziq (border-t) yoki ro'yxat bilan ajrating.");
  } else if (level === 1 && variant === "default") {
    console.warn('[Card] karta ichida karta: ichki karta `variant="inset"` bo\'lsin (DESIGN_SYSTEM §5).');
  }
};

export const Card = ({
  as = "section",
  variant,
  padding,
  title,
  titleAs = "h2",
  titleSize = "md",
  titleAddon,
  description,
  actions,
  divided = true,
  footer,
  bodyClassName,
  className,
  children,
  ...rest
}: CardProps) => {
  const level = useContext(CardLevelContext);
  warnNesting(level, variant);

  const resolvedVariant: CardVariant = variant ?? (level > 0 ? "inset" : "default");
  const resolvedPadding: CardPadding = padding ?? (resolvedVariant === "inset" ? "md" : "lg");
  const pad = PADDING[resolvedVariant][resolvedPadding];

  const chartFlush = !divided && resolvedPadding === "none";
  const titleId = useId();
  const hasTitle = title != null && title !== false;
  const hasHeader = hasTitle || description != null || actions != null || titleAddon != null;
  const hasBody = children != null && children !== false;
  const labelled =
    hasTitle && as !== "div" && rest["aria-label"] == null && rest["aria-labelledby"] == null;

  // TS: uchala teg ham HTMLElement; `ref` va atributlar bir xil.
  const Tag = as as "section";
  const Heading = titleAs;

  const header = hasHeader ? (
    <div
      className={cx(
        "flex min-w-0 flex-wrap justify-between",
        divided
          ? cx("items-center gap-x-3 gap-y-2 border-b border-border", HEAD_PADDING[resolvedVariant])
          : cx("items-start gap-x-4 gap-y-3", chartFlush && CHART_NONE_EDGE),
      )}
    >
      {/* `.el-card-head` (maketda odatda `nowrap`): amal o'ngda qoladi, uzun sarlavha/izoh o'z ichida
          o'raladi. Sarlavha bloki qatorni 96px dan kam joy bilan bo'lishmaydi — shundagina (keng
          segment, bir nechta tugma) amallar pastki qatorga o'tadi (maketdagi `flex-wrap: wrap` holati).
          `.el-chart-titles`: maketdagidek `flex: 1 1 200px`. */}
      <div
        className={cx(
          "flex flex-col gap-0.5",
          divided ? "min-w-[min(100%,6rem)] flex-[1_1_0%]" : "min-w-0 flex-[1_1_200px]",
        )}
      >
        {hasTitle || titleAddon != null ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {hasTitle ? (
              <Heading id={titleId} className={TITLE[titleSize]}>
                {title}
              </Heading>
            ) : null}
            {titleAddon}
          </div>
        ) : null}
        {description != null ? <p className="text-[13px] leading-[18px] text-text-muted">{description}</p> : null}
      </div>
      {actions != null ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  ) : null;

  const footerNode =
    footer != null ? (
      <div
        className={cx(
          "flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border",
          divided ? FOOT_PADDING[resolvedVariant] : cx("pt-4", chartFlush && cx(CHART_NONE_EDGE, "pb-5 max-md:pb-4")),
        )}
      >
        {footer}
      </div>
    ) : null;

  return (
    <Tag
      data-card-variant={resolvedVariant}
      aria-labelledby={labelled ? titleId : undefined}
      className={cx(
        "flex min-w-0 flex-col",
        SURFACE[resolvedVariant],
        // Chiziqsiz sarlavha: butun karta bitta chekka ichida (`.el-chart`: chekka 20 / gap 16,
        // telefonda 16 / 14).
        !divided &&
          cx(pad, CHART_PHONE_PADDING[resolvedPadding], chartFlush && CHART_NONE_ROOT, "gap-4 max-md:gap-3.5"),
        className,
      )}
      {...rest}
    >
      <CardLevelContext.Provider value={level + 1}>
        {header}
        {hasBody ? <div className={cx("min-w-0", divided && pad, bodyClassName)}>{children}</div> : null}
        {footerNode}
      </CardLevelContext.Provider>
    </Tag>
  );
};

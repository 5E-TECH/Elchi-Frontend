// dizayn-v2: superadmin-integrations-panel-settings, superadmin-integrations-panel-shipments, superadmin-integrations-panel-events
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";

/**
 * Konsol panellarining ichki tuzilmasi. Panel tanlangan ulanish KARTASI ichida turadi, shuning uchun
 * ichida karta yo'q (DESIGN_SYSTEM §5: karta ichida karta emas) — bo'limlar `border-t` bilan ajraladi.
 *
 *  - `PanelSection` — `p-5` blok (telefonda `p-4`), qo'shnisidan chiziq bilan ajraladi;
 *  - `SectionHead` — `.el-h3` sarlavha + izoh, o'ngda amallar (maket «Biz yuborgan hodisalar · Yangilash»);
 *  - `FormSection` — chapda sarlavha + izoh, o'ngda maydonlar (maket `*-panel-settings`, ≥ 1024 ikki ustun);
 *  - `ChartBlock` — `.el-chart`: sarlavha, ostida izoh, o'ngda boshqaruv, so'ng grafik.
 */

export const PanelSection = ({
  children,
  className,
  as: Tag = "section",
  bordered = true,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
  /** `false` — yuqori chiziqsiz (masalan `ColumnGrid` ustunining birinchi bo'limi). */
  bordered?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "data-testid"?: string;
}) => (
  <Tag {...rest} className={cx("flex min-w-0 flex-col gap-4 p-5 max-md:p-4", bordered && "border-t border-border", className)}>
    {children}
  </Tag>
);

export const SectionHead = ({
  title,
  description,
  actions,
  id,
  icon: Icon,
  as: Heading = "h3",
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
  /** Sarlavha oldidagi kichik ikonka (maket `*-panel-security`: «Kirish cheklovlari», «API kalit»). */
  icon?: LucideIcon;
  as?: "h2" | "h3";
}) => (
  <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
    <div className={cx("flex flex-[1_1_0%] flex-col gap-0.5", description != null ? "min-w-[min(100%,12rem)]" : "min-w-0")}>
      <Heading id={id} className="inline-flex items-center gap-2 text-sm font-semibold text-text">
        {Icon ? <Icon size={16} aria-hidden="true" className="flex-none text-text-muted" /> : null}
        {title}
      </Heading>
      {description != null ? <p className="text-[13px] leading-[18px] text-text-muted">{description}</p> : null}
    </div>
    {actions != null ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

export const FormSection = ({
  title,
  description,
  children,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  id?: string;
}) => (
  <section
    aria-labelledby={id}
    className="grid min-w-0 gap-x-8 gap-y-4 border-t border-border p-5 first:border-t-0 max-md:p-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]"
  >
    <div className="flex min-w-0 flex-col gap-1">
      <h3 id={id} className="text-sm font-semibold text-text">
        {title}
      </h3>
      {description != null ? <p className="text-[13px] leading-[18px] text-text-muted">{description}</p> : null}
    </div>
    <div className="flex min-w-0 flex-col gap-4">{children}</div>
  </section>
);

export const ChartBlock = ({
  title,
  subtitle,
  controls,
  children,
  className,
  titleAddon,
  id,
  "data-testid": testId,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
  titleAddon?: ReactNode;
  id?: string;
  "data-testid"?: string;
}) => (
  <section
    aria-labelledby={id}
    data-testid={testId}
    className={cx("flex min-w-0 flex-col gap-4 bg-surface p-5 max-md:p-4", className)}
  >
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 id={id} className="text-base font-bold text-text">
            {title}
          </h3>
          {titleAddon}
        </div>
        {subtitle != null ? <p className="text-[13px] leading-[18px] text-text-muted">{subtitle}</p> : null}
      </div>
      {controls != null ? <div className="flex flex-wrap items-center gap-2">{controls}</div> : null}
    </div>
    {children}
  </section>
);

/** Ustun asosiy kengligi (px) — statik klasslar (Tailwind dinamik klassni ko'rmaydi; `cx` birlashtirmaydi). */
const COLUMN_BASIS = {
  300: "[&>*]:flex-[1_1_300px]",
  340: "[&>*]:flex-[1_1_340px]",
  420: "[&>*]:flex-[1_1_420px]",
} as const;

/** Ustunlar to'ri: maketdagi `display:flex; gap:1px; background: var(--border)` — ustunlar orasida 1 px chiziq. */
export const ColumnGrid = ({
  children,
  className,
  basis = 340,
}: {
  children: ReactNode;
  className?: string;
  /** Ustun shu kenglikdan torayadigan bo'lsa keyingi qatorga o'tadi. */
  basis?: keyof typeof COLUMN_BASIS;
}) => (
  <div className={cx("flex min-w-0 flex-wrap gap-px border-t border-border bg-border [&>*]:min-w-0", COLUMN_BASIS[basis], className)}>
    {children}
  </div>
);

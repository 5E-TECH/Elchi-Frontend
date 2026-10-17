// dizayn-v2: common-settings-dashboard
import { useId, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { AppSettings, DashboardWidgetId } from "../../../entities/settings";
import { cx } from "../../../shared/lib/cx";
import { Badge, buttonClasses } from "../../../shared/ui/primitives";
import { SectionHead, SwitchList, SwitchRow } from "./settingsUi";

/**
 * Rasmchalar (maket `common-settings-dashboard`): 128 × 64 SVG, ranglar faqat token klasslari bilan
 * (`fill-*` / `stroke-*`). Maketdagi `--seq-*`, `--chart-total`, `--div-*`, `--chart-baseline` tokenlari ilovada
 * yo'q (CODE-MAP 0.1): ketma-ket shkala — `chart-1` shaffofligi, jami — `text-muted`, chiziq — `border`.
 */
const StatsThumb = () => (
  <svg viewBox="0 0 128 64" className="block size-full overflow-visible" aria-hidden="true">
    <path
      d="M 5 54 A 27 27 0 0 1 59 54"
      fill="none"
      className="stroke-success-soft"
      strokeWidth="8"
      strokeLinecap="round"
    />
    <path
      d="M 5 54 A 27 27 0 0 1 52.4 36.3"
      fill="none"
      className="stroke-success"
      strokeWidth="8"
      strokeLinecap="round"
    />
    <path d="M 32 54 L 45.6 42.2" className="stroke-text" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="32" cy="54" r="4" className="fill-text stroke-sunken" strokeWidth="1.5" />
    <g transform="rotate(-90 101 32)">
      <circle
        cx="101"
        cy="32"
        r="22"
        fill="none"
        className="stroke-success"
        strokeWidth="9"
        strokeDasharray="102.1 138.2"
      />
      <circle
        cx="101"
        cy="32"
        r="22"
        fill="none"
        className="stroke-warning"
        strokeWidth="9"
        strokeDasharray="19.5 138.2"
        strokeDashoffset="-104.1"
      />
      <circle
        cx="101"
        cy="32"
        r="22"
        fill="none"
        className="stroke-danger"
        strokeWidth="9"
        strokeDasharray="10.6 138.2"
        strokeDashoffset="-125.6"
      />
    </g>
  </svg>
);

const FIN_LINE =
  "M 2.0 20.0 C 5.8 21.3 9.6 24.0 13.4 24.0 C 17.2 24.0 21.0 10.0 24.8 10.0 C 28.6 10.0 32.4 12.7 36.2 16.0 " +
  "C 40.0 19.3 43.8 30.0 47.6 30.0 C 51.4 30.0 55.2 13.0 59.0 13.0 C 62.8 13.0 66.6 20.0 70.4 20.0 C 74.2 20.0 78.0 12.0 81.8 8.0";
const FIN_PREV =
  "M 2.0 26.0 C 5.8 26.7 9.6 28.0 13.4 28.0 C 17.2 28.0 21.0 20.0 24.8 20.0 C 28.6 20.0 32.4 20.3 36.2 22.0 " +
  "C 40.0 23.7 43.8 30.0 47.6 30.0 C 51.4 30.0 55.2 24.0 59.0 24.0 C 62.8 24.0 66.6 24.5 70.4 25.0 C 74.2 25.5 78.0 26.3 81.8 27.0";

const FinancialThumb = () => (
  <svg viewBox="0 0 128 64" className="block size-full overflow-visible" aria-hidden="true">
    <path
      d="M 0 60 L 128 60"
      className="stroke-border"
      strokeWidth="1"
      vectorEffect="non-scaling-stroke"
    />
    <path
      d={FIN_PREV}
      fill="none"
      className="stroke-chart-muted"
      strokeWidth="2"
      vectorEffect="non-scaling-stroke"
    />
    <path d={`${FIN_LINE} L 81.8 60 L 2 60 Z`} className="fill-chart-1 opacity-[.12]" />
    <path
      d={FIN_LINE}
      fill="none"
      className="stroke-chart-1"
      strokeWidth="2"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
    <circle cx="81.8" cy="8" r="3.5" className="fill-chart-1 stroke-sunken" strokeWidth="2" />
    <rect x="96" y="26" width="7" height="34" rx="1.5" className="fill-text-muted" />
    <rect x="104" y="10" width="7" height="16" rx="1.5" className="fill-chart-1" />
    <rect x="112" y="10" width="7" height="20" rx="1.5" className="fill-danger" />
    <rect x="120" y="30" width="7" height="30" rx="1.5" className="fill-text-muted" />
  </svg>
);

const TopThumb = () => (
  <svg viewBox="0 0 128 64" className="block size-full overflow-visible" aria-hidden="true">
    {[
      { y: 12, name: 46, bar: 75.4 },
      { y: 34, name: 39, bar: 68.9 },
      { y: 56, name: 32, bar: 62.3 },
    ].map(({ y, name, bar }) => (
      <g key={y}>
        <circle
          cx="7"
          cy={y}
          r="6"
          className="fill-surface stroke-border-strong"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <rect x="20" y={y - 6} width={name} height="5" rx="2.5" className="fill-border-strong" />
        <rect x="20" y={y + 3} width="82" height="4" rx="2" className="fill-action-soft" />
        <rect x="20" y={y + 3} width={bar} height="4" rx="2" className="fill-chart-1" />
        <rect x="108" y={y - 3} width="20" height="5" rx="2.5" className="fill-border-strong" />
      </g>
    ))}
  </svg>
);

const PerformanceThumb = () => (
  <svg viewBox="0 0 128 64" className="block size-full overflow-visible" aria-hidden="true">
    {[120, 110, 102, 92, 83, 72].map((end, index) => {
      const y = 1 + index * 10.6;
      return (
        <g key={end}>
          <rect x="0" y={y + 2} width="24" height="4.5" rx="2.25" className="fill-border-strong" />
          <path
            d={`M 30 ${y} H ${end} a 2 2 0 0 1 2 2 v 4.5 a 2 2 0 0 1 -2 2 H 30 Z`}
            className="fill-chart-1"
          />
        </g>
      );
    })}
  </svg>
);

/** Hudud plitkalari: [x, y, eni, ketma-ket shkala pog'onasi 0–4]. */
const REGION_TILES: [number, number, number, number][] = [
  [0, 0, 35.5, 0],
  [37, 0, 17, 0],
  [55.5, 0, 17, 0],
  [74, 0, 17, 3],
  [92.5, 0, 17, 1],
  [111, 0, 17, 2],
  [0, 22, 17, 0],
  [18.5, 22, 17, 1],
  [37, 22, 17, 2],
  [55.5, 22, 17, 0],
  [74, 22, 17, 4],
  [92.5, 22, 17, 2],
  [37, 44, 17, 1],
  [55.5, 44, 17, 0],
];
const SEQ_OPACITY = [
  "opacity-20",
  "opacity-35",
  "opacity-55",
  "opacity-75",
  "opacity-100",
] as const;

const RegionThumb = () => (
  <svg viewBox="0 0 128 64" className="block size-full overflow-visible" aria-hidden="true">
    {REGION_TILES.map(([x, y, width, step]) => (
      <rect
        key={`${x}-${y}`}
        x={x}
        y={y}
        width={width}
        height="20"
        rx="3"
        className={cx("fill-chart-1", SEQ_OPACITY[step])}
      />
    ))}
  </svg>
);

/** Maketdagi tartib. «Buyurtmalar vaqti» — «Taklif» (widget yo'q), chizilmaydi. */
const WIDGETS: { id: DashboardWidgetId; key: string; thumb: () => ReactNode }[] = [
  { id: "stats", key: "w_stats", thumb: StatsThumb },
  { id: "financial", key: "w_financial", thumb: FinancialThumb },
  { id: "topPerformers", key: "w_top", thumb: TopThumb },
  { id: "performanceChart", key: "w_performance", thumb: PerformanceThumb },
  { id: "region", key: "w_region", thumb: RegionThumb },
];

/**
 * «BOSH SAHIFA» — maket `common-settings-dashboard`: «Bosh sahifa bloklari» + «N / 5 ta yoqilgan», har blok —
 * rasmcha, nom, izoh (telefonda qisqa), kalit; o'chirilganida «Yashirilgan» badge'i. Pastda «Bosh sahifani ochish».
 */
export const DashboardPanel = ({
  widgets,
  homePath,
  onWidget,
}: {
  widgets: AppSettings["dashboard"]["widgets"];
  homePath: string;
  onWidget: (id: DashboardWidgetId, visible: boolean) => void;
}) => {
  const { t } = useTranslation("settings");
  const headId = useId();
  const enabled = WIDGETS.filter((widget) => widgets[widget.id]).length;

  return (
    <>
      <div className="p-5 max-md:p-4">
        <SectionHead
          id={headId}
          title={t("dashboard.widgets")}
          hint={t("dashboard.widgets_hint")}
          aside={
            <span className="whitespace-nowrap pt-0.5 text-[13px] text-text-muted">
              <Trans
                t={t}
                i18nKey="dashboard.enabled_count"
                values={{ count: enabled, total: WIDGETS.length }}
                components={{ b: <span className="font-semibold text-text" /> }}
              />
            </span>
          }
        />
      </div>
      <SwitchList labelledBy={headId}>
        {WIDGETS.map(({ id, key, thumb: Thumb }) => {
          const visible = widgets[id];
          return (
            <li key={id}>
              <SwitchRow
                checked={visible}
                onToggle={(next) => onWidget(id, next)}
                title={t(`dashboard.${key}`)}
                addon={visible ? null : <Badge>{t("dashboard.hidden")}</Badge>}
                hint={
                  <>
                    <span className="max-md:hidden">{t(`dashboard.${key}_hint`)}</span>
                    <span className="md:hidden">{t(`dashboard.${key}_short`)}</span>
                  </>
                }
                leading={
                  <span
                    aria-hidden="true"
                    className={cx(
                      "flex h-[88px] w-[152px] flex-none rounded-[10px] bg-sunken p-3 max-md:h-[60px] max-md:w-[104px] max-md:p-2",
                      !visible && "opacity-50",
                    )}
                  >
                    <Thumb />
                  </span>
                }
              />
            </li>
          );
        })}
      </SwitchList>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border px-5 py-3 max-md:flex-col max-md:items-start max-md:px-4">
        <span className="text-[13px] text-text-muted">{t("dashboard.footer")}</span>
        <Link
          to={homePath}
          className={buttonClasses({ variant: "link", className: "-ml-1 max-md:min-h-11" })}
        >
          {t("dashboard.open_home")}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </>
  );
};

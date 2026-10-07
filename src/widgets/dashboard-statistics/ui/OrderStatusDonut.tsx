import { memo } from "react";
import { PackageCheck } from "lucide-react";
import {
  toneAccent,
  formatNumber,
  formatPercent,
  ratio,
  TYPO,
  TEXT,
} from "../../../shared/config/designSystem";

/**
 * OrderStatusDonut — buyurtmalar holatining taqsimoti (donut/halqa grafik).
 * Markazda jami qabul qilingan soni. Atrofida: sotilgan / jarayonda / bekor.
 * Dashboard'da boshqa kartalardan ajralib turadigan asosiy vizual.
 *
 * Recharts EMAS, oddiy SVG (NIFAnCvf): bu karta dashboardning birinchi ekranida
 * turadi va recharts (~100 KB gzip) ni birinchi yuklashga tortib, 450 KB
 * byudjetni buzardi. Geometriya avvalgi PieChart bilan bir xil.
 */
export interface OrderStatusDonutProps {
  accepted: number;
  sold: number;
  inProgress: number;
  cancelled: number;
  title: string;
  centerLabel: string;
  legend: { sold: string; inProgress: string; cancelled: string };
}

// Avvalgi recharts PieChart o'lchamlari: 190px balandlik, innerRadius 62, outerRadius 88, paddingAngle 3.
const SIZE = 190;
const CENTER = SIZE / 2;
const INNER_RADIUS = 62;
const OUTER_RADIUS = 88;
const RING_WIDTH = OUTER_RADIUS - INNER_RADIUS;
const RING_RADIUS = INNER_RADIUS + RING_WIDTH / 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const PADDING_ANGLE = 3;

type Segment = { key: string; name: string; value: number; color: string };

/** Halqani segmentlarga bo'ladi: soat 12 dan boshlab soat strelkasi bo'yicha, orada 3° bo'shliq. */
const toArcs = (segments: Segment[]) => {
  const visible = segments.filter((segment) => segment.value > 0);
  const sum = visible.reduce((acc, segment) => acc + segment.value, 0);
  const gap = visible.length > 1 ? (PADDING_ANGLE / 360) * CIRCUMFERENCE : 0;
  const available = CIRCUMFERENCE - gap * visible.length;

  let offset = 0;
  return visible.map((segment) => {
    const length = (segment.value / sum) * available;
    const arc = { ...segment, length, offset };
    offset += length + gap;
    return arc;
  });
};

const OrderStatusDonut = memo(
  ({
    accepted,
    sold,
    inProgress,
    cancelled,
    title,
    centerLabel,
    legend,
  }: OrderStatusDonutProps) => {
    const total = accepted || sold + inProgress + cancelled;
    const allZero = total === 0;

    const segments = [
      { key: "sold", name: legend.sold, value: sold, color: toneAccent("success") },
      {
        key: "inProgress",
        name: legend.inProgress,
        value: inProgress,
        color: toneAccent("warning"),
      },
      {
        key: "cancelled",
        name: legend.cancelled,
        value: cancelled,
        color: toneAccent("danger"),
      },
    ];

    const arcs = allZero ? [] : toArcs(segments);

    return (
      <div className="el-card relative flex min-h-[300px] flex-col overflow-hidden rounded-2xl p-5">
        <div className="mb-1 flex items-center gap-2">
          <PackageCheck size={16} style={{ color: toneAccent("info") }} />
          <h3 className={`${TYPO.cardTitle} text-maindark dark:text-primary`}>
            {title}
          </h3>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          <svg
            width="100%"
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={`${centerLabel}: ${formatNumber(total)}`}
          >
            {allZero ? (
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RING_RADIUS}
                fill="none"
                stroke="var(--color-border-soft)"
                strokeWidth={RING_WIDTH}
              />
            ) : (
              <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
                {arcs.map((arc) => (
                  <circle
                    key={arc.key}
                    data-segment={arc.key}
                    cx={CENTER}
                    cy={CENTER}
                    r={RING_RADIUS}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={RING_WIDTH}
                    strokeDasharray={`${arc.length} ${CIRCUMFERENCE}`}
                    strokeDashoffset={-arc.offset}
                  >
                    <title>{`${arc.name}: ${formatNumber(arc.value)}`}</title>
                  </circle>
                ))}
              </g>
            )}
          </svg>

          {/* Markaz: jami qabul qilingan */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[30px] font-bold leading-none tracking-tight text-maindark dark:text-primary">
              {formatNumber(total)}
            </span>
            <span className="mt-1 text-[11px] font-semibold" style={{ color: TEXT.soft }}>
              {centerLabel}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {segments.map((s) => (
            <div key={s.key} className="flex flex-col items-center gap-0.5">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="text-[15px] font-bold text-maindark dark:text-primary">
                  {formatNumber(s.value)}
                </span>
              </span>
              <span className="text-[10px] font-medium" style={{ color: TEXT.soft }}>
                {s.name} · {formatPercent(ratio(s.value, total), 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  },
);

OrderStatusDonut.displayName = "OrderStatusDonut";

export default OrderStatusDonut;

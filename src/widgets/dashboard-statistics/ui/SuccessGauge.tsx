import { memo } from "react";
import { Gauge, CheckCircle2, XCircle } from "lucide-react";
import {
  toneAccent,
  formatPercent,
  formatNumber,
  TYPO,
  TEXT,
} from "../../../shared/config/designSystem";

/**
 * SuccessGauge — muvaffaqiyat darajasi (success rate) yarim doira "gauge".
 * Speedometer ko'rinishi — boshqa kartalardan keskin ajralib turadi.
 * Pastda sotilgan/bekor sonlari ixcham ko'rsatiladi.
 *
 * Recharts EMAS, oddiy SVG (NIFAnCvf) — OrderStatusDonut bilan bir sabab:
 * birinchi ekrandagi karta recharts'ni birinchi yuklashga tortmasin.
 */
export interface SuccessGaugeProps {
  successRate: number; // 0..100
  sold: number;
  cancelled: number;
  title: string;
  soldLabel: string;
  cancelledLabel: string;
}

// Avvalgi RadialBarChart (cy 80%, barSize 18, cornerRadius 10) bilan bir xil ko'rinish.
const WIDTH = 280;
const HEIGHT = 180;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT * 0.8;
const RADIUS = 123;
const BAR_SIZE = 18;
/** Chapdan o'ngga yarim doira; `pathLength=100` tufayli dash uzunligi to'g'ridan-to'g'ri foiz. */
const ARC_PATH = `M ${CENTER_X - RADIUS} ${CENTER_Y} A ${RADIUS} ${RADIUS} 0 0 1 ${CENTER_X + RADIUS} ${CENTER_Y}`;

const gaugeTone = (rate: number) =>
  rate >= 70 ? "success" : rate >= 40 ? "warning" : "danger";

const SuccessGauge = memo(
  ({
    successRate,
    sold,
    cancelled,
    title,
    soldLabel,
    cancelledLabel,
  }: SuccessGaugeProps) => {
    const tone = gaugeTone(successRate);
    const accent = toneAccent(tone);
    const value = Math.min(100, Math.max(0, successRate));

    return (
      <div className="el-card relative flex min-h-[300px] flex-col overflow-hidden rounded-2xl p-5">
        <span className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />

        <div className="mb-1 flex items-center gap-2">
          <Gauge size={16} style={{ color: accent }} />
          <h3 className={`${TYPO.cardTitle} text-maindark dark:text-primary`}>
            {title}
          </h3>
        </div>

        <div className="relative flex flex-1 items-end justify-center">
          <svg
            width="100%"
            height={HEIGHT}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={`${title}: ${formatPercent(successRate, 1)}`}
          >
            <path
              d={ARC_PATH}
              fill="none"
              stroke="var(--color-border-soft)"
              strokeWidth={BAR_SIZE}
              strokeLinecap="round"
            />
            {value > 0 && (
              <path
                data-testid="success-gauge-value"
                d={ARC_PATH}
                fill="none"
                stroke={accent}
                strokeWidth={BAR_SIZE}
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${value} 100`}
              />
            )}
          </svg>

          {/* Markaz: katta foiz */}
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center">
            <span
              className="text-[38px] font-bold leading-none tracking-tight"
              style={{ color: accent }}
            >
              {formatPercent(successRate, 1)}
            </span>
            <span className="mt-1 text-[11px] font-semibold" style={{ color: TEXT.soft }}>
              {title}
            </span>
          </div>
        </div>

        {/* Pastki ixcham sonlar */}
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} style={{ color: toneAccent("success") }} />
            <div className="flex flex-col">
              <span className="text-[15px] font-bold text-maindark dark:text-primary">
                {formatNumber(sold)}
              </span>
              <span className="text-[10px] font-medium" style={{ color: TEXT.soft }}>
                {soldLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <XCircle size={16} style={{ color: toneAccent("danger") }} />
            <div className="flex flex-col">
              <span className="text-[15px] font-bold text-maindark dark:text-primary">
                {formatNumber(cancelled)}
              </span>
              <span className="text-[10px] font-medium" style={{ color: TEXT.soft }}>
                {cancelledLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

SuccessGauge.displayName = "SuccessGauge";

export default SuccessGauge;

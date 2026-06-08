import { memo } from "react";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
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
 */
export interface SuccessGaugeProps {
  successRate: number; // 0..100
  sold: number;
  cancelled: number;
  title: string;
  soldLabel: string;
  cancelledLabel: string;
}

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
    const data = [{ name: "success", value: Math.min(100, Math.max(0, successRate)) }];

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
          <ResponsiveContainer width="100%" height={180}>
            <RadialBarChart
              cx="50%"
              cy="80%"
              innerRadius="120%"
              outerRadius="170%"
              barSize={18}
              data={data}
              startAngle={180}
              endAngle={0}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar
                background={{ fill: "var(--color-border-soft)" }}
                dataKey="value"
                cornerRadius={10}
                fill={accent}
              />
            </RadialBarChart>
          </ResponsiveContainer>

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

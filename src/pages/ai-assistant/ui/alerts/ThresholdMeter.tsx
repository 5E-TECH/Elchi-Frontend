// dizayn-v2: superadmin-ai-assistant-alert-dialog-courier-debt, superadmin-ai-assistant-alert-dialog-expense, superadmin-ai-assistant-alert-dialog-hq-transfer
import type { ReactNode } from "react";
import { Meter } from "../../../../shared/ui/charts";
import { thresholdMeterMax } from "./rules/ruleData";

export type ThresholdMeterProps = {
  /** Sarlavha («Chegaradan 840 000 so'm ortiq», «Odatdagidan 3,4 barobar»). */
  title: ReactNode;
  /** O'ngdagi solishtirish («2 840 000 / 2 000 000 so'm»). */
  compare: ReactNode;
  /** Qiymat va qoida chegarasi — bir shkalada (tik chiziq — chegara). */
  value: number;
  threshold: number;
  /** Ton: jiddiy — `danger`, diqqat — `warning` (maketdagidek, ogohlantirish jiddiyligidan). */
  tone: "danger" | "warning";
  /** Meter nomi (ekran o'quvchi): «Kassadagi summa 2 840 000 so'm, qoida chegarasi 2 000 000 so'm». */
  ariaLabel: string;
  /** Ostidagi izoh («Tik chiziq — qoida chegarasi, …»). */
  caption: ReactNode;
};

/**
 * Qoida chegarasi bilan o'lchagich (maketlar R2 `-courier-debt`, R3 `-expense`, R5 `-hq-transfer`): sarlavha
 * (`.el-h3`) va o'ngda «qiymat / chegara» (`.el-small.el-muted`), qalin `Meter` (ton + tik chiziq — chegara), ostida
 * `.el-xs.el-muted` izoh. Bo'laklar oralig'i 8 px.
 */
export const ThresholdMeter = ({ title, compare, value, threshold, tone, ariaLabel, caption }: ThresholdMeterProps) => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className="text-sm font-semibold text-text">{title}</span>
      <span className="text-[13px] whitespace-nowrap text-text-muted">{compare}</span>
    </div>
    <Meter
      value={value}
      max={thresholdMeterMax(value, threshold)}
      target={threshold}
      tone={tone}
      thickness="thick"
      ariaLabel={ariaLabel}
    />
    <span className="text-xs text-text-muted">{caption}</span>
  </div>
);

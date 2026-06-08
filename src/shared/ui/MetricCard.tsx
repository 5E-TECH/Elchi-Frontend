import { memo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  type Tone,
  TONE,
  TYPO,
  RADIUS,
  CARD_MIN_H,
  TEXT,
  toneSoftBg,
} from "../config/designSystem";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  MetricCard — universal KPI / statistika kartasi
 * ────────────────────────────────────────────────────────────────────────────
 *  Butun ilova bo'ylab bir xil ko'rinishdagi ko'rsatkich kartasi. Ranglar,
 *  shriftlar va o'lchamlar `designSystem.ts` token'laridan olinadi — qo'lda
 *  rang/o'lcham yozma. Dashboard, branch-dashboard va boshqa sahifalarda qayta
 *  ishlatish uchun mo'ljallangan.
 */

export interface MetricCardProps {
  /** Karta sarlavhasi (yorliq) */
  title: string;
  /** Asosiy qiymat (raqam yoki formatlangan matn) */
  value: string | number;
  /** Chap yuqoridagi ikona */
  icon: React.ReactNode;
  /** Semantik rang variantligi */
  tone: Tone;
  /** Qiymatdan keyingi qo'shimcha (masalan "so'm", "ta") */
  suffix?: string;
  /** O'ng yuqoridagi badge matni (masalan foiz). `badgeUp` rangini belgilaydi. */
  badge?: string;
  /** Badge trend yo'nalishi: true → yashil/yuqoriga, false → qizil/pastga */
  badgeUp?: boolean;
  /** Pastki izoh matni (kontekst beradi) */
  hint?: string;
  /** 0..100 progress — rate kartalar uchun ingichka chiziq */
  progress?: number;
  /** Kichikroq qiymat shrifti (uzun summalar uchun) */
  compact?: boolean;
}

const MetricCard = memo(
  ({
    title,
    value,
    icon,
    tone,
    suffix,
    badge,
    badgeUp,
    hint,
    progress,
    compact = false,
  }: MetricCardProps) => {
    const accent = TONE[tone].accent;
    const badgeColor =
      badgeUp === undefined
        ? accent
        : badgeUp
          ? "var(--color-success)"
          : "var(--color-error)";

    return (
      <div
        className={`el-card group relative flex ${CARD_MIN_H.metric} flex-col overflow-hidden ${RADIUS.card}
          transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-strong)]`}
      >
        {/* Yuqori aksent chizig'i */}
        <span
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: accent }}
        />

        <div className="flex flex-1 flex-col justify-between p-4 pt-5">
          {/* Ikona + badge */}
          <div className="mb-5 flex items-start justify-between">
            <div
              className={`flex h-10 w-10 items-center justify-center ${RADIUS.control} ring-1 ring-white/10`}
              style={{ background: accent, color: "var(--color-primary)" }}
            >
              {icon}
            </div>

            {badge && (
              <span
                className={`flex items-center gap-1 ${TYPO.badge} px-2 py-0.5 ${RADIUS.control}`}
                style={{
                  background: toneSoftBg(
                    badgeUp === false ? "danger" : tone,
                    15,
                  ),
                  color: badgeColor,
                }}
              >
                {badgeUp !== undefined &&
                  (badgeUp ? (
                    <TrendingUp size={11} strokeWidth={3} />
                  ) : (
                    <TrendingDown size={11} strokeWidth={3} />
                  ))}
                {badge}
              </span>
            )}
          </div>

          {/* Yorliq */}
          <p
            className={`mb-1.5 ${TYPO.label}`}
            style={{ color: TEXT.soft }}
          >
            {title}
          </p>

          {/* Qiymat */}
          <div className="flex items-baseline gap-1.5">
            <span
              className={`min-w-0 break-words text-maindark dark:text-primary ${
                compact ? TYPO.metricValueSm : TYPO.metricValue
              }`}
            >
              {value}
            </span>
            {suffix && (
              <span
                className="shrink-0 text-[11px] font-semibold uppercase"
                style={{ color: TEXT.soft }}
              >
                {suffix}
              </span>
            )}
          </div>

          {/* Izoh */}
          {hint && (
            <p className="mt-2 text-[11px] leading-tight" style={{ color: TEXT.soft }}>
              {hint}
            </p>
          )}

          {/* Progress chizig'i (rate kartalar) */}
          {progress !== undefined && (
            <div
              className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: toneSoftBg(tone, 16) }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, progress))}%`,
                  background: accent,
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  },
);

MetricCard.displayName = "MetricCard";

/** Yuklanish holatidagi skeleton — MetricCard bilan bir xil o'lcham. */
export const MetricCardSkeleton = memo(() => (
  <div className={`el-card ${CARD_MIN_H.metric} ${RADIUS.card} p-4 pt-5`}>
    <div className="mb-5 h-10 w-10 animate-pulse rounded-xl bg-slate-200 dark:bg-white/12" />
    <div className="mb-3 h-3 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-white/12" />
    <div className="h-7 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-white/12" />
  </div>
));

MetricCardSkeleton.displayName = "MetricCardSkeleton";

export default MetricCard;

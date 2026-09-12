import { fmtMetric, type ConnectionMetrics } from '../../../entities/integrations/metrics';

/**
 * METRIKA QATORI — tanlangan ulanishning oxirgi 24 soati.
 *
 * NEGA PANELNING TEPASIDA. Ilgari raqamlar faqat Manzara jadvalida edi:
 * operator bitta ulanishni ochganda "ishlayaptimi?" degan savolga javob
 * topish uchun orqaga qaytishi kerak edi. Endi javob ko'z oldida turadi va
 * pastdagi tab (Sozlamalar / Hodisalar) shu raqamning SABABINI ko'rsatadi.
 *
 * ⚠️ Har hujayra `fmtMetric` orqali chiziladi — o'lchanmagan qiymat "—",
 * hech qachon `0` emas.
 */
const ConnectionMetricRow = ({
  metrics,
  isLoading,
}: {
  metrics?: ConnectionMetrics;
  isLoading?: boolean;
}) => {
  /**
   * Metrika YO'Q bo'lishining ikki sababi bor va ular BOSHQA:
   *   yuklanmoqda      — hali kelmadi, kutish kerak
   *   ulanish yo'q     — 24 soatda hodisa bo'lmagan
   * Ikkisini bir xil ko'rsatish "hodisa yo'q" degan xato xulosaga olib boradi.
   */
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[58px] animate-pulse rounded-xl border border-[color:var(--color-border-soft)] bg-maindark/[0.04] dark:bg-white/[0.04]"
          />
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--color-border-soft)] px-4 py-3 text-xs text-[color:var(--color-text-muted)]">
        Oxirgi 24 soatda hodisa bo'lmagan — o'lchash uchun ma'lumot yo'q.
      </div>
    );
  }

  const cells: Array<{ label: string; value: string; tone?: 'bad' | 'warn' }> = [
    { label: 'Hodisa', value: String(metrics.events) },
    { label: 'Yetkazildi', value: String(metrics.delivered) },
    {
      label: 'Yetmadi',
      value: String(metrics.failed),
      tone: metrics.failed > 0 ? 'bad' : undefined,
    },
    {
      label: 'Navbatda',
      value: String(metrics.queued),
      tone: metrics.queued > 0 ? 'warn' : undefined,
    },
    { label: 'Muvaffaqiyat', value: fmtMetric(metrics.success_rate, '%') },
    { label: 'Javob vaqti', value: fmtMetric(metrics.avg_ms, ' ms') },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-xl border border-[color:var(--color-border-soft)] bg-primary px-3 py-2 dark:bg-primarydark"
        >
          <p className="m-0 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">
            {cell.label}
          </p>
          <p
            className={`m-0 mt-0.5 text-base font-extrabold tabular-nums ${
              cell.tone === 'bad'
                ? 'text-red-600 dark:text-red-300'
                : cell.tone === 'warn'
                  ? 'text-amber-600 dark:text-amber-300'
                  : 'text-maindark dark:text-white'
            }`}
          >
            {cell.value}
          </p>
        </div>
      ))}
    </div>
  );
};

export default ConnectionMetricRow;

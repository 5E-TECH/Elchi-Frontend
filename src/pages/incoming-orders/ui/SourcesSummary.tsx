// dizayn-v2: superadmin-neworders-incoming-sources, admin-neworders-incoming-sources, manager-new-orders-incoming-sources
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { sourceLabel, type IncomingSource } from "../../../entities/incoming-orders";
import { cx } from "../../../shared/lib/cx";
import {
  CURRENCY_LABEL,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import { donutArcs, oldestSource, sourceSlices, waitingFor, type SourceSlice } from "../lib";
import { chartBg, chartStroke } from "./sourceFormat";
import { SourceKey, WaitingLabel } from "./sourceVisuals";

/** Kichik halqa (maket `.el-donut-ring.is-sm`): 120 px, radius 52, qalinlik 16. */
const RING = 120;
const RADIUS = 52;
const STROKE = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * KUTILAYOTGAN POSILKALAR XULOSASI (maket `superadmin-neworders-incoming-sources`, jadval ustidagi qism).
 *
 *  - desktop/planshet: halqa (markazda jami posilka) + legenda (manba · soni · ulushi) va o'ngda
 *    «Jami summa» + «Eng uzoq kutayotgan» manba;
 *  - telefon: «12 ta posilka · summa», bo'laklangan chiziq va qisqa legenda.
 *
 * Halqa — oddiy SVG (recharts emas): bo'laklar soni kichik, kutubxona yuklanishi shart emas. Jadval
 * — grafikning egizagi (har manba soni va summasi pastdagi jadvalda ham bor).
 */
const SourcesSummary = ({ sources }: { sources: readonly IncomingSource[] }) => {
  const { t, i18n } = useTranslation("common");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);

  const slices = useMemo(() => sourceSlices(sources), [sources]);
  const arcs = useMemo(() => donutArcs(slices, CIRCUMFERENCE), [slices]);
  const totalParcels = slices.reduce((sum, slice) => sum + slice.value, 0);
  const totalSum = sources.reduce((sum, source) => sum + (Number(source.total_price_sum) || 0), 0);
  const oldest = oldestSource(sources);
  const oldestWait = oldest ? waitingFor(oldest.oldest_at) : null;

  const sliceName = (slice: SourceSlice) => (slice.source ? sourceLabel(slice.source) : t("incoming.otherSources"));
  const chartLabel = t("incoming.donutLabel", {
    count: totalParcels,
    list: slices.map((slice) => `${sliceName(slice)} ${formatNumberLocalized(slice.value)}`).join(", "),
  });
  const share = (value: number) => formatPercentLocalized(totalParcels ? (value / totalParcels) * 100 : 0);

  return (
    <div className="flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-border px-5 pb-5 pt-4">
      {/* Desktop/planshet: halqa + legenda */}
      <div className="flex min-w-0 max-w-[560px] flex-[1_1_380px] items-center gap-6 max-md:hidden">
        <div role="img" aria-label={chartLabel} className="relative size-[120px] shrink-0">
          <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} aria-hidden="true" className="absolute inset-0">
            <g transform={`rotate(-90 ${RING / 2} ${RING / 2})`}>
              {arcs.map((arc) => (
                <circle
                  key={arc.key}
                  cx={RING / 2}
                  cy={RING / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={chartStroke(arc.colorIndex)}
                  strokeWidth={STROKE}
                  strokeDasharray={`${arc.length} ${CIRCUMFERENCE}`}
                  strokeDashoffset={-arc.offset}
                />
              ))}
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
            <span className="text-[22px] leading-[26px] font-bold tracking-[-.02em] text-text proportional-nums">
              {formatNumberLocalized(totalParcels)}
            </span>
            <span className="max-w-[110px] text-xs font-semibold text-text-muted">
              {t("incoming.parcelsUnit", { count: totalParcels })}
            </span>
          </div>
        </div>
        <ul aria-label={t("incoming.shareLegend")} className="m-0 flex min-w-0 flex-1 list-none flex-col p-0">
          {slices.map((slice) => (
            <li
              key={slice.key}
              className="grid min-h-10 grid-cols-[12px_minmax(0,1fr)_auto_52px] items-center gap-2.5 border-t border-border py-1.5 text-sm text-text first:border-t-0"
            >
              <SourceKey colorIndex={slice.colorIndex} shape="dot" />
              <span className="truncate">{sliceName(slice)}</span>
              <span className="whitespace-nowrap text-right font-bold">
                {t("incoming.countTa", { count: slice.value })}
              </span>
              <span className="whitespace-nowrap text-right text-[13px] text-text-muted">{share(slice.value)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Telefon: jami, bo'laklangan chiziq, qisqa legenda */}
      <div className="hidden min-w-0 flex-[1_1_100%] flex-col gap-2.5 max-md:flex">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-base font-bold text-text">
            {formatNumberLocalized(totalParcels)}{" "}
            <span className="text-[13px] font-semibold text-text-muted">
              {t("incoming.parcelsUnit", { count: totalParcels })}
            </span>
          </span>
          <span className="whitespace-nowrap text-sm font-semibold text-text">{formatMoneyLocalized(totalSum)}</span>
        </div>
        <div role="img" aria-label={chartLabel} className="flex h-2.5 min-w-0 gap-0.5">
          {slices
            .filter((slice) => slice.value > 0)
            .map((slice) => (
              <span
                key={slice.key}
                className={cx(
                  "block min-w-1 first:rounded-l-[4px] last:rounded-r-[4px]",
                  chartBg(slice.colorIndex),
                )}
                style={{ flex: `${slice.value} 1 0` }}
              />
            ))}
        </div>
        <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-2 p-0 text-[13px] text-text-muted">
          {slices.map((slice) => (
            <li key={slice.key} className="inline-flex min-w-0 items-center gap-2">
              <SourceKey colorIndex={slice.colorIndex} />
              {sliceName(slice)} · {formatNumberLocalized(slice.value)}
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop/planshet: jami summa va eng uzoq kutayotgan manba */}
      <dl className="m-0 flex min-w-0 flex-[1_1_240px] flex-col gap-3.5 max-md:hidden">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-text-muted">{t("incoming.totalSum")}</dt>
          <dd className="m-0 whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] text-text proportional-nums">
            {formatMoneyLocalized(totalSum, { withCurrency: false })}
            <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted">
              {CURRENCY_LABEL[language]}
            </span>
          </dd>
        </div>
        {oldest && oldestWait ? (
          <div className="flex flex-col gap-1.5">
            <dt className="text-xs text-text-muted">{t("incoming.oldestWaiting")}</dt>
            <dd className="m-0 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-text">{sourceLabel(oldest)}</span>
              <WaitingLabel t={t} waiting={oldestWait} />
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
};

export default memo(SourcesSummary);

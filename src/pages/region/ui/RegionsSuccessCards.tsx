// dizayn-v2: superadmin-regions-map, admin-regions-map
import { ChevronDown, ChevronUp, CircleAlert, CircleX, PackageCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { Button, Card, EmptyState } from "../../../shared/ui/primitives";
import { ChartLegend, ChartNote, Gauge, Meter, successZoneTone } from "../../../shared/ui/charts";
import { GOOD_ZONE, type RegionRow, type RegionsSummary } from "../model/regionsModel";
import { SummaryRow } from "./regionBlocks";

const PHONE_LIMIT = 6;

/** Muvaffaqiyat ro'yxati qatori: nom · (ogohlantirish) foiz · «3 / 5» + meter (70% chizig'i bilan). */
const SuccessRow = ({ row, hiddenOnPhone }: { row: RegionRow; hiddenOnPhone: boolean }) => {
  const { t, i18n } = useTranslation("region");
  const language = i18n.language;
  const tone = successZoneTone(row.rate);
  const ZoneIcon = tone === "danger" ? CircleAlert : tone === "warning" ? TriangleAlert : null;
  return (
    <li className={cx("flex min-w-0 flex-col gap-1.5 border-b border-border py-2.5", hiddenOnPhone && "max-md:hidden")}>
      <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_52px] items-center gap-3 text-sm">
        <span className="truncate font-semibold text-text">{row.short}</span>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-text">
          {ZoneIcon ? (
            <ZoneIcon
              size={16}
              aria-hidden="true"
              className={tone === "danger" ? "text-danger-fg" : "text-warning-fg"}
            />
          ) : null}
          {formatPercentLocalized(row.rate, { language })}
        </span>
        <span className="whitespace-nowrap text-right text-xs text-text-muted">
          {t("v2.common.partOfTotalPlain", {
            part: formatNumberLocalized(row.sold, { language }),
            total: formatNumberLocalized(row.orders, { language }),
          })}
        </span>
      </span>
      <Meter
        value={row.rate}
        tone={tone}
        thickness="thin"
        target={GOOD_ZONE}
        ariaLabel={t("v2.success.rowAria", { name: row.short })}
      />
    </li>
  );
};

/**
 * Pastki juftlik: «Muvaffaqiyat darajasi» (spidometr, butun kompaniya) + «Viloyatlar muvaffaqiyati»
 * (eng pastdan, 70% chegara chizig'i; telefonda 6 ta + «Barcha 14 viloyat»).
 */
const RegionsSuccessCards = ({ summary, periodLabel }: { summary: RegionsSummary; periodLabel: string }) => {
  const { t, i18n } = useTranslation("region");
  const language = i18n.language;
  const [expanded, setExpanded] = useState(false);
  const number = (value: number) => formatNumberLocalized(value, { language });
  const percent = (value: number) => formatPercentLocalized(value, { language });

  const ordered = [...summary.active].sort((a, b) => a.rate - b.rate || b.orders - a.orders);
  const half = Math.ceil(ordered.length / 2);
  const columns = [ordered.slice(0, half), ordered.slice(half)];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-6 max-lg:grid-cols-1 max-md:gap-4">
      <Card
        divided={false}
        title={t("v2.gauge.title")}
        description={t("v2.gauge.subtitle", { period: periodLabel })}
        bodyClassName="flex flex-col gap-4"
      >
        <Gauge
          value={summary.rate}
          label={t("v2.common.soldOfAccepted")}
          ariaLabel={t("v2.gauge.aria", {
            rate: percent(summary.rate),
            sold: number(summary.sold),
            cancelled: number(summary.cancelled),
          })}
          stats={[
            {
              key: "sold",
              value: t("v2.common.countTa", { count: number(summary.sold) }),
              label: t("v2.status.sold"),
              tone: "success",
              icon: PackageCheck,
            },
            {
              key: "cancelled",
              value: t("v2.common.countTa", { count: number(summary.cancelled) }),
              label: t("v2.status.cancelled"),
              tone: "danger",
              icon: CircleX,
            },
          ]}
        />
        {summary.active.length > 0 ? (
          <SummaryRow
            items={[
              {
                key: "good",
                label: t("v2.gauge.goodZone"),
                value: t("v2.gauge.goodValue", {
                  good: number(summary.good.length),
                  total: number(summary.active.length),
                }),
                meta: t("v2.gauge.goodMeta"),
              },
              {
                key: "below",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    {summary.below.length > 0 ? (
                      <TriangleAlert size={14} aria-hidden="true" className="text-warning-fg" />
                    ) : null}
                    {t("v2.gauge.below")}
                  </span>
                ),
                value: t("v2.gauge.belowValue", { count: number(summary.below.length) }),
                meta: summary.below.length > 0 ? summary.below.map((row) => row.short).join(", ") : undefined,
              },
            ]}
          />
        ) : null}
      </Card>

      <Card
        divided={false}
        title={t("v2.success.title")}
        description={t("v2.success.subtitle")}
        bodyClassName="flex flex-col gap-4"
      >
        {ordered.length === 0 ? (
          <EmptyState size="chart" title={t("v2.success.empty")} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-8 max-md:grid-cols-1" aria-label={t("v2.success.aria")} role="group">
              {columns.map((column, columnIndex) =>
                column.length > 0 ? (
                  <ul key={columnIndex} className="m-0 flex min-w-0 list-none flex-col p-0">
                    {column.map((row, index) => (
                      <SuccessRow
                        key={row.id}
                        row={row}
                        hiddenOnPhone={!expanded && columnIndex * half + index >= PHONE_LIMIT}
                      />
                    ))}
                  </ul>
                ) : null,
              )}
            </div>
            {ordered.length > PHONE_LIMIT ? (
              <Button
                variant="ghost"
                size="sm"
                className="self-center md:hidden"
                aria-expanded={expanded}
                rightIcon={expanded ? ChevronUp : ChevronDown}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? t("v2.common.showLess") : t("v2.map.rank.showAll", { count: number(ordered.length) })}
              </Button>
            ) : null}
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <ChartLegend
                items={[
                  { key: "good", tone: "success", label: t("v2.success.legend.good") },
                  { key: "mid", tone: "warning", label: t("v2.success.legend.mid") },
                  { key: "low", tone: "danger", label: t("v2.success.legend.low") },
                  { key: "target", tone: "neutral", shape: "target", label: t("v2.success.legend.target") },
                ]}
              />
              {summary.lowData.length > 0 ? (
                <ChartNote>
                  {summary.lowData
                    .map((row) => t("v2.success.lowData", { name: row.short, count: number(row.orders) }))
                    .join("; ")}
                </ChartNote>
              ) : null}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default RegionsSuccessCards;

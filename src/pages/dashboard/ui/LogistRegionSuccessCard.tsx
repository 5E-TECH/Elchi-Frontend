// dizayn-v2: logist-dashboard-main
import { CircleX, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { Meter, successZoneTone } from "../../../shared/ui/charts";
import { Card } from "../../../shared/ui/primitives";
import type { LogistDashboardModel, LogistRegionRow } from "../model/logistDashboard";

/** Maqsad chizig'i — «Yaxshi» zonasi chegarasi (spidometr zonalari bilan bir xil, 70%). */
const TARGET = 70;

/** Zona belgisi: o'rtacha — ⚠, past — ⊗; yaxshida belgi yo'q (maket). Rang yolg'iz emas — yonida foiz matni. */
const ZoneIcon = ({ rate }: { rate: number }) => {
  const tone = successZoneTone(rate);
  if (tone === "success") return null;
  const Icon = tone === "warning" ? TriangleAlert : CircleX;
  return (
    <Icon
      size={14}
      aria-hidden="true"
      className={cx("shrink-0", tone === "warning" ? "text-warning-fg" : "text-danger-fg")}
    />
  );
};

const RegionMeterRow = ({ row }: { row: LogistRegionRow }) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const count = (value: number) => formatNumberLocalized(value, { language });
  const tone = row.hasOrders ? successZoneTone(row.rate) : "neutral";
  return (
    <li className="flex min-w-0 flex-col gap-1.5" data-logist-region-meter={row.id}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{row.name}</span>
        {row.hasOrders ? <ZoneIcon rate={row.rate} /> : null}
        <span className="whitespace-nowrap text-sm font-semibold text-text">
          {row.hasOrders ? formatPercentLocalized(row.rate, { language }) : t("v2Logist.regions.noOrders")}
        </span>
        <span className="w-12 whitespace-nowrap text-right text-xs text-text-muted">
          {count(row.delivered)} / {count(row.total)}
        </span>
      </div>
      <Meter
        value={row.rate}
        tone={tone}
        target={TARGET}
        ariaLabel={t("v2Logist.regions.aria", { name: row.name })}
      />
    </li>
  );
};

/**
 * «VILOYATLAR MUVAFFAQIYATI» (maket `logist-dashboard-main`): har viloyat — nom, zona belgisi, foiz, «58 / 86» va
 * o'lchagich (maqsad chizig'i 70%), eng pastdan boshlab; ostida «Eng past / Eng yuqori muvaffaqiyat».
 */
export const LogistRegionSuccessCard = ({
  model,
  className,
}: {
  model: LogistDashboardModel;
  className?: string;
}) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const extreme = (key: "lowest" | "highest", row: LogistRegionRow) => (
    <div className="flex min-w-0 flex-col gap-0.5" data-logist-extreme={key}>
      <span className="text-xs text-text-muted">{t(`v2Logist.regions.${key}`)}</span>
      <span className="truncate text-sm font-semibold text-text">{row.name}</span>
      <span className="text-xs text-text-muted">
        {t("v2Logist.regions.extremeMeta", {
          rate: formatPercentLocalized(row.rate, { language }),
          sold: formatNumberLocalized(row.delivered, { language }),
          total: formatNumberLocalized(row.total, { language }),
        })}
      </span>
    </div>
  );

  return (
    <Card
      divided={false}
      className={className}
      title={t("v2Logist.regions.title")}
      description={t("v2Logist.regions.sub")}
      bodyClassName="flex flex-1 flex-col gap-4"
    >
      <ul aria-label={t("v2Logist.regions.title")} className="m-0 flex list-none flex-col gap-4 p-0">
        {model.bySuccess.map((row) => (
          <RegionMeterRow key={row.id} row={row} />
        ))}
      </ul>
      {model.extremes ? (
        <div className="mt-auto grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-x-4 gap-y-3 rounded-xl bg-sunken px-4 py-3">
          {extreme("lowest", model.extremes.lowest)}
          {extreme("highest", model.extremes.highest)}
        </div>
      ) : null}
    </Card>
  );
};

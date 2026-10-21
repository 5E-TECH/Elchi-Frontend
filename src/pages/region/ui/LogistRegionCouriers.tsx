// dizayn-v2: logist-regions-detail
import { ChevronDown, ChevronUp, CircleX, TriangleAlert, Truck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { successZoneTone } from "../../../shared/ui/charts";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { COURIER_TOP, type LogistCourierRow } from "../model/logistRegionModel";

/** Muvaffaqiyat 70% dan past — ogohlantirish ikonkasi (sariq / qizil zona); ma'nosi yonidagi foiz matnida. */
const RateIcon = ({ rate }: { rate: number }) => {
  const tone = successZoneTone(rate);
  if (tone === "success") return null;
  const Icon = tone === "danger" ? CircleX : TriangleAlert;
  return (
    <Icon
      size={14}
      aria-hidden="true"
      className={tone === "danger" ? "shrink-0 text-danger-fg" : "shrink-0 text-warning-fg"}
    />
  );
};

/**
 * «KURYERLAR (N)» (maket `logist-regions-detail`): viloyatda buyurtmasi bor kuryerlar — top 5, qolgani «Yana N ta
 * kuryer». Desktop — jadval (№ · Kuryer + telefon · Tuman · Buyurtmalar · Sotilgan · bekor · Muvaffaqiyat; planshetda
 * «Tuman» va «Sotilgan · bekor» yashirin), telefon — ro'yxat. Pul yo'q (ega LG-S1). «Barcha kuryerlar» havolasi —
 * `/couriers` sahifasi bilan LG-5 da.
 */
export const LogistRegionCouriers = ({
  rows,
  counts,
}: {
  rows: LogistCourierRow[];
  counts: { active: number; total: number } | null;
}) => {
  const { t, i18n } = useTranslation("region");
  const language = i18n.language;
  const [expanded, setExpanded] = useState(false);
  const number = (value: number) => formatNumberLocalized(value, { language });
  const visible = expanded ? rows : rows.slice(0, COURIER_TOP);
  const hidden = rows.length - COURIER_TOP;
  const position = new Map(rows.map((row, index) => [row.id, index + 1]));

  const columns: DataTableColumn<LogistCourierRow>[] = [
    {
      id: "position",
      header: t("v2.logistView.couriers.position"),
      align: "end",
      className: "w-10",
      cellClassName: "text-text-muted",
      cell: (row) => number(position.get(row.id) ?? 0),
    },
    {
      id: "courier",
      header: t("v2.logistView.couriers.courier"),
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-bold text-text-muted"
          >
            {row.initials}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-semibold whitespace-nowrap text-text">{row.name}</span>
            {row.phone ? (
              <span className="text-[13px] whitespace-nowrap text-text-muted">
                {formatPhone(row.phone)}
              </span>
            ) : null}
          </span>
        </span>
      ),
    },
    {
      id: "district",
      header: t("v2.logistView.couriers.district"),
      hideBelow: "lg",
      cellClassName: "whitespace-nowrap",
      cell: (row) => row.districtName ?? "—",
    },
    {
      id: "orders",
      header: t("v2.logistView.couriers.orders"),
      align: "end",
      cell: (row) => number(row.orders),
    },
    {
      id: "soldCancelled",
      header: t("v2.logistView.couriers.soldCancelled"),
      align: "end",
      hideBelow: "lg",
      cell: (row) => `${number(row.sold)} · ${number(row.cancelled)}`,
    },
    {
      id: "success",
      header: t("v2.logistView.couriers.success"),
      align: "end",
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <RateIcon rate={row.rate} />
          {formatPercentLocalized(row.rate, { language })}
        </span>
      ),
    },
  ];

  const renderCard = (row: LogistCourierRow) => (
    <div className="flex min-w-0 flex-col gap-1 py-3">
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-semibold text-text">
          {`${number(position.get(row.id) ?? 0)}. ${row.name}`}
        </span>
        <span className="font-semibold whitespace-nowrap text-text">
          {t("v2.common.countTa", { count: number(row.orders) })}
        </span>
      </span>
      <span className="text-xs text-text-muted">
        {[row.districtName, row.phone ? formatPhone(row.phone) : null].filter(Boolean).join(" · ")}
      </span>
      <span className="inline-flex items-center gap-1 text-xs text-text-muted">
        <RateIcon rate={row.rate} />
        {t("v2.logistView.couriers.cardSummary", {
          rate: formatPercentLocalized(row.rate, { language }),
          cancelled: number(row.cancelled),
        })}
      </span>
    </div>
  );

  return (
    <Card
      divided={false}
      title={t("v2.logistView.couriers.title")}
      titleAddon={
        rows.length > 0 ? (
          <span className="text-base font-semibold text-text-muted">({number(rows.length)})</span>
        ) : undefined
      }
      description={
        counts
          ? t("v2.logistView.couriers.subtitle", {
              active: number(counts.active),
              total: number(counts.total),
            })
          : t("v2.logistView.couriers.subtitleNoCounts")
      }
      bodyClassName="flex flex-col gap-4"
    >
      {rows.length === 0 ? (
        <EmptyState
          size="chart"
          icon={Truck}
          title={t("v2.logistView.couriers.empty.title")}
          description={t("v2.logistView.couriers.empty.text")}
        />
      ) : (
        <>
          <DataTable
            rows={visible}
            columns={columns}
            getRowKey={(row) => row.id}
            label={t("v2.logistView.couriers.label")}
            cardsLabel={t("v2.logistView.couriers.listLabel")}
            density="compact"
            renderCard={renderCard}
            className="rounded-xl border border-border max-md:rounded-none max-md:border-0"
          />
          {hidden > 0 ? (
            <Button
              variant="ghost"
              aria-expanded={expanded}
              rightIcon={expanded ? ChevronUp : ChevronDown}
              onClick={() => setExpanded((value) => !value)}
              className="self-center"
            >
              {expanded
                ? t("v2.logistView.couriers.less")
                : t("v2.logistView.couriers.more", { count: hidden })}
            </Button>
          ) : null}
        </>
      )}
    </Card>
  );
};

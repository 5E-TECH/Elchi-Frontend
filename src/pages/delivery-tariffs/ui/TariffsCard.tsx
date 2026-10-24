// dizayn-v2: superadmin-regions-delivery-tariffs, admin-regions-delivery-tariffs
import { useId, useMemo } from "react";
import { Pencil, Truck } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  DELIVERY_TARIFF_IDS,
  formatKgValue,
  type DeliveryPricingSettings,
  type DeliveryTariff,
  type DeliveryTariffId,
  type DeliveryTariffsData,
} from "../../../entities/delivery-pricing";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import {
  Button,
  Card,
  DataTable,
  ErrorState,
  QueryBoundary,
  SkeletonTable,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { scheduledChanges } from "../model/history";
import { CardHead } from "./CardHead";
import { useTariffText } from "./useTariffText";

type Row = { id: DeliveryTariffId; tariff: DeliveryTariff | null };

export type TariffsCardProps = {
  query: Pick<UseQueryResult<DeliveryTariffsData>, "data" | "isLoading" | "isError" | "error" | "refetch">;
  settings: DeliveryPricingSettings | null;
  onEdit: (id: DeliveryTariffId) => void;
};

/**
 * «TARIFLAR — ASOSIY NARX VA HAR KG NARXI» (maket `superadmin-regions-delivery-tariffs`): jadval «Yo'nalish ·
 * Asosiy narx · {chegara} kg gacha · Har qo'shimcha kg · Muddat · Kuchga kirgan» (planshetda oxirgi ikkisi
 * yashirin) + «O'zgartirish» (yangi versiya oynasi); telefonda kartalar. Pastda kelajakdagi versiyalar —
 * «Rejalashtirilgan: …».
 */
export const TariffsCard = ({ query, settings, onEdit }: TariffsCardProps) => {
  const { t, language, money, days, changes, name } = useTariffText();
  const titleId = useId();
  const rows = useMemo<Row[] | undefined>(
    () => (query.data ? DELIVERY_TARIFF_IDS.map((id) => ({ id, tariff: query.data?.current[id] ?? null })) : undefined),
    [query.data],
  );
  const scheduled = useMemo(() => (query.data ? scheduledChanges(query.data) : []), [query.data]);

  const baseHeader = settings
    ? t("page.tariffs.columns.baseUpTo", { first: formatKgValue(settings.firstKgIncluded, language) })
    : t("page.tariffs.columns.base");

  const editButton = (row: Row, block = false) => (
    <Button
      variant="secondary"
      size="sm"
      leftIcon={Pencil}
      aria-label={t("page.tariffs.editAria", { name: name(row.id) })}
      onClick={() => onEdit(row.id)}
      className={block ? "w-full" : undefined}
    >
      {t("page.tariffs.edit")}
    </Button>
  );

  const priceOrDash = (value: number | undefined) =>
    value === undefined ? (
      <>
        <span aria-hidden="true" className="text-text-subtle">
          —
        </span>
        <span className="sr-only">{t("page.tariffs.noTariff")}</span>
      </>
    ) : (
      money(value)
    );

  const columns: DataTableColumn<Row>[] = [
    {
      id: "direction",
      header: t("page.tariffs.columns.direction"),
      cell: (row) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold text-text">{name(row.id)}</span>
          <span className="text-xs text-text-muted">{t(`page.tableScope.${row.id}`)}</span>
        </span>
      ),
    },
    {
      id: "base",
      header: baseHeader,
      align: "end",
      cell: (row) => <span className="font-semibold text-text">{priceOrDash(row.tariff?.basePrice)}</span>,
    },
    {
      id: "perKg",
      header: t("page.tariffs.columns.perKg"),
      align: "end",
      cell: (row) => (
        <span className="flex flex-col items-end gap-0.5">
          <span className="font-semibold text-text">{priceOrDash(row.tariff?.extraPerKg)}</span>
          {row.tariff ? <span className="text-xs text-text-muted">{t("page.tariffs.perKgSub")}</span> : null}
        </span>
      ),
    },
    {
      id: "days",
      header: t("page.tariffs.columns.days"),
      hideBelow: "lg",
      className: "whitespace-nowrap",
      cell: (row) => (row.tariff ? days(row.tariff.daysMin, row.tariff.daysMax) : "—"),
    },
    {
      id: "validFrom",
      header: t("page.tariffs.columns.validFrom"),
      hideBelow: "lg",
      className: "whitespace-nowrap",
      cell: (row) => (row.tariff ? formatDateLocalized(row.tariff.validFrom) : "—"),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("page.tariffs.columns.actions")}</span>,
      cellClassName: "text-right",
      cell: (row) => editButton(row),
    },
  ];

  // Telefon kartasi (maket `.el-list-item`): nom + muddat, «Asosiy narx», «Har qo'shimcha kg», to'liq enli tugma.
  const renderCard = (row: Row) => (
    <div className="flex flex-col gap-2 px-4 py-3 text-sm">
      <span className="flex justify-between gap-3">
        <span className="font-semibold text-text">{name(row.id)}</span>
        <span className="text-[13px] text-text-muted">
          {row.tariff ? days(row.tariff.daysMin, row.tariff.daysMax) : null}
        </span>
      </span>
      <span className="flex justify-between gap-3">
        <span className="text-[13px] text-text-muted">{t("page.tariffs.columns.base")}</span>
        <span className="font-semibold text-text">{priceOrDash(row.tariff?.basePrice)}</span>
      </span>
      <span className="flex justify-between gap-3">
        <span className="text-[13px] text-text-muted">{t("page.tariffs.columns.perKg")}</span>
        <span className="font-semibold text-text">{priceOrDash(row.tariff?.extraPerKg)}</span>
      </span>
      {editButton(row, true)}
    </div>
  );

  return (
    <Card
      as="section"
      padding="none"
      aria-labelledby={titleId}
      footer={
        scheduled.length ? (
          <div className="flex min-w-0 flex-col gap-1">
            {scheduled.map((entry) => (
              <p key={entry.version.id} className="m-0 text-[13px] text-text-muted">
                {t("page.tariffs.scheduled", {
                  name: name(entry.version.tariffId),
                  changes: changes(entry.changes),
                  date: formatDateLocalized(entry.version.validFrom),
                })}
              </p>
            ))}
          </div>
        ) : undefined
      }
    >
      <CardHead
        id={titleId}
        icon={Truck}
        title={t("page.tariffs.title")}
        description={t("page.tariffs.description")}
      />
      <QueryBoundary
        query={{ ...query, data: rows }}
        loadingLabel={t("page.tariffs.loading")}
        loading={
          <SkeletonTable
            framed={false}
            columns={[t("page.tariffs.columns.direction"), baseHeader, t("page.tariffs.columns.perKg")]}
            rows={3}
          />
        }
        error={(error, retry) => <ErrorState error={error} title={t("page.tariffs.loadFailed")} onRetry={retry} />}
      >
        {(list) => (
          <DataTable
            rows={list}
            columns={columns}
            getRowKey={(row) => row.id}
            label={t("page.tariffs.title")}
            renderCard={renderCard}
          />
        )}
      </QueryBoundary>
    </Card>
  );
};

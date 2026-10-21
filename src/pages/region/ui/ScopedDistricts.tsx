// dizayn-v2: manager-regions-scoped, courier-regions-scoped, logist-regions-detail
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleX,
  MapPin,
  PackageCheck,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { shareOf } from "../../../entities/region";
import { cx } from "../../../shared/lib/cx";
import {
  MINUS_SIGN,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
} from "../../../shared/lib/formatMoney";
import { Badge, Button, Pressable } from "../../../shared/ui/primitives";
import {
  ChartLegend,
  ChartNote,
  DeltaChip,
  RankList,
  RingStat,
  SegBar,
  successZoneTone,
  type RankItem,
} from "../../../shared/ui/charts";
import { tileScale, type DistrictRow, type TileStep } from "../model/scopedModel";
import { STEP_CLASS } from "../model/regionsModel";
import { StatusBar } from "./regionBlocks";

/** Katak matni: och pog'onalarda `region-map-label`, eng to'qida `surface` (kontrast); bo'sh — `text-muted`. */
const TILE_TEXT: Record<TileStep, string> = {
  0: "text-text-muted",
  1: "text-region-map-label",
  2: "text-region-map-label",
  3: "text-region-map-label",
  4: "text-surface",
};

const ppText = (value: number, language: string) => {
  const sign = value > 0 ? "+" : value < 0 ? MINUS_SIGN : "";
  return `${sign}${formatNumberLocalized(Math.abs(value), { language, fractionDigits: 1 })}`;
};

const useFormat = () => {
  const { t, i18n } = useTranslation("region");
  const language = i18n.language;
  return {
    t,
    language,
    number: (value: number) => formatNumberLocalized(value, { language }),
    percent: (value: number, fractionDigits?: number) =>
      formatPercentLocalized(value, { language, fractionDigits }),
    money: (value: number) => formatMoneyLocalized(value, { language }),
  };
};

/**
 * «Tanlangan tuman» paneli: halqa (muvaffaqiyat) + viloyatga nisbatan p.p. + jami/tushum + holatlar.
 * LG-3: logistda (`metric="couriers"`, maket `logist-regions-detail`) tushum o'rnida «Kuryerlar» — logist pulni
 * ko'rmaydi (ega LG-S1).
 */
export const SelectedDistrictPanel = ({
  row,
  regionRate,
  metric = "revenue",
}: {
  row: DistrictRow;
  regionRate: number;
  metric?: "revenue" | "couriers";
}) => {
  const { t, language, number, percent, money } = useFormat();
  const delta = row.orders > 0 ? row.rate - regionRate : null;
  return (
    <section
      aria-label={t("v2.scoped.selected.aria", { name: row.name })}
      aria-live="polite"
      className="flex min-w-0 flex-col gap-4 rounded-xl bg-sunken p-4"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <MapPin size={16} aria-hidden="true" className="shrink-0 text-text-muted" />
        <h3 className="min-w-0 text-sm font-bold text-text">{row.name}</h3>
        {row.satoCode ? (
          <Badge size="sm" variant="outline">
            {t("v2.common.sato", { code: row.satoCode })}
          </Badge>
        ) : null}
        <span className="ml-auto text-xs text-text-muted max-md:ml-0 max-md:w-full">
          {t("v2.scoped.selected.label")}
        </span>
      </div>
      <RingStat
        size="lg"
        value={row.rate}
        tone={row.orders > 0 ? successZoneTone(row.rate) : "neutral"}
        label={t("v2.scoped.selected.success")}
        valueText={row.orders > 0 ? percent(row.rate) : "—"}
        meta={
          delta != null ? (
            <>
              <DeltaChip
                value={delta}
                text={t("v2.common.pp", { value: ppText(delta, language) })}
              />
              <span>{t("v2.scoped.selected.vsRegion")}</span>
            </>
          ) : undefined
        }
      />
      <dl className="m-0 grid grid-cols-2 gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs text-text-muted">{t("v2.kpi.total")}</dt>
          <dd className="m-0 text-lg font-bold text-text">
            {t("v2.common.countTa", { count: number(row.orders) })}
          </dd>
        </div>
        {metric === "couriers" ? (
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-text-muted">{t("v2.logistView.selected.couriers")}</dt>
            <dd className="m-0 text-lg font-bold whitespace-nowrap text-text">
              {t("v2.common.countTa", { count: number(row.couriers) })}
            </dd>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-text-muted">{t("v2.scoped.selected.revenue")}</dt>
            <dd className="m-0 text-lg font-bold whitespace-nowrap text-text">
              {money(row.revenue)}
            </dd>
          </div>
        )}
      </dl>
      <SegBar
        ariaLabel={t("v2.scoped.selected.statusAria", {
          name: row.name,
          sold: number(row.sold),
          pending: number(row.pending),
          cancelled: number(row.cancelled),
        })}
        segments={[
          {
            key: "sold",
            label: t("v2.status.sold"),
            value: row.sold,
            tone: "success",
            icon: PackageCheck,
          },
          {
            key: "pending",
            label: t("v2.status.pending"),
            value: row.pending,
            tone: "warning",
            icon: Truck,
          },
          {
            key: "cancelled",
            label: t("v2.status.cancelled"),
            value: row.cancelled,
            tone: "danger",
            icon: CircleX,
          },
        ]}
      />
    </section>
  );
};

/** Tuman kataklari (`.el-tile`) + shkala + izoh. Katak — tugma (aria to'liq), tanlangan — `aria-pressed`. */
export const DistrictTiles = ({
  rows,
  selectedId,
  onSelect,
}: {
  rows: DistrictRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) => {
  const { t, number, percent } = useFormat();
  const maxOrders = rows[0]?.orders ?? 0;
  const scale = tileScale(maxOrders);
  const empty = rows.filter((row) => row.orders <= 0).length;
  const top = rows[0];
  const rangeLabel = (index: 0 | 1 | 2) => {
    const from = scale.bounds[index];
    const to = scale.bounds[index + 1] - 1;
    return from === to ? number(from) : `${number(from)}–${number(to)}`;
  };
  const steps = [rangeLabel(0), rangeLabel(1), rangeLabel(2), `${number(scale.bounds[3])}+`];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div
        role="group"
        aria-label={
          top && top.orders > 0
            ? t("v2.scoped.tiles.aria", {
                name: top.name,
                count: number(top.orders),
                empty: number(empty),
              })
            : t("v2.scoped.tiles.ariaEmpty")
        }
        className="grid grid-cols-4 gap-1 max-lg:grid-cols-4"
      >
        {rows.map((row) => {
          const step = scale.stepOf(row.orders);
          const selected = row.id === selectedId;
          return (
            <Pressable
              key={row.id}
              aria-pressed={selected}
              aria-label={
                row.orders > 0
                  ? t("v2.scoped.tiles.tileAria", {
                      name: row.name,
                      count: number(row.orders),
                      sold: number(row.sold),
                      cancelled: number(row.cancelled),
                      pending: number(row.pending),
                      rate: percent(row.rate),
                    })
                  : t("v2.scoped.tiles.tileAriaEmpty", { name: row.name })
              }
              onClick={() => onSelect(row.id)}
              className={cx(
                "flex min-h-[72px] min-w-0 flex-col justify-between gap-0.5 rounded-lg px-2 py-1.5 text-left",
                "transition-[box-shadow,filter] duration-150 hover:brightness-95 motion-reduce:transition-none",
                STEP_CLASS[step],
                TILE_TEXT[step],
                selected && "ring-2 ring-text ring-offset-1 ring-offset-surface",
              )}
            >
              <span className="text-xs font-semibold leading-[14px] [overflow-wrap:anywhere]">
                {row.name}
              </span>
              <span className="text-sm font-bold proportional-nums">
                {row.orders > 0 ? t("v2.common.countTa", { count: number(row.orders) }) : number(0)}
              </span>
            </Pressable>
          );
        })}
      </div>
      <div
        role="img"
        aria-label={t("v2.scoped.tiles.scaleAria", { steps: steps.join(", ") })}
        className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1.5 text-xs text-text-muted"
      >
        <span className="pt-px font-semibold text-text max-md:w-full">
          {t("v2.map.metric.orders")}
        </span>
        <span className="flex gap-0.5">
          {steps.map((label, index) => (
            <span key={label} className="flex w-12 flex-col gap-1">
              <span
                className={cx("h-2.5 w-full rounded-[2px]", STEP_CLASS[(index + 1) as TileStep])}
              />
              <span className="whitespace-nowrap">{label}</span>
            </span>
          ))}
        </span>
        <span className="flex w-10 flex-col gap-1">
          <span
            className={cx(
              "h-2.5 w-full rounded-[2px] ring-1 ring-inset ring-border",
              STEP_CLASS[0],
            )}
          />
          <span>{t("v2.map.scale.none")}</span>
        </span>
      </div>
      <ChartNote>{t("v2.scoped.tiles.note")}</ChartNote>
    </div>
  );
};

/** Telefon: bosiladigan reyting (holat chizig'i bilan) + buyurtmasiz tumanlar chiplari. */
export const DistrictRankPhone = ({
  rows,
  selectedId,
  onSelect,
}: {
  rows: DistrictRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) => {
  const { t, number, percent } = useFormat();
  const withOrders = rows.filter((row) => row.orders > 0);
  const withoutOrders = rows.filter((row) => row.orders <= 0);
  const items: RankItem[] = withOrders.map((row) => ({
    id: row.id,
    name: row.name,
    value: t("v2.common.countTa", { count: number(row.orders) }),
    sub: t("v2.map.rank.sold", { rate: percent(row.rate) }),
    highlight: row.id === selectedId,
    onClick: () => onSelect(row.id),
    ariaLabel: t("v2.scoped.rank.rowAria", {
      name: row.name,
      count: number(row.orders),
      rate: percent(row.rate),
    }),
    meta: (
      <StatusBar
        sold={row.sold}
        pending={row.pending}
        cancelled={row.cancelled}
        ariaLabel={t("v2.common.statusShortAria", {
          sold: number(row.sold),
          pending: number(row.pending),
          cancelled: number(row.cancelled),
        })}
        className="mt-1 w-full"
      />
    ),
  }));
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {items.length > 0 ? (
        <RankList
          items={items}
          ariaLabel={t("v2.scoped.rank.aria")}
          showAvatar={false}
          limit={items.length}
        />
      ) : null}
      {withoutOrders.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-text">{t("v2.scoped.noOrders.title")}</h3>
          <p className="text-xs text-text-muted">
            {t("v2.scoped.noOrders.meta", { count: number(withoutOrders.length) })}
          </p>
          <div className="flex flex-wrap gap-2">
            {withoutOrders.map((row) => (
              <Pressable
                key={row.id}
                aria-pressed={row.id === selectedId}
                aria-label={t("v2.scoped.noOrders.chipAria", { name: row.name })}
                onClick={() => onSelect(row.id)}
                className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-3 text-[13px] font-medium text-text hover:border-text-subtle aria-pressed:border-action aria-pressed:bg-action-soft aria-pressed:font-semibold aria-pressed:text-action-fg max-md:h-11"
              >
                {row.name}
              </Pressable>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

/**
 * «Tumanlar kesimida» jadvali: Tuman (+SATO) · Buyurtmalar (chiziq) · Holat · Muvaffaqiyat · Tushum.
 * LG-3: logistda `showRevenue={false}` — «Tushum» ustuni yo'q (maket `logist-regions-detail`, ega LG-S1).
 */
export const DistrictTable = ({
  rows,
  onSelect,
  showRevenue = true,
}: {
  rows: DistrictRow[];
  onSelect?: (id: string) => void;
  showRevenue?: boolean;
}) => {
  const { t, number, percent, money } = useFormat();
  const [showEmpty, setShowEmpty] = useState(false);
  const withOrders = rows.filter((row) => row.orders > 0);
  const withoutOrders = rows.filter((row) => row.orders <= 0);
  const total = rows.reduce(
    (acc, row) => ({
      orders: acc.orders + row.orders,
      sold: acc.sold + row.sold,
      pending: acc.pending + row.pending,
      cancelled: acc.cancelled + row.cancelled,
      revenue: acc.revenue + row.revenue,
    }),
    { orders: 0, sold: 0, pending: 0, cancelled: 0, revenue: 0 },
  );
  const maxOrders = withOrders[0]?.orders ?? 0;
  const totalRate = total.orders > 0 ? (total.sold / total.orders) * 100 : 0;
  const td = "h-12 border-b border-border px-3 py-1.5 align-middle";
  const shortName = (name: string) => name.replace(/\s+tumani$/i, "");

  const bodyRows = [...withOrders, ...(showEmpty ? withoutOrders : [])];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="relative overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {[
                { key: "name", label: t("v2.scoped.table.district"), className: "text-left" },
                { key: "orders", label: t("v2.scoped.table.orders"), className: "text-left" },
                {
                  key: "status",
                  label: t("v2.scoped.table.status"),
                  className: "text-left max-lg:hidden",
                },
                { key: "rate", label: t("v2.scoped.table.success"), className: "text-right" },
                ...(showRevenue
                  ? [
                      {
                        key: "revenue",
                        label: t("v2.scoped.table.revenue"),
                        className: "text-right max-md:hidden",
                      },
                    ]
                  : []),
              ].map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cx(
                    "h-9 whitespace-nowrap border-b border-border bg-sunken px-3 text-xs font-semibold uppercase tracking-[.04em] text-text-muted",
                    column.className,
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row) => {
              const tone = successZoneTone(row.rate);
              const ZoneIcon =
                row.orders > 0 && tone !== "success"
                  ? tone === "danger"
                    ? CircleAlert
                    : TriangleAlert
                  : null;
              return (
                <tr key={row.id}>
                  <td className={td}>
                    <span className="flex min-w-0 flex-col">
                      {onSelect ? (
                        <Pressable
                          onClick={() => onSelect(row.id)}
                          className="text-left font-semibold text-text hover:underline"
                        >
                          {row.name}
                        </Pressable>
                      ) : (
                        <span className="font-semibold text-text">{row.name}</span>
                      )}
                      {row.satoCode ? (
                        <span className="text-xs text-text-muted">
                          {t("v2.common.sato", { code: row.satoCode })}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className={td}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden="true" className="h-3 min-w-0 flex-1 max-md:hidden">
                        <span
                          className="block h-full rounded-[3px] bg-action"
                          style={{
                            width: `${maxOrders > 0 ? Math.max(2, shareOf(row.orders, maxOrders)) : 0}%`,
                          }}
                        />
                      </span>
                      <span className="shrink-0 font-semibold text-text proportional-nums">
                        {number(row.orders)}
                      </span>
                    </span>
                  </td>
                  <td className={cx(td, "max-lg:hidden")}>
                    <span className="flex w-40 flex-col gap-1">
                      <StatusBar
                        sold={row.sold}
                        pending={row.pending}
                        cancelled={row.cancelled}
                        ariaLabel={t("v2.common.statusShortAria", {
                          sold: number(row.sold),
                          pending: number(row.pending),
                          cancelled: number(row.cancelled),
                        })}
                      />
                      <span className="text-xs text-text-muted">
                        {`${number(row.sold)} · ${number(row.pending)} · ${number(row.cancelled)}`}
                      </span>
                    </span>
                  </td>
                  <td className={cx(td, "whitespace-nowrap text-right text-text")}>
                    <span className="inline-flex items-center gap-1.5">
                      {ZoneIcon ? (
                        <ZoneIcon
                          size={16}
                          aria-hidden="true"
                          className={tone === "danger" ? "text-danger-fg" : "text-warning-fg"}
                        />
                      ) : null}
                      {row.orders > 0 ? percent(row.rate) : "—"}
                    </span>
                  </td>
                  {showRevenue ? (
                    <td className={cx(td, "whitespace-nowrap text-right text-text max-md:hidden")}>
                      {money(row.revenue)}
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {withoutOrders.length > 0 ? (
              <tr className="bg-sunken">
                <td colSpan={showRevenue ? 5 : 4} className="border-b border-border px-3 py-2">
                  <span className="flex min-w-0 items-center justify-between gap-3">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-semibold text-text">
                        {t("v2.scoped.noOrders.row", { count: number(withoutOrders.length) })}
                      </span>
                      <span className="text-xs text-text-muted">
                        {withoutOrders.map((row) => shortName(row.name)).join(", ")}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-expanded={showEmpty}
                      rightIcon={showEmpty ? ChevronUp : ChevronDown}
                      onClick={() => setShowEmpty((value) => !value)}
                      className="shrink-0"
                    >
                      {showEmpty ? t("v2.common.hide") : t("v2.common.show")}
                    </Button>
                  </span>
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-text">
              <td className="h-11 px-3 py-1.5">
                {t("v2.scoped.table.total", { count: number(rows.length) })}
              </td>
              <td className="h-11 whitespace-nowrap px-3 py-1.5">
                {t("v2.common.countTa", { count: number(total.orders) })}
              </td>
              <td className="h-11 whitespace-nowrap px-3 py-1.5 max-lg:hidden">
                {`${number(total.sold)} · ${number(total.pending)} · ${number(total.cancelled)}`}
              </td>
              <td className="h-11 whitespace-nowrap px-3 py-1.5 text-right">
                {percent(totalRate)}
              </td>
              {showRevenue ? (
                <td className="h-11 whitespace-nowrap px-3 py-1.5 text-right max-md:hidden">
                  {money(total.revenue)}
                </td>
              ) : null}
            </tr>
          </tfoot>
        </table>
      </div>
      <ChartLegend
        className="max-lg:hidden"
        items={[
          { key: "sold", tone: "success", label: t("v2.status.sold") },
          { key: "pending", tone: "warning", label: t("v2.status.pending") },
          { key: "cancelled", tone: "danger", label: t("v2.status.cancelled") },
        ]}
      />
    </div>
  );
};

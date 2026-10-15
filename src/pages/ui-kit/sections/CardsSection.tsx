import type { ReactNode } from "react";
import { Banknote, ChevronDown, ChevronRight, CircleX, Pencil, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
} from "../../../shared/lib/formatMoney";
import { Button, buttonClasses } from "../../../shared/ui/primitives/Button";
import { Card } from "../../../shared/ui/primitives/Card";
import { StatCard } from "../../../shared/ui/primitives/StatCard";
import { KitSection } from "../KitSection";
import { ThemePair } from "../ThemePair";

/** Guruh sarlavhasi (namuna ustida): nom va qisqa izoh. */
const Group = ({ title, meta, children }: { title: string; meta: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-3">
    <div className="flex min-w-0 flex-col gap-0.5">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <p className="text-xs text-text-muted">{meta}</p>
    </div>
    {children}
  </div>
);

/**
 * Ixcham pulni maketdagidek ikkiga bo'ladi: katta raqam va kichik birlik (`48,6` + `mln so'm`,
 * `.el-kpi-value` / `.el-kpi-unit`). Matnni `formatCompactMoneyLocalized` yozadi, bu yer faqat
 * raqam qismini ajratadi (en: `48.6M UZS` → `48.6` + `M UZS`).
 */
const splitCompact = (formatted: string) => {
  const match = /^([−-]?[\d\s.,]*\d)\s*(.*)$/u.exec(formatted);
  return match ? { value: match[1], unit: match[2] || undefined } : { value: formatted, unit: undefined };
};

/**
 * «Kartalar» bo'limi — `Card` va `StatCard` namunalari, kunduzgi va tungi mavzuda (bitta `ThemePair`,
 * ichida guruhlar). Sarlavhalar tuzilmasi: bo'lim h2 → guruh h3 → karta h4 (ko'rinishi maketdagi `.el-h2`).
 *
 * Maket: `superadmin-orders-detail` («Manzil», «To'lov» kartalari), `superadmin-dashboard-main`
 * (ko'rsatkich kartalari, «Buyurtmalar holati», «Hududlar bo'yicha» ichki bloki), `tizim-loading` (skelet).
 * Ma'lumotlar maketdagi namunaviy qiymatlar; son va pul — `formatMoney.ts` orqali.
 */
export const CardsSection = () => {
  const { t, i18n } = useTranslation("ui");
  const language = i18n.language;
  const compact = (value: number) => splitCompact(formatCompactMoneyLocalized(value, { language }));
  const number = (value: number) => formatNumberLocalized(value, { language });
  const percent = (value: number) => formatPercentLocalized(value, { language });
  const pcs = t("card.demo.stats.pcs");

  const paymentRows = [
    { label: t("card.demo.payment.total"), value: 185_000, className: "text-base font-bold text-text" },
    { label: t("card.demo.payment.due"), value: 185_000, className: "font-semibold text-text" },
    { label: t("card.demo.payment.paid"), value: 0, className: "font-semibold text-text-muted" },
  ];

  const addressRows = [
    [t("card.demo.address.region"), t("card.demo.address.regionValue")],
    [t("card.demo.address.district"), t("card.demo.address.districtValue")],
    [t("card.demo.address.street"), t("card.demo.address.streetValue")],
  ];

  const regionFacts = [
    {
      label: t("card.demo.regions.topOrders"),
      value: t("card.demo.regions.topOrdersValue"),
      meta: t("card.demo.regions.topOrdersMeta", { orders: number(112), percent: percent(36) }),
    },
    {
      label: t("card.demo.regions.lowSales"),
      value: t("card.demo.regions.lowSalesValue"),
      meta: t("card.demo.regions.lowSalesMeta", { percent: percent(71.4), sold: number(15), total: number(21) }),
    },
    {
      label: t("card.demo.regions.couriers"),
      value: t("card.demo.regions.couriersValue", { couriers: number(86) }),
      meta: t("card.demo.regions.couriersMeta", { regions: number(14) }),
    },
  ];

  return (
    <KitSection id="cards" title={t("kit.sections.cards.title")} description={t("kit.sections.cards.description")}>
      <ThemePair>
        <div className="flex min-w-0 flex-col gap-6">
          <Group title={t("card.groups.surfaces.title")} meta={t("card.groups.surfaces.meta")}>
            <Card
              title={t("card.demo.address.title")}
              titleAs="h4"
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={Pencil}
                  aria-label={t("card.demo.address.editLabel")}
                  className="-my-1 -mr-2"
                >
                  {t("card.demo.address.edit")}
                </Button>
              }
            >
              <dl className="m-0 grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
                {addressRows.map(([term, detail]) => (
                  <div key={term} className="contents">
                    <dt className="text-text-muted">{term}</dt>
                    <dd className="m-0 min-w-0 font-semibold text-text">{detail}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card title={t("card.demo.payment.title")} titleAs="h4" padding="none" bodyClassName="px-5 py-1">
              {paymentRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-3 border-t border-border py-3 text-sm first:border-t-0"
                >
                  <span className="text-text-muted">{row.label}</span>
                  <span className={row.className}>{formatMoneyLocalized(row.value, { language })}</span>
                </div>
              ))}
            </Card>

            <Card as="div">
              <p className="text-sm text-text-muted">{t("card.demo.plain")}</p>
            </Card>
          </Group>

          <Group title={t("card.groups.inset.title")} meta={t("card.groups.inset.meta")}>
            <Card
              title={t("card.demo.regions.title")}
              titleAs="h4"
              description={t("card.demo.regions.description")}
              footer={
                <Button variant="ghost" size="sm" rightIcon={ChevronDown} className="mx-auto">
                  {t("card.demo.regions.all", { regions: number(14) })}
                </Button>
              }
            >
              {/* Maket: `repeat(auto-fit, minmax(min(150px, 100%), 1fr))`, oraliq 12 × 16. */}
              <Card as="div" bodyClassName="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-x-4 gap-y-3">
                {regionFacts.map((fact) => (
                  <div key={fact.label} className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs text-text-muted">{fact.label}</span>
                    <span className="text-sm font-semibold text-text">{fact.value}</span>
                    <span className="text-xs text-text-muted">{fact.meta}</span>
                  </div>
                ))}
              </Card>
            </Card>
          </Group>

          <Group title={t("card.groups.chart.title")} meta={t("card.groups.chart.meta")}>
            <Card
              divided={false}
              title={t("card.demo.status.title")}
              titleAs="h4"
              description={t("card.demo.status.description")}
              actions={
                <Link to="/orders" className={buttonClasses({ variant: "link", size: "sm", className: "-mr-1" })}>
                  {t("card.demo.status.list")}
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              }
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[32px] leading-9 font-bold text-text proportional-nums">{number(312)}</span>
                <span className="text-xs font-semibold text-text-muted">{t("card.demo.status.total")}</span>
              </div>
            </Card>
          </Group>

          <Group title={t("card.groups.stats.title")} meta={t("card.groups.stats.meta")}>
            {/* Sahifadagi `.el-kpi-row` kabi: telefonda 2 ustun (ikonka yashirin, 22px qiymat), keng panelda 4.
                Planshetda panel juda tor (ikki mavzu yonma-yon, < 24rem) — o'shanda 1 ustun. */}
            <div className="@container min-w-0">
              <div className="grid grid-cols-2 gap-4 max-md:gap-3 md:@max-sm:grid-cols-1 @4xl:grid-cols-4">
                <StatCard
                  label={t("card.demo.stats.revenue")}
                  {...compact(48_600_000)}
                  icon={Banknote}
                  delta={6.4}
                  hint={t("card.demo.stats.vsYesterday")}
                />
                <StatCard
                  label={t("card.demo.stats.lostRevenue")}
                  {...compact(5_000_000)}
                  delta={-10.7}
                  goodWhen="down"
                  hint={t("card.demo.stats.vsYesterday")}
                />
                <StatCard label={t("card.demo.stats.profit")} icon={Wallet} hint={t("card.demo.stats.profitHint")} loading />
                <StatCard
                  label={t("card.demo.stats.cancelled")}
                  value={number(25)}
                  unit={pcs}
                  icon={CircleX}
                  delta={12.5}
                  goodWhen="down"
                  hint={t("card.demo.stats.vsYesterday")}
                  href="/ops/ui-kit?section=cards"
                />
              </div>
            </div>
          </Group>
        </div>
      </ThemePair>
    </KitSection>
  );
};

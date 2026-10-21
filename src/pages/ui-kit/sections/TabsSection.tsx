import { useState, type ReactNode } from "react";
import { ChartColumn, Globe, Handshake, List, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams, type To } from "react-router-dom";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Card } from "../../../shared/ui/primitives/Card";
import { SegmentedControl, type SegmentedOption } from "../../../shared/ui/primitives/SegmentedControl";
import { getPanelId, getTabId, Tabs, type TabItem } from "../../../shared/ui/primitives/Tabs";
import { KitSection } from "../KitSection";
import { ThemePair } from "../ThemePair";

/**
 * «Tablar va segmentlar» bo'limi (`?section=tabs`).
 *
 * Namunalar maketdan: holat tablari — `superadmin-orders-list`; havola tablar —
 * `admin-balance-*`; to'liq enli — `courier-orders-pending`; holatlar va
 * segmentlar — `tizim-states-navigation` (03); davr segmenti —
 * `superadmin-dashboard-main`, `manager-branch-dashboard-main`.
 * Ikkala panel bitta holatni bo'lishadi (kunduzgi panelda tanlansa, tungida ham).
 */

type StatusTab = "all" | "new" | "received" | "onTheRoad" | "waiting" | "sold" | "paid" | "cancelled";
type ConnectionTab = "partners" | "external" | "marketplace";
type BalanceTab = "overview" | "history" | "analysis";
type CourierTab = "pending" | "all" | "cancelled";
type Period = "today" | "thisWeek" | "thisMonth" | "allTime";
type View = "chart" | "table";
type DayClose = "sold" | "cancel" | "tomorrow";

/** Maketdagi sonlar (`superadmin-orders-list`). */
const STATUS_COUNTS: Record<StatusTab, number> = {
  all: 1248,
  new: 32,
  received: 120,
  onTheRoad: 86,
  waiting: 14,
  sold: 734,
  paid: 168,
  cancelled: 94,
};
const STATUSES = Object.keys(STATUS_COUNTS) as StatusTab[];
const BALANCE_TABS: readonly BalanceTab[] = ["overview", "history", "analysis"];
const PERIODS: readonly Period[] = ["today", "thisWeek", "thisMonth", "allTime"];
/** Havola tablar namunasi URL'da: `?section=tabs&kit-tab=history`. */
const LINK_PARAM = "kit-tab";

const DemoBlock = ({ title, note, children }: { title: string; note?: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-3">
    <div className="flex min-w-0 flex-col gap-0.5">
      <h3 className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{title}</h3>
      {note ? <p className="text-[13px] text-text-muted">{note}</p> : null}
    </div>
    {children}
  </div>
);

/** Segment qatori: chapda yorliq (maket: 120 px), o'ngda boshqaruv; tor joyda ustma-ust. */
const SegmentRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
    <span className="w-[120px] shrink-0 text-[13px] text-text-muted">{label}</span>
    {children}
  </div>
);

export const TabsSection = () => {
  const { t, i18n } = useTranslation("ui");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [params] = useSearchParams();

  const [status, setStatus] = useState<StatusTab>("all");
  const [connection, setConnection] = useState<ConnectionTab>("external");
  const [courierTab, setCourierTab] = useState<CourierTab>("pending");
  const [period, setPeriod] = useState<Period>("today");
  const [periodSm, setPeriodSm] = useState<Period>("thisWeek");
  const [view, setView] = useState<View>("chart");
  const [dayClose, setDayClose] = useState<DayClose>("cancel");

  const linkParam = params.get(LINK_PARAM);
  const balance: BalanceTab = BALANCE_TABS.includes(linkParam as BalanceTab) ? (linkParam as BalanceTab) : "history";
  /** Joriy URL parametrlari (`section`, `theme-pair`) saqlanadi, faqat `kit-tab` almashadi. */
  const linkTo = (value: BalanceTab): To => {
    const next = new URLSearchParams(params);
    next.set(LINK_PARAM, value);
    return { search: `?${next.toString()}` };
  };

  const statusItems: TabItem<StatusTab>[] = STATUSES.map((value) => ({
    value,
    label: t(`tabs.demo.${value}`),
    count: STATUS_COUNTS[value],
    title:
      value === "paid" ? t("tabs.demo.paidHint") : value === "cancelled" ? t("tabs.demo.cancelledHint") : undefined,
  }));

  const connectionItems: TabItem<ConnectionTab>[] = [
    { value: "partners", label: t("tabs.demo.partners"), icon: Handshake, count: 5 },
    { value: "external", label: t("tabs.demo.external"), icon: Globe, count: 6 },
    { value: "marketplace", label: t("tabs.demo.marketplace"), icon: Store, count: 2, disabled: true },
  ];

  const balanceItems: TabItem<BalanceTab>[] = BALANCE_TABS.map((value) => ({
    value,
    label: t(`tabs.demo.${value}`),
    to: linkTo(value),
  }));

  const courierItems: TabItem<CourierTab>[] = [
    { value: "pending", label: t("tabs.demo.pending"), count: 7 },
    { value: "all", label: t("tabs.demo.all"), count: 24 },
    { value: "cancelled", label: t("tabs.demo.cancelled"), count: 3 },
  ];

  const periodOptions: SegmentedOption<Period>[] = PERIODS.map((value) => ({ value, label: t(`tabs.demo.${value}`) }));

  const viewOptions: SegmentedOption<View>[] = [
    { value: "chart", label: t("tabs.demo.chart"), icon: ChartColumn },
    { value: "table", label: t("tabs.demo.table"), icon: List },
  ];

  const dayCloseOptions: SegmentedOption<DayClose>[] = [
    { value: "sold", label: t("tabs.demo.closeSold") },
    { value: "cancel", label: t("tabs.demo.closeCancel") },
    { value: "tomorrow", label: t("tabs.demo.closeTomorrow") },
  ];

  return (
    <KitSection id="tabs" title={t("kit.sections.tabs.title")} description={t("kit.sections.tabs.description")}>
      <ThemePair>
        {(theme) => {
          // Ikki panel bir sahifada — `id` lar takrorlanmasin.
          const prefix = `kit-tabs-${theme}`;
          const statusPrefix = `${prefix}-status`;
          return (
            <div className="flex min-w-0 flex-col gap-6">
              <DemoBlock title={t("tabs.demo.statusesTitle")} note={t("tabs.demo.statusesNote")}>
                <Card as="div" padding="none">
                  <Tabs
                    idPrefix={statusPrefix}
                    ariaLabel={t("tabs.demo.statusesLabel")}
                    items={statusItems}
                    value={status}
                    onValueChange={setStatus}
                    controlsPanel
                    listClassName="px-3"
                  />
                  <div
                    role="tabpanel"
                    id={getPanelId(statusPrefix, status)}
                    aria-labelledby={getTabId(statusPrefix, status)}
                    tabIndex={0}
                    className="px-5 py-4 text-sm text-text-muted max-md:px-4"
                  >
                    {t("tabs.demo.panel", { total: formatNumberLocalized(STATUS_COUNTS[status], { language }) })}
                  </div>
                </Card>
              </DemoBlock>

              <DemoBlock title={t("tabs.demo.iconsTitle")}>
                <Tabs
                  idPrefix={`${prefix}-connections`}
                  ariaLabel={t("tabs.demo.connectionsLabel")}
                  items={connectionItems}
                  value={connection}
                  onValueChange={setConnection}
                  background="bg"
                />
              </DemoBlock>

              <DemoBlock title={t("tabs.demo.linksTitle")}>
                <Tabs
                  idPrefix={`${prefix}-balance`}
                  ariaLabel={t("tabs.demo.balanceLabel")}
                  items={balanceItems}
                  value={balance}
                  background="bg"
                />
              </DemoBlock>

              <DemoBlock title={t("tabs.demo.fullWidthTitle")}>
                {/* Maket `courier-orders-pending` (telefon): yuza fonli chiziq, tepada chegara, 4 px yon oraliq. */}
                <Tabs
                  idPrefix={`${prefix}-courier`}
                  ariaLabel={t("tabs.demo.courierLabel")}
                  items={courierItems}
                  value={courierTab}
                  onValueChange={setCourierTab}
                  fullWidth
                  className="border-t bg-surface"
                  listClassName="px-1"
                />
              </DemoBlock>

              <DemoBlock title={t("tabs.demo.countBusyTitle")} note={t("tabs.demo.countBusyNote")}>
                {/* Maket `courier-orders-pending-refreshing`: ro'yxat yangilanayotganda sonlar xira. */}
                <Card as="div" padding="none">
                  <Tabs
                    idPrefix={`${prefix}-busy`}
                    ariaLabel={t("tabs.demo.countBusyTitle")}
                    items={courierItems}
                    value={courierTab}
                    onValueChange={setCourierTab}
                    countBusy
                    listClassName="px-3"
                  />
                </Card>
              </DemoBlock>

              <DemoBlock title={t("tabs.demo.segmentTitle")}>
                <div className="flex min-w-0 flex-col gap-4">
                  <SegmentRow label={t("tabs.demo.period")}>
                    <SegmentedControl
                      ariaLabel={t("tabs.demo.period")}
                      options={periodOptions}
                      value={period}
                      onValueChange={setPeriod}
                    />
                  </SegmentRow>
                  <SegmentRow label={t("tabs.demo.sizeSm")}>
                    <SegmentedControl
                      ariaLabel={t("tabs.demo.period")}
                      size="sm"
                      options={periodOptions}
                      value={periodSm}
                      onValueChange={setPeriodSm}
                    />
                  </SegmentRow>
                  <SegmentRow label={t("tabs.demo.view")}>
                    <SegmentedControl
                      ariaLabel={t("tabs.demo.viewLabel")}
                      options={viewOptions}
                      value={view}
                      onValueChange={setView}
                    />
                  </SegmentRow>
                  <SegmentRow label={t("tabs.demo.dayClose")}>
                    <SegmentedControl
                      ariaLabel={t("tabs.demo.dayCloseLabel")}
                      options={dayCloseOptions}
                      value={dayClose}
                      onValueChange={setDayClose}
                    />
                  </SegmentRow>
                </div>
              </DemoBlock>
            </div>
          );
        }}
      </ThemePair>
    </KitSection>
  );
};

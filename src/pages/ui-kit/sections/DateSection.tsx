import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ISODateRange } from "../../../shared/lib/dateRange";
import { cx } from "../../../shared/lib/cx";
import { Calendar } from "../../../shared/ui/primitives/Calendar";
import { DateInput } from "../../../shared/ui/primitives/DateInput";
import { DateRange, DateRangePanel } from "../../../shared/ui/primitives/DateRange";
import { Field } from "../../../shared/ui/primitives/Field";
import { KitSection } from "../KitSection";
import { ThemePair } from "../ThemePair";

/**
 * «Sana oralig'i» bo'limi (`?section=date`) — 3-bosqich: `DateRange`, `DateRangePanel`, `DateInput`, `Calendar`.
 *
 * Namunalar taxtadan: `tizim-states-forms` 04 «Sana oralig'i» (bo'sh, tanlangan · tozalash, ochiq panel
 * «Bu oy» tanlangan, taqvim belgilari); dashboard maydoni («Boshlanish → Tugash», `superadmin-dashboard-main`);
 * bitta sana («Oxirgi buyurtma — dan», `superadmin-notifications-sms-campaign-confirm-dialog`).
 * «Bugun» — maketdagidek 08.10.2026 (tez tanlov va belgilar maket bilan solishtirilsin).
 * Ikkala panel bitta holatni bo'lishadi.
 */

/** Maketdagi «bugun» (taxta 08.10.2026 bilan chizilgan). */
const DEMO_TODAY = "2026-10-08";

const DemoBlock = ({ title, note, children }: { title: string; note?: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-3">
    <div className="flex min-w-0 flex-col gap-0.5">
      <h3 className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{title}</h3>
      {note ? <p className="text-[13px] text-text-muted">{note}</p> : null}
    </div>
    {children}
  </div>
);

/** Bitta holat: ustida holat nomi (maketdagi `.el-overline`), ostida maydon. */
const State = ({ name, children }: { name: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-2.5">
    <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{name}</span>
    {children}
  </div>
);

const GRID = "grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-x-6 gap-y-5";

/** «Taqvim belgilari» (maket): kalendar kuni bilan bir xil klasslar (`Calendar.tsx` → `dayClasses`). */
const LEGEND_DAY = "inline-flex h-9 w-9 shrink-0 items-center justify-center text-[13px]";

const Legend = () => {
  const { t } = useTranslation("ui");
  const items = [
    { day: 1, className: "rounded-lg bg-action font-bold text-on-solid", text: t("dateKit.legend.edges") },
    { day: 4, className: "bg-action-soft text-text", text: t("dateKit.legend.range") },
    { day: 8, className: "rounded-lg text-text ring-1 ring-action ring-inset", text: t("dateKit.legend.today") },
    { day: 30, className: "text-text-subtle", text: t("dateKit.legend.muted") },
  ];
  return (
    <ul className="flex min-w-0 flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.day} className="flex items-center gap-2.5">
          <span aria-hidden="true" className={cx(LEGEND_DAY, item.className)}>
            {item.day}
          </span>
          <span className="text-[13px] text-text-muted">{item.text}</span>
        </li>
      ))}
    </ul>
  );
};

export const DateSection = () => {
  const { t } = useTranslation("ui");
  const [empty, setEmpty] = useState<ISODateRange>({ from: "", to: "" });
  const [filled, setFilled] = useState<ISODateRange>({ from: "2026-10-01", to: DEMO_TODAY });
  const [dashboard, setDashboard] = useState<ISODateRange>({ from: "", to: "" });
  const [invalid, setInvalid] = useState<ISODateRange>({ from: "", to: "" });
  const [panel, setPanel] = useState<ISODateRange>({ from: "2026-10-01", to: DEMO_TODAY });
  const [lastOrder, setLastOrder] = useState("2026-07-01");
  const [single, setSingle] = useState(DEMO_TODAY);

  return (
    <KitSection id="date" title={t("kit.sections.date.title")} description={t("kit.sections.date.description")}>
      <ThemePair layout="stack">
        {() => (
          <div className="flex min-w-0 flex-col gap-8">
            <DemoBlock title={t("dateKit.groups.field")} note={t("dateKit.notes.field")}>
              <div className={GRID}>
                <State name={t("dateKit.states.empty")}>
                  <Field label={t("dateKit.demo.dateLabel")} labelAs="span">
                    <DateRange value={empty} onChange={setEmpty} today={DEMO_TODAY} />
                  </Field>
                </State>
                <State name={t("dateKit.states.selected")}>
                  <Field label={t("dateKit.demo.dateLabel")} labelAs="span">
                    <DateRange value={filled} onChange={setFilled} today={DEMO_TODAY} />
                  </Field>
                </State>
                <State name={t("dateKit.states.dashboard")}>
                  <DateRange
                    value={dashboard}
                    onChange={setDashboard}
                    placeholder={t("dateKit.demo.dashboardPlaceholder")}
                    aria-label={t("dateKit.demo.dashboardLabel")}
                    today={DEMO_TODAY}
                  />
                </State>
                <State name={t("dateKit.states.invalid")}>
                  <Field label={t("dateKit.demo.dateLabel")} labelAs="span" required error={t("dateKit.demo.error")}>
                    <DateRange value={invalid} onChange={setInvalid} today={DEMO_TODAY} />
                  </Field>
                </State>
                <State name={t("dateKit.states.disabled")}>
                  <Field
                    label={t("dateKit.demo.dateLabel")}
                    labelAs="span"
                    disabled
                    hint={t("dateKit.demo.disabledHint")}
                  >
                    <DateRange value={filled} onChange={setFilled} today={DEMO_TODAY} />
                  </Field>
                </State>
                <State name={t("dateKit.states.single")}>
                  <Field label={t("dateKit.demo.lastOrderLabel")} labelAs="span">
                    <DateInput value={lastOrder} onChange={setLastOrder} today={DEMO_TODAY} />
                  </Field>
                </State>
              </div>
            </DemoBlock>

            <DemoBlock title={t("dateKit.groups.panel")} note={t("dateKit.notes.panel")}>
              <div className="flex min-w-0 flex-wrap items-start gap-x-8 gap-y-6">
                <DateRangePanel
                  surface="raised"
                  role="group"
                  aria-label={t("date.panelLabel")}
                  value={panel}
                  onChange={setPanel}
                  today={DEMO_TODAY}
                  className="max-w-[652px] flex-[0_1_652px] max-md:p-1.5"
                />
                <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-2.5">
                  <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">
                    {t("dateKit.legend.title")}
                  </span>
                  <Legend />
                </div>
              </div>
            </DemoBlock>

            <DemoBlock title={t("dateKit.groups.single")} note={t("dateKit.notes.single")}>
              <div
                role="group"
                aria-label={t("date.datePanelLabel")}
                className="w-[300px] max-w-full rounded-[14px] border border-border bg-raised p-3 shadow-xl max-md:w-full max-md:p-1.5"
              >
                <Calendar start={single} onSelect={setSingle} today={DEMO_TODAY} />
              </div>
            </DemoBlock>
          </div>
        )}
      </ThemePair>
    </KitSection>
  );
};

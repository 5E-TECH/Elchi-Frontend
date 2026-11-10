// dizayn-v2: superadmin-payments-shift-settings
import { Bell, Crown, Info, Send, Store, Truck, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  SHIFT_REPORT_RECIPIENT_GROUPS,
  type ShiftReportChannels,
  type ShiftReportFormat,
  type ShiftReportRecipientGroup,
  type ShiftReportSendSettings,
} from "../../../entities/payments";
import { cx } from "../../../shared/lib/cx";
import { Card, DataTable, Field, SegmentedControl, type DataTableColumn } from "../../../shared/ui/primitives";
import { CellSwitch } from "./CellSwitch";

/**
 * Maket `superadmin-payments-shift-settings` ning pastki kartasi (gWI4gYkw): «Smena hisobotini yuborish» —
 * superadmin / kuryerlar / marketlar × Telegram / tizim kalitlari va ilova formati (PDF | Excel). Saqlash — sahifadagi
 * yagona «Saqlash» (`PATCH finance/shift/settings`, faqat o'zgarganlar). «Avtomatik yopish» kartasi (y8Tqm9Ap) Ops →
 * «Kun tartibi»ga ko'chdi (`pages/daily-schedule/ui/ShiftCards.tsx`, ega 2026-11-10); bu yerda — havola kartasi.
 */

export const IconBox = ({ icon: Icon }: { icon: LucideIcon }) => (
  <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-sunken text-text-muted">
    <Icon aria-hidden="true" size={18} />
  </span>
);

export const CardTitle = ({ icon, title }: { icon: LucideIcon; title: string }) => (
  <span className="inline-flex items-center gap-3">
    <IconBox icon={icon} />
    {title}
  </span>
);

const GROUP_ICON: Record<ShiftReportRecipientGroup, LucideIcon> = {
  superadmin: Crown,
  couriers: Truck,
  markets: Store,
};

export const ReportSendCard = ({
  value,
  onChange,
}: {
  value: ShiftReportSendSettings;
  onChange: (next: ShiftReportSendSettings) => void;
}) => {
  const { t } = useTranslation("payments");
  const setChannel = (group: ShiftReportRecipientGroup, channel: keyof ShiftReportChannels, next: boolean) =>
    onChange({
      ...value,
      recipients: { ...value.recipients, [group]: { ...value.recipients[group], [channel]: next } },
    });

  const groupName = (group: ShiftReportRecipientGroup) => (
    <span className="flex min-w-0 items-center gap-3">
      <IconBox icon={GROUP_ICON[group]} />
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold text-text">{t(`shiftCheck.settings.report.groups.${group}`)}</span>
        <span className="text-[13px] text-text-muted">{t(`shiftCheck.settings.report.groupHints.${group}`)}</span>
      </span>
    </span>
  );
  const channelSwitch = (group: ShiftReportRecipientGroup, channel: keyof ShiftReportChannels) => (
    <CellSwitch
      checked={value.recipients[group][channel]}
      label={t(`shiftCheck.settings.report.switch.${channel}`, { group: t(`shiftCheck.settings.report.groups.${group}`) })}
      onToggle={(next) => setChannel(group, channel, next)}
    />
  );
  const channelHeader = (channel: keyof ShiftReportChannels) => {
    const Icon = channel === "telegram" ? Send : Bell;
    return (
      <span className="inline-flex items-center gap-1.5">
        <Icon aria-hidden="true" size={14} />
        {t(`shiftCheck.settings.report.channels.${channel}`)}
      </span>
    );
  };

  const columns: DataTableColumn<ShiftReportRecipientGroup>[] = [
    { id: "group", header: t("shiftCheck.settings.report.recipient"), cell: groupName },
    { id: "telegram", header: channelHeader("telegram"), cell: (group) => channelSwitch(group, "telegram") },
    { id: "in_app", header: channelHeader("in_app"), cell: (group) => channelSwitch(group, "in_app") },
  ];

  return (
    <Card
      padding="none"
      className="min-w-0 flex-[1_1_400px]"
      title={<CardTitle icon={Send} title={t("shiftCheck.settings.report.title")} />}
      description={t("shiftCheck.settings.report.subtitle")}
      divided
    >
      <DataTable
        rows={[...SHIFT_REPORT_RECIPIENT_GROUPS]}
        columns={columns}
        getRowKey={(group) => group}
        label={t("shiftCheck.settings.report.label")}
        cardsLabel={t("shiftCheck.settings.report.label")}
        renderCard={(group) => (
          <div className="flex flex-col gap-1 px-4 py-3">
            {groupName(group)}
            {(["telegram", "in_app"] as const).map((channel) => (
              <span key={channel} className="flex min-h-11 items-center justify-between gap-3 text-[13px] text-text">
                {channelHeader(channel)}
                {channelSwitch(group, channel)}
              </span>
            ))}
          </div>
        )}
      />
      <div className="flex flex-col gap-4 border-t border-border px-5 py-4 max-md:px-4">
        <Field label={t("shiftCheck.settings.report.format")} labelAs="span" hint={t("shiftCheck.settings.report.formatHint")}>
          <SegmentedControl<ShiftReportFormat>
            ariaLabel={t("shiftCheck.settings.report.format")}
            className="self-start"
            fullWidth={false}
            options={[
              { value: "pdf", label: "PDF" },
              { value: "xlsx", label: "Excel" },
            ]}
            value={value.format}
            onValueChange={(format) => onChange({ ...value, format })}
          />
        </Field>
        <p className={cx("m-0 flex items-start gap-2 rounded-xl bg-sunken px-3.5 py-3 text-[13px] text-text-muted")}>
          <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          <span>{t("shiftCheck.settings.report.note")}</span>
        </p>
      </div>
    </Card>
  );
};

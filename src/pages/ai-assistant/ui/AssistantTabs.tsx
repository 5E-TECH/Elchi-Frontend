// dizayn-v2: superadmin-ai-assistant, superadmin-ai-assistant-alerts, superadmin-ai-assistant-tab-select
import { useTranslation } from "react-i18next";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Select, Tabs, type SelectOption, type TabItem } from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import { AI_TAB_SELECT_ID, AI_TABS, AI_TABS_ID_PREFIX, type AiTab } from "../model/tabs";

type AssistantTabsProps = {
  tab: AiTab;
  onChange: (tab: AiTab) => void;
  /** «Ogohlantirishlar» nishoni — `overview.alerts.new` (0 — nishonsiz). */
  newAlerts: number;
};

/**
 * Bo'limlar (D1; maketlar `superadmin-ai-assistant`, `-alerts`, `-tab-select`): ≥ 768 — sahifa fonidagi `Tabs` (tab
 * rejimi, panel bilan bog'langan; «Ogohlantirishlar N» — yangilar soni); telefonda — `Select` («Bo'lim: …», ochiq
 * ro'yxatda «N yangi» nuqtali badge, tanlanganida ✓). Faqat «Suhbat · Ogohlantirishlar»: «Hisobotlar», «Tavsiyalar»,
 * «Sarf» — backend yo'q, chizilmaydi (maket yo'q — qisman).
 */
export const AssistantTabs = ({ tab, onChange, newAlerts }: AssistantTabsProps) => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsPhone();
  const label = (value: AiTab) => t(`tabs.${value}`);
  const countOf = (value: AiTab): number | undefined => (value === "alerts" && newAlerts > 0 ? newAlerts : undefined);

  if (isPhone) {
    const options: SelectOption<AiTab>[] = AI_TABS.map((value) => ({ value, label: label(value) }));
    return (
      <Select<AiTab>
        options={options}
        value={tab}
        onChange={(next) => {
          if (next && next !== tab) onChange(next);
        }}
        id={AI_TAB_SELECT_ID}
        aria-label={t("tabs.select", { tab: label(tab) })}
        listLabel={t("tabs.label")}
        renderOption={(option) => {
          const count = countOf(option.value);
          return (
            <span className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate">{option.label}</span>
              {count !== undefined ? (
                <Badge tone="info" dot className="shrink-0">
                  {t("tabs.newCount", { count, value: formatNumberLocalized(count, { language }) })}
                </Badge>
              ) : null}
            </span>
          );
        }}
        className="w-full font-semibold"
      />
    );
  }

  const items: TabItem<AiTab>[] = AI_TABS.map((value) => ({ value, label: label(value), count: countOf(value) }));
  return (
    <Tabs<AiTab>
      items={items}
      value={tab}
      onValueChange={onChange}
      ariaLabel={t("tabs.label")}
      idPrefix={AI_TABS_ID_PREFIX}
      controlsPanel
      background="bg"
    />
  );
};

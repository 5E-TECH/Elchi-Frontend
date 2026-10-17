// dizayn-v2: superadmin-notifications-sms-campaign, superadmin-notifications-sms-campaign-confirm-dialog, superadmin-notifications-sms-templates, superadmin-notifications-sms-report, superadmin-notifications-sms-settings
import type { ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getPanelId,
  getTabId,
  PageHeader,
  Tabs,
  type TabItem,
} from "../../../shared/ui/primitives";
import { useIsPhoneViewport } from "../lib/useIsPhoneViewport";
import CampaignPage from "./CampaignPage";
import SmsTemplatesTab from "./SmsTemplatesTab";
import SmsReportTab from "./SmsReportTab";
import SmsSettingsTab from "./SmsSettingsTab";

const TABS = ["campaign", "templates", "report", "settings"] as const;
type TabKey = (typeof TABS)[number];

const TABS_ID = "sms-tabs";

const PANELS: Record<TabKey, ComponentType> = {
  campaign: CampaignPage,
  templates: SmsTemplatesTab,
  report: SmsReportTab,
  settings: SmsSettingsTab,
};

/**
 * SMS (`/notifications/sms`) — superadmin va admin, dizayn v2. Sarlavha «SMS» + tablar «Kampaniya · Shablonlar ·
 * Xarajat · Sozlamalar» (sahifa fonida, telefonda qatorda aylanadi). Faol tab URL'da (`?tab=`, `replace`) — avvalgidek;
 * noma'lum qiymat — «Kampaniya». Faqat faol tab chiziladi (avvalgi `destroyOnHidden` kabi).
 */
const SmsPage = () => {
  const { t } = useTranslation("sms");
  const [params, setParams] = useSearchParams();
  // Telefonda (maket) to'rt tab ekran eniga teng bo'linadi — aylantirmasdan sig'adi.
  const isPhone = useIsPhoneViewport();
  const active: TabKey = TABS.includes(params.get("tab") as TabKey)
    ? (params.get("tab") as TabKey)
    : "campaign";

  const items: TabItem<TabKey>[] = TABS.map((key) => ({ value: key, label: t(`tabs.${key}`) }));
  const Panel = PANELS[active];

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />

      <Tabs
        items={items}
        value={active}
        onValueChange={(key) => {
          const next = new URLSearchParams(params);
          next.set("tab", key);
          setParams(next, { replace: true });
        }}
        ariaLabel={t("tabsLabel")}
        idPrefix={TABS_ID}
        controlsPanel
        fullWidth={isPhone}
        background="bg"
      />

      <div
        role="tabpanel"
        id={getPanelId(TABS_ID, active)}
        aria-labelledby={getTabId(TABS_ID, active)}
        className="flex min-w-0 flex-col gap-6 max-md:gap-4"
      >
        <Panel />
      </div>
    </div>
  );
};

export default SmsPage;

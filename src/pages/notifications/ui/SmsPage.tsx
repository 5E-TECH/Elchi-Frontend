import { MessageSquareText } from "lucide-react";
import { Tabs } from "antd";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import HeaderName from "../../../shared/components/headerName";
import PageContainer from "../../../shared/ui/PageContainer";
import CampaignPage from "./CampaignPage";
import SmsTemplatesTab from "./SmsTemplatesTab";
import SmsReportTab from "./SmsReportTab";
import SmsSettingsTab from "./SmsSettingsTab";

const TABS = ["campaign", "templates", "report", "settings"] as const;
type TabKey = (typeof TABS)[number];

/** SMS (`/notifications/sms`) — superadmin va admin. Faol tab URL'da. */
const SmsPage = () => {
  const { t } = useTranslation("sms");
  const [params, setParams] = useSearchParams();
  const active: TabKey = TABS.includes(params.get("tab") as TabKey) ? (params.get("tab") as TabKey) : "campaign";

  return (
    <PageContainer>
      <HeaderName name={t("pageTitle")} description={t("pageDescription")} icon={<MessageSquareText size={22} />} />
      <Tabs
        className="mt-4"
        activeKey={active}
        onChange={(key) => {
          const next = new URLSearchParams(params);
          next.set("tab", key);
          setParams(next, { replace: true });
        }}
        destroyOnHidden
        items={[
          { key: "campaign", label: t("tabs.campaign"), children: <CampaignPage /> },
          { key: "templates", label: t("tabs.templates"), children: <SmsTemplatesTab /> },
          { key: "report", label: t("tabs.report"), children: <SmsReportTab /> },
          { key: "settings", label: t("tabs.settings"), children: <SmsSettingsTab /> },
        ]}
      />
    </PageContainer>
  );
};

export default SmsPage;

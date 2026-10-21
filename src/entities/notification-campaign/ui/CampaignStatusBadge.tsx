// dizayn-v2: superadmin-notifications-send-states
import { useTranslation } from "react-i18next";
import { StatusBadge } from "../../../shared/ui/primitives";
import { CAMPAIGN_STATUS_META, type CampaignDisplayStatus } from "../model/campaign";

/** Kampaniya holati belgisi (nuqtali; «Bekor qilingan» — chegarali, maketdagidek). */
export const CampaignStatusBadge = ({ status }: { status: CampaignDisplayStatus }) => {
  const { t } = useTranslation("notifications");
  const meta = CAMPAIGN_STATUS_META[status];
  return <StatusBadge tone={meta.tone} variant={meta.variant} label={t(meta.labelKey)} />;
};

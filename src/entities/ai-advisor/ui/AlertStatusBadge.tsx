// dizayn-v2: superadmin-ai-assistant-alerts
import { useTranslation } from "react-i18next";
import { CircleCheck, CircleMinus, type LucideIcon } from "lucide-react";
import { StatusBadge, type Tone } from "../../../shared/ui/primitives";
import type { AiAdvisorAlertStatus } from "../model/advisorTypes";

/**
 * Holat → ton va belgi (maket `superadmin-ai-assistant-alerts`): ochiqlari nuqtali — «Yangi» info, «Ko'rildi»
 * warning; yopilganlari ikonkali — «Hal qilindi» success `CircleCheck`, «Ahamiyatsiz» neutral `CircleMinus`.
 */
const STATUS_META: Record<AiAdvisorAlertStatus, { tone: Tone; icon?: LucideIcon }> = {
  new: { tone: "info" },
  seen: { tone: "warning" },
  resolved: { tone: "success", icon: CircleCheck },
  dismissed: { tone: "neutral", icon: CircleMinus },
};

export const AlertStatusBadge = ({ status, className }: { status: AiAdvisorAlertStatus; className?: string }) => {
  const { t } = useTranslation("aiAdvisor");
  const meta = STATUS_META[status];
  return <StatusBadge tone={meta.tone} icon={meta.icon} label={t(`alerts.status.${status}`)} className={className} />;
};

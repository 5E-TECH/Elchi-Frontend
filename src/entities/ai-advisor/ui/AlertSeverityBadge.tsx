// dizayn-v2: superadmin-ai-assistant-alerts
import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react";
import { Badge, type Tone } from "../../../shared/ui/primitives";
import type { AiAdvisorSeverity } from "../model/advisorTypes";

const SEVERITY_TONE: Record<AiAdvisorSeverity, Tone> = {
  critical: "danger",
  warning: "warning",
};

/**
 * Ogohlantirish jiddiyligi (maket `superadmin-ai-assistant-alerts`, `-alert-dialog*`): «Jiddiy» — danger, «Diqqat» —
 * warning, ikkalasida `TriangleAlert` (rang doim so'z va ikonka bilan).
 */
export const AlertSeverityBadge = ({ severity, className }: { severity: AiAdvisorSeverity; className?: string }) => {
  const { t } = useTranslation("aiAdvisor");
  return (
    <Badge tone={SEVERITY_TONE[severity]} icon={TriangleAlert} className={className}>
      {t(`alerts.severity.${severity}`)}
    </Badge>
  );
};

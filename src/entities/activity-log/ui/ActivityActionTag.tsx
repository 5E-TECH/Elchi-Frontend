// dizayn-v2: superadmin-activity-logs-list, superadmin-activity-logs-row-expanded, admin-activity-logs-list, admin-activity-logs-row-expanded
import { memo } from "react";
import { Badge } from "../../../shared/ui/primitives";
import { activityActionTone } from "../model/actionTone";

/**
 * Faoliyat jurnali — amal badge'i (dizayn v2 `Badge`, nuqtasiz). Yorliqni chaqiruvchi beradi (tarjima /
 * backend `action_meta.label`); ton — `activityActionTone` (fe'l kalit so'zi bo'yicha).
 */
const ActivityActionTag = ({ action, label }: { action: string; label: string }) => {
  if (!action) return <span>—</span>;
  const tone = activityActionTone(action);
  return (
    <Badge tone={tone} data-tone={tone}>
      {label}
    </Badge>
  );
};

export default memo(ActivityActionTag);

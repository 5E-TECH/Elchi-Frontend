// dizayn-v2: superadmin-activity-logs-list, superadmin-activity-logs-row-expanded, admin-activity-logs-list, admin-activity-logs-row-expanded
import { memo } from "react";
import { Badge } from "../../../shared/ui/primitives";
import { resolveActionMeta } from "../model/actionMeta";
import type { ActivityActionMeta } from "../model/types";

/**
 * Jurnal amali — v2 badge (y8CxCtcK, maket `superadmin-activity-logs-list` «Amal» ustuni): yorliq
 * `action_meta.label`, ton `action_meta.tone` → badge toni; ikona maketda yo'q. Reyestrda yo'q fe'l —
 * backend yorlig'i (humanize), yorliq umuman bo'lmasa — fe'lning o'zidan humanize.
 */
const ActivityActionBadge = ({
  action,
  meta,
  registry,
  label: labelOverride,
}: {
  action: string;
  meta?: ActivityActionMeta | null;
  registry?: ReadonlyMap<string, ActivityActionMeta>;
  /** Tarjima qilingan yorliq (ru/en — backend reyestri faqat o'zbekcha); berilmasa — `resolveActionMeta`. */
  label?: string;
}) => {
  const resolved = resolveActionMeta({ action, action_meta: meta ?? null }, registry);
  const label = labelOverride || resolved.label;
  const { tone } = resolved;
  if (!label) return <span className="text-text-muted">—</span>;
  // Badge bir qatorda; juda uzun yorliq (humanize qilingan noma'lum fe'l) kartadan chiqmaydi — «…», to'liq matn `title` da.
  return (
    <Badge tone={tone} data-tone={tone} title={label} className="max-w-full">
      <span className="min-w-0 truncate">{label}</span>
    </Badge>
  );
};

export default memo(ActivityActionBadge);

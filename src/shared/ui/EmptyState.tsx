import { memo, type ReactNode } from "react";
import { Inbox, Package, RotateCcw, TriangleAlert, type LucideIcon } from "lucide-react";
import { EmptyState as EmptyStateV2 } from "./primitives/EmptyState";

interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * v1 → v2 O'RAMI. Ko'rinish — `src/shared/ui/primitives/EmptyState.tsx` (`.el-empty`, taxta `tizim-errors`).
 * Yangi kodda to'g'ridan-to'g'ri `EmptyState` primitivini (yoki `QueryBoundary` ni) ishlating.
 *
 * Eski API saqlangan: `icon` (element yoki emoji), `title`, `description`, `action`, `className`.
 *   - Emoji ikonka (v1 sukuti «📭») lucide ikonkasiga almashtiriladi — maketda emoji yo'q.
 *   - v1 da bo'sh holat o'z kartasida chizilardi; o'sha ramka saqlangan (`framed`). Karta ichidagi
 *     chaqiruvlar uni `border-0 bg-transparent shadow-none` bilan o'chirardi — bu klasslar endi ramkasiz
 *     variantni tanlaydi (o'zi klass sifatida o'tmaydi).
 */
const EMOJI_ICON: Record<string, LucideIcon> = {
  "📭": Inbox,
  "📦": Package,
  "↩": RotateCcw,
  "😵": TriangleAlert,
};

const LEGACY_UNFRAMED = new Set(["border-0", "bg-transparent", "shadow-none"]);

const resolveIcon = (icon: ReactNode) => {
  if (icon == null || typeof icon === "boolean") return Inbox;
  if (typeof icon === "string" || typeof icon === "number") return EMOJI_ICON[String(icon).trim()] ?? Inbox;
  return icon;
};

const EmptyState = ({ icon, title, description, action, className = "" }: EmptyStateProps) => {
  const classes = className.split(/\s+/).filter(Boolean);
  const unframed = classes.some((name) => LEGACY_UNFRAMED.has(name));
  const rest = classes.filter((name) => !LEGACY_UNFRAMED.has(name)).join(" ");

  return (
    <EmptyStateV2
      icon={resolveIcon(icon)}
      title={title}
      description={description}
      action={action}
      framed={!unframed}
      className={rest || undefined}
    />
  );
};

export default memo(EmptyState);

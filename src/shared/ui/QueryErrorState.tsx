import { memo } from "react";
import { ErrorState } from "./primitives/ErrorState";

interface QueryErrorStateProps {
  description?: string;
  onRetry?: () => void;
  className?: string;
  /** So'rov xatosi (ixtiyoriy) — turini (server, internet yo'q, 403) aniqlash uchun. */
  error?: unknown;
}

const LEGACY_UNFRAMED = new Set(["border-0", "bg-transparent", "shadow-none"]);

/**
 * v1 → v2 O'RAMI. Ko'rinish — `src/shared/ui/primitives/ErrorState.tsx` (taxta `tizim-errors` 02:
 * «Ma'lumot yuklanmadi» — `danger-soft` ikonka, sarlavha, sabab, «Qayta urinish» `secondary`).
 * Yangi kodda `ErrorState` (yoki `QueryBoundary`) ni ishlating.
 *
 * Eski API saqlangan: `description`, `onRetry`, `className` (+ ixtiyoriy `error`). v1 dagi kabi o'z
 * kartasida; `border-0 bg-transparent shadow-none` — ramkasiz (karta yoki jadval ichida).
 */
const QueryErrorState = ({ description, onRetry, className = "", error }: QueryErrorStateProps) => {
  const classes = className.split(/\s+/).filter(Boolean);
  const unframed = classes.some((name) => LEGACY_UNFRAMED.has(name));
  const rest = classes.filter((name) => !LEGACY_UNFRAMED.has(name)).join(" ");

  return (
    <ErrorState
      error={error}
      description={description}
      onRetry={onRetry}
      framed={!unframed}
      className={rest || undefined}
    />
  );
};

export default memo(QueryErrorState);

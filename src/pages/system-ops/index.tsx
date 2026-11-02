// dizayn-v2: superadmin-ops-system, superadmin-ops-system-loading, superadmin-ops-system-error, superadmin-ops-system-partial, superadmin-ops-system-down, superadmin-ops-system-critical, superadmin-ops-system-ai-config, superadmin-ops-system-ai-cap
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { OpsIntro, OpsToolPage } from "../ops/ui/OpsToolPage";
import { AiStatusCard } from "./ui/AiStatusCard";
import { HealthCard } from "./ui/HealthCard";

/**
 * OPS → «Tizim holati» (maket `superadmin-ops-system` va holatlari): kirish kartasi → «Tizim holati»
 * (`GET /health/readiness`, `ui/HealthCard.tsx`) → «AI holati» (`GET ai/status` + gateway bayrog'i,
 * `ui/AiStatusCard.tsx`, OS-2). Maketdagi «O'z vaqtida (SLA)» va «Analitika KPI» bosh sahifaga ko'chgan
 * (`pages/dashboard/ui/AnalyticsKpiSection.tsx`), «Token orqali tekshirish» olib tashlangan: `/scan` shu ishni
 * qiladi (F2NzXpMv).
 */
const SystemOpsPage = ({ embedded = false }: { embedded?: boolean }) => {
  const { t } = useTranslation("ops");

  return (
    <OpsToolPage tabKey="system" embedded={embedded}>
      <OpsIntro title={t("system.intro.title")} description={t("system.intro.description")} />

      <HealthCard />

      <AiStatusCard />
    </OpsToolPage>
  );
};

export default memo(SystemOpsPage);

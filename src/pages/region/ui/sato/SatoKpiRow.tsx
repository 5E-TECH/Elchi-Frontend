// dizayn-v2: superadmin-regions-sato-codes
import type { ReactNode } from "react";
import {
  CircleCheck,
  FileText,
  GitCompareArrows,
  Map as MapIcon,
  SearchX,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Meter } from "../../../../shared/ui/charts";
import { StatCard } from "../../../../shared/ui/primitives";
import { satoMatchedPercent, type SatoPreviewStats } from "../../model/satoModel";

type Props = {
  /** `null` — yuklanmoqda (kartalar skeleti). */
  stats: SatoPreviewStats | null;
  /** «Kodi bor» tabidagi tumanlar (saqlangan kod, takroriylarsiz) — «N tasida kod bor». */
  withCode: number;
  /** Takroriy nomlar guruhlari — «Yozuv · N ta nomda». */
  duplicateGroups: number;
};

/**
 * SATO solishtirish natijasi (faqat superadmin — preview): 6 ta `StatCard`, «Mos keldi» ostida `Meter`
 * (mos kelganlar / bazadagi jami). Desktop 6 ustun, planshet 3, telefon 2 (maket `superadmin-regions-sato-codes`).
 */
export const SatoKpiRow = ({ stats, withCode, duplicateGroups }: Props) => {
  const { t, i18n } = useTranslation("region");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const number = (value: number) => formatNumberLocalized(value, { language });
  const loading = stats == null;
  const unit = t("v2.sato.kpi.unit");
  const card = (key: string, value: number | undefined, icon: LucideIcon, hint: string, extra?: ReactNode) => (
    <StatCard
      key={key}
      label={t(`v2.sato.kpi.${key}`)}
      value={value == null ? undefined : number(value)}
      unit={unit || undefined}
      icon={icon}
      hint={hint}
      loading={loading}
      className="h-full"
    >
      {extra}
    </StatCard>
  );

  return (
    <section
      aria-label={t("v2.sato.kpi.aria")}
      className="grid grid-cols-6 gap-4 max-lg:grid-cols-3 max-md:grid-cols-2 max-md:gap-3"
    >
      {card("totalDb", stats?.totalDb, MapIcon, t("v2.sato.kpi.totalDbHint"))}
      {card("totalSato", stats?.totalSato, FileText, t("v2.sato.kpi.totalSatoHint"))}
      {card(
        "matched",
        stats?.matchedCount,
        CircleCheck,
        t("v2.sato.kpi.matchedHint", { count: withCode, value: number(withCode) }),
        stats ? (
          <Meter
            value={satoMatchedPercent(stats)}
            tone="success"
            thickness="thin"
            ariaLabel={t("v2.sato.kpi.matchedShareAria")}
          />
        ) : null,
      )}
      {card("unmatched", stats?.unmatchedCount, GitCompareArrows, t("v2.sato.kpi.unmatchedHint"))}
      {card(
        "duplicates",
        stats?.duplicatesCount,
        TriangleAlert,
        t("v2.sato.kpi.duplicatesHint", { count: duplicateGroups, value: number(duplicateGroups) }),
      )}
      {card("missing", stats?.missingCount, SearchX, t("v2.sato.kpi.missingHint"))}
    </section>
  );
};

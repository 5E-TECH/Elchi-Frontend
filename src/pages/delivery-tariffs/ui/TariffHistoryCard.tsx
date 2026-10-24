// dizayn-v2: superadmin-regions-delivery-tariffs, admin-regions-delivery-tariffs
import { useId, useMemo } from "react";
import { Clock, History } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { DeliveryPricingSettingsVersion, DeliveryTariffsData } from "../../../entities/delivery-pricing";
import { cx } from "../../../shared/lib/cx";
import { formatDateLocalized, formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  QueryBoundary,
  SkeletonList,
} from "../../../shared/ui/primitives";
import { buildTimeline, type HistoryEntry, type SettingsHistoryEntry, type TimelineEntry } from "../model/history";
import { CardHead } from "./CardHead";
import { useTariffText } from "./useTariffText";

/**
 * «O'ZGARISHLAR TARIXI» (maket `superadmin-regions-delivery-tariffs`): `GET /delivery/tariffs` versiyalari, yangisi
 * tepada — «Markazgacha · har kg 4 000 → 4 500 so'm» + «Rejalashtirilgan»; ostida «25.10.2026 dan · Bugun, 14:20».
 * Hisob qoidalari o'zgarishlari (`GET /delivery/pricing-settings/history`) shu ro'yxatga qo'shiladi; har qatorda kim
 * o'zgartirgani (`created_by_name`). Qoidalar tarixi yuklanmasa — faqat tarif qatorlari.
 */
export const TariffHistoryCard = ({
  query,
  settingsVersions,
  className,
}: {
  query: Pick<UseQueryResult<DeliveryTariffsData>, "data" | "isLoading" | "isError" | "error" | "refetch">;
  /** Hisob qoidalari versiyalari (ixtiyoriy). */
  settingsVersions?: readonly DeliveryPricingSettingsVersion[];
  className?: string;
}) => {
  const { t, money, number, changes, settingsChanges, name } = useTariffText();
  const titleId = useId();
  const entries = useMemo(
    () => (query.data ? buildTimeline(query.data.versions, settingsVersions) : undefined),
    [query.data, settingsVersions],
  );

  const title = (entry: HistoryEntry) =>
    entry.initial
      ? t("page.history.initial", {
          name: name(entry.version.tariffId),
          base: money(entry.version.basePrice),
          perKg: money(entry.version.extraPerKg),
        })
      : t("page.history.line", { name: name(entry.version.tariffId), changes: changes(entry.changes, true) });

  const settingsTitle = (entry: SettingsHistoryEntry) =>
    entry.initial
      ? t("page.history.rulesInitial", { firstKg: number(entry.version.firstKgIncluded) })
      : t("page.history.rules", { changes: settingsChanges(entry.changes) });

  const meta = (item: TimelineEntry) => {
    const version = item.entry.version;
    return [
      item.type === "tariff" ? t("page.history.from", { date: formatDateLocalized(item.entry.version.validFrom) }) : null,
      version.createdAt ? formatDateTimeLocalized(version.createdAt) : null,
      version.createdByName ? t("page.history.by", { name: version.createdByName }) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  };

  const keyOf = (item: TimelineEntry) =>
    item.type === "tariff"
      ? `tariff-${item.entry.version.id || `${item.entry.version.tariffId}-${item.entry.version.validFrom}`}`
      : `settings-${item.entry.version.id || item.at}`;

  return (
    <Card as="section" padding="none" aria-labelledby={titleId} className={cx("min-w-0", className)}>
      <CardHead id={titleId} icon={Clock} title={t("page.history.title")} description={t("page.history.description")} />
      <QueryBoundary
        query={{ ...query, data: entries }}
        loading={<SkeletonList rows={3} />}
        empty={<EmptyState icon={History} title={t("page.history.empty")} description={t("page.history.emptyDescription")} />}
        error={(error, retry) => <ErrorState error={error} title={t("page.history.loadFailed")} onRetry={retry} />}
      >
        {(list) => (
          <ul className="m-0 flex list-none flex-col p-0" aria-labelledby={titleId}>
            {list.map((item) => (
              <li
                key={keyOf(item)}
                className="flex min-w-0 flex-col items-start gap-1 border-b border-border px-5 py-3 last:border-b-0 max-md:px-4"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-text">
                    {item.type === "tariff" ? title(item.entry) : settingsTitle(item.entry)}
                  </span>
                  {item.type === "tariff" && item.entry.version.isScheduled ? (
                    <Badge tone="info" size="sm">
                      {t("page.history.scheduled")}
                    </Badge>
                  ) : null}
                </span>
                <span className="text-xs text-text-muted">{meta(item)}</span>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </Card>
  );
};

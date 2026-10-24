// dizayn-v2: superadmin-regions-delivery-tariffs, admin-regions-delivery-tariffs
import { useId, useMemo } from "react";
import { Clock, History } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { DeliveryTariffsData } from "../../../entities/delivery-pricing";
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
import { buildHistory, type HistoryEntry } from "../model/history";
import { CardHead } from "./CardHead";
import { useTariffText } from "./useTariffText";

/**
 * «O'ZGARISHLAR TARIXI» (maket `superadmin-regions-delivery-tariffs`): `GET /delivery/tariffs` versiyalari, yangisi
 * tepada — «Markazgacha · har kg 4 000 → 4 500 so'm» + «Rejalashtirilgan»; ostida «25.10.2026 dan · Bugun, 14:20».
 * Muallif ismi backend javobida yo'q (faqat `created_by` ID) — chizilmaydi; hisob qoidalari o'zgarishlari ham
 * bu javobda yo'q (faoliyat jurnalida).
 */
export const TariffHistoryCard = ({
  query,
  className,
}: {
  query: Pick<UseQueryResult<DeliveryTariffsData>, "data" | "isLoading" | "isError" | "error" | "refetch">;
  className?: string;
}) => {
  const { t, money, changes, name } = useTariffText();
  const titleId = useId();
  const entries = useMemo(() => (query.data ? buildHistory(query.data.versions) : undefined), [query.data]);

  const title = (entry: HistoryEntry) =>
    entry.initial
      ? t("page.history.initial", {
          name: name(entry.version.tariffId),
          base: money(entry.version.basePrice),
          perKg: money(entry.version.extraPerKg),
        })
      : t("page.history.line", { name: name(entry.version.tariffId), changes: changes(entry.changes, true) });

  const meta = (entry: HistoryEntry) =>
    [
      t("page.history.from", { date: formatDateLocalized(entry.version.validFrom) }),
      entry.version.createdAt ? formatDateTimeLocalized(entry.version.createdAt) : null,
    ]
      .filter(Boolean)
      .join(" · ");

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
            {list.map((entry) => (
              <li
                key={entry.version.id || `${entry.version.tariffId}-${entry.version.validFrom}`}
                className="flex min-w-0 flex-col items-start gap-1 border-b border-border px-5 py-3 last:border-b-0 max-md:px-4"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-text">{title(entry)}</span>
                  {entry.version.isScheduled ? (
                    <Badge tone="info" size="sm">
                      {t("page.history.scheduled")}
                    </Badge>
                  ) : null}
                </span>
                <span className="text-xs text-text-muted">{meta(entry)}</span>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </Card>
  );
};

// dizayn-v2: superadmin-ai-assistant-alerts, superadmin-ai-assistant-alerts-filters-mobile
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck, Lock, SearchX } from "lucide-react";
import {
  useAdvisorAlerts,
  useAdvisorAvailability,
  type AdvisorTranslate,
  type AiAdvisorAlertListItem,
} from "../../../../entities/ai-advisor";
import { getErrorKind } from "../../../../shared/lib/errorKind";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Pagination,
  QueryBoundary,
  Skeleton,
} from "../../../../shared/ui/primitives";
import {
  ALERT_PAGE_SIZES,
  alertSearchWithId,
  countActiveFilters,
  filterSummary,
  toAlertListParams,
} from "../../model/alertFilters";
import { useAlertFilters } from "../../model/useAlertFilters";
import { AlertFilters } from "./AlertFilters";
import { AlertsTable } from "./AlertsTable";
import { CriticalBanner } from "./CriticalBanner";

/** Yuklanish skeleti (maket «Yuklanmoqda»): belgi · ikki qator · holat — to'rt qator. */
const SKELETON_ROWS = [
  ["64%", "38%"],
  ["52%", "44%"],
  ["70%", "32%"],
  ["58%", "40%"],
] as const;

const AlertsSkeleton = () => (
  <div className="flex flex-col px-5 py-1.5">
    {SKELETON_ROWS.map(([first, second], index) => (
      <div key={index} className="flex items-center gap-3 border-border py-3.5 not-first:border-t">
        <Skeleton shape="block" tone="border" width={56} height={22} className="rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton tone="border" width={first} />
          <Skeleton tone="border" width={second} />
        </div>
        <Skeleton shape="block" tone="border" width={64} height={22} className="rounded-full" />
      </div>
    ))}
  </div>
);

/**
 * «Ogohlantirishlar» tabi (60PWUbgC, maketlar `superadmin-ai-assistant-alerts`, `-alerts-filters-mobile`): jiddiylar
 * banneri (D11) → filtrlar (D4, URL'da) → «Ogohlantirishlar» kartasi (`DataTable` + `Pagination`, holatlar D10) →
 * «Yordamchi faqat ogohlantiradi…» izohi. `React.lazy` uchun sukut eksport — faqat backend mavjud bo'lsa yuklanadi.
 *
 * Bo'sh holat: filtrsiz — «Hammasi joyida»; filtr bilan — «Bu filtr bo'yicha ogohlantirish yo'q» + «Jiddiy · Zarar ·
 * Yangi — hech narsa topilmadi.» + «Filtrlarni tozalash». Sahifa oxirgisidan katta bo'lsa — oxirgisiga (`replace`).
 */
const AlertsPanel = () => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const tt = t as unknown as AdvisorTranslate;
  const { filters, page, limit, searchParams, update, clear, clampPage } = useAlertFilters();
  const availability = useAdvisorAvailability();
  const overview = availability.data?.kind === "available" ? availability.data.data : null;

  const params = useMemo(() => toAlertListParams({ filters, page, limit }), [filters, page, limit]);
  const listQuery = useAdvisorAlerts(params);
  const data = listQuery.data;
  const fresh = data && !listQuery.isPlaceholderData ? data : undefined;
  const filtered = countActiveFilters(filters) > 0;

  // Oxirgi sahifadan tashqarida (qatorlar kamaygan yoki eski havola) — mavjud oxirgi sahifaga.
  const outOfRange = Boolean(fresh && page > Math.max(1, fresh.meta.totalPages));
  useEffect(() => {
    if (fresh && outOfRange) clampPage(fresh.meta.totalPages);
  }, [clampPage, fresh, outOfRange]);

  const hrefOf = useCallback((row: AiAdvisorAlertListItem) => alertSearchWithId(searchParams, row.id), [searchParams]);

  // Eski (boshqa filtr/sahifa) javob bo'sh bo'lsa — bo'sh holatni undan chizmaymiz, yangi javobgacha yuklanish.
  const settling = listQuery.isPlaceholderData && !data?.items.length;
  const pending = outOfRange || settling;
  const query = {
    data: (listQuery.isError && !data) || pending ? undefined : data?.items,
    isLoading: listQuery.isLoading || pending,
    isError: listQuery.isError && !data,
    error: listQuery.error,
    refetch: () => void listQuery.refetch(),
  };

  const total = data?.meta.total;

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      {overview ? (
        <CriticalBanner
          alerts={overview.alerts}
          onlyCritical={filters.severity === "critical"}
          filteredTotal={fresh && filters.severity === "critical" ? fresh.meta.total : null}
          onOnlyCritical={() => update({ severity: "critical" })}
          onShowAll={() => update({ severity: "" })}
        />
      ) : null}

      <AlertFilters values={filters} counts={data?.counts.by_status} onChange={update} />

      <Card
        padding="none"
        title={t("alerts.list.title")}
        description={t("alerts.list.description")}
        actions={
          total !== undefined && total > 0 ? (
            <Badge>{t("alerts.list.total", { value: formatNumberLocalized(total, { language }) })}</Badge>
          ) : undefined
        }
        className="overflow-hidden"
        footer={
          data && data.meta.total > 0 && data.items.length > 0 && !pending ? (
            <Pagination
              page={data.meta.page}
              pageSize={data.meta.limit}
              total={data.meta.total}
              pageSizeOptions={ALERT_PAGE_SIZES}
              onPageChange={(next) => update({ page: next })}
              onPageSizeChange={(next) => update({ limit: next })}
              disabled={listQuery.isPlaceholderData}
              summary={(range) => t("alerts.list.summary", { ...range, count: data.meta.total })}
            />
          ) : undefined
        }
      >
        <QueryBoundary
          query={query}
          keepPreviousData={false}
          loadingLabel={t("alerts.list.loading")}
          loading={<AlertsSkeleton />}
          error={(error, retry) => (
            <ErrorState
              error={error}
              title={t("alerts.list.errorTitle")}
              description={getErrorKind(error) === "offline" ? t("alerts.list.errorOffline") : undefined}
              onRetry={retry}
              retrying={listQuery.isFetching}
            />
          )}
          empty={
            filtered ? (
              <EmptyState
                icon={SearchX}
                title={t("alerts.empty.filteredTitle")}
                description={t("alerts.empty.filteredText", { summary: filterSummary(filters, tt) })}
                action={
                  <Button variant="ghost" onClick={clear}>
                    {t("alerts.empty.clear")}
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={CircleCheck} title={t("alerts.empty.title")} description={t("alerts.empty.text")} />
            )
          }
        >
          {(rows: AiAdvisorAlertListItem[]) => (
            <AlertsTable rows={rows} hrefOf={hrefOf} busy={listQuery.isPlaceholderData} />
          )}
        </QueryBoundary>
      </Card>

      <p className="flex items-start gap-2 text-[13px] text-text-muted">
        <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>{t("alerts.list.footnote")}</span>
      </p>
    </div>
  );
};

export default AlertsPanel;

// dizayn-v2: (maket yo'q) superadmin-neworders-incoming-sources
import { memo, useMemo } from "react";
import { ChevronRight, Globe, Plug, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  QueryBoundary,
  SkeletonTable,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import NewOrdersTabs from "../ui/NewOrdersTabs";
import { toExternalSites, useExternalSites, type ExternalSite } from "./model/externalSites";

/** Sayt skanerlash sahifasi — ulanish id si bo'yicha (qidiruvga `slug`, qabulga `id` kerak; sahifa ikkalasini oladi). */
export const siteScanPath = (site: ExternalSite) => `/new-orders/sites/${site.integration.id}`;

/** Backend `last_sync_at` ni `bigint` (ms) — matn sifatida ham — qaytaradi. */
const syncDate = (value: unknown): number | string | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const raw = String(value);
  return /^\d+$/.test(raw) ? Number(raw) : raw;
};

/** `.el-stat-icon` — neytral ikonka qutisi (36 px), «Kiruvchi posilkalar» manbalari bilan bir xil. */
const SITE_ICON = (
  <span
    aria-hidden="true"
    className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
  >
    <Globe size={18} />
  </span>
);

/** `.el-iconbtn.el-iconbtn-sm` havola ko'rinishida (qatorning oxiridagi «›»). */
const ROW_LINK =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted " +
  "transition-[background-color,color] duration-150 hover:bg-sunken hover:text-text motion-reduce:transition-none max-md:size-11";

/**
 * «QABUL VA YARATISH» → «TASHQI SAYTLAR» (BeePost «Bugungi buyurtmalar → Tashqi buyurtmalar» naqshi).
 *
 * Sayt (Adosh, Donoxon …) bizga buyurtma yubormaydi: posilkada saytning QR'i bor. Operator shu yerda saytni tanlaydi,
 * keyingi sahifada QR'ni skanerlaydi — buyurtma saytdan olinadi va «Qabul qilish» bilan Elchi'ga tushadi.
 *
 * Maket yo'q — eng yaqini `superadmin-neworders-incoming-sources` (qobiq tablari bilan boshlanadigan karta, izoh +
 * «Yangilash», manbalar jadvali) va `superadmin-integrations-legacy-sources` (ulanish nomi + slug). Ro'yxat
 * `GET /integrations` dan (faqat superadmin, admin — tab ham faqat ularda): faol, marketga bog'langan ulanishlar.
 */
const ExternalSitesPage = () => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const { query, sites } = useExternalSites();

  const columns = useMemo<DataTableColumn<ExternalSite>[]>(
    () => [
      {
        id: "site",
        header: t("sites.colSite"),
        className: "w-[34%]",
        cell: (site) => (
          <span className="flex min-w-0 items-center gap-3">
            {SITE_ICON}
            <span className="flex min-w-0 flex-col">
              <Link
                to={siteScanPath(site)}
                className="min-w-0 font-semibold text-text [overflow-wrap:anywhere] hover:text-action-hover"
              >
                {site.integration.name}
              </Link>
              <span className="text-[13px] text-text-muted [overflow-wrap:anywhere]">{site.integration.slug}</span>
            </span>
          </span>
        ),
      },
      {
        id: "market",
        header: t("sites.colMarket"),
        className: "w-[24%]",
        cell: (site) => site.marketName ?? <span className="text-text-muted">—</span>,
      },
      {
        id: "synced",
        header: t("sites.colSynced"),
        align: "end",
        className: "w-[14%]",
        cell: (site) =>
          t("sites.syncedValue", { value: formatNumberLocalized(site.integration.total_synced_orders ?? 0, { language }) }),
      },
      {
        id: "lastSync",
        header: t("sites.colLastSync"),
        className: "w-[20%] pl-10",
        cell: (site) => {
          const date = syncDate(site.integration.last_sync_at);
          return date === null ? (
            <span className="text-text-muted">{t("sites.neverSynced")}</span>
          ) : (
            <span className="whitespace-nowrap">{formatDateTimeLocalized(date, { language })}</span>
          );
        },
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("sites.colActions")}</span>,
        className: "w-14",
        cellClassName: "text-right",
        cell: (site) => {
          const label = t("sites.open", { name: site.integration.name });
          return (
            <Link to={siteScanPath(site)} aria-label={label} title={label} className={ROW_LINK}>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          );
        },
      },
    ],
    [language, t],
  );

  const renderCard = (site: ExternalSite) => (
    <Link to={siteScanPath(site)} className="flex min-h-14 min-w-0 items-start gap-3 px-4 py-3 text-sm text-text">
      {SITE_ICON}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-semibold [overflow-wrap:anywhere]">{site.integration.name}</span>
        <span className="text-[13px] text-text-muted [overflow-wrap:anywhere]">
          {[
            site.marketName,
            t("sites.syncedLine", {
              value: formatNumberLocalized(site.integration.total_synced_orders ?? 0, { language }),
            }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <ChevronRight size={18} aria-hidden="true" className="mt-2 shrink-0 text-text-subtle" />
    </Link>
  );

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <Card padding="none" aria-label={t("sites.cardLabel")}>
        <NewOrdersTabs />

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
          <p className="m-0 min-w-0 flex-[1_1_320px] text-[13px] text-text-muted">{t("sites.intro")}</p>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={RefreshCw}
            loading={query.isFetching && !query.isLoading}
            onClick={() => void query.refetch()}
          >
            {t("sites.refresh")}
          </Button>
        </div>

        <QueryBoundary
          query={query}
          isEmpty={(data) => toExternalSites(data).length === 0}
          loading={
            <SkeletonTable
              framed={false}
              rows={3}
              className="border-t border-border"
              columns={[t("sites.colSite"), t("sites.colMarket"), t("sites.colSynced"), t("sites.colLastSync")]}
            />
          }
          empty={
            <EmptyState
              icon={Plug}
              title={t("sites.emptyTitle")}
              description={t("sites.emptyText")}
              action={
                <Button variant="secondary" size="sm" onClick={() => navigate("/integrations/connections")}>
                  {t("sites.emptyAction")}
                </Button>
              }
              className="border-t border-border"
            />
          }
          error={(error, retry) => (
            <ErrorState
              error={error}
              title={t("sites.loadError")}
              onRetry={retry}
              retrying={query.isFetching}
              className="border-t border-border"
            />
          )}
        >
          {() => (
            <DataTable
              rows={sites}
              columns={columns}
              getRowKey={(site) => String(site.integration.id)}
              label={t("sites.tableLabel")}
              onRowClick={(site) => navigate(siteScanPath(site))}
              renderCard={renderCard}
              className="border-t border-border"
            />
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
};

export default memo(ExternalSitesPage);

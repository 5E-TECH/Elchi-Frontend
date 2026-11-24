// dizayn-v2: superadmin-integrations-partners-console, superadmin-integrations-external-console, superadmin-integrations-marketplace-console, admin-integrations-partners, admin-integrations-external, admin-integrations-marketplace
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Plug, RefreshCw, ScanLine } from "lucide-react";
import { CATEGORY_LABEL, integrationKeys, type Integration } from "../../entities/integrations";
import { connectionHealth, metricsByUid, metricsKey, useIntegrationMetrics } from "../../entities/integrations/metrics";
import { settlementKey } from "../../entities/integrations/settlement";
import { isExternalSite, siteScanPath } from "../../entities/integrations/siteSource";
import { partnersKey } from "../../entities/partners";
import {
  Badge,
  Button,
  ButtonIcon,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  SkeletonTable,
  StatusBadge,
  Tabs,
  buttonClasses,
  getPanelId,
  getTabId,
} from "../../shared/ui/primitives";
import {
  HEALTH_KEY,
  HEALTH_TONE,
  PANEL_TABS,
  ROLE_ONE_KEY,
  hiddenTabsOf,
  scopeOfConnection,
  scopePath,
  successOf,
  uidFromParam,
  type PanelKey,
} from "./connectionMeta";
import { fieldsFor, isConfigured, useConnections, type Connection } from "./useConnections";
import ConnectionOverview from "./panels/ConnectionOverview";
import ConnectionSettings from "./panels/ConnectionSettings";
import ConnectionSecurity from "./panels/ConnectionSecurity";
import ConnectionLog from "./panels/ConnectionLog";
import ConnectionSettlement from "./panels/ConnectionSettlement";
import ConnectionShipments from "./panels/ConnectionShipments";
import ConnectionControl from "./panels/ConnectionControl";
import { InlineAlert } from "./ui";

/**
 * BITTA ULANISH — `/integrations/connections/:connectionId` (`integration-3`, `partner-7`), panel tabi `?t=`.
 *
 * Ega qarori 2026-11-25: ilgari tafsilot ro'yxat sahifasining PASTIDA, ekrandan tashqarida almashardi — qator
 * bosilsa hech narsa bo'lmagandek ko'rinardi, «Orqaga» esa bo'limdan chiqarib yuborardi. Endi ulanish o'z
 * sahifasida: tepada «← Integratsiyalar» va nomi. Panel tablari va ularning ko'rinishi — o'sha maket.
 *
 * Tab almashinuvi tarixga yozilmaydi (`replace`): «Orqaga» har doim ro'yxatga qaytaradi.
 */
const ConnectionPage = () => {
  const { t } = useTranslation("integrations");
  const { connectionId } = useParams<{ connectionId: string }>();
  const uid = uidFromParam(connectionId);
  const { connections, isLoading, isError, partialError, refetch } = useConnections({ silentError: true });
  const connection = useMemo(() => connections.find((c) => c.uid === uid), [connections, uid]);
  const [searchParams, setSearchParams] = useSearchParams();

  const setTab = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("t", next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  if (!connection) {
    const failed = isError || partialError;
    return (
      <div className="flex flex-col gap-6 max-md:gap-4">
        <PageHeader
          back="/integrations/connections"
          backLabel={t("pageTitle")}
          title={isLoading ? <Skeleton shape="block" width={180} height={28} /> : t("conn.notFoundTitle")}
        />
        {isLoading ? (
          <SkeletonTable rows={4} columns={["", "", ""]} />
        ) : failed ? (
          <InlineAlert
            tone="danger"
            action={
              <Button variant="secondary" size="sm" leftIcon={RefreshCw} onClick={refetch} className="max-md:min-h-11">
                {t("retry")}
              </Button>
            }
          >
            {t("lstLoadError")}
          </InlineAlert>
        ) : (
          <Card padding="none">
            <EmptyState
              icon={Plug}
              title={t("conn.notFoundTitle")}
              description={t("conn.notFoundText")}
              action={
                <Link to="/integrations/connections" className={buttonClasses({ variant: "secondary" })}>
                  {t("conn.toList")}
                </Link>
              }
            />
          </Card>
        )}
      </div>
    );
  }

  return (
    <ConnectionView
      key={connection.uid}
      connection={connection}
      tab={searchParams.get("t") ?? "overview"}
      setTab={setTab}
      refetch={refetch}
    />
  );
};

const ConnectionView = ({
  connection,
  tab,
  setTab,
  refetch,
}: {
  connection: Connection;
  tab: string;
  setTab: (tab: string) => void;
  refetch: () => void;
}) => {
  const { t } = useTranslation("integrations");
  const metricsQuery = useIntegrationMetrics(undefined, { silentError: true });
  /** D1: «kecha» — 48 soatlik oyna; kecha = 48 soat − 24 soat. Yiqilsa yashirinadi. */
  const prevQuery = useIntegrationMetrics(48, { silentError: true });
  const metrics = useMemo(() => metricsByUid(metricsQuery.data).get(connection.uid), [metricsQuery.data, connection.uid]);
  const wide = useMemo(() => metricsByUid(prevQuery.data).get(connection.uid), [prevQuery.data, connection.uid]);
  const prevSuccessRate =
    metrics && wide && !prevQuery.isError
      ? successOf(Math.max(0, wide.delivered - metrics.delivered), Math.max(0, wide.failed - metrics.failed))
      : null;

  const fields = useMemo(() => fieldsFor(connection), [connection]);
  const hiddenTabs = useMemo(() => hiddenTabsOf(connection), [connection]);
  const shownTabs = PANEL_TABS.filter((item) => !hiddenTabs.has(item.key));
  const activeTab: PanelKey = (shownTabs.find((item) => item.key === tab) ?? shownTabs[0]).key;
  const health = connectionHealth({
    isActive: connection.is_active,
    configured: isConfigured(connection),
    metrics,
  });

  /**
   * «Yangilash» (Umumiy holat) — TanStack Query keshini INVALIDATSIYA qiladi: ulanishlar, metrika va
   * qarz qoldig'i. Sahifa qayta yuklanmaydi; ochiq so'rovlar fonda yangilanadi.
   */
  const queryClient = useQueryClient();
  const refreshOverview = useCallback(() => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: metricsKey }),
      queryClient.invalidateQueries({ queryKey: [partnersKey] }),
      queryClient.invalidateQueries({ queryKey: integrationKeys.all }),
      queryClient.invalidateQueries({ queryKey: [settlementKey, "balance"] }),
    ]);
  }, [queryClient]);

  const panel = () => {
    switch (activeTab) {
      case "settings":
        return <ConnectionSettings connection={connection} fields={fields} onSaved={refetch} />;
      case "shipments":
        return <ConnectionShipments connection={connection} />;
      case "log":
        return <ConnectionLog connection={connection} metrics={metrics} />;
      case "settlement":
        return <ConnectionSettlement connection={connection} />;
      case "control":
        return <ConnectionControl connection={connection} onChanged={refetch} />;
      case "security":
        return <ConnectionSecurity connection={connection} fields={fields} onSaved={refetch} />;
      default:
        return (
          <ConnectionOverview
            connection={connection}
            metrics={metrics}
            metricsState={metricsQuery.isPending ? "loading" : metricsQuery.isError ? "error" : "ready"}
            onFix={setTab}
            hiddenTabs={hiddenTabs}
            onRefresh={refreshOverview}
            refreshing={metricsQuery.isFetching}
            prevSuccessRate={prevSuccessRate}
          />
        );
    }
  };

  /** QR skanerlab buyurtma olinadigan sayt — skanerlash shu yerdan ochiladi. */
  const isSite = connection.kind === "integration" && isExternalSite(connection.raw as Integration);
  const panelIdPrefix = `conn-${connection.uid.replace(":", "-")}`;

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back={scopePath(scopeOfConnection(connection))}
        backLabel={t("pageTitle")}
        title={connection.name}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={HEALTH_TONE[health]} label={t(HEALTH_KEY[health])} />
            <Badge>{t(ROLE_ONE_KEY[connection.role])}</Badge>
            <Badge>{t(CATEGORY_LABEL[connection.category])}</Badge>
          </span>
        }
        description={t(
          connection.kind === "partner"
            ? "console.selPartnerHint"
            : isSite
              ? "conn.siteHint"
              : "console.selIntegrationHint",
        )}
        actions={
          isSite ? (
            <Link to={siteScanPath(connection.id)} className={buttonClasses({ variant: "primary" })}>
              <ButtonIcon icon={ScanLine} px={18} />
              {t("conn.scan")}
            </Link>
          ) : undefined
        }
      />

      <Card padding="none" aria-label={connection.name} className="overflow-hidden">
        <Tabs
          items={shownTabs.map((item) => ({ value: item.key, label: t(item.labelKey) }))}
          value={activeTab}
          onValueChange={setTab}
          ariaLabel={t("console.panelTabsAria", { name: connection.name })}
          idPrefix={panelIdPrefix}
          controlsPanel
          listClassName="px-3"
        />
        <div
          role="tabpanel"
          id={getPanelId(panelIdPrefix, activeTab)}
          aria-labelledby={getTabId(panelIdPrefix, activeTab)}
          className="min-w-0"
        >
          {panel()}
        </div>
      </Card>
    </div>
  );
};

export default ConnectionPage;

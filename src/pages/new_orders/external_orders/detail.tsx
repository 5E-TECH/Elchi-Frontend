// dizayn-v2: superadmin-integrations-legacy-source-detail
import { memo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Package, QrCode, RefreshCw } from "lucide-react";
import { getIntegrationErrorMessage, useGetIntegrationById } from "../../../entities/integrations";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge } from "../../../shared/ui/primitives";

/**
 * ESKI TASHQI MANBA — tafsilot (maket `*-integrations-legacy-source-detail`).
 *
 * Skaner holati va skanerlangan buyurtmalar ro'yxati. Maketdagi «Yoki kodni qo'lda kiriting» + «Qidirish»
 * maydoni CHIZILMAYDI (ega savoli 7, sukut): `POST /integrations/{slug}/search-by-qr` backendda bor, lekin
 * kodda qidiruv oqimi yo'q — ishlamaydigan maydon qo'yilmaydi.
 */
const ExternalIntegrationDetail = () => {
  const { t, i18n } = useTranslation("integrations");
  const { id } = useParams();

  const query = useGetIntegrationById(id);
  const integration = query.data?.data;

  const title = integration?.name ?? t("legacySources.integration");
  const isActive = Boolean(integration?.is_active);
  const synced = integration?.total_synced_orders ?? 0;

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/integrations/sources"
        backLabel={t("legacySources.title")}
        title={query.isLoading ? <Skeleton width={220} height={28} /> : title}
        meta={
          integration ? (
            <StatusBadge
              tone={isActive ? "success" : "neutral"}
              label={isActive ? t("legacySources.connected") : t("legacySources.inactive")}
            />
          ) : null
        }
        description={
          integration
            ? t("legacySources.detailSub", {
                slug: integration.slug || t("legacySources.idLabel", { id: id ?? "—" }),
                count: formatNumberLocalized(synced, { language: i18n.language }),
              })
            : undefined
        }
        actions={
          <Button variant="secondary" leftIcon={RefreshCw} loading={query.isFetching && !query.isLoading} onClick={() => void query.refetch()}>
            {t("refresh")}
          </Button>
        }
      />

      {query.isError ? (
        <Card padding="none">
          <ErrorState
            error={query.error}
            title={t("legacySources.loadError")}
            description={getIntegrationErrorMessage(query.error) || undefined}
            onRetry={() => void query.refetch()}
          />
        </Card>
      ) : (
        <>
          <Card aria-label={t("legacySources.scannerAria")}>
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 flex-none items-center justify-center rounded-[10px] bg-success-soft text-success-fg">
                <QrCode size={20} aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold text-text">{t("legacySources.scannerReady")}</span>
                <span className="text-[13px] text-text-muted">{t("legacySources.scannerHint")}</span>
              </span>
            </div>
          </Card>

          <Card padding="none" title={t("legacySources.scannedTitle")} titleAddon={<Badge>{t("console.countTa", { count: "0" })}</Badge>}>
            <EmptyState icon={Package} title={t("legacySources.scannedEmpty")} description={t("legacySources.scannedEmptyHint")} />
          </Card>
        </>
      )}
    </div>
  );
};

export default memo(ExternalIntegrationDetail);

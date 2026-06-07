import { memo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Globe,
  Package,
  QrCode,
  RefreshCw,
  XCircle,
} from "lucide-react";
import {
  getIntegrationErrorMessage,
  useGetIntegrationById,
} from "../../../entities/integrations";
import BackButton from "../../../shared/ui/BackButton";

const ExternalIntegrationDetail = () => {
  const { t } = useTranslation("newOrders");
  const { id } = useParams();

  const query = useGetIntegrationById(id);
  const integration = query.data?.data;

  const title = integration?.name ?? t("integration");
  const isActive = Boolean(integration?.is_active);
  const synced = integration?.total_synced_orders ?? 0;

  const errorMessage = query.isError
    ? getIntegrationErrorMessage(query.error) || t("integrationLoadError")
    : "";

  return (
    <div className="space-y-5 pb-20 sm:pb-24 md:pb-4">
      {/* Top row (screenshot-like) */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <BackButton className="h-9 min-w-9 rounded-xl px-3 text-xs" />

          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-main/10 dark:bg-main/20 ring-1 ring-main/15 flex items-center justify-center shrink-0">
              <Globe size={16} className="text-main" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-extrabold text-gray-900 dark:text-white m-0 truncate">
                  {title}
                </h2>
                {query.isFetching && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-main/10 dark:bg-main/20 text-main font-bold animate-pulse tracking-wide">
                    {t("refreshing")}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-white/40 m-0 mt-0.5 truncate">
                {integration?.slug ? t("marketSlug", { slug: integration.slug }) : t("idLabel", { id: id ?? "—" })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => query.refetch()}
            title={t("refresh")}
            className="h-9 w-9 rounded-xl flex items-center justify-center bg-main-soft/30 dark:bg-white/5 border border-glass-border hover:border-main/40 hover:text-main dark:hover:border-main/40 text-gray-500 dark:text-white/40 transition-all"
          >
            <RefreshCw size={14} className={query.isFetching ? "animate-spin" : ""} />
          </button>

          <div
            className={`h-9 px-3 rounded-xl flex items-center gap-2 border text-xs font-extrabold ${
              isActive
                ? "bg-success/10 text-success border-success/20"
                : "bg-error/10 text-error border-error/20"
            }`}
            title={isActive ? t("connected") : t("disconnected")}
          >
            {isActive ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {isActive ? t("connected") : t("disconnected")}
            <span className="ml-1 text-[11px] opacity-80 tabular-nums">{synced}</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="px-4 py-3 rounded-xl border border-error/20 bg-error/6 dark:bg-error/10 text-error text-sm">
          {errorMessage}
        </div>
      )}

      {/* Scanner */}
      <div className="rounded-2xl border border-success/30 bg-success/5 dark:bg-success/10 h-44 flex items-center justify-center">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center">
            <QrCode size={22} className="text-success" />
          </div>
          <p className="m-0 text-sm font-extrabold text-success">{t("scannerReady")}</p>
          <p className="m-0 text-[11px] text-gray-500 dark:text-white/50">
            {t("scanQrAutoSearch")}
          </p>
        </div>
      </div>

      {/* Empty scanned orders */}
      <div className="bg-white dark:bg-primarydark border border-glass-border rounded-2xl shadow-sm shadow-main-soft dark:shadow-none">
        <div className="px-5 py-10 flex items-center justify-center">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-main/8 dark:bg-main/15 border border-glass-border flex items-center justify-center">
              <Package size={22} className="text-gray-500 dark:text-white/50" />
            </div>
            <p className="m-0 text-sm font-extrabold text-gray-900 dark:text-white">
              {t("scannedOrdersEmpty")}
            </p>
            <p className="m-0 text-[11px] text-gray-400 dark:text-white/40">
              {t("scannedOrdersHint")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ExternalIntegrationDetail);

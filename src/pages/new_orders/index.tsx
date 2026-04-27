import { memo, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { ClipboardList, QrCode, Store } from "lucide-react";
import type { RootState } from "../../app/config/store";

type Tab = "markets" | "integrations";

const NewOrders = () => {
  const { t } = useTranslation("newOrders");
  const navigate = useNavigate();
  const location = useLocation();
  const role = useSelector((state: RootState) => state.role.role);
  const isMarketRole = role === "market";

  const activeTab = useMemo<Tab>(() => {
    return location.pathname.startsWith("/new-orders/integrations") ? "integrations" : "markets";
  }, [location.pathname]);

  return (
    <div className="rounded-2xl bg-sidebar p-3 dark:bg-maindark sm:p-4 md:p-6">
      <div className="relative overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-elevated)] p-3 shadow-[0_12px_30px_color-mix(in_srgb,var(--color-background-deep)_12%,transparent)] dark:bg-[color:var(--color-surface-elevated-dark)] sm:p-4">
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-main/10 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--color-main)_0%,var(--color-primarydark)_100%)] text-primary shadow-[0_12px_24px_color-mix(in_srgb,var(--color-main)_35%,transparent)]">
            <ClipboardList size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold leading-tight text-maindark dark:text-primary sm:text-2xl">
              {t("pageTitle")}
            </h1>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-maindark/65 dark:text-primary/70 sm:text-sm">
              {t("pageDescription")}
            </p>
          </div>
        </div>
      </div>

      {!isMarketRole && (
        <div className="mb-5 mt-4 flex flex-col gap-3 sm:mb-6 sm:gap-4 lg:flex-row lg:items-center">
          {/* Markets tab */}
          <div
            onClick={() => navigate("/new-orders")}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all duration-200 sm:p-4
              ${activeTab === "markets"
                ? "bg-main text-white border-main shadow-lg shadow-main/25"
                : "bg-white dark:bg-primarydark text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-main/30 hover:bg-gray-50 dark:hover:bg-primarydark/80"
              }`}
          >
            <Store size={20} />
            <h4 className="font-semibold">{t("marketsTab")}</h4>
            <strong
              className={`ml-auto text-sm px-2.5 py-0.5 rounded-lg ${activeTab === "markets"
                ? "bg-white/20 text-white"
                : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400"
                }`}
            >
              2
            </strong>
          </div>

          {/* Tashqi Buyurtmalar tab */}
          <div
            onClick={() => navigate("/new-orders/integrations")}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all duration-200 sm:p-4
              ${activeTab === "integrations"
                ? "bg-main text-white border-main shadow-lg shadow-main/25"
                : "bg-white dark:bg-primarydark text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-main/30 hover:bg-gray-50 dark:hover:bg-primarydark/80"
              }`}
          >
            <QrCode size={20} />
            <h4 className="font-semibold">{t("integrationsTitle")}</h4>
          </div>
        </div>
      )}

      <Outlet />
    </div>
  );
};

export default memo(NewOrders);

import { memo, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Building2, ClipboardList, QrCode, Store } from "lucide-react";
import type { RootState } from "../../app/config/store";
import HeaderName from "../../shared/components/headerName";
import PageContainer from "../../shared/ui/PageContainer";

type Tab = "markets" | "integrations" | "branches";

const NewOrders = () => {
  const { t } = useTranslation("newOrders");
  const navigate = useNavigate();
  const location = useLocation();
  const role = useSelector((state: RootState) => state.role.role);
  const isMarketRole = role === "market";
  const isAdminRole = role === "admin" || role === "superadmin";

  const activeTab = useMemo<Tab>(() => {
    if (location.pathname.startsWith("/new-orders/branches")) return "branches";
    return location.pathname.startsWith("/new-orders/integrations") ? "integrations" : "markets";
  }, [location.pathname]);

  return (
    <PageContainer>
      <div className="mb-4">
        <HeaderName
          name={t("pageTitle")}
          description={t("pageDescription")}
          icon={<ClipboardList />}
        />
      </div>

      {!isMarketRole && (
        <div className="mb-5 mt-4 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {/* Markets tab */}
          <div
            onClick={() => navigate("/new-orders")}
            className={`flex min-w-0 w-full cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all duration-200 sm:p-4
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
            className={`flex min-w-0 w-full cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all duration-200 sm:p-4
              ${activeTab === "integrations"
                ? "bg-main text-white border-main shadow-lg shadow-main/25"
                : "bg-white dark:bg-primarydark text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-main/30 hover:bg-gray-50 dark:hover:bg-primarydark/80"
              }`}
          >
            <QrCode size={20} />
            <h4 className="font-semibold">{t("integrationsTitle")}</h4>
          </div>

          {isAdminRole && (
            <div
              onClick={() => navigate("/new-orders/branches")}
              className={`sm:col-span-2 xl:col-span-1 flex min-w-0 w-full cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all duration-200 sm:p-4
              ${activeTab === "branches"
                ? "bg-main text-white border-main shadow-lg shadow-main/25"
                : "bg-white dark:bg-primarydark text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-main/30 hover:bg-gray-50 dark:hover:bg-primarydark/80"
              }`}
            >
              <Building2 size={20} />
              <h4 className="font-semibold">{t("branchesTab")}</h4>
            </div>
          )}
        </div>
      )}

      <Outlet />
    </PageContainer>
  );
};

export default memo(NewOrders);

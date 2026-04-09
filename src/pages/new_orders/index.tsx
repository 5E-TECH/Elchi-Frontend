import { memo, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import HeaderName from "../../shared/components/headerName";
import { ClipboardList, QrCode, Store } from "lucide-react";

type Tab = "markets" | "integrations";

const NewOrders = () => {
  const { t } = useTranslation("newOrders");
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = useMemo<Tab>(() => {
    return location.pathname.startsWith("/new-orders/integrations") ? "integrations" : "markets";
  }, [location.pathname]);

  return (
    <div className="p-6 rounded-2xl bg-sidebar dark:bg-maindark">
      <HeaderName
        name={t("pageTitle")}
        description={t("pageDescription")}
        icon={<ClipboardList />}
      />

      <div className="flex items-center gap-4 mt-4 mb-6">
        {/* Markets tab */}
        <div
          onClick={() => navigate("/new-orders")}
          className={`flex items-center gap-3 p-4 rounded-2xl w-full cursor-pointer transition-all duration-200 border
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
          className={`flex items-center gap-3 p-4 rounded-2xl w-full cursor-pointer transition-all duration-200 border
            ${activeTab === "integrations"
              ? "bg-main text-white border-main shadow-lg shadow-main/25"
              : "bg-white dark:bg-primarydark text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-main/30 hover:bg-gray-50 dark:hover:bg-primarydark/80"
            }`}
        >
          <QrCode size={20} />
          <h4 className="font-semibold">{t("integrationsTitle")}</h4>
        </div>
      </div>

      <Outlet />
    </div>
  );
};

export default memo(NewOrders);

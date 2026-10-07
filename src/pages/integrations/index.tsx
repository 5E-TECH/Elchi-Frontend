import { useMemo } from "react";
import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Tabs } from "antd";
import { useTranslation } from "react-i18next";
import { Globe, Handshake, Store } from "lucide-react";

/**
 * INTEGRATSIYALAR UYI — PCS (BeePost) `IntegrationsRoot` shakli, 1-ga-1.
 *
 * BeePost'da ildiz uchta antd Tab: "Tashqi saytlar" (manbalar), "Yetkazuvchilar"
 * (cargo), "Marketplace". Elchi domeni teskari — Elchi O'ZI yetkazuvchi, unda
 * BeePost = HAMKOR — shuning uchun yorliqlar moslashtirildi, tuzilma esa aynan:
 *
 *   Hamkorlar       — bizga ulanadiganlar (BeePost, marketplace). Kalit BIZDAN.
 *   Tashqi tizimlar — biz ulanadiganlar (CRM, to'lov, yetkazuvchi).
 *   Marketplace     — ko'p-sotuvchi manbalar (Uzum va h.k.).
 *
 * Har tab bir xil konsolni (`ConnectionsPage`) o'z `scope`'i bilan ko'rsatadi —
 * xuddi BeePost `ProvidersTab` provayderni almashtirgani kabi. Tab tanlovi
 * URL'ga yoziladi (`?scope=`), shuning uchun sahifa yangilansa yo'qolmaydi.
 */

const TABS = [
  { key: "partner", labelKey: "navPartners", icon: <Handshake className="h-4 w-4" /> },
  { key: "external", labelKey: "navExternal", icon: <Globe className="h-4 w-4" /> },
  { key: "marketplace", labelKey: "navMarketplace", icon: <Store className="h-4 w-4" /> },
] as const;

const IntegrationsPage = () => {
  const { t } = useTranslation("integrations");
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /**
   * Faol tab — URL'dagi `scope`'dan. Katalog/usta (`/new`) ochiq bo'lsa ham
   * oxirgi scope yoqilib turadi (tab shunchaki navigatsiya).
   */
  const active = useMemo(() => {
    const s = searchParams.get("scope");
    return TABS.some((tab) => tab.key === s) ? (s as string) : "partner";
  }, [searchParams]);

  const onChange = (key: string) => {
    navigate(`/integrations/connections?scope=${key}`);
  };

  /** Katalog/usta ochiq bo'lsa tab paneli tagida chiziladi (Outlet). */
  const onCreateSurface =
    location.pathname.includes("/integrations/new") ||
    location.pathname.includes("/integrations/sources");

  return (
    <div>
      <Tabs
        size="large"
        activeKey={onCreateSurface ? "" : active}
        onChange={onChange}
        items={TABS.map((tab) => ({
          key: tab.key,
          label: (
            <span className="flex items-center gap-2">
              {tab.icon}
              {t(tab.labelKey)}
            </span>
          ),
        }))}
      />
      <Outlet />
    </div>
  );
};

export default IntegrationsPage;

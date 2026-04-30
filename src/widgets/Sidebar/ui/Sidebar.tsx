import { memo, useMemo } from "react";
import SidebarLink from "./SidebarItem";
import { useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import { SIDEBAR_CONFIG, type SidebarUserRole } from "../model/menuConfig";
import { toggleSidebar } from "../model/sidebarSlice";
import type { RootState } from "../../../app/config/store";
import { ChevronLeft, ChevronRight } from "lucide-react";
import LogoText from "../../../shared/assets/logo yozuvlik qora.png";
import LogoIcon from "../../../shared/assets/logo qora.png";
import LogoTextdark from "../../../shared/assets/logo yozuvlik oq.png";
import LogoIcondark from "../../../shared/assets/logo oq.png";
import { useTheme } from "../../../app/providers/theme/ThemeContext";

const Sidebar = () => {
  const { t } = useTranslation(["sidebar"]);
  const dispatch = useDispatch();
  const sidebarRedux = useSelector((state: RootState) => state.sidebar);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  // ─── User role'ni Redux dan oling ────────────────────────────────────────
  const { role } = useSelector((state: RootState) => state.role);
  const userRole = (role as SidebarUserRole) || "admin";

  // ─── Rolga mos navigation items'ni olish ─────────────────────────────────
  const links = useMemo(() => {
    const navItems = SIDEBAR_CONFIG[userRole] ?? SIDEBAR_CONFIG.admin;

    return navItems.map((item) => ({
      to: item.to,
      icon: <item.icon />,
      label: t(item.label),
      end: item.end,
    }));
  }, [userRole, t]);

  // ─── Logo rasmlarini tanlash ──────────────────────────────────────────────
  const currentLogoText = isDarkMode ? LogoTextdark : LogoText;
  const currentLogoIcon = isDarkMode ? LogoIcondark : LogoIcon;

  return (
    <aside
      className={`sticky left-0 top-0 z-50 hidden h-screen flex-col bg-sidebar text-maindark transition-all duration-300 ease-in-out md:flex dark:bg-maindark dark:text-primary ${!sidebarRedux.isOpen ? "w-20" : "w-72"
        }`}
    >
      {/* Header with Logo */}
      <div className="flex h-22 items-center justify-start overflow-hidden bg-sidebar pl-4 dark:bg-maindark">
        <div
          className={`transition-all duration-300 flex items-center justify-start ${!sidebarRedux.isOpen ? "w-full px-2" : "w-full px-4"
            }`}
        >
          <img
            src={sidebarRedux.isOpen ? currentLogoText : currentLogoIcon}
            alt="Elchi Logo"
            className={`object-contain transition-all duration-300 ${!sidebarRedux.isOpen ? "h-10 w-10" : "h-auto w-40"
              }`}
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto bg-sidebar px-3 py-4 custom-scrollbar dark:bg-maindark">
        {links.map((link) => (
          <SidebarLink key={link.to} {...link} />
        ))}
      </nav>

      {/* Footer with Toggle Button and Logout */}
      <div className={`p-3 flex bg-primary/5 dark:bg-maindark/50 ${!sidebarRedux.isOpen ? "flex-col space-y-3 items-center" : "items-center justify-between"}`}>
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="flex items-center justify-center rounded-lg p-2 transition-all duration-300 text-maindark dark:text-primary hover:bg-main/10"
        >
          {sidebarRedux.isOpen ? (
            <>
              <ChevronLeft size={20} />
              <span className="ml-2 text-sm font-medium">{t("collapse")}</span>
            </>
          ) : (
            <ChevronRight size={20} />
          )}
        </button>
      </div>
    </aside>
  );
};

export default memo(Sidebar);

import { memo, useMemo, useEffect, useState } from "react";
import SidebarLink from "./SidebarItem";
import { useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import { SIDEBAR_CONFIG } from "../model/menuConfig";
import { toggleSidebar } from "../model/sidebarSlice";
import type { RootState } from "../../../app/config/store";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import LogoText from "../../../shared/assets/logo yozuvlik qora.png";
import LogoIcon from "../../../shared/assets/logo qora.png";
import LogoTextdark from "../../../shared/assets/logo yozuvlik oq.png";
import LogoIcondark from "../../../shared/assets/logo oq.png";

const Sidebar = () => {
  const { t } = useTranslation(["sidebar"]);
  const dispatch = useDispatch();
  const sidebarRedux = useSelector((state: RootState) => state.sidebar);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // User role'ni Redux dan oling
  // const userRole = useSelector((state: RootState) => state.auth.role) as UserRole;
  const userRole = "admin";

  // Dark mode holatini kuzatish
  useEffect(() => {
    const checkDarkMode = () => {
      const theme = localStorage.getItem("theme");
      const isDark =
        theme === "dark" ||
        (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
      setIsDarkMode(isDark);
    };

    checkDarkMode();

    // MutationObserver orqali HTML class o'zgarishini kuzatish
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Rolga mos navigation items'ni olish
  const links = useMemo(() => {
    const navItems = SIDEBAR_CONFIG[userRole] || SIDEBAR_CONFIG.user;

    return navItems.map((item: any) => ({
      to: item.to,
      icon: <item.icon />,
      label: t(item.label),
      end: item.end,
    }));
  }, [userRole, t]);

  // Logo rasmlarini tanlash
  const currentLogoText = isDarkMode ? LogoTextdark : LogoText;
  const currentLogoIcon = isDarkMode ? LogoIcondark : LogoIcon;

  return (
    <aside
      className={`h-screen sticky top-0 left-0 flex flex-col bg-sidebar dark:bg-maindark text-maindark dark:text-primary transition-all duration-300 ease-in-out shadow-xl z-50 ${
        !sidebarRedux.isOpen ? "w-24" : "w-72"
      }`}
    >
      {/* Header with Logo */}
      <div className="flex items-center justify-center h-24 bg-sidebar dark:bg-maindark overflow-hidden">
        <div
          className={`transition-all duration-300 flex items-center justify-center ${
            !sidebarRedux.isOpen ? "w-full px-2" : "w-full px-6"
          }`}
        >
          <img
            src={sidebarRedux.isOpen ? currentLogoText : currentLogoIcon}
            alt="Elchi Logo"
            className={`object-contain transition-all duration-300 ${
              !sidebarRedux.isOpen ? "w-12 h-12" : "w-40 h-auto"
            }`}
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-2 custom-scrollbar bg-sidebar dark:bg-maindark">
        {links.map((link: any) => (
          <SidebarLink key={link.to} {...link} />
        ))}
      </nav>

      {/* Footer with Toggle Button */}
      <div className="p-4 flex items-center justify-between bg-primary/5 dark:bg-maindark/50">
        <button
          onClick={() => dispatch(toggleSidebar())}
          className={`flex items-center justify-center p-2 rounded-lg transition-all duration-300 text-maindark dark:text-primary hover:bg-main/10 ${
            !sidebarRedux.isOpen ? "mx-auto" : ""
          }`}
        >
          {sidebarRedux.isOpen ? (
            <ChevronLeft size={20} />
          ) : (
            <ChevronRight size={20} />
          )}
          {sidebarRedux.isOpen && (
            <span className="ml-2 text-sm font-medium">Yashirish</span>
          )}
        </button>

        {sidebarRedux.isOpen && (
          <button className="flex items-center justify-center p-2 rounded-lg hover:bg-red-500/20 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-all duration-300">
            <LogOut size={20} />
          </button>
        )}
      </div>
    </aside>
  );
};

export default memo(Sidebar);

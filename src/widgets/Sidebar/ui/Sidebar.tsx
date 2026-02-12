import { memo, useMemo } from "react";
import SidebarLink from "./SidebarItem";
import { useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import { SIDEBAR_CONFIG } from "../model/menuConfig";
import { toggleSidebar } from "../model/sidebarSlice";
import type { RootState } from "../../../app/config/store";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import LogoText from "../../../shared/assets/logo yozuvlik oq.png";
import LogoIcon from "../../../shared/assets/logo oq.png";

const Sidebar = () => {
  const { t } = useTranslation(["sidebar"]);
  const dispatch = useDispatch();
  const sidebarRedux = useSelector((state: RootState) => state.sidebar);

  // User role'ni Redux dan oling
  // const userRole = useSelector((state: RootState) => state.auth.role) as UserRole;
  const userRole = "admin"

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

  return (
    <aside
      className={`h-screen sticky top-0 left-0 flex flex-col bg-main dark:bg-maindark text-primay transition-all duration-300 ease-in-out shadow-xl z-50 ${!sidebarRedux.isOpen ? "w-24" : "w-72"
        }`}
    >
      {/* Header with Logo */}
      <div className="flex items-center justify-center h-24 border-b border-main bg-main overflow-hidden">
        <div className={`transition-all duration-300 flex items-center justify-center ${!sidebarRedux.isOpen ? "w-full px-2" : "w-full px-6"}`}>
          <img
            src={sidebarRedux.isOpen ? LogoText : LogoIcon}
            alt="Elchi Logo"
            className={`object-contain transition-all duration-300 ${!sidebarRedux.isOpen
              ? "w-12 h-12"
              : "w-40 h-auto"
              }`}
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-2 custom-scrollbar bg-main">
        {links.map((link: any) => (
          <SidebarLink key={link.to} {...link} />
        ))}
      </nav>

      {/* Footer with Toggle Button */}
      <div className="p-4 border-t border-[--primarydark] flex items-center justify-between bg-opacity-10 bg-main">
        <button
          onClick={() => dispatch(toggleSidebar())}
          className={`flex items-center justify-center p-2 rounded-lg hover:bg-[--primarydark] transition-all duration-300 text-white ${!sidebarRedux.isOpen ? "mx-auto" : ""}`}
        >
          {sidebarRedux.isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          {sidebarRedux.isOpen && <span className="ml-2 text-sm font-medium">Yashirish</span>}
        </button>

        {sidebarRedux.isOpen && (
          <button className="flex items-center justify-center p-2 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-500 transition-all duration-300">
            <LogOut size={20} />
          </button>
        )}
      </div>
    </aside>
  );
};

export default memo(Sidebar);
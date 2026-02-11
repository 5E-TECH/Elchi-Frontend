import { memo, useMemo } from "react";
import SidebarLink from "./SidebarItem";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { SIDEBAR_CONFIG } from "../model/menuConfig";
import type { RootState } from "../../../app/config/store";

const Sidebar = () => {
  const { t } = useTranslation(["sidebar"]);
  const sidebarRedux = useSelector((state: RootState) => state.sidebar);
  
  // User role'ni Redux dan oling
//   const userRole = useSelector((state: RootState) => state.auth.role) as UserRole;
    const userRole = "admin"
  // Rolga mos navigation items'ni olish
  const links = useMemo(() => {
    const navItems = SIDEBAR_CONFIG[userRole] || SIDEBAR_CONFIG.user;
    
    return navItems.map((item:any) => ({
      to: item.to,
      icon: <item.icon />,
      label: t(item.label),
      end: item.end,
    }));
  }, [userRole, t]);

  return (
    <div className="bg-(--color-bg-py) pt-6 dark:bg-(--color-dark-bg-py) dark:text-[#E7E3FCE5] h-full">
      <ul
        className={`flex flex-col gap-1.5 mr-4 transition-all duration-300 ease-in-out ${
          !sidebarRedux.isOpen ? "w-15" : "w-61"
        }`}
      >
        {links.map((link:any) => (
          <li key={link.to}>
            <SidebarLink {...link} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default memo(Sidebar);
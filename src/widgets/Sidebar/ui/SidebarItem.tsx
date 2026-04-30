import { memo } from "react";
import { NavLink } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { useSelector } from "react-redux";

interface SidebarLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ to, icon, label, end }) => {
  const sidebarRedux = useSelector((state: RootState) => state.sidebar);

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `mx-1 flex items-center gap-3.5 rounded-xl px-4 py-2.5 capitalize transition-all duration-300 text-[15px] font-semibold ${isActive
          ? "bg-main text-primary shadow-lg shadow-main/30"
          : "text-maindark dark:text-primary hover:bg-main/10 dark:hover:bg-main/20"
        }`
      }
    >
      <span className="text-[19px]">{icon}</span>
      {sidebarRedux.isOpen && <span className="truncate">{label}</span>}
    </NavLink>
  );
};

export default memo(SidebarLink);

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
  const isOpen = sidebarRedux.isOpen;

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center rounded-xl capitalize transition-all duration-300 text-[15px] font-semibold ${
          isOpen
            ? "mx-1 gap-3.5 px-4 py-2.5"
            : "mx-auto h-12 w-12 justify-center p-0"
        } ${isActive
          ? "bg-main text-primary shadow-lg shadow-main/30"
          : "text-maindark dark:text-primary hover:bg-main/10 dark:hover:bg-main/20"
        }`
      }
      aria-label={label}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[19px]">{icon}</span>
      {isOpen && <span className="truncate">{label}</span>}
    </NavLink>
  );
};

export default memo(SidebarLink);

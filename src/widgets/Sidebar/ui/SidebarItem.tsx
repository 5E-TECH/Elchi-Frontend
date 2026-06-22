import { memo } from "react";
import { NavLink } from "react-router-dom";
import { preloadRoute } from "../../../app/lib/routePreload";

interface SidebarLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
  isOpen: boolean;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ to, icon, label, end, isOpen }) => {
  return (
    <NavLink
      to={to}
      end={end}
      onPointerEnter={() => preloadRoute(to)}
      onFocus={() => preloadRoute(to)}
      onTouchStart={() => preloadRoute(to)}
      className={({ isActive }) =>
        `flex items-center rounded-xl capitalize transition-all duration-300 text-[15px] font-semibold ${isOpen
          ? "mx-1 gap-3.5 px-4 py-2"
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

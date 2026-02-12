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
        `flex items-center gap-3 px-4 py-3 mx-2 rounded-xl transition-all duration-300 font-medium ${isActive
          ? "bg-white text-[--main] shadow-lg"
          : "text-white hover:bg-white/10"
        }`
      }>
      <span className="text-xl">{icon}</span>
      {
        sidebarRedux.isOpen &&
        <span className="truncate">{label}</span>
      }
    </NavLink>
  );
};

export default SidebarLink;

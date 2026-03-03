import { memo } from "react";
import { NavLink } from "react-router-dom";
import { Menu, House, ShoppingBag, UserRound, MapPinned } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BottomNavProps {
    onMenuClick: () => void;
}

const BottomNav = ({ onMenuClick }: BottomNavProps) => {
    const { t } = useTranslation(["sidebar"]);

    const navItems = [
        { to: "/", icon: House, label: "dashboard", end: true },
        { to: "/orders", icon: ShoppingBag, label: "orders" },
        { to: "/all-users", icon: UserRound, label: "users" },
        { to: "/regions", icon: MapPinned, label: "region" },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden animate-slide-up">
            <div className="mx-4 mb-4 glass-card-dark rounded-2xl flex items-center justify-around p-2 gap-1 shadow-2xl shadow-black/40 border border-white/10 overflow-hidden">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                            `flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all duration-300 min-w-15 ${isActive
                                ? "bg-main text-white shadow-lg shadow-main/30 scale-105"
                                : "text-white hover:text-white"
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                    {t(item.label)}
                                </span>
                            </>
                        )}
                    </NavLink>
                ))}

                <button
                    onClick={onMenuClick}
                    className="flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all duration-300 min-w-15 text-white/60 hover:text-white"
                >
                    <Menu size={20} strokeWidth={2} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                        Menu
                    </span>
                </button>
            </div>
        </nav>
    );
};

export default memo(BottomNav);

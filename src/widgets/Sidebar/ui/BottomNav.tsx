import { memo } from "react";
import { NavLink } from "react-router-dom";
import { Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { SIDEBAR_CONFIG, type UserRole } from "../model/menuConfig";
import type { RootState } from "../../../app/config/store";

interface BottomNavProps {
    onMenuClick: () => void;
}

const BottomNav = ({ onMenuClick }: BottomNavProps) => {
    const { t } = useTranslation(["sidebar"]);

    // ─── Redux dan haqiqiy rolni oling ───────────────────────────────────────
    const { role } = useSelector((state: RootState) => state.role);
    const userRole = (role as UserRole) || "admin";

    // ─── Rolga mos itemlarni olib, faqat birinchi 4 tasini ko'rsatish ────────
    const navItems = (SIDEBAR_CONFIG[userRole] ?? SIDEBAR_CONFIG.admin).slice(0, 4);

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

import { memo, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { getSidebarConfigForUser, type SidebarUserRole } from "../model/menuConfig";
import type { RootState } from "../../../app/config/store";
import { preloadRoute } from "../../../app/lib/routePreload";
const MOBILE_ADMIN_ALLOWED_LABELS = [
    "dashboard",
    "orders",
    "batches",
    "users",
    "payments",
    "balance",
] as const;

const BottomNav = () => {
    const { t } = useTranslation(["sidebar"]);

    // ─── Redux dan haqiqiy rolni oling ───────────────────────────────────────
    const { role } = useSelector((state: RootState) => state.role);
    const user = useSelector((state: RootState) => state.user.user);
    const userRole = (role as SidebarUserRole) || "admin";

    // ─── navItems memoized — role/user o'zgarmasa qayta hisoblanmaydi ─────────
    const navItems = useMemo(() => {
        const sourceItems = getSidebarConfigForUser(userRole, user);

        if (userRole === "admin" || userRole === "superadmin") {
            return sourceItems.filter((item) =>
                MOBILE_ADMIN_ALLOWED_LABELS.includes(
                    item.label as (typeof MOBILE_ADMIN_ALLOWED_LABELS)[number],
                ),
            );
        }

        if (userRole === "courier") {
            return sourceItems.slice(0, 4);
        }

        return sourceItems;
    }, [userRole, user]);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up lg:hidden">
            <div
                className="mx-4 mb-3 grid gap-1 overflow-hidden rounded-2xl border border-white/60 bg-[rgba(255,255,255,0.55)] p-2 shadow-[0_10px_30px_rgba(56,37,135,0.18)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/15 dark:bg-[rgba(33,25,73,0.52)] dark:shadow-[0_12px_34px_rgba(0,0,0,0.42)]"
                style={{ gridTemplateColumns: `repeat(${Math.max(navItems.length, 1)}, minmax(0, 1fr))` }}
            >
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onPointerEnter={() => preloadRoute(item.to)}
                        onFocus={() => preloadRoute(item.to)}
                        onTouchStart={() => preloadRoute(item.to)}
                        aria-label={t(item.label)}
                        className={({ isActive }) =>
                            `flex items-center justify-center py-2 rounded-xl transition-all duration-300 min-w-0 ${isActive
                                ? "bg-main/90 text-white shadow-[0_8px_22px_rgba(106,70,255,0.45)] scale-105"
                                : "text-maindark/65 hover:bg-white/40 hover:text-maindark dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
                            }`
                        }
                    >
                        {({ isActive }) => <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />}
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

export default memo(BottomNav);

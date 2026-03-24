import { memo, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { X, LogOut, ChevronRight, Moon, Sun, Bell, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SIDEBAR_CONFIG, type UserRole } from "../model/menuConfig";
import { useLogout } from "../../../shared/lib/useLogout";
import { useTheme } from "../../../app/providers/theme/ThemeContext";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import LogoTextdark from "../../../shared/assets/logo yozuvlik oq.png";
import { Controller, useForm } from "react-hook-form";
import { GlobalSearchInput } from "../../../features/search";

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

interface MobileMenuSearchValues {
    search: string;
}

const MobileMenu = ({ isOpen, onClose }: MobileMenuProps) => {
    const { t } = useTranslation(["sidebar"]);
    const { logout } = useLogout();
    const { theme, toggleTheme } = useTheme();
    const roleState = useSelector((state: RootState) => state.role);
    const userRole = (roleState.role as UserRole) || "admin";
    const { control } = useForm<MobileMenuSearchValues>({
        defaultValues: { search: "" },
    });

    const links = useMemo(() => {
        const navItems = SIDEBAR_CONFIG[userRole] ?? SIDEBAR_CONFIG.admin;
        return navItems.map((item: any) => ({
            to: item.to,
            icon: <item.icon size={20} />,
            label: t(item.label),
            end: item.end,
        }));
    }, [userRole, t]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-60 md:hidden overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-loader-in"
                onClick={onClose}
            />

            {/* Content */}
            <div className="absolute right-0 top-0 bottom-0 w-[85%] bg-maindark glass-card-dark border-l border-white/10 shadow-2xl flex flex-col animate-slide-up origin-right">
                {/* Header Section */}
                <div className="flex flex-col gap-4 px-6 py-6 border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <img src={LogoTextdark} alt="Logo" className="h-12 w-auto object-contain" />
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-white/5 text-white/60 hover:text-white transition-colors"
                        >
                            <X size={28} />
                        </button>
                    </div>

                    {/* Search in Menu */}
                    <Controller
                        control={control}
                        name="search"
                        render={({ field }) => (
                            <GlobalSearchInput
                                name={field.name}
                                value={field.value}
                                onBlur={field.onBlur}
                                placeholder="Qidiruv..."
                                className="w-full"
                                inputClassName="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-2xl py-3.5 focus:bg-white/10"
                                iconClassName="text-white/40 group-focus-within:text-main"
                                clearButtonClassName="text-white/40 hover:text-white"
                                onValueChange={field.onChange}
                            />
                        )}
                    />
                </div>

                {/* Navigation Links */}
                <div className="flex-1 overflow-y-auto py-4 px-4 space-y-1 custom-scrollbar">
                    <p className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/30">Asosiy Menyular</p>
                    {links.map((link: any) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.end}
                            onClick={onClose}
                            className={({ isActive }) =>
                                `flex items-center justify-between px-4 py-4 rounded-2xl transition-all duration-300 ${isActive
                                    ? "bg-main text-white shadow-lg shadow-main/20"
                                    : "text-white/60 hover:bg-white/5 hover:text-white"
                                }`
                            }
                        >
                            <div className="flex items-center gap-4">
                                <span className="p-2 rounded-xl bg-white/5">{link.icon}</span>
                                <span className="font-bold text-sm tracking-wide uppercase">{link.label}</span>
                            </div>
                            <ChevronRight size={16} className="opacity-20" />
                        </NavLink>
                    ))}

                    <div className="h-4" />
                    <p className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/30">Sozlamalar</p>

                    {/* Theme Toggle in Menu */}
                    <button
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-between px-4 py-4 rounded-2xl text-white/60 hover:bg-white/5 hover:text-white transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <span className="p-2 rounded-xl bg-white/5 group-hover:bg-main/20 transition-colors">
                                {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
                            </span>
                            <span className="font-bold text-sm tracking-wide uppercase">
                                {theme === "light" ? "Tungi rejim" : "Kunduzgi rejim"}
                            </span>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${theme === "dark" ? "bg-main" : "bg-white/10"}`}>
                            <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${theme === "dark" ? "right-1" : "left-1"}`} />
                        </div>
                    </button>

                    {/* Notifications in Menu - Just UI for now */}
                    <button className="w-full flex items-center justify-between px-4 py-4 rounded-2xl text-white/60 hover:bg-white/5 hover:text-white transition-all group">
                        <div className="flex items-center gap-4">
                            <span className="p-2 rounded-xl bg-white/5 group-hover:bg-main/20 transition-colors relative">
                                <Bell size={20} />
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-darkmain" />
                            </span>
                            <span className="font-bold text-sm tracking-wide uppercase">Bildirishnomalar</span>
                        </div>
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">3</span>
                    </button>
                </div>

                {/* Footer Section - Profile & Logout */}
                <div className="p-6 border-t border-white/5 space-y-4 bg-white/2">
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                        <div className="w-12 h-12 rounded-2xl bg-main flex items-center justify-center shadow-lg shadow-main/20">
                            <User size={24} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-black text-white uppercase tracking-tight">{roleState.name || "Admin User"}</p>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest leading-none mt-1 font-bold">{roleState.role || "Super Admin"}</p>
                        </div>
                    </div>

                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-red-500 text-white font-black uppercase tracking-widest text-xs hover:bg-red-600 active:scale-95 transition-all duration-300 shadow-lg shadow-red-500/20"
                    >
                        <LogOut size={18} />
                        <span>Chiqish</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default memo(MobileMenu);

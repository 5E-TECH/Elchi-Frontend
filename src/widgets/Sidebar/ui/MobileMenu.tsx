import { memo } from "react";
import { X, LogOut, Bell, User, ScanQrCode, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLogout } from "../../../shared/lib/useLogout";
import { useTheme } from "../../../app/providers/theme/ThemeContext";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import LogoText from "../../../shared/assets/logo yozuvlik qora.png";
import LogoTextdark from "../../../shared/assets/logo yozuvlik oq.png";
import { Controller, useForm } from "react-hook-form";
import { GlobalSearchInput } from "../../../features/search";
import { useNavigate } from "react-router-dom";

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
    const { theme } = useTheme();
    const roleState = useSelector((state: RootState) => state.role);
    const { control } = useForm<MobileMenuSearchValues>({
        defaultValues: { search: "" },
    });
    const navigate = useNavigate();

    const currentLogo = theme === "dark" ? LogoTextdark : LogoText;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-60 overflow-hidden lg:hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-loader-in"
                onClick={onClose}
            />

            {/* Content */}
            <div className="absolute bottom-0 right-0 top-0 flex w-[85%] animate-slide-in-right flex-col border-l border-black/10 bg-sidebar shadow-2xl dark:border-white/10 dark:bg-maindark">
                {/* Header Section */}
                <div className="flex flex-col gap-4 border-b border-black/10 px-6 py-6 dark:border-white/5">
                    <div className="flex items-center justify-between">
                        <img src={currentLogo} alt="Logo" className="h-12 w-auto object-contain" />
                        <button
                            onClick={onClose}
                            className="rounded-xl bg-black/5 p-2 text-maindark/60 transition-colors hover:text-maindark dark:bg-white/5 dark:text-white/60 dark:hover:text-white"
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
                                placeholder={t("search")}
                                className="w-full"
                                inputClassName="rounded-2xl border border-black/10 bg-black/5 py-3.5 text-maindark placeholder:text-maindark/35 focus:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:bg-white/10"
                                iconClassName="text-maindark/40 group-focus-within:text-main dark:text-white/40"
                                clearButtonClassName="text-maindark/40 hover:text-maindark dark:text-white/40 dark:hover:text-white"
                                onValueChange={field.onChange}
                            />
                        )}
                    />
                </div>

                {/* Menu Links intentionally removed for mobile as requested */}
                <div className="flex-1 overflow-y-auto py-4 px-4 space-y-1 custom-scrollbar">
                    <p className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-maindark/40 dark:text-white/30">{t("settings")}</p>

                    {/* Settings link (mavzu, til va boshqa sozlamalar shu yerda) */}
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            navigate("/settings");
                        }}
                        className="group flex w-full items-center justify-between rounded-2xl px-4 py-4 text-maindark/75 transition-all hover:bg-black/5 hover:text-maindark dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white"
                    >
                        <div className="flex items-center gap-4">
                            <span className="rounded-xl bg-black/5 p-2 transition-colors group-hover:bg-main/20 dark:bg-white/5">
                                <Settings size={20} />
                            </span>
                            <span className="font-bold text-sm tracking-wide uppercase">{t("settings")}</span>
                        </div>
                    </button>

                    {/* Scanner in mobile menu */}
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            navigate("/scan");
                        }}
                        className="group mt-3 flex w-full items-center justify-between rounded-2xl px-4 py-4 text-maindark/75 transition-all hover:bg-black/5 hover:text-maindark dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white"
                    >
                        <div className="flex items-center gap-4">
                            <span className="rounded-xl bg-black/5 p-2 transition-colors group-hover:bg-main/20 dark:bg-white/5">
                                <ScanQrCode size={20} />
                            </span>
                            <span className="font-bold text-sm tracking-wide uppercase">Scanner</span>
                        </div>
                    </button>

                    {/* Notifications in Menu - Just UI for now */}
                    <button className="group flex w-full items-center justify-between rounded-2xl px-4 py-4 text-maindark/65 transition-all hover:bg-black/5 hover:text-maindark dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white">
                        <div className="flex items-center gap-4">
                            <span className="relative rounded-xl bg-black/5 p-2 transition-colors group-hover:bg-main/20 dark:bg-white/5">
                                <Bell size={20} />
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-darkmain" />
                            </span>
                            <span className="font-bold text-sm tracking-wide uppercase">{t("notifications")}</span>
                        </div>
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">3</span>
                    </button>
                </div>

                {/* Footer Section - Profile & Logout */}
                <div className="space-y-4 border-t border-black/10 bg-black/5 p-6 dark:border-white/5 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-black/5 p-4 dark:border-white/5 dark:bg-white/5">
                        <div className="w-12 h-12 rounded-2xl bg-main flex items-center justify-center shadow-lg shadow-main/20">
                            <User size={24} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-black uppercase tracking-tight text-maindark dark:text-white">{roleState.name || "Admin User"}</p>
                            <p className="mt-1 text-[10px] font-bold uppercase leading-none tracking-widest text-maindark/45 dark:text-white/40">{roleState.role || "Super Admin"}</p>
                        </div>
                    </div>

                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-red-500 text-white font-black uppercase tracking-widest text-xs hover:bg-red-600 active:scale-95 transition-all duration-300 shadow-lg shadow-red-500/20"
                    >
                        <LogOut size={18} />
                        <span>{t("logout")}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default memo(MobileMenu);

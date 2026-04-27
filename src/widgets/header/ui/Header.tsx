import { memo, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import {
  Bell,
  ScanQrCode,
  Check,
  ChevronDown,
  Globe,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  User,
  X,
} from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useTheme } from "../../../app/providers/theme/ThemeContext";
import { useLogout } from "../../../shared/lib/useLogout";
import LogoText from "../../../shared/assets/logo yozuvlik qora.png";
import LogoTextdark from "../../../shared/assets/logo yozuvlik oq.png";
import { useNavigate } from "react-router-dom";
import { GlobalSearchInput } from "../../../features/search";
import { LANGUAGE_STORAGE_KEY, normalizeLanguage } from "../../../i18n";
import type { RootState } from "../../../app/config/store";
import { getUserRoleLabelKey } from "../../../entities/user/lib/role";

interface HeaderProps {
  onMenuClick?: () => void;
}

interface HeaderSearchValues {
  search: string;
}

const FLAGS: Record<string, JSX.Element> = {
  uz: (
    <svg
      viewBox="0 0 900 600"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <rect width="900" height="200" fill="#1EB2A6" />
      <rect y="200" width="900" height="200" fill="#fff" />
      <rect y="400" width="900" height="200" fill="#1DBF73" />
      <rect y="186" width="900" height="28" fill="#E8112D" />
      <rect y="386" width="900" height="28" fill="#E8112D" />
      <circle cx="160" cy="100" r="60" fill="white" />
      <circle cx="185" cy="100" r="50" fill="#1EB2A6" />
      {(
        [
          [260, 55],
          [320, 38],
          [380, 55],
          [260, 100],
          [320, 83],
          [380, 100],
          [260, 145],
          [320, 128],
          [380, 145],
        ] as [number, number][]
      ).map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="16" fill="white" />
      ))}
    </svg>
  ),
  ru: (
    <svg
      viewBox="0 0 3 2"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <rect width="3" height="0.667" fill="#fff" />
      <rect y="0.667" width="3" height="0.667" fill="#0039A6" />
      <rect y="1.333" width="3" height="0.667" fill="#D52B1E" />
    </svg>
  ),
  en: (
    <svg
      viewBox="0 0 60 30"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="white" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 V30 M0,15 H60" stroke="white" strokeWidth="10" />
      <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  ),
};

const LANGUAGE_OPTIONS = [
  { key: "uz", label: "O'zbekcha" },
  { key: "ru", label: "Русский" },
  { key: "en", label: "English" },
] as const;

const Header = ({ onMenuClick }: HeaderProps) => {
  const { logout } = useLogout();
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation("common");
  const { t: tUsers } = useTranslation("users");
  const profile = useSelector((state: RootState) => state.user.user);
  const roleState = useSelector((state: RootState) => state.role);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const { control } = useForm<HeaderSearchValues>({
    defaultValues: { search: "" },
  });

  const navigate = useNavigate();

  const activeLanguage =
    LANGUAGE_OPTIONS.find(
      (language) =>
        language.key === normalizeLanguage(i18n.resolvedLanguage ?? i18n.language),
    ) ?? LANGUAGE_OPTIONS[0];
  const profileRecord = profile as typeof profile & {
    fullName?: string;
    full_name?: string;
  };
  const profileFullName =
    profileRecord?.fullName ||
    profileRecord?.full_name ||
    profileRecord?.name ||
    roleState.name ||
    t("profile");
  const profileRole = tUsers(getUserRoleLabelKey(profileRecord?.role || roleState.role));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setIsLanguageOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageChange = async (nextLanguage: string) => {
    const normalizedLanguage = normalizeLanguage(nextLanguage);
    if (normalizedLanguage === normalizeLanguage(i18n.language)) {
      setIsLanguageOpen(false);
      return;
    }
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
    await i18n.changeLanguage(normalizedLanguage);
    setIsLanguageOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between dark:bg-maindark px-4 md:px-6 py-3 md:py-4 bg-sidebar backdrop-blur-md transition-colors duration-300 shadow-sm border-b border-black/5 dark:border-white/5 h-17.5 md:h-auto">
      {/* Mobile Search Overlay */}
      {isSearchOpen && (
        <div className="absolute inset-0 z-50 bg-sidebar dark:bg-maindark px-4 flex items-center animate-fade-in md:hidden">
          <Controller
            control={control}
            name="search"
            render={({ field }) => (
              <GlobalSearchInput
                name={field.name}
                value={field.value}
                onBlur={field.onBlur}
                autoFocus
                placeholder="Qidiruv..."
                className="w-full"
                inputClassName="bg-white border-primary text-black placeholder:text-black/50 py-2 shadow-lg shadow-main/10"
                iconClassName="text-black group-focus-within:text-main"
                clearButtonClassName="text-black/50 hover:text-black"
                onValueChange={field.onChange}
              />
            )}
          />
          <button
            onClick={() => setIsSearchOpen(false)}
            className="ml-3 p-2 rounded-xl text-maindark dark:text-primary hover:bg-main/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Mobile Logo */}
      <div
        className={`md:hidden ${isSearchOpen ? "hidden" : "block animate-fade-in"}`}
      >
        <img
          src={theme === "dark" ? LogoTextdark : LogoText}
          alt="Logo"
          className="h-28 w-auto object-contain"
          onDoubleClick={() => setIsSearchOpen(true)}
        />
      </div>

      {/* Search Bar - Desktop Only */}
      <Controller
        control={control}
        name="search"
        render={({ field }) => (
          <div className="hidden md:flex flex-1 items-center max-w-lg">
            <GlobalSearchInput
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              placeholder="Qidiruv..."
              className="w-full md:w-96"
              inputClassName="bg-white border-primary text-black placeholder:text-black py-2"
              iconClassName="text-black group-focus-within:text-main"
              clearButtonClassName="text-black/50 hover:text-black"
              onValueChange={field.onChange}
            />
          </div>
        )}
      />

      {/* Right Actions */}
      <div
        className={`flex items-center gap-3 md:gap-4 shrink-0 ${isSearchOpen ? "hidden md:flex" : "flex"}`}
      >
        <div ref={languageMenuRef} className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setIsLanguageOpen((prev) => !prev)}
            className="group flex h-9 items-center gap-1.5 rounded-xl border border-main/15 bg-primary px-2 text-maindark shadow-sm transition-all duration-200 hover:border-main/25 hover:bg-main/10 dark:border-white/10 dark:bg-maindark dark:text-primary"
            aria-label={t("language")}
          >
            <span className="flex h-5 w-7 overflow-hidden rounded-lg shrink-0">
              {FLAGS[activeLanguage.key]}
            </span>
            <div className="hidden items-center gap-1.5 md:flex">
              <span className="text-sm font-medium leading-none">
                {activeLanguage.label}
              </span>
              <Globe className="h-3.5 w-3.5 text-main/80 dark:text-primary/80" />
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 text-maindark/50 transition-all duration-200 dark:text-primary/60 ${isLanguageOpen ? "rotate-180" : "group-hover:translate-y-px"}`}
            />
          </button>

          {isLanguageOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-2xl border border-main/15 bg-primary p-1.5 shadow-[0_20px_45px_var(--color-background-soft)] dark:border-white/10 dark:bg-maindark dark:shadow-[0_20px_45px_var(--color-background-deep)]">
              {LANGUAGE_OPTIONS.map((language) => {
                const isSelected = language.key === activeLanguage.key;
                return (
                  <button
                    key={language.key}
                    type="button"
                    onClick={() => void handleLanguageChange(language.key)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all duration-200 ${isSelected
                        ? "bg-main text-primary"
                        : "text-maindark hover:bg-main/10 dark:text-primary dark:hover:bg-primary/10"
                      }`}
                  >
                    <span
                      className={`flex h-6 w-8 overflow-hidden rounded-lg shrink-0 ${isSelected ? "ring-1 ring-primary/50" : ""}`}
                    >
                      {FLAGS[language.key]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {language.label}
                      </div>
                      <div
                        className={`text-[10px] uppercase tracking-[0.18em] ${isSelected ? "text-primary/75" : "text-maindark/45 dark:text-primary/45"}`}
                      >
                        {language.key}
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate("/scan")}
          className="group relative hidden h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border border-main/15 bg-primary text-maindark shadow-sm transition-all duration-300 hover:border-main/35 hover:bg-main/10 dark:border-white/10 dark:bg-maindark dark:text-primary md:flex md:h-11 md:w-11"
          aria-label={t("scannerTitle")}
          title={t("scannerTitle")}
        >
          <span className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.18),transparent_55%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-main/12 text-main dark:bg-primary/10 dark:text-primary">
            <ScanQrCode className="h-4.5 w-4.5" />
          </span>
        </button>

        <button
          onClick={() => setIsSearchOpen(true)}
          className="md:hidden p-2 rounded-xl text-maindark dark:text-primary hover:bg-main/10 transition-colors"
          aria-label="Open search"
        >
          <Search className="w-5.5 h-5.5" />
        </button>

        {/* Mobile Hamburger */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-xl text-maindark dark:text-primary hover:bg-main/10 transition-colors"
        >
          <Menu className="w-7 h-7" />
        </button>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2 md:gap-4 shrink-0">
          <button
            onClick={toggleTheme}
            className="p-2 md:p-2.5 rounded-xl hover:bg-[--main]/10 text-maindark dark:text-primary transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5 md:w-5.5 md:h-5.5" />
            ) : (
              <Sun className="w-5 h-5 md:w-5.5 md:h-5.5" />
            )}
          </button>

          <button className="relative p-2 md:p-2.5 rounded-xl hover:bg-[--main]/10 text-maindark dark:text-primary transition-colors">
            <Bell className="w-5 h-5 md:w-6 md:h-6" />
            <span className="absolute top-2 right-2 w-2 h-2 md:w-2.5 md:h-2.5 bg-red-500 rounded-full border-2 border-[--bg-default]"></span>
          </button>

          <button
            onClick={logout}
            className="p-2 md:p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 group"
            title="Chiqish"
          >
            <LogOut className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
          </button>

          <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-[--border-default] cursor-pointer hover:opacity-80 transition-opacity">
            <div className="text-right hidden md:block text-maindark dark:text-primary">
              <h4 className="max-w-36 truncate text-sm font-bold">{profileFullName}</h4>
              <p className="text-xs">{profileRole}</p>
            </div>
            <div
              onClick={() => navigate("profile")}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-main flex items-center justify-center shadow-md shadow-main/20"
            >
              <User className="w-4 h-4 text-primary md:w-5 md:h-5" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default memo(Header);

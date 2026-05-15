import { memo, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  Globe,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  User,
  X,
} from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useTheme } from "../../../app/providers/theme/ThemeContext";
import { useLogout } from "../../../shared/lib/useLogout";
import LogoText from "../../../shared/assets/logo yozuvlik qora.png";
import LogoTextdark from "../../../shared/assets/logo yozuvlik oq.png";
import { useNavigate } from "react-router-dom";
import { GlobalSearchInput } from "../../../features/search";
import { useGlobalSearch } from "../../../features/search/api/useGlobalSearch";
import { LANGUAGE_STORAGE_KEY, normalizeLanguage } from "../../../i18n";
import type { RootState } from "../../../app/config/store";
import { getUserRoleLabelKey } from "../../../entities/user/lib/role";
import Popup from "../../../shared/ui/Popup";
import HeaderSearchPopup from "./HeaderSearchPopup";
import ScannerActionButton from "../../../shared/components/ScannerActionButton";

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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [searchLimit, setSearchLimit] = useState(10);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchContainerRef = useRef<HTMLDivElement | null>(null);
  const desktopSearchContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement | null>(null);
  const goShortcutRef = useRef<number>(0);
  const { control, setValue } = useForm<HeaderSearchValues>({
    defaultValues: { search: "" },
  });
  const searchValue = useWatch({ control, name: "search" }) ?? "";
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const navigate = useNavigate();
  const {
    data: searchData,
    isFetching: isSearchLoading,
  } = useGlobalSearch(
    {
      q: debouncedSearch,
      page: 1,
      limit: searchLimit,
    },
    debouncedSearch.trim().length > 0,
  );
  const searchItems = searchData?.items ?? [];
  const totalSearchItems = searchData?.meta.total ?? 0;
  const hasMoreSearch = searchItems.length < totalSearchItems;

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
  const canOpenBatchesShortcut = roleState.role === "manager";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setIsLanguageOpen(false);
      }
      const inDesktop = desktopSearchContainerRef.current?.contains(event.target as Node);
      const inMobile = mobileSearchContainerRef.current?.contains(event.target as Node);
      if (!inDesktop && !inMobile) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return (
        element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.tagName === "SELECT" ||
        element.isContentEditable
      );
    };

    const focusSearch = () => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        desktopSearchInputRef.current?.focus();
        setIsSearchFocused(true);
        return;
      }

      setIsSearchOpen(true);
      window.setTimeout(() => {
        mobileSearchInputRef.current?.focus();
        setIsSearchFocused(true);
      }, 0);
    };

    const handleShortcutKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        focusSearch();
        return;
      }

      if (event.key === "Escape") {
        setIsShortcutsOpen(false);
        setIsLanguageOpen(false);
        setIsSearchFocused(false);
        setIsSearchOpen(false);
        return;
      }

      if (isEditableTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const now = Date.now();
      if (key === "?") {
        event.preventDefault();
        setIsShortcutsOpen(true);
        return;
      }

      if (key === "g") {
        goShortcutRef.current = now;
        return;
      }

      if (goShortcutRef.current && now - goShortcutRef.current <= 900) {
        if (key === "o") {
          event.preventDefault();
          goShortcutRef.current = 0;
          navigate("/orders");
          return;
        }

        if (key === "b" && canOpenBatchesShortcut) {
          event.preventDefault();
          goShortcutRef.current = 0;
          navigate("/batches");
          return;
        }
      }

      if (goShortcutRef.current && now - goShortcutRef.current > 900) {
        goShortcutRef.current = 0;
      }
    };

    window.addEventListener("keydown", handleShortcutKeyDown);
    return () => window.removeEventListener("keydown", handleShortcutKeyDown);
  }, [canOpenBatchesShortcut, navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 450);

    return () => window.clearTimeout(timer);
  }, [searchValue]);

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

  const handleSelectSearchItem = (item: (typeof searchItems)[number]) => {
    const sourceId = item.sourceId ?? String(item.raw.sourceId ?? "");
    const type = item.type ?? "";
    const source = item.source ?? "";

    if (
      source === "identity"
      || ["manager", "courier", "admin", "registrator", "market", "operator", "user"].includes(type)
    ) {
      if (sourceId) navigate(`/all-users/${sourceId}`);
      setIsSearchFocused(false);
      return;
    }

    if (source === "orders" || type === "order") {
      const orderId = sourceId || String(item.raw.order_id ?? item.raw.id ?? "");
      if (orderId) navigate(`/orders/edit/${orderId}`);
      setIsSearchFocused(false);
      return;
    }

    setIsSearchFocused(false);
  };

  const handleLoadMoreSearch = () => {
    if (!hasMoreSearch || isSearchLoading) return;
    setSearchLimit((prev) => {
      const maxLimit = totalSearchItems > 0 ? totalSearchItems : prev + 10;
      if (prev >= maxLimit) return prev;
      return Math.min(prev + 10, maxLimit);
    });
  };

  return (
    <header className="sticky top-0 z-30 flex h-17.5 items-center justify-between gap-2 bg-sidebar px-3 py-3 transition-colors duration-300 md:h-auto md:px-4 md:py-4 lg:px-6 dark:bg-maindark">
      {/* Mobile Search Overlay */}
      {isSearchOpen && (
        <div className="absolute inset-0 z-50 bg-sidebar px-4 flex items-center animate-fade-in dark:bg-maindark lg:hidden">
          <div ref={mobileSearchContainerRef} className="relative w-full">
            <Controller
              control={control}
              name="search"
              render={({ field }) => (
                <GlobalSearchInput
                  ref={mobileSearchInputRef}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  autoFocus
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("globalSearchAria")}
                  className="w-full"
                  inputClassName="border border-main/10 bg-white py-2 text-maindark placeholder:text-maindark/45 shadow-lg shadow-main/10 dark:border-white/10 dark:bg-[var(--color-card-surface-strong)] dark:text-primary dark:placeholder:text-primary/45"
                  iconClassName="text-maindark/50 group-focus-within:text-main dark:text-primary/45"
                  clearButtonClassName="text-maindark/45 hover:text-maindark dark:text-primary/45 dark:hover:text-primary"
                  onFocus={() => setIsSearchFocused(true)}
                  onValueChange={(nextValue) => {
                    setSearchLimit(10);
                    field.onChange(nextValue);
                    setValue("search", nextValue, { shouldDirty: true });
                  }}
                />
              )}
            />
            <HeaderSearchPopup
              open={isSearchFocused && searchValue.trim().length > 0}
              loading={isSearchLoading && searchItems.length === 0}
              loadingMore={isSearchLoading && searchItems.length > 0}
              items={searchItems}
              query={searchValue}
              onSelect={handleSelectSearchItem}
              hasMore={hasMoreSearch}
              onLoadMore={handleLoadMoreSearch}
            />
          </div>
          <button
            type="button"
            onClick={() => setIsSearchOpen(false)}
            aria-label={t("closeSearch")}
            className="ml-3 p-2 rounded-xl text-maindark dark:text-primary hover:bg-main/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Mobile Logo */}
      <div
        className={`lg:hidden ${isSearchOpen ? "hidden" : "block animate-fade-in"}`}
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
          <div ref={desktopSearchContainerRef} className="relative hidden min-w-0 lg:flex lg:flex-1 lg:items-center lg:max-w-[520px]">
            <GlobalSearchInput
              ref={desktopSearchInputRef}
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              placeholder={t("searchPlaceholder")}
              aria-label={t("globalSearchAria")}
              className="w-full"
              inputClassName="border border-main/10 bg-white py-2 text-maindark placeholder:text-maindark/45 dark:border-white/10 dark:bg-[var(--color-card-surface-strong)] dark:text-primary dark:placeholder:text-primary/45"
              iconClassName="text-maindark/50 group-focus-within:text-main dark:text-primary/45"
              clearButtonClassName="text-maindark/45 hover:text-maindark dark:text-primary/45 dark:hover:text-primary"
              onFocus={() => setIsSearchFocused(true)}
              onValueChange={(nextValue) => {
                setSearchLimit(10);
                field.onChange(nextValue);
                setValue("search", nextValue, { shouldDirty: true });
              }}
            />
            <HeaderSearchPopup
              open={isSearchFocused && searchValue.trim().length > 0}
              loading={isSearchLoading && searchItems.length === 0}
              loadingMore={isSearchLoading && searchItems.length > 0}
              items={searchItems}
              query={searchValue}
              onSelect={handleSelectSearchItem}
              hasMore={hasMoreSearch}
              onLoadMore={handleLoadMoreSearch}
            />
          </div>
        )}
      />

      {/* Right Actions */}
      <div
        className={`flex items-center gap-2 md:gap-3 shrink-0 ${isSearchOpen ? "hidden md:flex" : "flex"}`}
      >
        <div ref={languageMenuRef} className="relative hidden lg:block">
          <button
            type="button"
            onClick={() => setIsLanguageOpen((prev) => !prev)}
            className="el-glass-control group flex h-9 items-center gap-1.5 rounded-xl px-2 text-maindark transition-all duration-200 hover:border-[var(--color-border-strong)] hover:bg-main/10 dark:text-primary"
            aria-label={t("language")}
          >
            <span className="flex h-5 w-7 overflow-hidden rounded-lg shrink-0">
              {FLAGS[activeLanguage.key]}
            </span>
            <div className="hidden items-center gap-1.5 xl:flex">
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
            <div className="el-card absolute right-0 top-full z-50 mt-2 w-44 rounded-2xl p-1.5">
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
          onClick={() => setIsShortcutsOpen(true)}
          className="el-glass-control group relative hidden h-10 w-10 cursor-pointer items-center justify-center rounded-2xl text-maindark transition-all duration-300 hover:border-[var(--color-border-strong)] hover:bg-main/10 dark:text-primary md:flex lg:h-11 lg:w-11"
          aria-label={t("keyboardShortcuts")}
          title={t("keyboardShortcuts")}
        >
          <CircleHelp className="h-5 w-5" />
        </button>

        <ScannerActionButton
          onClick={() => navigate("/scan")}
          label={t("scannerTitle")}
          className="hidden lg:inline-flex"
        />

        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="rounded-xl p-2 text-maindark transition-colors hover:bg-main/10 dark:text-primary lg:hidden"
          aria-label={t("openSearch")}
        >
          <Search className="w-5.5 h-5.5" />
        </button>

        {/* Mobile Hamburger */}
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-xl p-2 text-maindark transition-colors hover:bg-main/10 dark:text-primary lg:hidden"
          aria-label={t("openMenu")}
        >
          <Menu className="w-7 h-7" />
        </button>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-1.5 lg:gap-3 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-xl p-2 text-maindark transition-colors hover:bg-main/10 dark:text-primary"
            aria-label={t("toggleTheme")}
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>

          <button
            type="button"
            className="relative hidden rounded-xl p-2 text-maindark transition-colors hover:bg-main/10 lg:inline-flex dark:text-primary"
            aria-label={t("notifications")}
          >
            <Bell className="w-5 h-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-[var(--color-card-surface-strong)] bg-red-500 md:h-2.5 md:w-2.5"></span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 group"
            title="Chiqish"
            aria-label={t("logout")}
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>

          <div className="flex cursor-pointer items-center gap-2 border-l border-[var(--color-border-soft)] pl-2 transition-opacity hover:opacity-90 lg:gap-3 lg:pl-3">
            <div className="text-right hidden xl:block text-maindark dark:text-primary">
              <h4 className="max-w-36 truncate text-sm font-bold">{profileFullName}</h4>
              <p className="text-xs">{profileRole}</p>
            </div>
            <div
              onClick={() => navigate("profile")}
              role="button"
              tabIndex={0}
              aria-label={t("profile")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate("profile");
                }
              }}
              className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-main flex items-center justify-center shadow-md shadow-main/20"
            >
              <User className="w-4 h-4 text-primary lg:w-5 lg:h-5" />
            </div>
          </div>
        </div>
      </div>
      <Popup isShow={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)}>
        <div
          className="w-[92vw] max-w-md rounded-3xl border border-[color:var(--color-border-soft)] bg-primary p-5 shadow-2xl dark:bg-primarydark"
          role="dialog"
          aria-modal="true"
          aria-labelledby="keyboard-shortcuts-title"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="keyboard-shortcuts-title" className="m-0 text-xl font-black text-maindark dark:text-white">
                {t("keyboardShortcuts")}
              </h2>
              <p className="m-0 mt-1 text-sm font-semibold text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                {t("keyboardShortcutsHint")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsShortcutsOpen(false)}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl text-maindark transition hover:bg-main/10 dark:text-white"
              aria-label={t("close")}
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {[
              { keys: "Ctrl + K", description: t("shortcutSearch") },
              { keys: "G → O", description: t("shortcutOrders") },
              ...(canOpenBatchesShortcut ? [{ keys: "G → B", description: t("shortcutBatches") }] : []),
              { keys: "Esc", description: t("shortcutEscape") },
            ].map((shortcut) => (
              <div key={shortcut.keys} className="flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--color-border-soft)] bg-white/70 px-4 py-3 dark:bg-white/[0.04]">
                <span className="text-sm font-bold text-maindark dark:text-white">{shortcut.description}</span>
                <kbd className="rounded-xl border border-[color:var(--color-border-soft)] bg-maindark px-3 py-1.5 text-xs font-black text-white dark:bg-white dark:text-maindark">
                  {shortcut.keys}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </Popup>
    </header>
  );
};

export default memo(Header);

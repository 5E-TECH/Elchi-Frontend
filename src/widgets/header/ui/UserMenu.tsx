// dizayn-v2: shell
import { memo, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Keyboard,
  Languages,
  LogOut,
  Moon,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { ThemeMode } from "../../../entities/settings";
import { cx } from "../../../shared/lib/cx";
import { LANGUAGE_OPTIONS, useAppearance } from "../model/useAppearance";
import { useDismiss } from "../model/useDismiss";
import { AVATAR, KBD, MENU_ITEM, MENU_ITEM_DANGER, MENU_SEP, RAISED } from "./styles";

/**
 * PROFIL TUGMASI VA MENYUSI (maket `.el-user` + `.el-menu`, taxta `tizim-states-navigation` → «Yuqori panel»:
 * «Profil, sozlamalar, mavzu, til va chiqish — profil menyusida»).
 *
 * Tugma: avatar (bosh harflar) + ism va rol (≥ 1024) + `ChevronDown` (ochiq — `ChevronUp`); telefonda 44px.
 * Menyu: ism + rol · filial → Profil · Sozlamalar · Tezkor tugmalar (?) → Mavzu (Kunduzgi | Tungi) · Til →
 * Chiqish (qizil). Klaviatura: ↓/↑ (aylanma), Home/End, Esc — yopadi va fokus tugmaga qaytadi, Tab — yopadi;
 * Til bandida → ochadi, ← yopadi. Tashqariga bosish yopadi.
 */

type UserMenuProps = {
  name: string;
  /** Tugmadagi rol qatori: «Superadmin», «Menejer · Urgut filiali». */
  roleLine: string;
  /** Menyu sarlavhasidagi rol qatori — filial biriktirilgan bo'lsa har doim bilan: «Kuryer · Samarqand filiali». */
  menuRoleLine: string;
  initials: string;
  onOpenShortcuts: () => void;
  onLogout: () => void;
};

const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemradio"]';

const UserMenu = ({ name, roleLine, menuRoleLine, initials, onOpenShortcuts, onLogout }: UserMenuProps) => {
  const { t } = useTranslation("ui");
  const { theme, language, changeTheme, changeLanguage } = useAppearance();
  const [open, setOpen] = useState(false);
  const [languagesOpen, setLanguagesOpen] = useState(false);
  /** Ochilgach qaysi bandga fokus: birinchi (sichqoncha, Enter, ↓) yoki oxirgi (↑). */
  const [initialFocus, setInitialFocus] = useState<"first" | "last">("first");
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const themeLabelId = useId();
  const languagesId = useId();

  const items = useCallback(() => Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []), []);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setLanguagesOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useDismiss(open, [rootRef], (reason) => close(reason === "escape"));

  useEffect(() => {
    if (!open) return;
    const list = items();
    (initialFocus === "last" ? list[list.length - 1] : list[0])?.focus({ preventScroll: true });
  }, [open, initialFocus, items]);

  const openWith = (focus: "first" | "last") => {
    setInitialFocus(focus);
    setOpen(true);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openWith(event.key === "ArrowUp" ? "last" : "first");
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const current = list.indexOf(document.activeElement as HTMLElement);
    const focusAt = (index: number) => list[(index + list.length) % list.length]?.focus();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(current + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(current === -1 ? list.length - 1 : current - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(list.length - 1);
        break;
      case "Tab":
        // Menyu Tab tartibida emas: fokus keyingi elementga o'tadi, menyu yopiladi.
        close(false);
        break;
      default:
        break;
    }
  };

  const onLanguagesKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight" && !languagesOpen) {
      event.preventDefault();
      setLanguagesOpen(true);
    }
    if (event.key === "ArrowLeft" && languagesOpen) {
      event.preventDefault();
      setLanguagesOpen(false);
    }
  };

  const onLanguageOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setLanguagesOpen(false);
      menuRef.current?.querySelector<HTMLElement>(`[aria-controls="${languagesId}"]`)?.focus();
    }
  };

  const currentLanguage = LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ?? language;

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: "light", label: t("header.profile.themeLight") },
    { value: "dark", label: t("header.profile.themeDark") },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        // Ko'rinadigan ism nomning boshida (WCAG 2.5.3 «Label in Name»: «Shodiyor Ergashev» deb ovoz bilan bosish).
        aria-label={`${name}, ${t("header.profile.menu")}`}
        onClick={() => (open ? close(false) : openWith("first"))}
        onKeyDown={onTriggerKeyDown}
        className={cx(
          "flex h-10 min-w-0 items-center gap-2.5 rounded-[10px] pl-1 pr-2 text-text",
          "transition-[background-color] duration-150 motion-reduce:transition-none hover:bg-sunken aria-expanded:bg-sunken",
          "max-md:h-11",
        )}
      >
        <span aria-hidden="true" className={cx(AVATAR, "size-8 text-[13px]")}>
          {initials}
        </span>
        <span className="flex min-w-0 max-w-[200px] flex-col text-left max-lg:hidden">
          <span className="truncate text-sm font-semibold leading-[1.2]">{name}</span>
          <span className="truncate text-xs leading-[1.2] text-text-muted">{roleLine}</span>
        </span>
        {open ? (
          <ChevronUp aria-hidden="true" size={16} className="shrink-0 text-text-subtle" />
        ) : (
          <ChevronDown aria-hidden="true" size={16} className="shrink-0 text-text-subtle" />
        )}
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={t("header.profile.menu")}
          onKeyDown={onMenuKeyDown}
          className={cx(
            RAISED,
            "absolute right-0 top-[calc(100%+8px)] z-10 flex w-[min(296px,calc(100vw-32px))] flex-col gap-0.5 p-1.5",
            // Past oynada (telefon yotiq, 390px) «Chiqish» kesilib qolmasin: menyu oynaga sig'adi va o'zi aylanadi.
            "max-h-[calc(100dvh-80px)] overflow-y-auto overscroll-contain [&>*]:shrink-0",
          )}
        >
          <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-2">
            <span aria-hidden="true" className={cx(AVATAR, "size-10 text-sm")}>
              {initials}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-text">{name}</span>
              <span className="truncate text-xs text-text-muted">{menuRoleLine}</span>
            </span>
          </div>
          <div role="separator" className={MENU_SEP} />

          <Link role="menuitem" tabIndex={-1} to="/profile" onClick={() => close(false)} className={MENU_ITEM}>
            <User aria-hidden="true" size={18} />
            {t("header.profile.profile")}
          </Link>
          <Link role="menuitem" tabIndex={-1} to="/settings" onClick={() => close(false)} className={MENU_ITEM}>
            <Settings aria-hidden="true" size={18} />
            {t("header.profile.settings")}
          </Link>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-keyshortcuts="?"
            onClick={() => {
              close(false);
              onOpenShortcuts();
            }}
            className={MENU_ITEM}
          >
            <Keyboard aria-hidden="true" size={18} />
            {t("header.profile.shortcuts")}
            <span aria-hidden="true" className={cx(KBD, "ml-auto")}>
              ?
            </span>
          </button>
          <div role="separator" className={MENU_SEP} />

          <div
            role="group"
            aria-labelledby={themeLabelId}
            className="flex items-center justify-between gap-2 py-1 pl-2.5 pr-1"
          >
            <span id={themeLabelId} className="inline-flex items-center gap-2.5 text-[13px] text-text">
              {theme === "dark" ? (
                <Moon aria-hidden="true" size={18} className="text-text-muted" />
              ) : (
                <Sun aria-hidden="true" size={18} className="text-text-muted" />
              )}
              {t("header.profile.theme")}
            </span>
            <span className="inline-flex gap-0.5 rounded-[10px] border border-border bg-sunken p-[3px]">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  tabIndex={-1}
                  aria-checked={theme === option.value}
                  onClick={() => changeTheme(option.value)}
                  className={cx(
                    "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold",
                    "text-text-muted transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none",
                    "hover:text-text aria-checked:bg-surface aria-checked:text-text aria-checked:shadow-xs max-md:min-h-11",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </span>
          </div>

          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-expanded={languagesOpen}
            aria-controls={languagesId}
            onClick={() => setLanguagesOpen((value) => !value)}
            onKeyDown={onLanguagesKeyDown}
            className={MENU_ITEM}
          >
            <Languages aria-hidden="true" size={18} />
            {t("header.profile.language")}
            <span className="ml-auto truncate text-text-muted">{currentLanguage}</span>
            {languagesOpen ? (
              <ChevronDown aria-hidden="true" size={16} />
            ) : (
              <ChevronRight aria-hidden="true" size={16} />
            )}
          </button>
          {languagesOpen ? (
            <div id={languagesId} role="group" aria-label={t("header.profile.language")} className="flex flex-col gap-0.5">
              {LANGUAGE_OPTIONS.map((option) => {
                const checked = option.value === language;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    tabIndex={-1}
                    aria-checked={checked}
                    lang={option.value}
                    onClick={() => changeLanguage(option.value)}
                    onKeyDown={onLanguageOptionKeyDown}
                    className={cx(MENU_ITEM, "pl-9", checked && "font-semibold")}
                  >
                    {option.label}
                    {checked ? <Check aria-hidden="true" size={16} className="ml-auto" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div role="separator" className={MENU_SEP} />

          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              close(false);
              onLogout();
            }}
            className={MENU_ITEM_DANGER}
          >
            <LogOut aria-hidden="true" size={18} />
            {t("header.profile.logout")}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default memo(UserMenu);

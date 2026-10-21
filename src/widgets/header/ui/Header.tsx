// dizayn-v2: shell
import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import { Menu, ScanLine, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { canViewOrders } from "../../../app/lib/access";
import { getUserRoleLabelKey, roleHasGlobalSearch, roleHasScanner } from "../../../entities/user/lib/role";
import { openScanner } from "../../../shared/lib/scanner/scannerHost";
import { useActiveScanTarget } from "../../../shared/lib/scanner/scanTargets";
import { preloadScannerCamera } from "../../../shared/ui/camera/loadScannerCamera";
import { useLogout } from "../../../shared/lib/useLogout";
import { Button, IconButton } from "../../../shared/ui/primitives";
import { useMobileMenu } from "../../Sidebar/model/shellNav";
import { useHeaderSearch } from "../model/useHeaderSearch";
import { DESKTOP_QUERY, matchesMedia, useMediaQuery } from "../model/useMediaQuery";
import {
  TOPBAR_BRANCH_ROLES,
  getInitials,
  joinRoleAndBranch,
  readBranchName,
  readDisplayName,
} from "../model/userIdentity";
import HeaderSearch from "./HeaderSearch";
import NotificationsMenu from "./NotificationsMenu";
import SearchScreen from "./SearchScreen";
import ShortcutsDialog from "./ShortcutsDialog";
import UserMenu from "./UserMenu";

/**
 * YUQORI PANEL (maket `.el-topbar`, `design/tools/build.mjs` → `topbar()`; taxta `tizim-states-navigation` →
 * 02 «Yuqori panel» va 06 «Telefon navigatsiyasi»). Shell slotida (`data-shell-slot="topbar"`) — o'zi
 * `sticky/fixed` emas, 64px, `surface` fon, pastda chiziq; chekkalar 32px (< 1024 da 16px).
 *
 *   ≥ 1024:  [qidiruv 420px] ……… [Skanerlash] [qo'ng'iroqcha] [avatar · ism · rol ▾]
 *   768–1023: [menyu] ……… [Skanerlash] [qidiruv] [qo'ng'iroqcha] [avatar ▾]
 *   < 768:   [menyu] ……… [qidiruv] [qo'ng'iroqcha] [avatar ▾]   — har biri 44px
 *
 * Profil, sozlamalar, tezkor tugmalar, mavzu, til va «Chiqish» — profil menyusida (`UserMenu`).
 * Planshet/telefondagi qidiruv tugmasi maketda yo'q (u yerda qidiruv sahifa tepasida) — sahifalar 4-bosqichda
 * ko'chguncha global qidiruvga yagona yo'l, shuning uchun saqlangan.
 *
 * Klaviatura: Ctrl/⌘ + K — qidiruv, `?` — tezkor tugmalar, G → O — buyurtmalar, G → B — paketlar (menejer).
 *
 * Rol personasi (`entities/user/lib/role.ts`, maket `roles.json` → `persona`): «Skanerlash» faqat
 * `roleHasScanner` rollarida (market, market operatori, logist, investorda yo'q); qidiruv (maydon, telefondagi
 * qidiruv ekrani, Ctrl K) faqat `roleHasGlobalSearch` da (investorda yo'q). G → O — buyurtmalar ochiladigan
 * rolda (`canViewOrders`), aks holda tugma 403 ga olib borardi.
 */

interface HeaderProps {
  /** Shell (dashboardLayout) beradi; bo'lmasa — `useMobileMenu().open`. */
  onMenuClick?: () => void;
}

const GO_SHORTCUT_WINDOW_MS = 900;

const isEditableTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element || !element.tagName) return false;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT" ||
    element.isContentEditable
  );
};

const Header = ({ onMenuClick }: HeaderProps) => {
  const { t } = useTranslation("ui");
  const { t: tUsers } = useTranslation("users");
  const navigate = useNavigate();
  const { logout } = useLogout();
  const mobileMenu = useMobileMenu();
  const profile = useSelector((state: RootState) => state.user.user);
  const roleState = useSelector((state: RootState) => state.role);
  const scanTarget = useActiveScanTarget();

  const searchId = useId();
  const search = useHeaderSearch(searchId);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [searchScreenOpen, setSearchScreenOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const goShortcutRef = useRef(0);

  const role = (profile as { role?: string } | null)?.role || roleState.role;
  const name = readDisplayName(profile, roleState.name) ?? t("header.profile.profile");
  const roleLabel = tUsers(getUserRoleLabelKey(role));
  const branchName = readBranchName(profile);
  const menuRoleLine = joinRoleAndBranch(roleLabel, branchName);
  const roleLine = TOPBAR_BRANCH_ROLES.has(String(role ?? "").toLowerCase()) ? menuRoleLine : roleLabel;
  const canOpenBatchesShortcut = roleState.role === "manager";
  const canOpenOrdersShortcut = useSelector(canViewOrders);
  const hasScanner = roleHasScanner(role);
  const hasSearch = roleHasGlobalSearch(role);

  const openSearchScreen = useCallback(() => setSearchScreenOpen(true), []);
  const { setOpen: setSearchOpen, close: closeSearch } = search;
  const closeSearchScreen = useCallback(() => {
    setSearchScreenOpen(false);
    closeSearch();
  }, [closeSearch]);

  // Qidiruv ekrani faqat < 1024 da: ekran kengaysa yopiladi (desktopda maydon panelning o'zida).
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (query.matches) closeSearchScreen();
    };
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, [closeSearchScreen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "k") {
        if (!hasSearch) return;
        event.preventDefault();
        if (matchesMedia(DESKTOP_QUERY)) {
          desktopInputRef.current?.focus();
          setSearchOpen(true);
        } else {
          setSearchScreenOpen(true);
        }
        return;
      }

      if (event.defaultPrevented || isEditableTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const now = Date.now();
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (key === "g") {
        goShortcutRef.current = now;
        return;
      }
      if (goShortcutRef.current && now - goShortcutRef.current <= GO_SHORTCUT_WINDOW_MS) {
        if (key === "o" && canOpenOrdersShortcut) {
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
      if (goShortcutRef.current && now - goShortcutRef.current > GO_SHORTCUT_WINDOW_MS) {
        goShortcutRef.current = 0;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canOpenBatchesShortcut, canOpenOrdersShortcut, hasSearch, navigate, setSearchOpen]);

  return (
    <header
      aria-label={t("header.label")}
      className="flex h-16 items-center gap-3 border-b border-border bg-surface px-8 max-lg:px-4"
    >
      <IconButton
        label={t("header.openMenu")}
        icon={Menu}
        aria-haspopup="dialog"
        aria-expanded={mobileMenu.isOpen}
        onClick={onMenuClick ?? mobileMenu.open}
        className="lg:hidden"
      />

      {isDesktop && hasSearch ? (
        <HeaderSearch search={search} listId={`${searchId}-list`} inputRef={desktopInputRef} />
      ) : null}

      <div aria-hidden="true" className="min-w-0 flex-1" />

      {/* Skanersiz rollar — market, market operatori, logist, investor (maket: persona.scan=false; ega qarori
          2026-10-16, ROL-0). Kontekstli (ega roziligi 2026-10-19): sahifa skan maqsadi bo'lsa kamera shu sahifa
          ustida ochiladi, aks holda `/scan`. */}
      {hasScanner ? (
        <Button
          variant="secondary"
          leftIcon={ScanLine}
          aria-label={scanTarget ? t("shell.scanFor", { action: t("header.scan"), target: scanTarget.title }) : undefined}
          aria-haspopup={scanTarget ? "dialog" : undefined}
          onClick={() => openScanner({ navigate })}
          // Kamera alohida bo'lak — sekin tarmoqda birinchi bosish «hech narsa bo'lmadi» bo'lib qolmasin.
          onPointerEnter={scanTarget ? preloadScannerCamera : undefined}
          onFocus={scanTarget ? preloadScannerCamera : undefined}
          className="max-md:hidden"
        >
          {t("header.scan")}
        </Button>
      ) : null}

      {!isDesktop && hasSearch ? (
        <IconButton
          label={t("header.search.open")}
          icon={Search}
          aria-haspopup="dialog"
          aria-expanded={searchScreenOpen}
          onClick={openSearchScreen}
          className="lg:hidden"
        />
      ) : null}

      <NotificationsMenu enabled={Boolean(roleState.role)} />

      <UserMenu
        name={name}
        roleLine={roleLine}
        menuRoleLine={menuRoleLine}
        initials={getInitials(name)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onLogout={() => void logout()}
      />

      {hasSearch ? (
        <SearchScreen
          open={searchScreenOpen && !isDesktop}
          search={search}
          listId={`${searchId}-screen-list`}
          onClose={closeSearchScreen}
        />
      ) : null}
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        showSearch={hasSearch}
        showOrders={canOpenOrdersShortcut}
        showBatches={canOpenBatchesShortcut}
      />
    </header>
  );
};

export default memo(Header);

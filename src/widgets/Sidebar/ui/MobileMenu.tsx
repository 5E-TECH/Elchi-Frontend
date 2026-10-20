// dizayn-v2: shell
import {
  memo,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  Bell,
  ChevronRight,
  LogOut,
  Search,
  Settings,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import type { RootState } from "../../../app/config/store";
import { canViewOrders } from "../../../app/lib/access";
import { useUnreadCount } from "../../../entities/notification-inbox";
import { getUserRoleLabelKey, roleHasGlobalSearch } from "../../../entities/user/lib/role";
import { cx } from "../../../shared/lib/cx";
import { useFocusTrap } from "../../../shared/lib/useFocusTrap";
import { useLogout } from "../../../shared/lib/useLogout";
import { extractScannerToken } from "../../../shared/lib/scanToken";
import { Button, IconButton } from "../../../shared/ui/primitives";
import LogoWhite from "../../../shared/assets/brand/elchi-logo-white.png";
import { useNavPathname } from "../model/shellNav";
import {
  formatNavCount,
  getActiveNavTo,
  getNavPersona,
  getTileAccessibleName,
  useNavSections,
  type NavEntry,
  type NavSection,
} from "../model/navSections";
import SidebarItem from "./SidebarItem";
import { NAV_ROW, NAV_ROW_ACTIVE, NAV_ROW_IDLE } from "./navClasses";

/**
 * SURILUVCHI MENYU (< 1024) — maket `courier-dashboard-mobile-menu` (planshet: chapdan yon panel,
 * telefon: pastki varaqa). Ochuvchilar: yuqori paneldagi menyu tugmasi va telefondagi pastki menyu «Menyu»
 * bandi (`useMobileMenu().open()`); shell sahifa almashganda va ekran ≥ 1024 bo'lganda o'zi yopadi.
 *
 * Planshet (768–1023): 296px navy panel, yon menyu bilan bir xil bandlar (`SidebarItem`), guruhlar, qidiruv,
 *   «Shaxsiy» (Bildirishnomalar soni bilan, Sozlamalar), pastda foydalanuvchi va «Chiqish».
 * Telefon (< 768): pastki varaqa — sarlavha «Menyu», qidiruv, foydalanuvchi kartasi, bo'limlar 3 ustunli
 *   kataklarda (≥ 72px; uzun menyuda guruh sarlavhalari bilan), «Bildirishnomalar» / «Sozlamalar» qatorlari
 *   (56px) va «Chiqish» (yumshoq qizil, 48px).
 *
 * Ikkalasi: `role="dialog"` + `aria-modal`, fokus ichida qamaladi, Escape va fon bosilsa yopiladi, yopilganda
 * fokus ochgan tugmaga qaytadi (`useFocusTrap`). Shell ochiq paytda orqa fonni `inert` qiladi.
 * Bandlar, guruhlar, yorliqlar, ikonkalar va faol band — yon menyu bilan bitta manbadan (`useNavSections`,
 * `getActiveNavTo` + `useNavPathname`).
 */

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Telefon chegarasi (Tailwind `max-md`). */
const PHONE_QUERY = "(max-width: 767px)";

const subscribePhone = (onChange: () => void) => {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener?.("change", onChange);
  return () => query.removeEventListener?.("change", onChange);
};
const isPhoneNow = () =>
  typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches;
const useIsPhone = () => useSyncExternalStore(subscribePhone, isPhoneNow, () => false);

/** «Shaxsiy» bo'lim: bildirishnomalar qutisi va sozlamalar (maketda profil menyusidagi bandlar). */
type PersonalEntry = {
  to: string;
  icon: LucideIcon;
  label: string;
  count: string | null;
  countLabel?: string;
};

type Persona = { name: string; initials: string; subtitle: string };

/** `.el-search` + `INPUT` (CODE-MAP 1, 2.4): 44px — menyu teginish uchun (planshet ham). */
const SEARCH_INPUT =
  "h-11 w-full rounded-[10px] border pl-10 pr-3 text-base md:text-sm [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden " +
  "transition-[background-color,border-color,color,box-shadow,opacity] duration-150 motion-reduce:transition-none";

/** Qidiruv: buyurtmalar ro'yxatiga `?search=` bilan o'tadi (skaner havolasi bo'lsa — uning tokeni). */
const MenuSearch = ({
  onSearch,
  tone,
}: {
  onSearch: (value: string) => void;
  tone: "nav" | "surface";
}) => {
  const { t } = useTranslation(["sidebar"]);
  const [value, setValue] = useState("");
  const inputId = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    const token = trimmed.includes("/scan/")
      ? extractScannerToken(trimmed, window.location.origin)
      : null;
    onSearch(token && token.length >= 6 ? token : trimmed);
  };

  return (
    <form role="search" onSubmit={submit} className="relative flex shrink-0 items-center">
      <label htmlFor={inputId} className="sr-only">
        {t("searchLabel")}
      </label>
      <Search
        aria-hidden="true"
        size={18}
        className={cx(
          "pointer-events-none absolute left-3",
          tone === "nav" ? "text-nav-muted" : "text-text-subtle",
        )}
      />
      <input
        id={inputId}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("searchPlaceholder")}
        className={cx(
          SEARCH_INPUT,
          tone === "nav"
            ? "border-nav-line bg-nav-hover text-on-nav placeholder:text-nav-muted focus:border-nav-text focus-visible:outline-nav-text!"
            : "border-border-strong bg-input text-text placeholder:text-text-subtle hover:border-text-subtle focus:border-action focus:ring-3 focus:ring-focus",
        )}
      />
    </form>
  );
};

/** Avatar (maket `.el-avatar`): bosh harflar. */
const Avatar = ({ initials, className }: { initials: string; className: string }) => (
  <span
    aria-hidden="true"
    className={cx(
      "inline-flex shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
      className,
    )}
  >
    {initials}
  </span>
);

/* ─── Planshet: chapdan yon panel (navy) ─────────────────────────────────── */

type VariantProps = {
  titleId: string;
  sections: NavSection[];
  personal: PersonalEntry[];
  activeTo: string | null;
  persona: Persona;
  branchTypeMissing: boolean;
  /**
   * Menyu qidiruvi — global qidiruvi bor (`roleHasGlobalSearch`; investor maketida yo'q) va buyurtmalar ochiladigan
   * (`canViewOrders`) rolda.
   */
  showSearch: boolean;
  label: (item: NavEntry) => string;
  /** Ixcham katak yorlig'i (qisqa shakl bo'lsa — u). */
  shortLabel: (item: NavEntry) => string;
  onClose: () => void;
  onSearch: (value: string) => void;
  onLogout: () => void;
};

const NavGroupLabel = ({
  id,
  children,
  tone,
}: {
  id: string;
  children: ReactNode;
  tone: "nav" | "surface";
}) => (
  <div
    id={id}
    className={cx(
      "text-xs leading-[18px] font-semibold uppercase tracking-[.06em]",
      tone === "nav" ? "px-3 pt-4 pb-1.5 text-nav-muted" : "text-text-muted",
    )}
  >
    {children}
  </div>
);

const Drawer = ({
  titleId,
  sections,
  personal,
  activeTo,
  persona,
  branchTypeMissing,
  showSearch,
  label,
  onClose,
  onSearch,
  onLogout,
}: VariantProps) => {
  const { t } = useTranslation(["sidebar"]);
  const baseId = useId();

  return (
    <div
      data-mobile-menu="drawer"
      className={cx(
        "relative flex h-full w-[min(296px,86%)] flex-col overflow-y-auto overscroll-contain bg-nav px-3 pb-4 text-nav-text shadow-xl",
        "transition-transform duration-200 ease-out starting:-translate-x-full motion-reduce:transition-none",
      )}
    >
      <div className="mb-2 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-nav-line pl-2">
        <img
          src={LogoWhite}
          alt="Elchi Pochta"
          width={96}
          height={32}
          className="block h-8 w-auto"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label={t("closeMenu")}
          title={t("closeMenu")}
          className={cx(NAV_ROW, NAV_ROW_IDLE, "size-11 shrink-0 justify-center")}
        >
          <X aria-hidden="true" size={20} />
        </button>
      </div>
      <h2 id={titleId} className="sr-only">
        {t("menu")}
      </h2>

      {showSearch ? (
        <div className="mt-1 mb-3">
          <MenuSearch onSearch={onSearch} tone="nav" />
        </div>
      ) : null}

      {branchTypeMissing ? (
        <div
          role="status"
          className="mb-2 flex shrink-0 items-start gap-2 rounded-[10px] bg-warning-soft px-3 py-2.5 text-[13px] leading-snug text-warning-fg"
        >
          <TriangleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold">{t("branchTypeMissing")}</div>
            {t("branchTypeMissingHint")}
          </div>
        </div>
      ) : null}

      <nav aria-label={t("sections")} className="flex shrink-0 flex-col gap-0.5">
        {sections.map((section, index) => {
          const headingId = `${baseId}-${section.id ?? `top-${index}`}`;
          return (
            <div key={section.id ?? `top-${index}`} className="flex flex-col gap-0.5">
              {section.id ? (
                <NavGroupLabel id={headingId} tone="nav">
                  {t(`group_${section.id}`)}
                </NavGroupLabel>
              ) : null}
              <ul
                role="list"
                aria-labelledby={section.id ? headingId : undefined}
                className="m-0 flex list-none flex-col gap-0.5 p-0"
              >
                {section.items.map((item) => (
                  <li key={item.to} className="flex flex-col">
                    <SidebarItem
                      to={item.to}
                      icon={item.icon}
                      label={label(item)}
                      active={item.to === activeTo}
                      onNavigate={onClose}
                      touch
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <NavGroupLabel id={`${baseId}-personal`} tone="nav">
        {t("personal")}
      </NavGroupLabel>
      <nav aria-labelledby={`${baseId}-personal`} className="flex shrink-0 flex-col gap-0.5">
        {personal.map((entry) => (
          <SidebarItem
            key={entry.to}
            to={entry.to}
            icon={entry.icon}
            label={entry.label}
            count={entry.count}
            countLabel={entry.countLabel}
            active={entry.to === activeTo}
            onNavigate={onClose}
            touch
          />
        ))}
      </nav>

      <div aria-hidden="true" className="min-h-3 flex-1" />

      <div className="flex shrink-0 flex-col gap-1 border-t border-nav-line pt-3">
        <Link
          to="/profile"
          onClick={onClose}
          aria-current={activeTo === "/profile" ? "page" : undefined}
          aria-label={`${t("openProfile")}: ${persona.name}`}
          className={cx(
            NAV_ROW,
            activeTo === "/profile" ? NAV_ROW_ACTIVE : NAV_ROW_IDLE,
            "h-14 shrink-0 px-2",
          )}
        >
          <Avatar initials={persona.initials} className="size-8 bg-nav-active text-nav-text" />
          <span className="flex min-w-0 flex-col leading-[1.3]">
            <span className="truncate font-semibold">{persona.name}</span>
            <span className="truncate text-xs font-medium text-nav-muted">{persona.subtitle}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className={cx(NAV_ROW, NAV_ROW_IDLE, "h-11 w-full shrink-0 px-3 text-left")}
        >
          <LogOut aria-hidden="true" size={20} className="shrink-0" />
          <span className="truncate">{t("logout")}</span>
        </button>
      </div>
    </div>
  );
};

/* ─── Telefon: pastki varaqa ─────────────────────────────────────────────── */

/** Katak (maket: 72px, radius 12, ikonka 22, yorliq 13px/600 bir qatorda). Ichki chekka 2px — 375px da ham uzun so'z sig'sin. */
const TILE =
  "relative flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-0.5 py-2.5 " +
  "text-center no-underline transition-[background-color,border-color,color,box-shadow,opacity] duration-150 " +
  "motion-reduce:transition-none";

const ROW =
  "flex min-h-14 items-center gap-3 px-4 py-2 text-text no-underline " +
  "transition-[background-color,border-color,color,box-shadow,opacity] duration-150 motion-reduce:transition-none " +
  "hover:bg-border/40 focus-visible:-outline-offset-2!";

const Sheet = ({
  titleId,
  sections,
  personal,
  activeTo,
  persona,
  branchTypeMissing,
  showSearch,
  label,
  shortLabel,
  onClose,
  onSearch,
  onLogout,
}: VariantProps) => {
  const { t } = useTranslation(["sidebar"]);
  const baseId = useId();

  return (
    <div
      data-mobile-menu="sheet"
      className={cx(
        "relative flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-[20px] border border-b-0 border-border bg-raised",
        "px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-text shadow-xl",
        "transition-transform duration-200 ease-out starting:translate-y-full motion-reduce:transition-none",
      )}
    >
      <div
        aria-hidden="true"
        className="mx-auto mt-1 h-1 w-10 shrink-0 rounded-full bg-border-strong"
      />
      <div className="-my-1 -mr-2 flex shrink-0 items-center justify-between gap-3">
        <h2 id={titleId} className="text-base font-bold text-text">
          {t("menu")}
        </h2>
        <IconButton size="lg" label={t("closeMenu")} icon={X} onClick={onClose} />
      </div>

      {showSearch ? <MenuSearch onSearch={onSearch} tone="surface" /> : null}

      <Link
        to="/profile"
        onClick={onClose}
        aria-current={activeTo === "/profile" ? "page" : undefined}
        aria-label={`${t("openProfile")}: ${persona.name}`}
        className={cx(
          "flex shrink-0 items-center gap-3 rounded-xl bg-sunken px-4 py-2.5 text-text no-underline",
          "transition-[background-color,border-color,color,box-shadow,opacity] duration-150 hover:bg-border/40 motion-reduce:transition-none",
        )}
      >
        <Avatar initials={persona.initials} className="size-11 bg-avatar text-on-avatar" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold">{persona.name}</span>
          <span className="truncate text-[13px] text-text-muted">{persona.subtitle}</span>
        </span>
        <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-text-subtle" />
      </Link>

      {branchTypeMissing ? (
        <div
          role="status"
          className="flex shrink-0 items-start gap-2 rounded-xl bg-warning-soft px-3 py-2.5 text-[13px] leading-snug text-warning-fg"
        >
          <TriangleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold">{t("branchTypeMissing")}</div>
            {t("branchTypeMissingHint")}
          </div>
        </div>
      ) : null}

      <nav aria-label={t("sections")} className="flex shrink-0 flex-col gap-3">
        {sections.map((section, index) => {
          const headingId = `${baseId}-${section.id ?? `top-${index}`}`;
          return (
            <div key={section.id ?? `top-${index}`} className="flex flex-col gap-2">
              {section.id ? (
                <NavGroupLabel id={headingId} tone="surface">
                  {t(`group_${section.id}`)}
                </NavGroupLabel>
              ) : null}
              <ul
                role="list"
                aria-labelledby={section.id ? headingId : undefined}
                className="m-0 grid list-none grid-cols-3 gap-2 p-0"
              >
                {section.items.map((item) => {
                  const active = item.to === activeTo;
                  const text = label(item);
                  const compact = shortLabel(item);
                  return (
                    <li key={item.to} className="flex min-w-0 flex-col">
                      <Link
                        to={item.to}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        // Qisqa yorliq ko'rinsa, to'liq nom ekran o'quvchida va maslahatda (WCAG 2.5.3: nom ko'ringan so'zni o'z ichiga oladi).
                        aria-label={getTileAccessibleName(compact, text)}
                        title={text}
                        className={cx(
                          TILE,
                          active
                            ? "bg-action-soft text-action-fg"
                            : "bg-sunken text-text hover:bg-border/40",
                        )}
                      >
                        <item.icon aria-hidden="true" size={22} className="shrink-0" />
                        <span className="block max-w-full truncate text-[13px] font-semibold">
                          {compact}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <nav
        aria-label={t("personalSections")}
        className="flex shrink-0 flex-col overflow-hidden rounded-xl bg-sunken"
      >
        {personal.map((entry, index) => {
          const active = entry.to === activeTo;
          return (
            <Link
              key={entry.to}
              to={entry.to}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
              aria-label={
                entry.count && entry.countLabel ? `${entry.label}, ${entry.countLabel}` : undefined
              }
              className={cx(ROW, index > 0 && "border-t border-border", active && "text-action-fg")}
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted">
                <entry.icon aria-hidden="true" size={20} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{entry.label}</span>
              {entry.count ? (
                <span
                  aria-hidden="true"
                  data-testid="menu-unread-badge"
                  className="h-[18px] min-w-[18px] shrink-0 rounded-full bg-danger px-[5px] text-center text-xs font-bold leading-[18px] text-on-solid"
                >
                  {entry.count}
                </span>
              ) : null}
              <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-text-subtle" />
            </Link>
          );
        })}
      </nav>

      <Button
        variant="danger-soft"
        size="lg"
        fullWidth
        leftIcon={LogOut}
        onClick={onLogout}
        className="shrink-0"
      >
        {t("logout")}
      </Button>
    </div>
  );
};

/* ─── Menyu ──────────────────────────────────────────────────────────────── */

const MobileMenu = ({ isOpen, onClose }: MobileMenuProps) => {
  const { t } = useTranslation(["sidebar"]);
  const { t: tUsers } = useTranslation("users");
  const { logout } = useLogout();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const titleId = useId();

  const { role, user, sections, items, branchTypeMissing } = useNavSections();
  const roleState = useSelector((state: RootState) => state.role);
  // Menyu qidiruvi `/orders?search=` ga olib boradi — buyurtmalar ochilmaydigan rolda (logist, market operatori:
  // LG-4 / MO-3 gacha) u 403 sahifasiga olib borardi; yuqori paneldagi global qidiruv qoladi.
  const canOpenOrders = useSelector(canViewOrders);
  // Yuqori paneldagi qo'ng'iroqcha bilan bir xil so'rov (kesh umumiy) — qo'shimcha so'rov ketmaydi.
  const { data: unreadCount = 0 } = useUnreadCount(Boolean(roleState.role));
  const pathname = useNavPathname();

  // Menyu butun ekranni yopadi — fokus ichida qamaladi, Escape yopadi, yopilganda fokus ochgan tugmaga qaytadi.
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen, { onEscape: onClose });

  /**
   * «Shaxsiy»: shaxsiy bildirishnomalar qutisi (`/inbox`) va sozlamalar. Superadmin menyusida Telegram
   * guruhlari sahifasi (`/notifications`) ham «Bildirishnomalar» — ikkisi adashmasin deb qutining nomi
   * shu rolda «Bildirishnomalar qutisi» (sahifa sarlavhasi, maket `common-inbox`).
   */
  const personal = useMemo<PersonalEntry[]>(() => {
    const inboxClashes = items.some((item) => item.to === "/notifications");
    const count = formatNavCount(unreadCount);
    return [
      {
        to: "/inbox",
        icon: Bell,
        label: inboxClashes ? t("inbox") : t("notifications"),
        count,
        countLabel: count ? t("newCount", { count: unreadCount }) : undefined,
      },
      { to: "/settings", icon: Settings, label: t("settings"), count: null },
    ];
  }, [items, unreadCount, t]);

  const activeTo = useMemo(
    () => getActiveNavTo([...items, ...personal, { to: "/profile" }], pathname),
    [items, personal, pathname],
  );

  const persona = useMemo<Persona>(() => {
    const { name, initials, branchName } = getNavPersona(user, roleState.name);
    const roleLabel = tUsers(getUserRoleLabelKey(user?.role || role));
    return {
      name: name || t("profile"),
      initials: initials || "?",
      subtitle: [roleLabel, branchName].filter(Boolean).join(" · "),
    };
  }, [user, roleState.name, role, t, tUsers]);

  if (!isOpen) return null;

  const onSearch = (value: string) => {
    onClose();
    navigate(`/orders?search=${encodeURIComponent(value)}`);
  };

  const variantProps: VariantProps = {
    titleId,
    sections,
    personal,
    activeTo,
    persona,
    branchTypeMissing,
    showSearch: roleHasGlobalSearch(user?.role || role || roleState.role) && canOpenOrders,
    label: (item) => t(item.labelKey),
    shortLabel: (item) => t(item.shortLabelKey ?? item.labelKey),
    onClose,
    onSearch,
    onLogout: () => {
      void logout();
    },
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={cx(
        "fixed inset-0 z-[60] flex outline-none lg:hidden",
        isPhone ? "items-end" : "items-stretch",
      )}
    >
      {/* Fon — faqat sichqoncha/teginish uchun (klaviaturada Escape va «Menyuni yopish»). */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-overlay transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none"
      />
      {isPhone ? <Sheet {...variantProps} /> : <Drawer {...variantProps} />}
    </div>
  );
};

export default memo(MobileMenu);

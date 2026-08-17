import { memo, useMemo } from "react";
import SidebarLink from "./SidebarItem";
import { useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import { getSidebarConfigForUser, normalizeSidebarRole } from "../model/menuConfig";
import { toggleSidebar } from "../model/sidebarSlice";
import type { RootState } from "../../../app/config/store";
import { ChevronLeft, ChevronRight } from "lucide-react";
import LogoText from "../../../shared/assets/logo yozuvlik qora.png";
import LogoIcon from "../../../shared/assets/logo qora.png";
import LogoTextdark from "../../../shared/assets/logo yozuvlik oq.png";
import LogoIcondark from "../../../shared/assets/logo oq.png";
import { useTheme } from "../../../app/providers/theme/ThemeContext";

const Sidebar = () => {
  const { t } = useTranslation(["sidebar"]);
  const dispatch = useDispatch();
  // Faqat kerakli field — butun sidebar object emas (re-render kamayadi)
  const isOpen = useSelector((state: RootState) => state.sidebar.isOpen);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  // ─── User role'ni Redux dan oling ────────────────────────────────────────
  const role = useSelector((state: RootState) => state.role.role);
  const user = useSelector((state: RootState) => state.user.user);
  const userRole = normalizeSidebarRole(role, user);

  // ─── Rolga mos navigation items'ni olish ─────────────────────────────────
  // navItems va links alohida memoized — role/user o'zgarmasa qayta hisoblanmaydi
  const navItems = useMemo(
    () => getSidebarConfigForUser(userRole, user),
    [userRole, user],
  );

  // t() faqat til o'zgarganda links yangilanadi
  const links = useMemo(
    () => navItems.map((item) => ({ ...item, label: t(item.label) })),
    [navItems, t],
  );

  // ─── Logo rasmlarini tanlash ──────────────────────────────────────────────
  const currentLogoText = isDarkMode ? LogoTextdark : LogoText;
  const currentLogoIcon = isDarkMode ? LogoIcondark : LogoIcon;


  return (
    <aside
      className={`sticky left-0 top-0 z-50 hidden h-screen flex-col bg-sidebar text-maindark transition-all duration-300 ease-in-out lg:flex dark:bg-maindark dark:text-primary ${!isOpen ? "w-20" : "w-72"
        }`}
    >
      {/* Header with Logo */}
      <div className="flex h-18 shrink-0 items-center justify-start overflow-hidden bg-sidebar pl-4 dark:bg-maindark">
        <div
          className={`transition-all duration-300 flex items-center justify-start ${!isOpen ? "w-full px-2" : "w-full px-4"
            }`}
        >
          <img
            src={isOpen ? currentLogoText : currentLogoIcon}
            alt="Elchi Logo"
            className={`object-contain transition-all duration-300 ${!isOpen ? "h-10 w-10" : "h-auto w-40"
              }`}
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-sidebar px-3 py-3 custom-scrollbar dark:bg-maindark">
        {links.map((link) => (
          <SidebarLink
            key={link.to}
            to={link.to}
            icon={<link.icon />}
            label={link.label}
            end={link.end}
            isOpen={isOpen}
          />
        ))}
      </nav>

      {/* Footer — Toggle */}
      <div className="shrink-0 border-t border-black/5 bg-primary/5 p-3 dark:border-white/5 dark:bg-maindark/50">
        <button
          onClick={() => dispatch(toggleSidebar())}
          aria-label={isOpen ? t("collapse") : t("expand")}
          className={`flex shrink-0 items-center justify-center rounded-lg p-2 text-maindark transition-all duration-300 hover:bg-main/10 dark:text-primary ${isOpen ? "w-full" : "mx-auto"}`}
        >
          {isOpen ? (
            <>
              <ChevronLeft size={20} />
              <span className="ml-2 text-sm font-medium">{t("collapse")}</span>
            </>
          ) : (
            <ChevronRight size={20} />
          )}
        </button>
      </div>
    </aside>
  );
};

export default memo(Sidebar);

import { memo, useMemo, useState } from "react";
import SidebarLink from "./SidebarItem";
import { useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import {
  getSidebarGroupsForUser,
  hasUnknownBranchType,
  normalizeSidebarRole,
  type SidebarGroupId,
} from "../model/menuConfig";
import { toggleSidebar } from "../model/sidebarSlice";
import type { RootState } from "../../../app/config/store";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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

  // ─── Rolga mos navigation guruhlarini olish ──────────────────────────────
  // Guruhlar va tarjimalar alohida memoized — role/user o'zgarmasa qayta
  // hisoblanmaydi, t() esa faqat til o'zgarganda ishga tushadi.
  const groups = useMemo(
    () => getSidebarGroupsForUser(userRole, user),
    [userRole, user],
  );

  const translatedGroups = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        items: group.items.map((item) => ({ ...item, label: t(item.label) })),
      })),
    [groups, t],
  );

  /**
   * Yig'ilgan guruhlar — brauzerda saqlanadi.
   *
   * Operator "Tizim" guruhini bir marta yopsa, u har kirganda qayta ochilib
   * turmasligi kerak. Saqlash localStorage'da: server holati emas, shaxsiy
   * ko'rinish.
   */
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("sidebar:collapsedGroups");
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      // Buzilgan/yopiq localStorage sidebarni yiqitmasligi kerak.
      return new Set();
    }
  });

  const toggleGroup = (groupId: SidebarGroupId) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      try {
        localStorage.setItem(
          "sidebar:collapsedGroups",
          JSON.stringify([...next]),
        );
      } catch {
        // Saqlab bo'lmasa ham holat shu sessiyada ishlayveradi.
      }
      return next;
    });
  };

  /**
   * Menejerning filial turi aniqlanmagan.
   *
   * Bunday holatda menyu bazaviy uch bandga tushadi va u bilan birga pochta,
   * kassa, xodimlar sahifalari yopiladi. Avval bu JIMGINA sodir bo'lardi —
   * foydalanuvchi "bandlar yo'qoldi" deb o'ylardi. Endi sabab ochiq aytiladi.
   */
  const branchTypeMissing = hasUnknownBranchType(userRole, user);

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
        {branchTypeMissing && (
          <div
            className="mb-2 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/12 px-3 py-2.5 text-amber-700 dark:text-amber-200"
            title={t("branchTypeMissingHint")}
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {isOpen && (
              <span className="text-xs font-semibold leading-snug">
                {t("branchTypeMissing")}
              </span>
            )}
          </div>
        )}
        {translatedGroups.map((group, index) => {
          const collapsed = group.id ? collapsedGroups.has(group.id) : false;

          return (
            <div key={group.id ?? `ungrouped-${index}`} className="space-y-1">
              {group.id &&
                (isOpen ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id as SidebarGroupId)}
                    className="mt-3 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-maindark/45 transition hover:text-main dark:text-primary/45"
                  >
                    <span>{t(`group_${group.id}`)}</span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
                    />
                  </button>
                ) : (
                  /* Yig'ilgan sidebarda sarlavha o'rniga nozik ajratgich —
                     matn sig'maydi, lekin guruh chegarasi ko'rinib turishi kerak. */
                  <div className="mx-auto my-2 h-px w-8 bg-maindark/10 dark:bg-primary/10" />
                ))}

              {!collapsed &&
                group.items.map((link) => (
                  <SidebarLink
                    key={link.to}
                    to={link.to}
                    icon={<link.icon />}
                    label={link.label}
                    end={link.end}
                    isOpen={isOpen}
                  />
                ))}
            </div>
          );
        })}
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

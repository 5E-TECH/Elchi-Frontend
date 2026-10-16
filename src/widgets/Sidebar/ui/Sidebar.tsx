// dizayn-v2: shell
import { memo, useCallback, useId, useMemo, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, PanelLeft, TriangleAlert } from "lucide-react";
import type { RootState } from "../../../app/config/store";
import { SETTINGS_KEY, useUpdateSettings } from "../../../entities/settings";
import { cx } from "../../../shared/lib/cx";
import LogoWhite from "../../../shared/assets/brand/elchi-logo-white.png";
import MarkWhite from "../../../shared/assets/brand/elchi-mark-white.png";
import { setSidebar } from "../model/sidebarSlice";
import { useNavPathname } from "../model/shellNav";
import { getActiveNavTo, useNavSections, type NavSectionId } from "../model/navSections";
import SidebarItem from "./SidebarItem";
import { NAV_ROW, NAV_ROW_COLLAPSED, NAV_ROW_IDLE } from "./navClasses";

/**
 * YON MENYU (≥ 1024) — maket `.el-sidebar` / `.el-brand` / `.el-nav` / `.el-nav-group` (design/kit/helmet.html),
 * holatlar va yig'ilgan ko'rinish — taxta `tizim-states-navigation` (01 · Yon menyu).
 *
 * - Kengaytirilgan 248px, yig'ilgan 72px (`state.sidebar.isOpen`, brauzerda va serverda saqlanadi). Fon `nav`
 *   (ikkala mavzuda navy), logotip oq, 32px, 64px qatorda, ostida `nav-line` chiziq.
 * - Bandlar `useNavSections()` dan (rol + filial turi — `menuConfig.tsx`; guruh, yorliq, ikonka — maketdagidek).
 *   Uzun menyu (superadmin, admin, menejer) guruhlarga bo'lingan: sarlavha 12px/600 katta harf `nav-muted`,
 *   bosilsa guruh yig'iladi (holati shu brauzerda eslab qolinadi). Yig'ilgan menyuda sarlavha o'rnida
 *   ingichka chiziq, barcha bandlar ko'rinadi, nom — maslahatda.
 * - Faol band — `getActiveNavTo(items, useNavPathname())`: ichki sahifada ota bo'lim (maketdagi ota bandi
 *   bo'lgan alohida manzillar ham — Ops eski sahifalari), bosilgan band sahifa yuklanguncha ham darhol tanlangan.
 * - Menejerga filial turi biriktirilmagan bo'lsa — ogohlantirish (menyuning bir qismi yashirin).
 * - Pastda «Yashirish» / «Menyuni kengaytirish». Holat serverdagi sozlamaga ham yoziladi (Sozlamalar sahifasidagi
 *   «Yon menyu» bilan bir xil qoida): faqat brauzerga yozilsa `SettingsSync` keyingi kirishda va har mavzu/til
 *   almashganda serverdagi eski qiymatni qaytarib qo'yardi.
 *
 * Balandlik shell slot'idan (`h-full`), menyu uzun bo'lsa faqat bandlar ro'yxati aylanadi.
 */

const COLLAPSED_GROUPS_KEY = "sidebar:collapsedGroups";

const readCollapsedGroups = (): Set<string> => {
  try {
    const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [],
    );
  } catch {
    // Buzilgan yoki yopiq localStorage menyuni yiqitmasligi kerak.
    return new Set();
  }
};

const writeCollapsedGroups = (groups: Set<string>) => {
  try {
    localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...groups]));
  } catch {
    // Saqlab bo'lmasa ham holat shu sessiyada ishlayveradi.
  }
};

type Hint = { label: string; top: number; left: number };

const Sidebar = () => {
  const { t } = useTranslation(["sidebar"]);
  const dispatch = useDispatch();
  const isOpen = useSelector((state: RootState) => state.sidebar.isOpen);
  const collapsed = !isOpen;
  const { sections, items, branchTypeMissing } = useNavSections();
  const pathname = useNavPathname();
  const activeTo = useMemo(() => getActiveNavTo(items, pathname), [items, pathname]);
  const navId = useId();

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(readCollapsedGroups);
  const toggleGroup = (groupId: NavSectionId) => {
    setCollapsedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      writeCollapsedGroups(next);
      return next;
    });
  };

  /**
   * Yig'ilgan menyudagi nom maslahati (maket `.el-tooltip`). `fixed` — bandlar ro'yxati aylanadi
   * (`overflow-y-auto`) va absolyut maslahat uning chetida kesilib qolardi. Nom `aria-label` da,
   * maslahat faqat ko'rish uchun (`aria-hidden`). Escape, skroll va kengaytirish uni yopadi.
   */
  const [hint, setHint] = useState<Hint | null>(null);
  const onHint = useCallback((target: HTMLElement | null, label: string) => {
    if (!target) {
      setHint(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    setHint({ label, top: rect.top + rect.height / 2, left: rect.right + 10 });
  }, []);
  const hideHintOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") setHint(null);
  };

  const toggleLabel = collapsed ? t("expand") : t("collapse");

  const queryClient = useQueryClient();
  const updateSettings = useUpdateSettings();
  const toggleCollapsed = () => {
    setHint(null);
    const nextOpen = collapsed;
    dispatch(setSidebar(nextOpen));
    // Sozlamalar hali yuklanmagan bo'lsa serverga yozilmaydi: `useUpdateSettings` to'liq obyektni yuboradi va
    // keshsiz u sukut qiymatlar bilan foydalanuvchining mavzu/tilini ustidan yozib yuborardi.
    if (queryClient.getQueryData(SETTINGS_KEY)) {
      updateSettings.mutate({ interface: { sidebarOpen: nextOpen } });
    }
  };

  return (
    <aside
      aria-label={t("mainMenu")}
      onKeyDown={hideHintOnEscape}
      className={cx(
        "flex h-full shrink-0 flex-col bg-nav pb-4 text-nav-text",
        "transition-[width] duration-200 ease-out motion-reduce:transition-none",
        collapsed ? "w-[72px] px-3" : "w-[248px] px-3",
      )}
    >
      <div
        className={cx(
          "mb-1 flex h-16 shrink-0 items-center border-b border-nav-line",
          collapsed ? "justify-center" : "px-2",
        )}
      >
        {collapsed ? (
          <img
            src={MarkWhite}
            alt="Elchi Pochta"
            width={35}
            height={32}
            className="block h-8 w-auto"
          />
        ) : (
          <img
            src={LogoWhite}
            alt="Elchi Pochta"
            width={96}
            height={32}
            className="block h-8 w-auto"
          />
        )}
      </div>

      {branchTypeMissing ? (
        collapsed ? (
          <div
            role="status"
            title={`${t("branchTypeMissing")}. ${t("branchTypeMissingHint")}`}
            className={cx(
              NAV_ROW_COLLAPSED,
              "mt-1 mb-1 rounded-[10px] bg-warning-soft text-warning-fg",
            )}
          >
            <TriangleAlert aria-hidden="true" size={18} />
            <span className="sr-only">
              {t("branchTypeMissing")}. {t("branchTypeMissingHint")}
            </span>
          </div>
        ) : (
          <div
            role="status"
            className="mt-1 mb-1 flex shrink-0 items-start gap-2 rounded-[10px] bg-warning-soft px-3 py-2.5 text-[13px] leading-snug text-warning-fg"
          >
            <TriangleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold">{t("branchTypeMissing")}</div>
              {t("branchTypeMissingHint")}
            </div>
          </div>
        )
      ) : null}

      <nav
        id={navId}
        aria-label={t("sections")}
        onScroll={() => setHint(null)}
        className={cx(
          // `-mx-3 px-3 py-1`: fokus halqasi (2 + 2px) aylanuvchi ro'yxat chetida kesilmasin; logotip ostidagi
          // 8px oraliq = `mb-1` + `pt-1`.
          "-mx-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-3 py-1",
          "[scrollbar-color:var(--color-nav-line)_transparent] [scrollbar-width:thin]",
        )}
      >
        {sections.map((section, index) => {
          const groupId = section.id;
          const listId = `${navId}-${groupId ?? `top-${index}`}`;
          // Yig'ilgan menyuda barcha bandlar ko'rinadi (taxta qoidasi 5); guruh holati faqat kengida.
          const groupClosed = !collapsed && groupId !== null && collapsedGroups.has(groupId);

          return (
            <div key={groupId ?? `top-${index}`} className="flex flex-col gap-0.5">
              {groupId !== null ? (
                collapsed ? (
                  <div
                    aria-hidden="true"
                    className="mx-auto my-[7px] h-px w-8 shrink-0 bg-nav-line"
                  />
                ) : (
                  <button
                    type="button"
                    aria-expanded={!groupClosed}
                    aria-controls={listId}
                    onClick={() => toggleGroup(groupId)}
                    className={cx(
                      "flex w-full shrink-0 items-center justify-between gap-2 rounded-[10px] px-3 pt-4 pb-1.5 text-left",
                      "text-xs leading-[18px] font-semibold uppercase tracking-[.06em] text-nav-muted",
                      "transition-[color] duration-150 hover:text-nav-text motion-reduce:transition-none",
                      "focus-visible:outline-nav-text!",
                    )}
                  >
                    <span className="truncate">{t(`group_${groupId}`)}</span>
                    {groupClosed ? (
                      <ChevronRight aria-hidden="true" size={16} className="shrink-0" />
                    ) : (
                      <ChevronDown aria-hidden="true" size={16} className="shrink-0" />
                    )}
                  </button>
                )
              ) : null}

              {/* Yig'ilgan guruh ro'yxati DOM'da qoladi (`hidden`) — `aria-controls` doim mavjud elementga ishora qiladi. */}
              <ul
                id={listId}
                role="list"
                hidden={groupClosed}
                className="m-0 flex list-none flex-col gap-0.5 p-0"
              >
                {section.items.map((item) => (
                  <li key={item.to} className="flex flex-col">
                    <SidebarItem
                      to={item.to}
                      icon={item.icon}
                      label={t(item.labelKey)}
                      active={item.to === activeTo}
                      collapsed={collapsed}
                      onHint={onHint}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="mt-2 shrink-0 border-t border-nav-line pt-3">
        <button
          type="button"
          onClick={toggleCollapsed}
          onPointerEnter={(event) => collapsed && onHint(event.currentTarget, toggleLabel)}
          onPointerLeave={() => setHint(null)}
          onFocus={(event) => collapsed && onHint(event.currentTarget, toggleLabel)}
          onBlur={() => setHint(null)}
          aria-label={collapsed ? toggleLabel : undefined}
          aria-expanded={!collapsed}
          aria-controls={navId}
          className={cx(
            NAV_ROW,
            NAV_ROW_IDLE,
            collapsed ? NAV_ROW_COLLAPSED : "h-10 w-full px-3 text-left",
          )}
        >
          <PanelLeft aria-hidden="true" size={20} className="shrink-0" />
          {collapsed ? null : <span className="truncate">{toggleLabel}</span>}
        </button>
      </div>

      {hint ? (
        <span
          aria-hidden="true"
          style={{ top: hint.top, left: hint.left }}
          className="pointer-events-none fixed z-50 max-w-[240px] -translate-y-1/2 whitespace-nowrap rounded-lg bg-text px-2.5 py-1.5 text-xs font-semibold leading-[1.4] text-bg shadow-xl"
        >
          {hint.label}
        </span>
      ) : null}
    </aside>
  );
};

export default memo(Sidebar);

import { useMemo } from "react";
import { useSelector } from "react-redux";
import type { LucideIcon } from "lucide-react";
import type { RootState } from "../../../app/config/store";
import type { User } from "../../../entities/user/model/types";
import {
  getSidebarGroupsForUser,
  hasUnknownBranchType,
  normalizeSidebarRole,
  type NavItem,
  type SidebarGroupId,
  type SidebarUserRole,
} from "./menuConfig";
import { getActiveNavPath, isNavPathActive, type NavMatchItem } from "./shellNav";

/**
 * YON MENYU VA SURILUVCHI MENYU BO'LIMLARI (dizayn v2, 2-bosqich).
 *
 * Bandlar to'plami, tartibi va ruxsat qoidasi — `menuConfig.tsx` (rol + filial turi). Bu fayl faqat
 * KO'RINISHNI maketga (`design/kit/roles.json`) moslaydi, band qo'shmaydi va olib tashlamaydi:
 *
 *   1. Guruhlar. Maketda to'rtta: Ish · Moliya · Ma'lumotnoma · Tizim. `menuConfig` dagi alohida
 *      `integrations` guruhi maketda «Ma'lumotnoma» ichida (oxirida) turadi — shu yerda qo'shiladi.
 *      Guruhlash chegarasi (`SIDEBAR_GROUPING_THRESHOLD`) o'zgarmaydi: qisqa menyu (market, kuryer,
 *      registrator) guruhsiz — maketda ham `grouped: false`.
 *   2. Yorliq. Kuryerning `/cash-box` bandi maketda «Kassa» (marketda o'sha yo'l — «To'lovlar»).
 *   3. Ikonka — `menuConfig.tsx` dan o'zgarishsiz (u yerda kanonik, `design/icon-registry.json`).
 *
 * Yon menyu (`Sidebar`, ≥ 1024) va suriluvchi menyu (`MobileMenu`, < 1024) shu bitta manbadan o'qiydi —
 * guruh, yorliq va ikonka ikkalasida bir xil.
 */

/** Maketdagi guruh (roles.json → `group`): Ish · Moliya · Ma'lumotnoma · Tizim. */
export type NavSectionId = "work" | "finance" | "directory" | "system";

const SECTION_OF_GROUP: Record<SidebarGroupId, NavSectionId> = {
  work: "work",
  finance: "finance",
  directory: "directory",
  // Maketda «Integratsiyalar» — «Ma'lumotnoma» guruhining oxirgi bandi.
  integrations: "directory",
  system: "system",
};

/** Ekranga chiqadigan band: yo'l, ikonka va tarjima kaliti (`sidebar:<labelKey>`). */
export interface NavEntry {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  labelKey: string;
  /**
   * Ixcham joy (telefon varaqasidagi katak) uchun qisqa yorliq — maket `roles.json` → `short`:
   * «Qabul va yaratish» → «Qabul» (marketda «Yaratish»), «Tezkor amal» → ru «Закрыть день». Yo'q bo'lsa `labelKey`.
   */
  shortLabelKey?: string;
}

export interface NavSection {
  /** `null` — guruhsiz (bosh sahifa yoki qisqa menyu): sarlavha chiqmaydi. */
  id: NavSectionId | null;
  items: NavEntry[];
}

/** Rolga xos yorliq kaliti (yo'l bo'yicha). */
const LABEL_KEY_BY_ROLE: Partial<Record<SidebarUserRole, Record<string, string>>> = {
  courier: { "/cash-box": "cashbox" },
  // MO-2/MO-3: market operatorida yaratish bandi «Buyurtma yaratish» (maket `roles.json`; qabul/bekorlar yo'q). Band
  // `/new-orders` (MO-3: operatorda u `/new-orders/create` ga yo'naltiriladi); `/new-orders/create` ham shu yorliqda —
  // aks holda umumiy «Qabul va yaratish» chiqardi.
  market_operator: { "/new-orders": "createOrder", "/new-orders/create": "createOrder" },
};

/**
 * Qisqa yorliq kaliti (yo'l bo'yicha) va rolga xos istisno. Manba — `roles.json` → `short`
 * («Qabul va yaratish» → «Qabul», «Tezkor amal» → ru «Закрыть день» / en «Close day» — pastki menyu bilan bir xil).
 * Maketda qisqa shakli yo'q, lekin ru tilida 375px katakka sig'maydigan bandlar uchun tabiiy qisqa shakl:
 * «Журнал активности» → «Журнал», «Ops-инструменты» → «Инструменты» (uz/en — to'liq nom, sig'adi).
 */
const SHORT_LABEL_KEY_BY_PATH: Record<string, string> = {
  "/new-orders": "newOrdersShort",
  "/courier-bulk": "quickActionShort",
  "/activity-logs": "activityLogsShort",
  "/ops": "opsShort",
};
const SHORT_LABEL_KEY_BY_ROLE: Partial<Record<SidebarUserRole, Record<string, string>>> = {
  // Market buyurtmani faqat yaratadi — maketda «Yaratish».
  market: { "/new-orders": "createShort" },
  // Investor: varaqa plitkalarida TO'LIQ nom («Investitsiyalar», «Foyda tarixi» — maket
  // `investor--dashboard-mobile-menu`); qisqa «Investitsiya» / «Foyda» faqat pastki menyuda (`BottomNav`).
  market_operator: { "/new-orders": "createShort", "/new-orders/create": "createShort" },
};

/** Menyu bandi → yorliq kalitlari bilan (rolga xos to'liq va qisqa yorliq). Testlar uchun eksport. */
export const toNavEntry = (role: SidebarUserRole | null, item: NavItem): NavEntry => {
  const shortLabelKey =
    (role ? SHORT_LABEL_KEY_BY_ROLE[role]?.[item.to] : undefined) ??
    SHORT_LABEL_KEY_BY_PATH[item.to];
  return {
    to: item.to,
    ...(item.end ? { end: true } : {}),
    icon: item.icon,
    labelKey: (role ? LABEL_KEY_BY_ROLE[role]?.[item.to] : undefined) ?? item.label,
    ...(shortLabelKey ? { shortLabelKey } : {}),
  };
};

/**
 * Rol menyusi maketdagi guruhlar bilan. Ketma-ket bir xil guruh (masalan `directory` + `integrations`)
 * bitta bo'limga qo'shiladi; bandlar tartibi `menuConfig` dagidek.
 */
export const getNavSections = (
  role: SidebarUserRole | string | null | undefined,
  user?: User | null,
): NavSection[] => {
  const normalizedRole = normalizeSidebarRole(role, user);
  const sections: NavSection[] = [];

  for (const group of getSidebarGroupsForUser(normalizedRole, user)) {
    const id = group.id ? SECTION_OF_GROUP[group.id] : null;
    const items = group.items.map((item) => toNavEntry(normalizedRole, item));
    const previous = sections[sections.length - 1];
    if (id && previous?.id === id) previous.items.push(...items);
    else sections.push({ id, items });
  }

  return sections;
};

/**
 * Katakning ekran o'quvchi nomi. Qisqa yorliq to'liq nomning bir qismi bo'lsa («Qabul» ⊂ «Qabul va yaratish») —
 * to'liq nom. Aks holda («Закрыть день» / «Быстрое действие», «Создать» / «Приём и создание») nom ko'ringan
 * so'zdan boshlanadi (WCAG 2.5.3: ovoz bilan boshqarishda ko'ringan yorliq aytiladi): «Закрыть день (Быстрое действие)».
 */
export const getTileAccessibleName = (compact: string, full: string): string | undefined => {
  if (compact === full) return undefined;
  return full.toLocaleLowerCase().includes(compact.toLocaleLowerCase())
    ? full
    : `${compact} (${full})`;
};

/**
 * Menyuda alohida bandi yo'q, lekin maketda (`design/kit/views.json` → `menuKey`) shu bandga tegishli sahifalar —
 * ular ochilganda ota band faol (taxta `tizim-states-navigation`, qoida 1: «ichki sahifada ota bo'lim faol»):
 *   - Ops vositalarining eski manzillari (`pages/ops/tabs.ts` → `legacyPath`, maketda `menuKey: "ops"`);
 *   - superadminning shaxsiy qutisi `/inbox` (maket `superadmin-notifications-inbox`, `menuKey: "notifications"`).
 * Faqat to'g'ridan-to'g'ri mos band bo'lmasa qo'llanadi: suriluvchi menyudagi «Shaxsiy → Bildirishnomalar»
 * (`/inbox`) o'zi mos keladi va faol qoladi.
 */
const ACTIVE_ALIASES_BY_PATH: Record<string, readonly string[]> = {
  "/ops": [
    "/finance-operators",
    "/integrations-ops",
    "/investors-ops",
    "/logistics-ops",
    "/branch-ops",
    "/identity-ops",
    "/system-ops",
    "/logs",
  ],
  "/notifications": ["/inbox"],
};

/** Faol band: avval eng uzun mos yo'l (`getActiveNavPath`), bo'lmasa maketdagi ota band (`ACTIVE_ALIASES_BY_PATH`). */
export const getActiveNavTo = (items: readonly NavMatchItem[], pathname: string): string | null => {
  const direct = getActiveNavPath(items, pathname);
  if (direct !== null) return direct;
  const parent = items.find((item) =>
    ACTIVE_ALIASES_BY_PATH[item.to]?.some((alias) => isNavPathActive(alias, pathname)),
  );
  return parent?.to ?? null;
};

/** Menyudagi son: 0 yoki yo'q — belgi chiqmaydi; 99 dan oshsa «99+» (taxta `tizim-states-navigation`). */
export const formatNavCount = (count: number | null | undefined): string | null => {
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) return null;
  return count > 99 ? "99+" : String(Math.floor(count));
};

/** Ism → 2 harfli avatar (maket `.el-avatar`: «Jasur Tursunov» → «JT»). */
export const getInitials = (name: string | null | undefined): string => {
  const words = (name ?? "")
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return "";
  const letters = words.length > 1 ? [words[0][0], words[1][0]] : [words[0][0], words[0][1]];
  return letters.filter(Boolean).join("").toLocaleUpperCase();
};

type ProfileLike = User & {
  fullName?: string | null;
  full_name?: string | null;
  branch?: { name?: unknown; branch?: { name?: unknown } | null } | null;
};

/**
 * Foydalanuvchi bloki (maket: suriluvchi menyudagi «Jasur Tursunov · Kuryer · Chilonzor filiali»).
 * Ism — profil, bo'lmasa sessiyadagi nom. Filial nomi profil bersagina qo'shiladi (o'ylab topilmaydi).
 */
export const getNavPersona = (
  user: User | null | undefined,
  sessionName: string | null | undefined,
): { name: string; initials: string; branchName: string | null } => {
  const profile = user as ProfileLike | null | undefined;
  const name = (
    profile?.fullName ||
    profile?.full_name ||
    profile?.name ||
    sessionName ||
    ""
  ).trim();
  const rawBranch = profile?.branch?.name ?? profile?.branch?.branch?.name;
  const branchName = typeof rawBranch === "string" && rawBranch.trim() ? rawBranch.trim() : null;
  return { name, initials: getInitials(name), branchName };
};

/** Joriy foydalanuvchi menyusi (redux `role` + `user`). */
export const useNavSections = () => {
  const role = useSelector((state: RootState) => state.role.role);
  const user = useSelector((state: RootState) => state.user.user);
  const userRole = normalizeSidebarRole(role, user);

  const sections = useMemo(() => getNavSections(userRole, user), [userRole, user]);
  const items = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const branchTypeMissing = hasUnknownBranchType(userRole, user);

  return { role: userRole, user, sections, items, branchTypeMissing };
};

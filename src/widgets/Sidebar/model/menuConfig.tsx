import {
  House,
  Plug,
  ShoppingBag,
  MailOpen,
  Apple,
  UserRound,
  UsersRound,
  MapPinned,
  Calendar1,
  PackageCheck,
  RotateCcw,
  CreditCard,
  Scale,
  FileText,
  ScrollText,
  Bell,
  Building2,
  Truck,
  Zap,
  type LucideIcon,
  //   LucideIcon,
} from "lucide-react";
import type { User } from "../../../entities/user/model/types";

export type UserRole = "admin" | "superadmin" | "market" | "courier" | "registrator";
export type BranchDashboardRole = "manager";
export type SidebarUserRole = UserRole | BranchDashboardRole;

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

export type BranchType = "HQ" | "PICKUP" | "REGIONAL" | "HYBRID";

export const normalizeSidebarRole = (
  role: unknown,
  user?: User | null,
): SidebarUserRole | null => {
  const rawRole =
    typeof role === "string" && role.trim()
      ? role
      : typeof user?.role === "string"
        ? user.role
        : "";
  const normalized = rawRole.trim().toLowerCase();

  if (normalized in SIDEBAR_CONFIG) {
    return normalized as SidebarUserRole;
  }

  return null;
};

/**
 * Barcha roller uchun static navigation configuration
 * Icon'lar component'ga JSX sifatida ishlatiladi
 */
export const SIDEBAR_CONFIG: Record<SidebarUserRole, NavItem[]> = {
  superadmin: [
    { to: "/", icon: House, label: "dashboard", end: true },
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/new-orders", icon: Calendar1, label: "newOrders" },
    { to: "/mails", icon: MailOpen, label: "mails" },
    { to: "/products", icon: Apple, label: "products" },
    { to: "/all-users", icon: UserRound, label: "users" },
    { to: "/payments", icon: CreditCard, label: "payments" },
    { to: "/financial-balance", icon: Scale, label: "balance" },
    { to: "/regions", icon: MapPinned, label: "regions" },
    { to: "/notifications", icon: Bell, label: "notifications" },
    { to: "/branches", icon: Building2, label: "branches" },
    { to: "/partners", icon: Plug, label: "partners" },
    { to: "/activity-logs", icon: ScrollText, label: "activityLogs" },
    { to: "/logs", icon: FileText, label: "logs" },
  ],
  admin: [
    { to: "/", icon: House, label: "dashboard", end: true },
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/new-orders", icon: Calendar1, label: "newOrders" },
    { to: "/mails", icon: MailOpen, label: "mails" },
    { to: "/batches", icon: PackageCheck, label: "batches" },
    { to: "/returns", icon: RotateCcw, label: "returns" },
    { to: "/products", icon: Apple, label: "products" },
    { to: "/all-users", icon: UserRound, label: "users" },
    { to: "/payments", icon: CreditCard, label: "payments" },
    { to: "/financial-balance", icon: Scale, label: "balance" },
    { to: "/regions", icon: MapPinned, label: "regions" },
    { to: "/partners", icon: Plug, label: "partners" },
    { to: "/activity-logs", icon: ScrollText, label: "activityLogs" },
  ],
  market: [
    { to: "/", icon: House, label: "dashboard", end: true },
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/new-orders", icon: Calendar1, label: "newOrders" },
    { to: "/products", icon: Apple, label: "products" },
    { to: "/cash-box", icon: CreditCard, label: "payments" },
    { to: "/market-operators", icon: UsersRound, label: "operators" },
  ],
  registrator: [
    { to: "/", icon: House, label: "dashboard", end: true },
    { to: "/dispatch", icon: Truck, label: "dispatch" },
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/new-orders", icon: Calendar1, label: "newOrders" },
    { to: "/mails", icon: MailOpen, label: "mails" },
    { to: "/products", icon: Apple, label: "products" },
  ],
  courier: [
    { to: "/", icon: House, label: "dashboard", end: true },
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/courier-bulk", icon: Zap, label: "quickAction" },
    { to: "/mails", icon: MailOpen, label: "mails" },
    { to: "/cash-box", icon: CreditCard, label: "payments" },
    { to: "/regions", icon: MapPinned, label: "regions" },
  ],
  /**
   * ⚠️ Menejer menyusi ASLIDA bu yerdan olinmaydi — u `MANAGER_MENU_ORDER` dan
   * qobiliyatlar bo'yicha hosil qilinadi (`buildManagerConfig`). Bu yozuv
   * faqat `Record<SidebarUserRole, NavItem[]>` turini qanoatlantirish uchun va
   * filial turi aniqlanmagandagi bazaviy ro'yxatga TENG bo'lishi shart —
   * tenglik testda qulflangan.
   */
  manager: [
    { to: "/branch-dashboard", icon: House, label: "dashboard", end: true },
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/regions", icon: MapPinned, label: "regions" },
  ],
};

/**
 * ═══════════════ MENEJER QOBILIYATLARI ═══════════════
 *
 * Avval menejer uchun TO'RTTA qo'lda yozilgan menyu ro'yxati bor edi
 * (REGIONAL / PICKUP / HYBRID / HQ). Ikki muammosi bor edi:
 *
 *   1. HYBRID aynan REGIONAL ∪ PICKUP ga teng edi — ya'ni uchinchi ro'yxat
 *      ortiqcha nusxa. REGIONAL ga band qo'shilsa, HYBRID ga ham qo'lda
 *      qo'shish kerak edi; unutilsa ikkisi jimgina ajralib ketardi.
 *   2. Ro'yxat KIRISH HUQUQINI ham belgilaydi (`routes.tsx` guardlari),
 *      shuning uchun ro'yxatdagi tasodifiy farq = ruxsat xatosi.
 *
 * Endi manba bitta: filial turi → QOBILIYATLAR to'plami. Menyu ham, guard ham
 * shundan hosil bo'ladi. HYBRID alohida ro'yxat emas — u shunchaki ikkala
 * qobiliyatga ega.
 */
export type ManagerCapability =
  /** Jo'natish yo'nalishi: kuryerga berish, tezkor amal. */
  | 'dispatch'
  /** Qabul yo'nalishi: buyurtma qabuli, paketlar, qaytarishlar. */
  | 'intake'
  /** Pochta ro'yxati. */
  | 'mails'
  /** Kassa. */
  | 'finance'
  /** Filial xodimlari. */
  | 'staff';

export const MANAGER_CAPABILITIES: Record<BranchType, ManagerCapability[]> = {
  REGIONAL: ['dispatch', 'mails', 'finance', 'staff'],
  PICKUP: ['intake'],
  // HYBRID = REGIONAL ∪ PICKUP — qo'lda emas, hisoblab chiqariladi.
  HYBRID: ['dispatch', 'intake', 'mails', 'finance', 'staff'],
  /**
   * HQ markaziy filial: pochta va kassa avvaldan bor edi; `intake` 2026-09-10
   * da QO'SHILDI — hamkordan (BeePost) kelgan posilkalarni aynan HQ qabul
   * qiladi, shuning uchun HQ menejeri qabul ekranini ko'rishi kerak.
   */
  HQ: ['intake', 'mails', 'finance'],
};

/**
 * Menyu bandlarining KANONIK tartibi.
 *
 * Tartib ataylab bitta joyda: har bir filial turi shu ro'yxatdan o'ziga
 * tegishlisini FILTRLAB oladi. Shu sababli ikki filial turi orasida tartib
 * hech qachon farq qilmaydi.
 *
 * `null` qobiliyat = bazaviy band, hamma menejerda bor.
 */
const MANAGER_MENU_ORDER: { item: NavItem; capability: ManagerCapability | null }[] = [
  { item: { to: "/branch-dashboard", icon: House, label: "dashboard", end: true }, capability: null },
  { item: { to: "/dispatch", icon: Truck, label: "dispatch" }, capability: 'dispatch' },
  { item: { to: "/orders", icon: ShoppingBag, label: "orders" }, capability: null },
  { item: { to: "/courier-bulk", icon: Zap, label: "quickAction" }, capability: 'dispatch' },
  { item: { to: "/new-orders", icon: Calendar1, label: "newOrders" }, capability: 'intake' },
  { item: { to: "/mails", icon: MailOpen, label: "mails" }, capability: 'mails' },
  { item: { to: "/batches", icon: PackageCheck, label: "batches" }, capability: 'intake' },
  { item: { to: "/returns", icon: RotateCcw, label: "returns" }, capability: 'intake' },
  { item: { to: "/all-users", icon: UserRound, label: "users" }, capability: 'staff' },
  { item: { to: "/payments", icon: CreditCard, label: "payments" }, capability: 'finance' },
  { item: { to: "/regions", icon: MapPinned, label: "regions" }, capability: null },
];

/**
 * Menejerning qobiliyatlari.
 *
 * ⚠️ Filial turi ANIQLANMASA bo'sh to'plam qaytadi — ya'ni menejer faqat
 * bazaviy bandlarni ko'radi. Bu ATAYLAB: noma'lum filialga kengroq huquq
 * berishdan ko'ra torroq berish xavfsiz. Foydalanuvchi sababni bilishi uchun
 * sidebar ogohlantirish ko'rsatadi (`hasUnknownBranchType`).
 */
export const getManagerCapabilities = (
  user?: User | null,
): ManagerCapability[] => {
  const branchType = getUserBranchType(user);
  return branchType ? MANAGER_CAPABILITIES[branchType] : [];
};

export const managerHasCapability = (
  user: User | null | undefined,
  capability: ManagerCapability,
): boolean => getManagerCapabilities(user).includes(capability);

/** Menejer roli, lekin filial turi aniqlanmagan — menyu qisqarib qoladi. */
export const hasUnknownBranchType = (
  role: SidebarUserRole | string | null | undefined,
  user?: User | null,
): boolean =>
  normalizeSidebarRole(role, user) === "manager" && getUserBranchType(user) === null;

const buildManagerConfig = (user?: User | null): NavItem[] => {
  const capabilities = getManagerCapabilities(user);
  return MANAGER_MENU_ORDER.filter(
    ({ capability }) => capability === null || capabilities.includes(capability),
  ).map(({ item }) => item);
};

const toBranchType = (value: unknown): BranchType | null => {
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase();
  if (
    normalized === "HQ" ||
    normalized === "PICKUP" ||
    normalized === "REGIONAL" ||
    normalized === "HYBRID"
  ) {
    return normalized;
  }
  return null;
};

export const getUserBranchType = (user: User | null | undefined): BranchType | null => {
  if (!user || typeof user !== "object") return null;

  const rawUser = user as User & {
    branch_type?: string | null;
    branch?: {
      type?: string | null;
      branch_type?: string | null;
      branch?: { type?: string | null; branch_type?: string | null } | null;
    } | null;
  };

  return (
    toBranchType(rawUser.branch?.branch?.type) ??
    toBranchType(rawUser.branch?.branch?.branch_type) ??
    toBranchType(rawUser.branch?.type) ??
    toBranchType(rawUser.branch?.branch_type) ??
    toBranchType(rawUser.branch_type) ??
    null
  );
};

export const getSidebarConfigForUser = (
  role: SidebarUserRole | string | null | undefined,
  user?: User | null,
): NavItem[] => {
  const normalizedRole = normalizeSidebarRole(role, user);
  if (!normalizedRole) return [];

  const branchType = getUserBranchType(user);

  if (normalizedRole === "manager") {
    return buildManagerConfig(user);
  }

  if (normalizedRole === "registrator" && branchType === "HQ") {
    return SIDEBAR_CONFIG.registrator.filter((item) => item.to !== "/dispatch");
  }

  return SIDEBAR_CONFIG[normalizedRole];
};

import {
  House,
  ShoppingBag,
  MailOpen,
  Apple,
  UserRound,
  MapPinned,
  Calendar1,
  PackageCheck,
  RotateCcw,
  CreditCard,
  Scale,
  FileText,
  Bell,
  Building2,
  Truck,
  type LucideIcon,
  //   LucideIcon,
} from "lucide-react";
import type { User } from "../../../entities/user/model/types";

export type UserRole = "admin" | "superadmin" | "market" | "courier" | "registrator";
export type BranchDashboardRole = "manager" | "operator";
export type SidebarUserRole = UserRole | BranchDashboardRole;

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

export type BranchType = "HQ" | "PICKUP" | "REGIONAL" | "HYBRID";

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
  ],
  market: [
    { to: "/", icon: House, label: "dashboard", end: true },
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/new-orders", icon: Calendar1, label: "newOrders" },
    { to: "/products", icon: Apple, label: "products" },
    { to: "/cash-box", icon: CreditCard, label: "payments" },
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
    { to: "/cash-box", icon: CreditCard, label: "payments" },
  ],
  manager: [
    { to: "/branch-dashboard", icon: House, label: "dashboard", end: true },
    { to: "/dispatch", icon: Truck, label: "dispatch" },
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/new-orders", icon: Calendar1, label: "newOrders" },
    { to: "/batches", icon: PackageCheck, label: "batches" },
    { to: "/returns", icon: RotateCcw, label: "returns" },
  ],
  operator: [
    { to: "/branch-dashboard", icon: House, label: "dashboard", end: true },
    { to: "/dispatch", icon: Truck, label: "dispatch" },
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/mails", icon: MailOpen, label: "mails" },
    { to: "/batches", icon: PackageCheck, label: "batches" },
    { to: "/returns", icon: RotateCcw, label: "returns" },
  ],
};

const MANAGER_REGIONAL_CONFIG: NavItem[] = [
  { to: "/branch-dashboard", icon: House, label: "dashboard", end: true },
  { to: "/dispatch", icon: Truck, label: "dispatch" },
  { to: "/orders", icon: ShoppingBag, label: "orders" },
  { to: "/mails", icon: MailOpen, label: "mails" },
  { to: "/all-users", icon: UserRound, label: "users" },
  { to: "/payments", icon: CreditCard, label: "payments" },
];

const MANAGER_PICKUP_CONFIG: NavItem[] = [
  { to: "/branch-dashboard", icon: House, label: "dashboard", end: true },
  { to: "/orders", icon: ShoppingBag, label: "orders" },
  { to: "/new-orders", icon: Calendar1, label: "newOrders" },
  { to: "/batches", icon: PackageCheck, label: "batches" },
  { to: "/returns", icon: RotateCcw, label: "returns" },
];

const MANAGER_HYBRID_CONFIG: NavItem[] = [
  { to: "/branch-dashboard", icon: House, label: "dashboard", end: true },
  { to: "/dispatch", icon: Truck, label: "dispatch" },
  { to: "/orders", icon: ShoppingBag, label: "orders" },
  { to: "/new-orders", icon: Calendar1, label: "newOrders" },
  { to: "/mails", icon: MailOpen, label: "mails" },
  { to: "/batches", icon: PackageCheck, label: "batches" },
  { to: "/returns", icon: RotateCcw, label: "returns" },
  { to: "/all-users", icon: UserRound, label: "users" },
  { to: "/payments", icon: CreditCard, label: "payments" },
];

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
  role: SidebarUserRole,
  user?: User | null,
): NavItem[] => {
  const branchType = getUserBranchType(user);

  if (role === "manager" && branchType === "REGIONAL") {
    return MANAGER_REGIONAL_CONFIG;
  }

  if (role === "manager" && branchType === "PICKUP") {
    return MANAGER_PICKUP_CONFIG;
  }

  if (role === "manager" && branchType === "HYBRID") {
    return MANAGER_HYBRID_CONFIG;
  }

  return SIDEBAR_CONFIG[role] ?? SIDEBAR_CONFIG.admin;
};

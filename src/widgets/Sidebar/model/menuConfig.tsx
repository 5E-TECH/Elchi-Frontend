import {
  House,
  ShoppingBag,
  MailOpen,
  Apple,
  UserRound,
  MapPinned,
  Calendar1,
  PackageCheck,
  CreditCard,
  Scale,
  FileText,
  Bell,
  Building2,
  type LucideIcon,
  //   LucideIcon,
} from "lucide-react";

export type UserRole = "admin" | "superadmin" | "market" | "courier" | "registrator";
export type BranchDashboardRole = "manager" | "operator";
export type SidebarUserRole = UserRole | BranchDashboardRole;

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

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
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/new-orders", icon: Calendar1, label: "newOrders" },
    { to: "/mails", icon: MailOpen, label: "mails" },
    { to: "/products", icon: Apple, label: "products" },
  ],
  courier: [
    { to: "/", icon: House, label: "dashboard", end: true },
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/mails", icon: MailOpen, label: "mails" },
    { to: "/cash-box", icon: CreditCard, label: "payments" },
  ],
  manager: [
    { to: "/branch-dashboard", icon: House, label: "dashboard", end: true },
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/mails", icon: MailOpen, label: "mails" },
    { to: "/batches", icon: PackageCheck, label: "batches" },
  ],
  operator: [
    { to: "/branch-dashboard", icon: House, label: "dashboard", end: true },
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/mails", icon: MailOpen, label: "mails" },
    { to: "/batches", icon: PackageCheck, label: "batches" },
  ],
};

import {
  House,
  ShoppingBag,
  MailOpen,
  Apple,
  UserRound,
  MapPinned,
  Calendar1,
  CreditCard,
  Scale,
  FileText,
//   LucideIcon,
} from "lucide-react";

export type UserRole = "admin" | "manager" | "user";

export interface NavItem {
  to: string;
  icon: any;
  label: string;
  end?: boolean;
}

/**
 * Barcha roller uchun static navigation configuration
 * Icon'lar component'ga JSX sifatida ishlatiladi
 */
export const SIDEBAR_CONFIG: Record<UserRole, NavItem[]> = {
  admin: [
    { to: "/", icon: House, label: "dashboard", end: true },
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/new-orders", icon: Calendar1, label: "new_orders" },
    { to: "/mails", icon: MailOpen, label: "mails" },
    { to: "/products", icon: Apple, label: "products" },
    { to: "/all-users", icon: UserRound, label: "users" },
    { to: "/payments", icon: CreditCard, label: "payments" },
    { to: "/m-balance", icon: Scale, label: "balance" },
    { to: "/regions", icon: MapPinned, label: "region" },
    { to: "/logs", icon: FileText, label: "logs" },
  ],
  manager: [
    { to: "/", icon: House, label: "dashboard", end: true },
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/order/markets/new-orders", icon: Calendar1, label: "new_orders" },
    { to: "/products", icon: Apple, label: "products" },
    { to: "/payments", icon: CreditCard, label: "payments" },
    { to: "/m-balance", icon: Scale, label: "balance" },
  ],
  user: [
    { to: "/", icon: House, label: "dashboard", end: true },
    { to: "/orders", icon: ShoppingBag, label: "orders" },
    { to: "/products", icon: Apple, label: "products" },
    { to: "/m-balance", icon: Scale, label: "balance" },
  ],
};
import type { UserRole } from "../types/user";

export const USER_ROLE_LABEL_KEYS: Record<UserRole, string> = {
  admin: "roleAdmin",
  manager: "roleManager",
  registrator: "roleRegistrator",
  marketing: "roleMarketing",
  operator: "roleOperator",
  courier: "roleCourier",
  market: "roleMarket",
  superadmin: "roleSuperAdmin",
  customer: "roleCustomer",
};

export const getUserRoleLabelKey = (role?: string | null) =>
  role && role in USER_ROLE_LABEL_KEYS
    ? USER_ROLE_LABEL_KEYS[role as UserRole]
    : "roleUnknown";


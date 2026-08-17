import {
  BriefcaseBusiness,
  Building2,
  ClipboardPenLine,
  Crown,
  Headset,
  Megaphone,
  ShieldCheck,
  Store,
  Truck,
  User,
  UserRound,
  type LucideIcon,
} from "lucide-react";

type RoleAvatarConfig = {
  icon: LucideIcon;
  className: string;
};

const ROLE_AVATAR_CONFIG: Record<string, RoleAvatarConfig> = {
  superadmin: {
    icon: Crown,
    className: "bg-violet-600 text-white shadow-violet-600/25",
  },
  admin: {
    icon: User,
    className: "bg-blue-600 text-white shadow-blue-600/25",
  },
  manager: {
    icon: BriefcaseBusiness,
    className: "bg-indigo-600 text-white shadow-indigo-600/25",
  },
  registrator: {
    icon: ClipboardPenLine,
    className: "bg-cyan-600 text-white shadow-cyan-600/25",
  },
  operator: {
    icon: Headset,
    className: "bg-teal-600 text-white shadow-teal-600/25",
  },
  branch: {
    icon: Building2,
    className: "bg-sky-600 text-white shadow-sky-600/25",
  },
  courier: {
    icon: Truck,
    className: "bg-orange-500 text-white shadow-orange-500/25",
  },
  market: {
    icon: Store,
    className: "bg-emerald-600 text-white shadow-emerald-600/25",
  },
  marketing: {
    icon: Megaphone,
    className: "bg-pink-600 text-white shadow-pink-600/25",
  },
  customer: {
    icon: UserRound,
    className: "bg-slate-600 text-white shadow-slate-600/25",
  },
  client: {
    icon: UserRound,
    className: "bg-slate-600 text-white shadow-slate-600/25",
  },
};

const DEFAULT_ROLE_AVATAR: RoleAvatarConfig = {
  icon: ShieldCheck,
  className: "bg-main text-white shadow-main/25",
};

export const getRoleAvatarConfig = (role?: string | null): RoleAvatarConfig =>
  ROLE_AVATAR_CONFIG[String(role ?? "").trim().toLowerCase()] ??
  DEFAULT_ROLE_AVATAR;

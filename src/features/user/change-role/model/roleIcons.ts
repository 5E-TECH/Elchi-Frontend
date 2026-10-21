import { Briefcase, ClipboardPenLine, Route, UserCog, type LucideIcon } from "lucide-react";
import type { ChangeableUserRole } from "../../../../entities/user/types/user";

/** Rol ikonkasi (`design/icon-registry.json`: Admin — UserCog, Menejer — Briefcase, Ro'yxatchi, Logist — Route). */
export const CHANGEABLE_ROLE_ICON: Record<ChangeableUserRole, LucideIcon> = {
  admin: UserCog,
  manager: Briefcase,
  registrator: ClipboardPenLine,
  logist: Route,
};

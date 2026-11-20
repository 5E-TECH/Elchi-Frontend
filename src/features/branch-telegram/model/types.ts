import type { NotificationInactiveReason } from "../../../entities/notification";

/** Kassa hisoboti qayerga: filial guruhiga (sukut) yoki filial menejerlarining shaxsiy chatiga (bot orqali). */
export type BranchReportTarget = "group" | "private";

/** Filialga ulangan Telegram guruhi (`GET branches/:id/telegram` → `group`). */
export type BranchTelegramGroup = {
  chatId: string;
  title: string | null;
  isActive: boolean;
  /** Bot aniqlagan sabab (`kicked`, `left`, `blocked_on_send`, `chat_not_found`); noma'lum — `null`. */
  inactiveReason: NotificationInactiveReason | null;
  inactiveAt: string | null;
  linkedAt: string | null;
};

export type BranchTelegramStatus = {
  branchId: string;
  reportTarget: BranchReportTarget;
  /** `null` — guruh ulanmagan (yoki panelda uzilgan). */
  group: BranchTelegramGroup | null;
  /** Shu foydalanuvchi o'zgartira oladimi (HQ filiali — faqat superadmin). */
  canManage: boolean;
};

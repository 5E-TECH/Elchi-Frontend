import { normalizeOrderStatus } from "../order";
import type { OrderStatus } from "../order/types/order";

/**
 * ORTGA QAYTARISH (`POST /orders/rollback/:id`, y2RarzlT) — backend qoidasi:
 *   - kim: kuryer, menejer, superadmin (`@Roles(COURIER, MANAGER, SUPERADMIN)`);
 *   - qaysi holatdan: superadmin — sotilgan, bekor qilingan, yopilgan, to'langan, qisman to'langan; menejer va
 *     kuryer — sotilgan, bekor qilingan;
 *   - qaysi holatga (`target_status`): `waiting` (sukut) | `cancelled` | `cancelled_sent` (faqat kuryer).
 */
export type RollbackRole = "superadmin" | "manager" | "courier";
export type RollbackTarget = "waiting" | "cancelled" | "cancelled_sent";

export const ROLLBACK_ALLOWED_STATUSES_BY_ROLE: Readonly<Record<RollbackRole, ReadonlySet<OrderStatus>>> = {
  superadmin: new Set<OrderStatus>(["sold", "cancelled", "closed", "paid", "partly_paid"]),
  manager: new Set<OrderStatus>(["sold", "cancelled"]),
  courier: new Set<OrderStatus>(["sold", "cancelled"]),
};

/** Shu rol shu holatdagi buyurtmani qaytara oladimi (rolning boshqa shartlari — chaqiruvchida). */
export const canRollbackOrderStatus = (role: RollbackRole, status: unknown) => {
  const normalized = normalizeOrderStatus(status);
  return normalized !== null && ROLLBACK_ALLOWED_STATUSES_BY_ROLE[role].has(normalized);
};

/** Maqsad holatning ko'rsatish holati (badge, yorliq): `cancelled_sent` → «Bekor — jo'natilgan». */
export const ROLLBACK_TARGET_STATUS: Readonly<Record<RollbackTarget, OrderStatus>> = {
  waiting: "waiting",
  cancelled: "cancelled",
  cancelled_sent: "cancelled (sent)",
};

/**
 * Oynadagi tanlov: «Kutilmoqda» · «Bekor qilish» · (kuryer) «Bekor — jo'natilgan». Bekor qilingan buyurtma faqat
 * «Kutilmoqda» ga qaytadi (yana bekorga «qaytarish» ma'nosiz). Birinchisi — sukut.
 */
export const getRollbackTargets = (role: RollbackRole, status: unknown): RollbackTarget[] => {
  const current = normalizeOrderStatus(status);
  if (current === "cancelled" || current === "cancelled (sent)") return ["waiting"];
  return role === "courier" ? ["waiting", "cancelled", "cancelled_sent"] : ["waiting", "cancelled"];
};

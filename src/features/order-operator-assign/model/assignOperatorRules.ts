/**
 * 2026-11-16 (Dilshod): «operator tanlanmasa shu buyurtmaga operator biriktirib qo'yish imkoni bo'lishi kerak».
 *
 * Backend: `PUT /orders/:id/operator` `{ operator_id }` — faqat operatori YO'Q buyurtmaga (bor bo'lsa 409
 * `ORDER_OPERATOR_ALREADY_ASSIGNED`, almashtirish emas), integratsiya buyurtmasiga emas (409
 * `ORDER_OPERATOR_EXTERNAL`), operator — buyurtma marketining faol operatori (`GET /market-operators/selectable`,
 * yaratish formasidagi «Operator» bilan AYNI ro'yxat). Sotilgan buyurtmada operator ulushi darhol yoziladi.
 */

/** Biriktira oladigan rollar — gateway `@Roles` bilan AYNI (market operatori va kuryer — yo'q). */
const ASSIGN_ROLES = ["superadmin", "admin", "registrator", "manager", "branch", "market"] as const;

export interface AssignOperatorTarget {
  /** Buyurtmadagi `operator_id` (ro'yxatdan tanlangan operator). */
  operatorId: string | null;
  /** `operator` matni `external_…` — integratsiya buyurtmasi. */
  operatorExternal: boolean;
  /** Buyurtma marketi — operatorlar ro'yxati shu market bo'yicha. */
  marketId: string | null;
}

export const canAssignOrderOperator = (
  role: string | null | undefined,
  target: AssignOperatorTarget | null | undefined,
): boolean => {
  if (!target) return false;
  if (!(ASSIGN_ROLES as readonly string[]).includes((role ?? "").toLowerCase())) return false;
  if (target.operatorId || target.operatorExternal) return false;
  return Boolean(target.marketId);
};

/** Market roli ro'yxatni o'z tokenidan oladi (`market_id` yuborilmaydi) — yaratish formasidagidek. */
export const isOwnMarketRole = (role: string | null | undefined) => (role ?? "").toLowerCase() === "market";

/** Backend 409 kodlari — xabar backend matnidan; kod kelsa buyurtma eskirgan (qayta o'qiladi). */
export const ORDER_OPERATOR_ERROR_CODES = {
  ALREADY_ASSIGNED: "ORDER_OPERATOR_ALREADY_ASSIGNED",
  EXTERNAL: "ORDER_OPERATOR_EXTERNAL",
  MARKET_CHANGED: "ORDER_OPERATOR_MARKET_CHANGED",
} as const;

const KNOWN_CODES: readonly string[] = Object.values(ORDER_OPERATOR_ERROR_CODES);

/** Javobdagi `code` — faqat yuqoridagi uchtasidan biri bo'lsa (boshqa xatolar `null`). */
export const readOrderOperatorErrorCode = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null) return null;
  const data = (error as { response?: { data?: { code?: unknown; data?: { code?: unknown } } } }).response?.data;
  const code = data?.code ?? data?.data?.code;
  return typeof code === "string" && KNOWN_CODES.includes(code) ? code : null;
};

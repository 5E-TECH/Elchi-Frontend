import type { RootState } from "../../../../app/config/store";
import { isCourierHeldOrder } from "../../../../entities/orders/custody";
import { canRollbackOrderStatus } from "../../../../entities/orders/rollbackTarget";
import { canInitiateReturn, canMarkReturnedToMarket } from "../../../../features/order-return";
import {
  canRunCourierAction,
  isOrderReceivedOrLater,
  isOrderSentToBranch,
} from "../newOrderUpdateRules";
import type { OrderDetail } from "./orderDetailModel";

/**
 * BUYURTMA TAFSILOTI — kim nimani ko'radi va o'zgartira oladi (sof funksiyalar, testlanadi).
 *
 * Qoidalar avvalgi sahifadagidek (fix3 / fix3b FE-ORD-12, LC-04):
 *  - mijoz (PATCH /users/:id) — faqat superadmin / admin;
 *  - manzil va buyurtma/mahsulotlar (PATCH /orders/:id/full) — superadmin / admin / registrator / menejer;
 *  - HQ qabul qilgach mahsulot va summa qulflanadi; filialga jo'natilgach mijoz va manzil ham;
 *  - sotish / bekor qilish / qaytarish — faqat REGIONAL · HYBRID menejeri VA uning per-menejer
 *    `can_sell_cancel` bayrog'i yoqilgan bo'lsa (ro'yxatdagi `canUseManagerTableActions` bilan
 *    AYNI qoida; backend sotish/bekorni baribir 403 bilan to'sadi).
 *
 * Ko'rinish maketlar bo'yicha: market va kuryer — faqat o'qish (tahrirlash tugmasi umuman yo'q);
 * registratorda mijoz tugmasi o'chiq (sababi bilan), menejerda tugma yo'q, faqat izoh
 * (`*-orders-detail` maketlari).
 */

export type OrderPageBranchType = "HQ" | "PICKUP" | "REGIONAL" | "HYBRID";

const BRANCH_TYPES = new Set<OrderPageBranchType>(["HQ", "PICKUP", "REGIONAL", "HYBRID"]);

/** Joriy foydalanuvchi filiali turi — profil javobining har xil shakllaridan. */
export const getOrderPageBranchType = (user: RootState["user"]["user"]): OrderPageBranchType | null => {
  const raw = user as
    | {
        branch_type?: string | null;
        branch?: {
          type?: string | null;
          branch_type?: string | null;
          branch?: { type?: string | null; branch_type?: string | null } | null;
        } | null;
      }
    | null
    | undefined;

  const normalize = (value: unknown): OrderPageBranchType | null => {
    if (typeof value !== "string") return null;
    const upper = value.toUpperCase() as OrderPageBranchType;
    return BRANCH_TYPES.has(upper) ? upper : null;
  };

  return (
    normalize(raw?.branch?.branch?.type) ??
    normalize(raw?.branch?.branch?.branch_type) ??
    normalize(raw?.branch?.type) ??
    normalize(raw?.branch?.branch_type) ??
    normalize(raw?.branch_type) ??
    null
  );
};

/**
 * Menejerning sotish/bekor/qaytarish ruxsati (`can_sell_cancel`, superadmin/admin yoqadi,
 * default — yo'q). Redux `User` tipida bu maydon yo'q, shuning uchun cast bilan o'qiladi.
 */
export const getUserCanSellCancel = (user: RootState["user"]["user"]): boolean =>
  Boolean((user as { can_sell_cancel?: boolean } | null | undefined)?.can_sell_cancel);

/** Sahifa ko'rinishi: `courier` va `market` — o'z maketlari, qolganlar — umumiy. */
export type OrderDetailLayout = "default" | "market" | "courier";

/**
 * Mijoz kartasidagi tahrirlash tugmasi:
 *  - `button` — superadmin / admin (filialga jo'natilgach o'chiq);
 *  - `disabled` — registrator: o'chiq tugma + sabab (`registrator-orders-detail`);
 *  - `hidden` — menejer (`manager-orders-detail`), market, kuryer: tugma yo'q.
 */
export type CustomerEditMode = "button" | "disabled" | "hidden";

export interface OrderDetailAccess {
  layout: OrderDetailLayout;
  canEditCustomer: boolean;
  canEditOrderFull: boolean;
  customerEdit: CustomerEditMode;
  /** Mijoz kartasida «faqat admin yoki superadmin» izohi (registrator, menejer). */
  showCustomerLockHint: boolean;
  productsLocked: boolean;
  destinationLocked: boolean;
  isRegionalManager: boolean;
  /** «Bekor qilish» (va «Sotish», agar `canSell`) — WAITING + post_id, `can_sell_cancel` yoqilgan. */
  canUseCourierActions: boolean;
  /** fix3b LC-04: kuryer qo'lidagi buyurtmani menejer sotmaydi (backend 400). */
  canSell: boolean;
  canRollback: boolean;
  canStartReturn: boolean;
  canHandOverReturn: boolean;
}

const normalizeRole = (role: string | null | undefined) => (role ?? "").trim().toLowerCase();

export const getOrderDetailAccess = ({
  role: rawRole,
  branchType,
  canSellCancel = false,
  order,
}: {
  role: string | null | undefined;
  branchType: OrderPageBranchType | null;
  /** Menejerning `can_sell_cancel` bayrog'i (`getUserCanSellCancel`); berilmasa — ruxsat yo'q. */
  canSellCancel?: boolean;
  order: OrderDetail | null;
}): OrderDetailAccess => {
  const role = normalizeRole(rawRole);
  const layout: OrderDetailLayout = role === "courier" ? "courier" : role === "market" ? "market" : "default";
  const canEditCustomer = role === "superadmin" || role === "admin";
  const canEditOrderFull = canEditCustomer || role === "registrator" || role === "manager";
  const isRegionalManager = role === "manager" && (branchType === "REGIONAL" || branchType === "HYBRID");
  const canManagerSellCancel = isRegionalManager && canSellCancel;
  const canUseCourierActions = canManagerSellCancel && canRunCourierAction(order);

  return {
    layout,
    canEditCustomer,
    canEditOrderFull,
    customerEdit: canEditCustomer ? "button" : role === "registrator" ? "disabled" : "hidden",
    showCustomerLockHint: role === "registrator" || role === "manager",
    productsLocked: Boolean(order && isOrderReceivedOrLater(order.status)),
    destinationLocked: Boolean(order && isOrderSentToBranch(order)),
    isRegionalManager,
    canUseCourierActions,
    canSell: canUseCourierActions && !isCourierHeldOrder(order),
    // Ortga qaytarish (y2RarzlT, backend qoidasi): superadmin — sotilgan, bekor, yopilgan, to'langan, qisman to'langan;
    // hududiy menejer (`can_sell_cancel`) — sotilgan, bekor.
    canRollback:
      (role === "superadmin" && canRollbackOrderStatus("superadmin", order?.status)) ||
      (canManagerSellCancel && canRollbackOrderStatus("manager", order?.status)),
    canStartReturn: canInitiateReturn(rawRole, order),
    canHandOverReturn: canMarkReturnedToMarket(rawRole, order),
  };
};

/** Qulf ogohlantirishlarining id'lari — o'chiq «Tahrirlash» tugmalari `aria-describedby` bilan bog'lanadi. */
export const LOCK_ALERT_ID = {
  products: "products-lock",
  all: "edit-lock",
  destination: "destination-lock",
} as const;

/** Qaysi qulf ogohlantirishi chiqadi (va tugmalar qaysi id'ga bog'lanadi). */
export const getLockAlertIds = (productsLocked: boolean, destinationLocked: boolean) => {
  if (productsLocked && destinationLocked) return { products: LOCK_ALERT_ID.all, destination: LOCK_ALERT_ID.all };
  return {
    products: productsLocked ? LOCK_ALERT_ID.products : undefined,
    destination: destinationLocked ? LOCK_ALERT_ID.destination : undefined,
  };
};

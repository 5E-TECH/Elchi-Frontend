import { isCourierHeldOrder } from "../../../entities/orders/custody";
import { getOrderItemName } from "../../../shared/lib/orderItemName";
import type { OrderDetailAccess } from "../../new_orders/components/detail/orderDetailAccess";
import {
  getDistrictName,
  getRegionName,
  readOrderCreatedAt,
  readOrderMarket,
  type OrderDetail,
} from "../../new_orders/components/detail/orderDetailModel";

/**
 * SKANER NATIJASI (`/scan/:token`, buyurtma) — ko'rinish modeli (sof funksiyalar, testlanadi).
 *
 * Xom javob avval buyurtma tafsilotidagi `normalizeOrderDetail` bilan tozalanadi (`id` yo'q — «topilmadi»),
 * keyin shu yerda sahifa ko'rsatadigan maydonlarga aylanadi. Maketlar: `courier-scan-order-detail`,
 * `manager-scan-result`, `superadmin-scan-result`, `registrator-scan-result` — tuzilma hamma rol uchun bitta
 * (spec G3 §2.2), rollar faqat mazmun bilan farq qiladi (§2.3).
 */

/**
 * Rol → natija sahifasining mazmuni:
 *  - `courier` — «O'zimga olish» (`POST orders/scan-assign`, backend faqat COURIER);
 *  - `staff` — superadmin, admin, registrator: «Holat tarixi» + «Buyurtma sahifasi»;
 *  - `manager` — «Amallar» (sotish / bekor / kuryerga biriktirish, buyurtma tafsilotidagi qoidalar bilan);
 *  - `readonly` — market (va noma'lum rol): faqat ma'lumot, havolasiz, amalsiz.
 */
export type ScanRoleKind = "courier" | "staff" | "manager" | "readonly";

export const getScanRoleKind = (role: string | null | undefined): ScanRoleKind => {
  const value = (role ?? "").trim().toLowerCase();
  if (value === "courier") return "courier";
  if (value === "manager") return "manager";
  if (value === "superadmin" || value === "admin" || value === "registrator") return "staff";
  return "readonly";
};

export type ScanDeliveryKind = "home" | "center";

/** `where_deliver`: `address` / `home` — «Uygacha», `center` — «Markazgacha»; boshqasi — yo'q. */
export const getScanDeliveryKind = (value: unknown): ScanDeliveryKind | null => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "address" || normalized === "home") return "home";
  if (normalized === "center") return "center";
  return null;
};

export interface ScanOrderItemView {
  key: string;
  name: string;
  quantity: number;
}

export interface ScanOrderView {
  id: string;
  status: string;
  delivery: ScanDeliveryKind | null;
  createdAt: string | number | null;
  total: number;
  paid: number;
  customerName: string;
  /** Xom telefon (`formatPhone` / `toTelHref` ko'rsatishda). */
  customerPhone: string;
  initials: string;
  /** «Tuman, viloyat» — ikkalasi ham bo'lmasa `null`. */
  place: string | null;
  address: string | null;
  comment: string | null;
  marketName: string | null;
  items: ScanOrderItemView[];
  /** Posilka kuryer qo'lida (backend `isHeldByCourier` bilan bir xil qoida). */
  courierHeld: boolean;
  /** Enriched javobdagi `courier.name` (bo'lmasa `null`). */
  courierName: string | null;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** Mijoz ismining bosh harflari (avatar): «Zarina Yo'ldosheva» → «ZY»; ism yo'q — «—». */
export const getInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "—";

const readCourierName = (order: OrderDetail): string | null => {
  const courier = order.courier;
  if (courier && typeof courier === "object" && !Array.isArray(courier)) {
    return text((courier as { name?: unknown }).name);
  }
  return null;
};

export const buildScanOrderView = (order: OrderDetail): ScanOrderView => {
  const district = text(getDistrictName(order));
  const region = text(getRegionName(order));
  const place = [district, region].filter(Boolean).join(", ") || null;
  const customerName = text(order.customer.name) ?? "";

  return {
    id: order.id,
    status: order.status,
    delivery: getScanDeliveryKind(order.where_deliver),
    createdAt: readOrderCreatedAt(order),
    total: order.total_price,
    paid: order.paid_amount,
    customerName,
    customerPhone: order.customer.phone_number,
    initials: getInitials(customerName),
    place,
    address: text(order.address),
    comment: text(order.comment),
    marketName: readOrderMarket(order)?.name ?? null,
    items: order.items.map((item, index) => ({
      key: item.id,
      name: getOrderItemName(item, `#${index + 1}`),
      quantity: item.quantity,
    })),
    courierHeld: isCourierHeldOrder(order),
    courierName: readCourierName(order),
  };
};

/**
 * Menejer amallari (`manager-scan-result`). Sotish / bekor — buyurtma tafsilotidagi AYNI qoida
 * (`getOrderDetailAccess`: REGIONAL · HYBRID menejeri, `can_sell_cancel`, WAITING + pochta).
 * Kuryer qo'lidagi buyurtma — maketdagi «Buyurtma kuryerda» holati: amal tugmalari umuman yo'q, faqat
 * ma'lumot va tafsilot havolasi. «Kuryerga biriktirish» — faqat `/dispatch` ochiq bo'lsa
 * (`canViewDispatchPage`).
 */
export interface ManagerScanActions {
  courierHeld: boolean;
  canSell: boolean;
  canCancel: boolean;
  canDispatch: boolean;
  /** Sotish/bekor ruxsati bor (REGIONAL · HYBRID + `can_sell_cancel`) — yo'q bo'lsa «ruxsatini admin beradi». */
  hasSellPermission: boolean;
}

export const getManagerScanActions = ({
  access,
  canSellCancel,
  courierHeld,
  canViewDispatch,
}: {
  access: Pick<OrderDetailAccess, "canSell" | "canUseCourierActions" | "isRegionalManager">;
  canSellCancel: boolean;
  courierHeld: boolean;
  canViewDispatch: boolean;
}): ManagerScanActions => {
  const hasSellPermission = access.isRegionalManager && canSellCancel;
  if (courierHeld) {
    return { courierHeld: true, canSell: false, canCancel: false, canDispatch: false, hasSellPermission };
  }
  return {
    courierHeld: false,
    canSell: access.canSell,
    canCancel: access.canUseCourierActions,
    canDispatch: canViewDispatch,
    hasSellPermission,
  };
};

/** Menejerda hech qanday amal yo'q (HQ · PICKUP, ruxsatsiz, biriktirish ham yopiq) — xodimlar ko'rinishi. */
export const hasAnyManagerAction = (actions: ManagerScanActions) =>
  actions.courierHeld || actions.canSell || actions.canCancel || actions.canDispatch;

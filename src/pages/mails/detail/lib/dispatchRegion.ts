import type { PostOrder } from "../../../../entities/mails";

const toText = (value: unknown) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

/**
 * Pochtani filialga jo'natishda manzil filiallar QAYSI viloyatdan olinadi
 * (fix3 LC-09).
 *
 * Ilgari birinchi buyurtmaning GEOGRAFIK viloyati olinardi
 * (`orders[0].region_id`). HQ pochtasi esa tumanning `assigned_region` i
 * bo'yicha tuziladi (HQ qabuli). Admin tumanni boshqa viloyatga
 * o'tkazgan bo'lsa (Viloyatlar → Tumanlar), R2 pochtasida R1 filiallari
 * chiqardi yoki "viloyatda aktiv filial yo'q" deyilardi — qaysi ro'yxat
 * chiqishi esa qaysi buyurtma birinchi turganiga bog'liq edi.
 *
 * Tartib:
 *   1. pochtaning o'z viloyati (ro'yxatdan navigatsiya holatida keladi);
 *   2. buyurtmalar tumanining `assigned_region` i — HQ qabuli aynan shu
 *      kalit bilan pochtaga joylaydi;
 *   3. avvalgidek — birinchi buyurtmaning geografik viloyati.
 */
export const resolveDispatchRegionId = (
  postRegionId: string | null | undefined,
  orders: readonly PostOrder[],
): string => {
  const fromPost = toText(postRegionId);
  if (fromPost) return fromPost;

  for (const order of orders) {
    const assigned = toText(order.district?.assigned_region ?? order.district?.assignedToRegion?.id);
    if (assigned) return assigned;
  }

  return toText(orders[0]?.region_id ?? orders[0]?.district?.region_id);
};

/**
 * Buyurtma tafsiloti (`/orders/edit/:orderId`) tahrirlash oynalari — dizayn v2.
 *
 *   <EditAddressDialog  open={dialog === "address"}  order={order} onClose={closeDialog} />
 *   <EditCustomerDialog open={dialog === "customer"} order={order} onClose={closeDialog} />
 *   <EditOrderDialog    open={dialog === "order"}    order={order} onClose={closeDialog} />
 *
 * Har oyna o'zi: formani buyurtmadan to'ldiradi, tekshiradi (xato maydon ostida), payload'ni
 * `newOrderUpdateRules.ts` bilan quradi, so'rov yuboradi (yuklanishda yopilmaydi), natija/xato xabarini
 * chiqaradi va muvaffaqiyatda `onSaved?.()` → `onClose()` chaqiradi. Tugma ruxsati (rol, qulf) — sahifada.
 */
export { EditAddressDialog } from "./EditAddressDialog";
export { EditCustomerDialog } from "./EditCustomerDialog";
export { EditOrderDialog } from "./EditOrderDialog";
export type { EditDialogOrder, EditDialogOrderItem, EditDialogProps } from "./editDialogModel";

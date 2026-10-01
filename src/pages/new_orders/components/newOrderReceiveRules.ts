import type { BranchType } from "../../../widgets/Sidebar/model/menuConfig";

/**
 * "Qabul qilish" qaysi endpointga ketadi:
 *
 * - `receive`  — POST /orders/receive (`createReceiveOrder`);
 * - `transfer` — POST /branches/transfer-batches (`createTransferBatch`);
 * - `none`     — bu rolda qabul oqimi yo'q (market o'z buyurtmasini qabul qilmaydi).
 */
export type NewOrderReceiveMode = "receive" | "transfer" | "none";

/**
 * Rol va filial turiga qarab qabul usuli.
 *
 * ⚠️ HQ xodimi (menejer/registrator) transfer-batches ishlata olmaydi: HQ ning
 * ota filiali yo'q, backend 400 "Source branch ota branch'i topilmadi"
 * qaytaradi. HQ buyurtmani to'g'ridan-to'g'ri qabul qiladi — POST /orders/receive.
 *
 * ⚠️ REGIONAL xodimi — `none` (fix3 CODE-17): REGIONAL filial transfer batch
 * yarata olmaydi (backend 403 "REGIONAL filial transfer batch yarata
 * olmaydi"), ya'ni "Qabul qilish" doim rad etilardi. Bunday filialda buyurtma
 * "Biriktirish" (/dispatch) sahifasida kuryerga berilganda avtomatik qabul
 * qilinadi (NEW → RECEIVED → yo'lda), shuning uchun tugma yashiriladi.
 *
 * PICKUP/HYBRID (va noma'lum tur) — hozirgidek transfer-batches.
 * Superadmin/admin — hozirgidek POST /orders/receive.
 */
export const resolveReceiveMode = (
  role: string | null | undefined,
  branchType: BranchType | null | undefined,
): NewOrderReceiveMode => {
  if (role === "market") return "none";

  if (role === "manager" || role === "registrator") {
    if (branchType === "HQ") return "receive";
    if (branchType === "REGIONAL") return "none";
    return "transfer";
  }

  return "receive";
};

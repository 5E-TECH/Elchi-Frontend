import type { BranchType } from "../../../../widgets/Sidebar/model/menuConfig";

/**
 * POCHTANI KIM QABUL QILADI (`/mails/:id`, oddiy — rad etilmagan — pochta). Elchi-Backend #620/#621, Trello anKpzwxk.
 *
 *  - Kuryer pochtasi (`courier_id` — haqiqiy kuryer): qabul qiluvchi — o'sha kuryer. Menejerga qoida o'zgarmagan
 *    (filial turi aniq menejer qabul rejimini ko'radi — avvalgidek).
 *  - Filial o'tkazmasi (HQ → filial, `courier_id` bo'sh yoki `'0'`): faqat MANZIL filial menejeri — REGIONAL yoki
 *    HYBRID filial menejeri, `String(post.branch_id) === o'z filiali`. HQ menejeri va boshqa filial menejeri —
 *    backend 403 (#621: sababsiz yoki `post_receive_manager_only`), shuning uchun ularga sahifa faqat o'qish uchun
 *    («Faqat o'qish» + izoh, ega Q4 sukuti). Registrator, superadmin, admin — o'zgarmagan (qabul tugmasi yo'q;
 *    SA/admin favqulodda qabul UI'si yo'q — ega Q3).
 *  - Rad etilgan pochtani qabul qilish (`post/cancel/receive`) bu yerda emas — #620 unga tegmaydi.
 *
 * Sof funksiya: sahifa (`detail/index.tsx`) va testlar bir xil shartni ishlatadi.
 */
export type ReceiveAccessInput = {
  role: string | null | undefined;
  branchType: BranchType | null;
  /** Ko'ruvchining filiali (`getCurrentBranchId`), bo'lmasa — `""`. */
  myBranchId: string;
  /** Ko'ruvchi id'si (kuryer o'z pochtasini taniydi). */
  viewerId: string;
  /** Pochta (`post/orders/:id` → `data.post`); yuklanmagan bo'lsa — `null`. */
  post: { courier_id?: unknown; branch_id?: unknown; status?: unknown } | null | undefined;
};

export type ReceiveAccess = {
  /** Pochta yuklangan va u filial o'tkazmasi (`courier_id` bo'sh / `'0'`). */
  isTransferPost: boolean;
  /** Ko'ruvchi — shu o'tkazmaning manzil filial menejeri. */
  isDestinationManager: boolean;
  /**
   * Pochtaning qabul qiluvchisi: kuryer — o'z pochtasi; menejer — manzil filialiga o'tkazma. Eski pochtada
   * qolib ketgan (yo'ldagi) buyurtmalarni qayta qabul qilish va «qaytarish so'rovi» shundan.
   */
  isPostReceiver: boolean;
  /** Oddiy pochtada qabul rejimi («Pochtani qabul qilish»). */
  canReceive: boolean;
  /**
   * Jo'natilgan (`sent`) o'tkazma, ko'ruvchi — manzil filial menejeri emas (HQ menejeri, boshqa filial): faqat o'qish.
   */
  isReadOnlyForeignTransfer: boolean;
};

const DESTINATION_BRANCH_TYPES: ReadonlySet<BranchType> = new Set(["REGIONAL", "HYBRID"]);

const toText = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

export const resolveReceiveAccess = ({ role, branchType, myBranchId, viewerId, post }: ReceiveAccessInput): ReceiveAccess => {
  const isCourier = role === "courier";
  const isManager = role === "manager";
  // Filial turi aniq menejer (PICKUP da pochta yo'q — `canViewMails`, lekin shart avvalgidek).
  const isKnownBranchManager = isManager && branchType !== null;
  const courierId = toText(post?.courier_id);
  const postBranchId = toText(post?.branch_id);
  const isTransferPost = Boolean(post) && (courierId === "" || courierId === "0");
  const isDestinationManager =
    isTransferPost &&
    isManager &&
    branchType !== null &&
    DESTINATION_BRANCH_TYPES.has(branchType) &&
    postBranchId !== "" &&
    postBranchId === myBranchId;

  const isPostReceiver = isCourier ? viewerId !== "" && courierId === viewerId : isDestinationManager;
  // Kuryer — avvalgidek har oddiy pochtada qabul rejimi (o'zganiki — `isForeignReceivedPost` faqat o'qish).
  // Menejer: o'tkazmada — faqat manzil menejeri; kuryer pochtasida — o'zgarmagan. Pochta hali yuklanmagan bo'lsa
  // menejerda rejim ochilmaydi (o'tkazmami — noma'lum).
  const canReceive = isCourier || (isKnownBranchManager && Boolean(post) && (isTransferPost ? isDestinationManager : true));
  const isReadOnlyForeignTransfer =
    isManager && isTransferPost && !isDestinationManager && toText(post?.status).toLowerCase() === "sent";

  return { isTransferPost, isDestinationManager, isPostReceiver, canReceive, isReadOnlyForeignTransfer };
};

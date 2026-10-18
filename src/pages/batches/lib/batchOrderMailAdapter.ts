import type { BatchDetail, BatchOrder } from "../../../entities/batch";
import type { PostOrder } from "../../../entities/mails";
import { resolveDisplayOrderStatus } from "../../../entities/order";
import i18n from "../../../i18n";

/**
 * Paket buyurtmasi (`GET transfer-batches/:id` → `BatchOrder`) → pochta buyurtmasi (`PostOrder`): paket tafsiloti
 * pochta tafsilotining buyurtmalar jadvalini (`mails/detail/ui/OrdersTable`) va tanlov modelini
 * (`useMailDetailState`) qayta ishlatadi.
 */

/**
 * Holat — faqat ko'rsatish uchun (`OrderStatusBadge`): backend holati o'zicha («Sotilgan», «Kutilmoqda», «Yo'lda»).
 * `PostOrder.status` turi torroq (pochta holatlari), shuning uchun ko'rsatish holati shu turga keltiriladi; noma'lum
 * holat — «Yangi» (v1 dagidek).
 */
const toDisplayStatus = (status: string): PostOrder["status"] =>
  (resolveDisplayOrderStatus(status) ?? "new") as PostOrder["status"];

/** Yetkazish (ega qarori D13): `center` — «Markazgacha», qolgani (`home`, `address`, noma'lum) — «Uygacha». */
const toWhereDeliver = (value: BatchOrder["where_deliver"]): PostOrder["where_deliver"] =>
  value === "center" ? "center" : "address";

const known = (value: string | null | undefined): string | null => {
  const text = value?.trim();
  return text && text !== "—" ? text : null;
};

export const mapBatchOrdersToPostOrders = (batch?: BatchDetail | null): PostOrder[] => {
  const batchCreatedAt = batch?.created_at ?? new Date().toISOString();
  const branchId = batch?.to_branch?.id ?? "batch-region";
  const branchName = batch?.to_branch?.name ?? i18n.t("batches:detail.branch");

  return (batch?.orders ?? []).map((order): PostOrder => {
    // Buyurtma sanasi — buyurtmaning o'zi, bo'lmasa paket yaratilgan vaqt (D13).
    const createdAt = known(order.created_at) ?? batchCreatedAt;
    // Tuman — enriched buyurtmadan (D13); bo'lmasa bo'sh (filial nomi tuman o'rnida ko'rsatilmasin).
    const districtName = known(order.district) ?? "";
    const regionName = known(order.region) ?? branchName;
    const marketName = known(order.market);

    return {
      id: order.id,
      createdAt,
      updatedAt: createdAt,
      isDeleted: false,
      market_id: "batch-market",
      customer_id: `batch-customer-${order.id}`,
      product_quantity: 0,
      where_deliver: toWhereDeliver(order.where_deliver),
      total_price: order.price,
      to_be_paid: order.price,
      paid_amount: 0,
      status: toDisplayStatus(order.status),
      comment: null,
      operator: null,
      post_id: null,
      canceled_post_id: null,
      sold_at: null,
      district_id: "batch-district",
      region_id: branchId,
      address: order.address,
      qr_code_token: order.qr_code_token ?? null,
      external_id: null,
      deleted: false,
      items: [],
      ...(marketName
        ? {
            // Pochta detali tiplari backend oq ro'yxatiga toraytirilgan (VfgcnxDa) — faqat `id/name/phone_number`.
            market: { id: "batch-market", name: marketName, phone_number: "" },
          }
        : {}),
      customer: {
        id: `batch-customer-${order.id}`,
        name: order.receiver,
        phone_number: order.phone,
        extra_number: null,
      },
      district: {
        id: "batch-district",
        name: districtName,
        sato_code: "",
        region_id: branchId,
        assigned_region: regionName,
      },
      region: {
        id: branchId,
        name: regionName,
        sato_code: "",
        districts: [],
        createdAt,
        updatedAt: createdAt,
      },
    };
  });
};

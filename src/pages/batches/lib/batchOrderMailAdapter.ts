import type { BatchDetail } from "../../../entities/batch";
import type { PostOrder } from "../../../entities/mails";
import i18n from "../../../i18n";

const normalizeOrderStatus = (status: string): PostOrder["status"] => {
  const normalized = status.toLowerCase();
  if (
    normalized === "received" ||
    normalized === "delivered" ||
    normalized === "cancelled" ||
    normalized === "cancelled (sent)"
  ) {
    return normalized;
  }
  return "new";
};

export const mapBatchOrdersToPostOrders = (batch?: BatchDetail | null): PostOrder[] => {
  const createdAt = batch?.created_at ?? new Date().toISOString();
  const branchId = batch?.to_branch?.id ?? "batch-region";
  const branchName = batch?.to_branch?.name ?? i18n.t("batches:detail.branch");

  return (batch?.orders ?? []).map((order): PostOrder => ({
    id: order.id,
    createdAt,
    updatedAt: createdAt,
    isDeleted: false,
    market_id: "batch-market",
    customer_id: `batch-customer-${order.id}`,
    product_quantity: 0,
    where_deliver: "address",
    total_price: order.price,
    to_be_paid: order.price,
    paid_amount: 0,
    status: normalizeOrderStatus(order.status),
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
    // Pochta detali tiplari backend oq ro'yxatiga toraytirilgan (VfgcnxDa) — faqat shu maydonlar.
    customer: {
      id: `batch-customer-${order.id}`,
      name: order.receiver,
      phone_number: order.phone,
      extra_number: null,
    },
    district: {
      id: "batch-district",
      name: branchName,
      sato_code: "",
      region_id: branchId,
      assigned_region: branchName,
    },
    region: {
      id: branchId,
      name: branchName,
      sato_code: "",
      districts: [],
      createdAt,
      updatedAt: createdAt,
    },
  }));
};

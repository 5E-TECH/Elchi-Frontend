import type { Batch, BatchBranch, BatchOrder } from "../../../entities/batch";
import type { useBranchesWithSentBatches } from "../../../entities/branch";
import type { SourceListRow } from "../ui/SourceListCard";

/**
 * «FILIAL PAKETLARI» (`/new-orders/branches*`) — sof yordamchilar.
 *
 * Sahifalar (`index.tsx`, `batches.tsx`, `batchDetail.tsx`) shu yerdagi qoidalardan foydalanadi; hammasi
 * `branchBatchesModel.test.ts` da tekshiriladi.
 */

/** `GET branches/with-sent-batches` qatori (`entities/branch` normalizatori natijasi). */
type SentBatchBranchRow = NonNullable<ReturnType<typeof useBranchesWithSentBatches>["data"]>[number];

/** Filiallar ro'yxati qatori: `SourceListCard` shakli (`orders_count` — paketlar soni). */
export type BranchSourceRow = SourceListRow;

/** `GET branches/with-sent-batches` → `SourceListCard` qatorlari (`batches_count` → `orders_count`). */
export const toBranchSourceRows = (rows: readonly SentBatchBranchRow[] | undefined): BranchSourceRow[] =>
  (rows ?? [])
    .filter((row) => row.branch_id)
    .map((row) => ({
      id: row.branch_id,
      name: row.name,
      phone_number: row.phone_number,
      orders_count: Number(row.batches_count) || 0,
      total_price_sum: Number(row.total_price_sum) || 0,
    }));

/** Paket holati → ton: manbasi `entities/batch` (bir nechta sahifa ishlatadi), bu yerda qayta eksport. */
export { BATCH_STATUS_TONE } from "../../../entities/batch";

/** Normalizator topa olmagan maydon «—» bo'lib keladi (`batchApi.ts` `toText` fallback). */
const known = (value: string | null | undefined): string | null => {
  const text = value?.trim();
  return text && text !== "—" ? text : null;
};

/** Paket boradigan viloyat: `to_branch.region`, bo'lmasa filial nomi (v1 dagidek). */
export const readBatchRegion = (batch: Pick<Batch, "to_branch">): string | null =>
  known(batch.to_branch.region) ?? known(batch.to_branch.name);

/**
 * Paketlar qidiruvi (mijoz tomonida, v1 dagidek): paket id, QR token, viloyat va manzil filial nomi.
 * Katta-kichik harfsiz; «B-148» ham, «148» ham topadi.
 */
export const matchesBatchSearch = (batch: Batch, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const plain = needle.replace(/^b-/, "");
  return [batch.id, batch.token, batch.to_branch.region ?? "", batch.to_branch.name ?? ""].some((value) => {
    const text = String(value).toLowerCase();
    return text.includes(needle) || (plain !== needle && text.includes(plain));
  });
};

export const sumBatchesTotal = (batches: readonly Pick<Batch, "total_price">[]): number =>
  batches.reduce((sum, batch) => sum + (Number(batch.total_price) || 0), 0);

export const sumBatchOrdersTotal = (orders: readonly Pick<BatchOrder, "price">[]): number =>
  orders.reduce((sum, order) => sum + (Number(order.price) || 0), 0);

/** Skaner indeksi: paket QR tokeni `qr_code_token` sifatida (`useOrderQrScanner` shakli). */
export const toScannableBatches = <T extends Pick<Batch, "id" | "token">>(
  batches: readonly T[],
): (T & { qr_code_token: string | null })[] =>
  batches.map((batch) => ({ ...batch, qr_code_token: batch.token || null }));

/** Filial nomi: ma'lum bo'lsa (normalizator «—» bermagan bo'lsa). */
export const readBranchName = (branch: Pick<BatchBranch, "name"> | null | undefined): string | null =>
  known(branch?.name);

/** Filial id: route uchun yaroqli bo'lsa (normalizator «—» bermagan bo'lsa). */
export const readBranchId = (branch: Pick<BatchBranch, "id"> | null | undefined): string | undefined =>
  known(branch?.id) ?? undefined;

/** Buyurtma sanasi: buyurtmaning o'zi (`created_at`), bo'lmasa paket yaratilgan vaqt (v1 dagidek). */
export const readBatchOrderDate = (order: Pick<BatchOrder, "created_at">, batchCreatedAt?: string): string | null =>
  known(order.created_at) ?? known(batchCreatedAt);

/** Yetkazish yorlig'i uchun: normalizatorning `home` qiymati — eshikkacha («Uygacha»), `address` bilan bir xil. */
export const toDeliveryKind = (whereDeliver: BatchOrder["where_deliver"]): string | undefined =>
  whereDeliver === "home" ? "address" : whereDeliver;

/** Buyurtma holati: ma'lum bo'lsa (normalizator «—» qaytargan bo'lsa — yo'q). */
export const readBatchOrderStatus = (order: Pick<BatchOrder, "status">): string | null => known(order.status);

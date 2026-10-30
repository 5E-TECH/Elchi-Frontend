import type { BatchDetail } from "../../../entities/batch";
import type { ReceiptPackageSource } from "../../../features/print-receipts";

/**
 * Paket → paket cheki manbasi (HJ5sLHiz, maket `tizim-receipts` 02, TZ F8): «Filial paketi» / «Qaytarish paketi»,
 * B-raqam, vaqt, «Qayerdan» → «Qayerga» (filial nomi ma'lum bo'lsa), buyurtmalar soni, jami summa, haydovchi va
 * avtomobil (yo'q — qator chiqmaydi), QR — paket tokeni.
 */
export const toBatchReceiptSource = (
  batch: BatchDetail,
  names: { from?: string | null; to?: string | null } = {},
): ReceiptPackageSource => ({
  kind: "batch",
  id: batch.id,
  direction: batch.direction,
  token: batch.token,
  createdAt: batch.created_at,
  from: names.from ?? null,
  to: names.to ?? null,
  ordersCount: batch.orders_count,
  totalPrice: batch.total_price,
  driver: { name: batch.driver ?? null, phone_number: batch.driver_phone ?? null },
  vehiclePlate: batch.vehicle_plate ?? null,
});

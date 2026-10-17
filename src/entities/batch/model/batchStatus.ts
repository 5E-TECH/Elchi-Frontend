import type { Tone } from "../../../shared/ui/primitives";
import type { BatchStatus } from "./types";

/**
 * Paket holati → ton (maketdagidek, ega qarori 2026-10-17 F1): yorliq — `newOrders:batchStatus.*` (haqiqiy holat,
 * «Yangi» qattiq yozilmaydi).
 *   PENDING   → `new`        «Yangi», info;
 *   SENT      → `on_the_way` «Yo'lda», warning — buyurtmadagi «Yo'lda» bilan bir xil;
 *   RECEIVED  → `received`   «Qabul qilingan», success;
 *   CANCELLED → `cancelled`  «Bekor qilingan», danger.
 *
 * Bir nechta sahifa ishlatadi («Filial paketlari», «Paketlar», «Qaytarishlar», «Eski pochtalar» — paketlar
 * rejimi va Excel), shuning uchun `entities/batch` da turadi.
 */
export const BATCH_STATUS_TONE: Record<BatchStatus, Tone> = {
  new: "info",
  on_the_way: "warning",
  received: "success",
  cancelled: "danger",
};

import type { Tone } from "../../../shared/ui/primitives";
import type { BatchStatus } from "./types";

/**
 * Paket holati → ton (ega qarori D1): yorliq — `newOrders:batchStatus.*` (haqiqiy holat, «Yangi» qattiq
 * yozilmaydi). `SENT` → `on_the_way` («Yo'lda»).
 *
 * Bir nechta sahifa ishlatadi («Filial paketlari», «Paketlar», «Qaytarishlar», «Eski pochtalar» — paketlar
 * rejimi), shuning uchun `entities/batch` da turadi.
 */
export const BATCH_STATUS_TONE: Record<BatchStatus, Tone> = {
  new: "info",
  on_the_way: "info",
  received: "success",
  cancelled: "danger",
};

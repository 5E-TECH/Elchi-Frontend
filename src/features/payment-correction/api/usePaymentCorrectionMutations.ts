import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getNetworkDownKind, NETWORK_RESTORED_EVENT } from "../../../auth/networkError";
import { financeHistory, refreshCashboxQueries } from "../../../entities/payments";
import { useIdempotencyKeys } from "../../../entities/warehouse";
import { API_ENDPOINTS } from "../../../shared/api";
import { api } from "../../../shared/api/api";
import {
  correctionErrorNeedsRefresh,
  correctionErrorRefreshesDetail,
  correctionErrorResetsKeys,
  readCorrectionError,
} from "../model/errors";
import { normalizeCorrectionReason } from "../model/validation";

/**
 * T6 N2 — to'lovni qaytarish va summasini tuzatish (faqat superadmin; backend `@Roles(SUPERADMIN)`):
 *   `POST finance/history/:id/reverse`        `{ reason }`
 *   `POST finance/history/:id/correct-amount` `{ new_amount, reason }`
 * Tanada ortiqcha kalit yo'q (gateway `forbidNonWhitelisted` → 400); sabab trim qilingan, summa — son.
 *
 * `Idempotency-Key` MAJBURIY (yo'q — 400 `IDEMPOTENCY_KEY_REQUIRED`). Kalit tana «barmoq izi»ga bog'lanadi
 * (`amal|id|sabab|summa`, backend «ayni so'rov» ta'rifi bilan bir xil): javobsiz qolgan urinish (504, tarmoq) AYNI
 * tana bilan qayta yuborilsa — o'sha kalit, backend 200 `idempotent: true` qaytaradi va ikkinchi marta tuzatmaydi;
 * tana o'zgarsa — yangi kalit (eskisi bilan 409 `IDEMPOTENCY_KEY_REUSED` bo'lardi). Muvaffaqiyatda kalitlar
 * tashlanadi. Kalitlar hook nusxasida yashaydi — hook'ni oqim davomida yashaydigan joyda (tafsilot oynasi yoki
 * forma oynasi) chaqiring.
 *
 * `silentNetworkError` — tarmoq xatosida global «Internet aloqasi yo'q» xabari chiqmaydi: matn tasdiq oynasining
 * o'zida (maket `*-errors`).
 *
 * Yangilash (`refreshCashboxQueries` — kassa, tarix ro'yxatlari va ochiq tafsilot `["finance-history", id]`):
 * muvaffaqiyatda (filial qabul qilgan to'lovda superadmin realtime hodisa olmaydi), natija noma'lum xatoda (504 da
 * bajarilgan bo'lishi mumkin), `ALREADY_CORRECTED` va `NOT_FOUND` da. Kutilmaydi — tasdiq tugmasi darhol bo'shaydi.
 * Javob umuman kelmagan bo'lsa (aloqa uzilgan deb belgilangan — `silentNetworkError` ham belgilaydi) yangilash aloqa
 * tiklangach (`elchi:network-restored` — uzilishdan keyingi birinchi javob): «Wi-Fi bor, server yo'q» holatida
 * darhol so'ralsa yangilash GET'lari ham yiqilib global «Internet aloqasi yo'q» xabarini ochardi — matn tasdiq
 * oynasidagi bilan ikki marta. 502/503/504 da aloqa bor — darhol. Qayta urinish muvaffaqiyatli bo'lsa o'zi yangilaydi.
 * Doimiy hukmda (`COURIER_MOVED`, `WINDOW_EXPIRED`, `LEGACY_UNLINKED`, sababli `NOT_CORRECTABLE`) — faqat ochiq
 * tafsilot (`correctable` qulfga o'tadi).
 */

export type ReversePaymentInput = { historyId: string; reason: string };
export type CorrectPaymentAmountInput = { historyId: string; newAmount: number; reason: string };

/** POST javobidagi tuzatish (tarix `correction` dan boshqa shakl: `created_by` — ID, `role` / `related` yo'q). */
export type PaymentCorrectionResult = {
  /** Takroriy so'rov (o'sha kalit) — tuzatish avval bajarilgan; foydalanuvchi uchun baribir muvaffaqiyat. */
  idempotent: boolean;
  correctionId: string | null;
  action: "reverse" | "edit" | null;
  originalAmount: number | null;
  newAmount: number | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const numberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** `{ statusCode, message, data: { correction, cashboxes, idempotent } }` → natija (himoyaviy). */
export const normalizePaymentCorrectionResult = (body: unknown): PaymentCorrectionResult => {
  const root = asRecord(body);
  const data = asRecord(root?.data) ?? root;
  const correction = asRecord(data?.correction);
  const action = correction?.action === "reverse" || correction?.action === "edit" ? correction.action : null;
  return {
    idempotent: data?.idempotent === true,
    correctionId: correction?.id === undefined || correction?.id === null ? null : String(correction.id),
    action,
    originalAmount: numberOrNull(correction?.original_amount),
    newAmount: numberOrNull(correction?.new_amount),
  };
};

/** Idempotentlik barmoq izi: amal + oyoq + trim qilingan sabab + yangi summa (2 xona). */
export const paymentCorrectionFingerprint = (
  action: "reverse" | "edit",
  input: { historyId: string; reason: string; newAmount?: number | null },
) =>
  [
    action,
    input.historyId,
    normalizeCorrectionReason(input.reason),
    input.newAmount === null || input.newAmount === undefined ? "" : String(Math.round(input.newAmount * 100) / 100),
  ].join("|");

/** Aloqa tiklanishini kutayotgan mijozlar — bir nechta javobsiz urinish bitta yangilash beradi. */
const waitingForNetwork = new WeakSet<QueryClient>();

const refreshWhenNetworkRestored = (client: QueryClient) => {
  if (typeof window === "undefined" || waitingForNetwork.has(client)) return;
  waitingForNetwork.add(client);
  window.addEventListener(
    NETWORK_RESTORED_EVENT,
    () => {
      waitingForNetwork.delete(client);
      void refreshCashboxQueries(client);
    },
    { once: true },
  );
};

const handleCorrectionError = (client: QueryClient, reset: () => void, error: unknown, historyId: string) => {
  const info = readCorrectionError(error);
  if (correctionErrorResetsKeys(info)) reset();
  if (correctionErrorNeedsRefresh(info)) {
    // Javobsiz va aloqa uzilgan: yangilash GET'lari ham yiqilardi (global xabar) — aloqa tiklangach.
    if (info.status === undefined && getNetworkDownKind() !== null) refreshWhenNetworkRestored(client);
    else void refreshCashboxQueries(client);
    return;
  }
  if (correctionErrorRefreshesDetail(info)) {
    void client.invalidateQueries({ queryKey: [financeHistory, historyId], refetchType: "active" });
  }
};

/** «Qaytarish»: `mutateAsync({ historyId, reason })` — tasdiq oynasining `onConfirm` i. */
export const useReversePayment = () => {
  const client = useQueryClient();
  const keys = useIdempotencyKeys();
  return useMutation({
    mutationFn: async ({ historyId, reason }: ReversePaymentInput) => {
      const body = { reason: normalizeCorrectionReason(reason) };
      const key = keys.take(paymentCorrectionFingerprint("reverse", { historyId, reason: body.reason }));
      const response = await api.post(API_ENDPOINTS.FINANCE.HISTORY_REVERSE(historyId), body, {
        headers: { "Idempotency-Key": key },
        silentNetworkError: true,
      });
      return normalizePaymentCorrectionResult(response.data);
    },
    onSuccess: () => {
      keys.reset();
      void refreshCashboxQueries(client);
    },
    onError: (error, { historyId }) => handleCorrectionError(client, keys.reset, error, historyId),
  });
};

/** «Summani tahrirlash»: `mutateAsync({ historyId, newAmount, reason })`. */
export const useCorrectPaymentAmount = () => {
  const client = useQueryClient();
  const keys = useIdempotencyKeys();
  return useMutation({
    mutationFn: async ({ historyId, newAmount, reason }: CorrectPaymentAmountInput) => {
      const body = { new_amount: Number(newAmount), reason: normalizeCorrectionReason(reason) };
      const key = keys.take(
        paymentCorrectionFingerprint("edit", { historyId, reason: body.reason, newAmount: body.new_amount }),
      );
      const response = await api.post(API_ENDPOINTS.FINANCE.HISTORY_CORRECT_AMOUNT(historyId), body, {
        headers: { "Idempotency-Key": key },
        silentNetworkError: true,
      });
      return normalizePaymentCorrectionResult(response.data);
    },
    onSuccess: () => {
      keys.reset();
      void refreshCashboxQueries(client);
    },
    onError: (error, { historyId }) => handleCorrectionError(client, keys.reset, error, historyId),
  });
};

import type { Batch } from "../../../entities/batch";
import { readBackendRejection } from "../../../shared/lib/backendReason";
import { knownText } from "./batchView";

/**
 * PAKETNI BEKOR QILISH — `/batches/:id` (Trello oP02jE2P; backend Elchi-Backend #684, `POST transfer-batches/:id/cancel`).
 *
 * Backend qoidasi (FRONTEND_CHANGELOG 2026-11-17): faqat hali jo'natilmagan (`PENDING` → ilovada `new`) paket bekor
 * qilinadi; jo'natilgan (`SENT`) — 409 `batch_in_transit`, hech kimga (superadmin va adminga ham). Kim: superadmin,
 * admin va paketni yig'gan (MANBA) filialning registratori yoki menejeri (yoki menejer daraxti); boshqasi — 403.
 *
 * Tugma qoidasi (frontend): holat `new` va
 *  - superadmin, admin — doim;
 *  - menejer, registrator, filial akkaunti — ko'ruvchi filiali (`getCurrentBranchId`) manba filial bilan bir xil bo'lsa;
 *    ikkalasidan biri noma'lum bo'lsa ham ko'rsatiladi — qarorni backend beradi (403 — o'z matnimiz). Ma'lum va boshqa
 *    filial bo'lsa — yashirin (menejer daraxti — ota filial menejeri — frontda aniqlanmaydi; ega savoli PR'da);
 *  - qolgan rollar (logist …) — yo'q.
 */

/** Backend `CancelTransferBatchRequestDto`: sabab kamida 10 belgi (trim). */
export const BATCH_CANCEL_MIN_REASON = 10;

const PRIVILEGED_ROLES = new Set(["superadmin", "admin"]);
const BRANCH_STAFF_ROLES = new Set(["manager", "registrator", "branch"]);

export type BatchCancelAccessInput = {
  role: string | null | undefined;
  /** Ko'ruvchining filiali (`getCurrentBranchId`), bo'lmasa — `""`. */
  viewerBranchId: string;
  batch: Pick<Batch, "status" | "from_branch"> | null | undefined;
};

export const canCancelBatch = ({ role, viewerBranchId, batch }: BatchCancelAccessInput): boolean => {
  if (!batch || batch.status !== "new") return false;
  const viewerRole = String(role ?? "");
  if (PRIVILEGED_ROLES.has(viewerRole)) return true;
  if (!BRANCH_STAFF_ROLES.has(viewerRole)) return false;
  const sourceBranchId = knownText(batch.from_branch?.id);
  const ownBranchId = knownText(viewerBranchId);
  if (!sourceBranchId || !ownBranchId) return true;
  return sourceBranchId === ownBranchId;
};

/**
 * Rad javobi turi (oyna ichidagi xato qutisi):
 *  - `inTransit` — 409 yoki `batch_in_transit` («Paket yo'lda …»; `data.reason` siz 409 ham shu — backend kamyob
 *    poygada sababsiz qaytaradi);
 *  - `received` / `alreadyCancelled` / `notCancellable` — 400 `batch_received` / `batch_already_cancelled` /
 *    `batch_not_cancellable`;
 *  - `forbidden` — 403 (backend matni «Transfer batch yaratishga ruxsat yo'q» chalg'itadi — o'z matnimiz);
 *  - `notFound` — 404;
 *  - `rejected` — boshqa 4xx: backend o'zbekcha matni (holat kodisiz), bo'lmasa umumiy matn;
 *  - `failed` — tarmoq / 5xx / javobsiz: umumiy o'zbekcha matn (backend hali deploy qilinmagan bo'lsa ham).
 */
export type BatchCancelErrorKind =
  | "inTransit"
  | "received"
  | "alreadyCancelled"
  | "notCancellable"
  | "forbidden"
  | "notFound"
  | "rejected"
  | "failed";

export type BatchCancelError = {
  kind: BatchCancelErrorKind;
  /** Backend matni — faqat `rejected` da (aks holda `null`, i18n matn ishlatiladi). */
  message: string | null;
  /** Qayta urinish befoyda: «Paketni bekor qilish» o'chadi (oyna yopilib qayta ochilguncha). */
  blockConfirm: boolean;
};

const REASON_KIND: Record<string, BatchCancelErrorKind> = {
  batch_in_transit: "inTransit",
  batch_received: "received",
  batch_already_cancelled: "alreadyCancelled",
  batch_not_cancellable: "notCancellable",
};

/** Matndagi « (400)» kabi holat kodi qo'shimchasi — foydalanuvchiga kerak emas. */
const stripStatusSuffix = (message: string) => message.replace(/\s*\(\d{3}\)\s*$/, "").trim();

export const resolveBatchCancelError = (error: unknown): BatchCancelError => {
  const { status, reason, message } = readBackendRejection(error);
  const known = reason ? REASON_KIND[reason] : undefined;
  if (known) return { kind: known, message: null, blockConfirm: true };
  if (status === 409) return { kind: "inTransit", message: null, blockConfirm: true };
  if (status === 403) return { kind: "forbidden", message: null, blockConfirm: true };
  if (status === 404) return { kind: "notFound", message: null, blockConfirm: true };
  if (status !== null && status >= 400 && status < 500 && status !== 401) {
    const text = message ? stripStatusSuffix(message) : "";
    return { kind: "rejected", message: text || null, blockConfirm: false };
  }
  return { kind: "failed", message: null, blockConfirm: false };
};

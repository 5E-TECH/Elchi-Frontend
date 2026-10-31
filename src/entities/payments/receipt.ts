import { useMutation, useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "../../shared/api";
import { api, LONG_REQUEST_TIMEOUT_MS } from "../../shared/api/api";
import { prepareImage, type PreparedImage } from "../../shared/lib/downscaleImage";

/**
 * KASSA CHEKI (QlLf33Ma, backend `docs/frontend/FRONTEND_CHANGELOG.md` «T3», 2026-10-30): qo'lda chiqim va HQ'ga
 * o'tkazmada chek rasmi. Bu modul — kontrakt turlari, normalizatorlar va so'rovlar:
 *  - `GET finance/receipt-settings` (superadmin/admin/menejer) — ikki guruh × ikki kalit; sukut — hammasi yoqiq;
 *  - `POST finance/receipts` (multipart `kind`, `photo`) → qoralama `receipt_id` (24 soat), operatsiya tanasida
 *    `receipt_id` bilan biriktiriladi. Rasm brauzerda ≤ 5 MB JPEG qilinadi (`prepareImage`, smena rasmi va AI buyurtma
 *    bilan bitta yo'l), shuning uchun 12 MB telefon surati ham o'tadi.
 *
 * Xatolar `response.data.code` da (`RECEIPT_*`, FE matnni emas, kodni tekshiradi).
 */

export const RECEIPT_KINDS = ["manual_expense", "courier_to_hq", "branch_to_hq"] as const;
export type ReceiptKind = (typeof RECEIPT_KINDS)[number];

export const RECEIPT_SETTING_GROUPS = ["manual_expense", "hq_transfer"] as const;
export type ReceiptSettingGroup = (typeof RECEIPT_SETTING_GROUPS)[number];
/** Backend `receiptSettingGroupOf`: kuryer va filial o'tkazmasi — bitta juft kalit. */
export const receiptSettingGroupOf = (kind: ReceiptKind): ReceiptSettingGroup =>
  kind === "manual_expense" ? "manual_expense" : "hq_transfer";

export type ReceiptGroupSettings = { photo_required: boolean; ai_enabled: boolean };

export type ReceiptSettings = Record<ReceiptSettingGroup, ReceiptGroupSettings> & {
  updated_at: string | null;
  updated_by: string | null;
};

export const RECEIPT_AI_STATUSES = ["disabled", "pending", "match", "mismatch", "unreadable", "error"] as const;
export type ReceiptAiStatus = (typeof RECEIPT_AI_STATUSES)[number];

/** Rasm: jpeg / png / webp, ≤ 5 MB (gateway `CASHBOX_RECEIPT_MAX_BYTES`). */
export const RECEIPT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

export const RECEIPT_ERROR_CODES = [
  "RECEIPT_AI_REQUIRES_PHOTO",
  "RECEIPT_DISABLED",
  "RECEIPT_REQUIRED",
  "RECEIPT_NOT_FOUND",
  "RECEIPT_NOT_OWNER",
  "RECEIPT_KIND_MISMATCH",
  "RECEIPT_ALREADY_USED",
  "RECEIPT_NOT_APPLICABLE",
  "RECEIPT_ALREADY_MATCHED",
  "RECEIPT_AI_DISABLED",
  "RECEIPT_AI_PENDING",
  "RECEIPT_AI_ATTEMPTS_EXHAUSTED",
] as const;
export type ReceiptErrorCode = (typeof RECEIPT_ERROR_CODES)[number];

/** Xatodagi `RECEIPT_*` kodi (`response.data.code`); boshqa xato — `null`. */
export const getReceiptErrorCode = (error: unknown): ReceiptErrorCode | null => {
  const data = (error as { response?: { data?: { code?: unknown; data?: { code?: unknown } } } } | null | undefined)
    ?.response?.data;
  const code = data?.code ?? data?.data?.code;
  return typeof code === "string" && (RECEIPT_ERROR_CODES as readonly string[]).includes(code)
    ? (code as ReceiptErrorCode)
    : null;
};

// ───────────────────────── normalizatorlar ─────────────────────────

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const text = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() ? value : null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

/** `response.data.data` yoki `response.data` — ikkalasi ham. */
const payload = (value: unknown): Record<string, unknown> => {
  const root = record(value);
  return "data" in root && root.data && typeof root.data === "object" ? record(root.data) : root;
};

const normalizeGroup = (value: unknown): ReceiptGroupSettings => {
  const group = record(value);
  // Sukut — yoqiq (ega qarori 1): kalit javobda yo'q bo'lsa ham shunday.
  return { photo_required: group.photo_required !== false, ai_enabled: group.ai_enabled !== false };
};

export const normalizeReceiptSettings = (value: unknown): ReceiptSettings => {
  const data = payload(value);
  return {
    manual_expense: normalizeGroup(data.manual_expense),
    hq_transfer: normalizeGroup(data.hq_transfer),
    updated_at: text(data.updated_at),
    updated_by: text(data.updated_by),
  };
};

export const toReceiptAiStatus = (value: unknown): ReceiptAiStatus | null => {
  const raw = String(value ?? "").toLowerCase();
  return (RECEIPT_AI_STATUSES as readonly string[]).includes(raw) ? (raw as ReceiptAiStatus) : null;
};

/** Operatsiya javobi `data.receipt` dagi AI holati (chek yo'q — `null`). */
export const readLinkedReceiptStatus = (response: unknown): ReceiptAiStatus | null => {
  const body = (response as { data?: { data?: { receipt?: { ai_status?: unknown } | null } | null } } | null | undefined)
    ?.data?.data;
  return toReceiptAiStatus(body?.receipt?.ai_status);
};

// ───────────────────────── so'rovlar ─────────────────────────

export const receiptSettingsKey = ["cashbox", "receipt-settings"] as const;

/** `GET finance/receipt-settings`. Xato — chaqiruvchi rasmni majburiy deb hisoblaydi (TZ «Holatlar»). */
export const useReceiptSettings = (enabled = true) =>
  useQuery({
    queryKey: receiptSettingsKey,
    queryFn: () => api.get(API_ENDPOINTS.CASHBOX.RECEIPT_SETTINGS).then((res) => normalizeReceiptSettings(res.data)),
    enabled,
    meta: { silentError: true },
  });

export type ReceiptDraft = {
  receipt_id: string;
  kind: ReceiptKind;
  photo_url: string | null;
  photo_url_expires_in: number | null;
};

export type PreparedReceiptPhoto = Pick<PreparedImage, "name" | "preview" | "bytes"> & { photo: File };

/** Faylni yuborishga tayyorlaydi: ≤ 5 MB JPEG (`PrepareImageError` — sabab bilan). */
export const prepareReceiptPhoto = async (file: File): Promise<PreparedReceiptPhoto> => {
  const prepared = await prepareImage(file, { maxBytes: RECEIPT_PHOTO_MAX_BYTES });
  const bytes = Uint8Array.from(atob(prepared.data_base64), (char) => char.charCodeAt(0));
  return {
    name: prepared.name,
    preview: prepared.preview,
    bytes: prepared.bytes,
    photo: new File([bytes], prepared.name, { type: prepared.media_type }),
  };
};

export type UploadReceiptInput = {
  kind: ReceiptKind;
  file: File;
  signal?: AbortSignal;
  /** Rasm tayyor (kichraytirildi) — yuborish boshlanadi: eskiz va asl/yakuniy hajm shu yerdan. */
  onPrepared?: (prepared: PreparedReceiptPhoto) => void;
  /** Yuborilgan ulush, 0–100. */
  onProgress?: (percent: number) => void;
};

/** `POST finance/receipts`: kichraytirish + multipart. Javob — qoralama (`receipt_id` formaga yoziladi). */
export const useUploadReceipt = () =>
  useMutation({
    mutationFn: async ({ kind, file, signal, onPrepared, onProgress }: UploadReceiptInput): Promise<ReceiptDraft> => {
      const prepared = await prepareReceiptPhoto(file);
      signal?.throwIfAborted();
      onPrepared?.(prepared);
      const form = new FormData();
      form.append("kind", kind);
      form.append("photo", prepared.photo);
      const response = await api.post(API_ENDPOINTS.CASHBOX.RECEIPTS, form, {
        timeout: LONG_REQUEST_TIMEOUT_MS,
        signal,
        onUploadProgress: (event) => {
          const total = event.total ?? prepared.bytes;
          if (total > 0) onProgress?.(Math.min(100, Math.round((event.loaded / total) * 100)));
        },
      });
      const data = payload(response.data);
      const receiptId = text(data.receipt_id);
      if (!receiptId) throw new Error("receipt_id missing");
      return {
        receipt_id: receiptId,
        kind,
        photo_url: text(data.photo_url),
        photo_url_expires_in: typeof data.photo_url_expires_in === "number" ? data.photo_url_expires_in : null,
      };
    },
  });

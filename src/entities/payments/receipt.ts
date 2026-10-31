import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
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
 *  - `PATCH finance/receipt-settings` — faqat superadmin (`RECEIPT_AI_REQUIRES_PHOTO`: AI yoqiq + rasm o'chiq);
 *  - kassa tarixi qatorlarida `receipt: { id, ai_status } | null`, filtr `receipt_status`; to'liq ko'rinish
 *    `GET finance/receipts/:id` (rasm havolasi har so'rovda yangi, 300 s), qayta tahlil `POST …/reanalyze` (202);
 *  - realtime `finance.receipt.checked` (`app/providers/realtimeFinance`) — so'rovlar qayta o'qiladi (natija sahifa
 *    yangilanmay ko'rinadi); socket bo'lmasa — `pending` paytida 5 s lik so'rov, `ai_stale` kelguncha.
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

/** «Chek holati» filtri: AI holatlari + `none` («Chek yo'q» — chek so'raladigan, lekin cheksiz qator). */
export const RECEIPT_FILTER_STATUSES = ["match", "mismatch", "unreadable", "pending", "error", "disabled", "none"] as const;
export type ReceiptFilterStatus = (typeof RECEIPT_FILTER_STATUSES)[number];

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

/** Tarix qatoridagi qisqa ko'rinish. */
export type ReceiptRef = { id: string; ai_status: ReceiptAiStatus };

/** `receipt` maydoni → qisqa ko'rinish; chek yo'q yoki noma'lum holat — `null`. */
export const toReceiptRef = (value: unknown): ReceiptRef | null => {
  const row = record(value);
  const id = text(row.id);
  const status = toReceiptAiStatus(row.ai_status);
  return id && status ? { id, ai_status: status } : null;
};

export type ReceiptAiResult = {
  amount: number | null;
  difference: number | null;
  currency: string | null;
  /** Rasmdan o'qilgan sana — erkin matn. */
  date: string | null;
  recipient: string | null;
  recipient_last4: string | null;
  payer: string | null;
  payer_last4: string | null;
  bank: string | null;
  reference: string | null;
  /** 0–1. */
  confidence: number | null;
  flags: string[];
  checked_at: string | null;
  attempts: number;
  max_attempts: number;
  error_reason: string | null;
};

export type ReceiptDetail = {
  id: string;
  kind: ReceiptKind | null;
  history_id: string | null;
  counter_history_id: string | null;
  entered_amount: number | null;
  payment_method: string | null;
  photo_url: string | null;
  photo_url_expires_in: number | null;
  uploaded_by: { id: string | null; name: string | null } | null;
  uploaded_at: string | null;
  ai_status: ReceiptAiStatus;
  /** `pending` 3 daqiqadan oshdi. */
  ai_stale: boolean;
  can_reanalyze: boolean;
  ai: ReceiptAiResult | null;
};

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeReceiptDetail = (value: unknown): ReceiptDetail | null => {
  const data = payload(value);
  const id = text(data.id);
  const status = toReceiptAiStatus(data.ai_status);
  if (!id || !status) return null;
  const uploadedBy = record(data.uploaded_by);
  const ai = data.ai && typeof data.ai === "object" ? record(data.ai) : null;
  const kind = String(data.kind ?? "");
  return {
    id,
    kind: (RECEIPT_KINDS as readonly string[]).includes(kind) ? (kind as ReceiptKind) : null,
    history_id: text(data.history_id),
    counter_history_id: text(data.counter_history_id),
    entered_amount: num(data.entered_amount),
    payment_method: text(data.payment_method),
    photo_url: text(data.photo_url),
    photo_url_expires_in: num(data.photo_url_expires_in),
    uploaded_by: data.uploaded_by ? { id: text(uploadedBy.id), name: text(uploadedBy.name) } : null,
    uploaded_at: text(data.uploaded_at),
    ai_status: status,
    ai_stale: data.ai_stale === true,
    can_reanalyze: data.can_reanalyze === true,
    ai: ai
      ? {
          amount: num(ai.amount),
          difference: num(ai.difference),
          currency: text(ai.currency),
          date: text(ai.date),
          recipient: text(ai.recipient),
          recipient_last4: text(ai.recipient_last4),
          payer: text(ai.payer),
          payer_last4: text(ai.payer_last4),
          bank: text(ai.bank),
          reference: text(ai.reference),
          confidence: num(ai.confidence),
          flags: Array.isArray(ai.flags) ? ai.flags.filter((flag): flag is string => typeof flag === "string") : [],
          checked_at: text(ai.checked_at),
          attempts: num(ai.attempts) ?? 0,
          max_attempts: num(ai.max_attempts) ?? 5,
          error_reason: text(ai.error_reason),
        }
      : null,
  };
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

export type UpdateReceiptSettingsRequest = Partial<Record<ReceiptSettingGroup, Partial<ReceiptGroupSettings>>>;

/** `PATCH finance/receipt-settings` — faqat o'zgargan kalitlar; muvaffaqiyatda sozlama qayta o'qiladi. */
export const useUpdateReceiptSettings = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateReceiptSettingsRequest) =>
      api.patch(API_ENDPOINTS.CASHBOX.RECEIPT_SETTINGS, body).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: receiptSettingsKey }),
  });
};

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

const receiptRootKey = "finance-receipt";
export const receiptKey = (id: string) => [receiptRootKey, id] as const;

/** `pending` paytida so'rov oralig'i (realtime kelmasa ham natija chiqsin). */
export const RECEIPT_PENDING_POLL_MS = 5000;

/**
 * `GET finance/receipts/:id`. `pending` da 5 s da qayta o'qiladi; server `ai_stale` (3 daqiqadan oshdi) desa so'rov
 * to'xtaydi — UI «AI natijasi kelmadi» va «Qayta tahlil». Havola 300 s yashaydi: ko'ruvchi rasm ochilmasa qayta so'raydi.
 */
export const useReceipt = (id: string | null | undefined, options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: receiptKey(String(id ?? "")),
    queryFn: () =>
      api.get(API_ENDPOINTS.CASHBOX.RECEIPT(String(id))).then((res) => normalizeReceiptDetail(res.data)),
    enabled: Boolean(id) && (options.enabled ?? true),
    refetchInterval: (query) => {
      const receipt = query.state.data;
      return receipt?.ai_status === "pending" && !receipt.ai_stale ? RECEIPT_PENDING_POLL_MS : false;
    },
    meta: { silentError: true },
  });

/** Chek holati o'zgardi: tafsilot va kassa tarixi ro'yxatlari (ochiq sahifalar) qayta o'qiladi. */
export const refreshReceiptQueries = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: [receiptRootKey], refetchType: "active" }),
    client.invalidateQueries({ queryKey: ["cashbox"], refetchType: "active" }),
    client.invalidateQueries({ queryKey: ["finance-history"], refetchType: "active" }),
  ]);

/**
 * `POST finance/receipts/:id/reanalyze` (superadmin/admin, 202). Rad: `RECEIPT_ALREADY_MATCHED` / `RECEIPT_AI_PENDING` 409,
 * `RECEIPT_AI_DISABLED` 400, `RECEIPT_AI_ATTEMPTS_EXHAUSTED` 429. Natija qanday bo'lsa ham holat qayta o'qiladi.
 */
export const useReanalyzeReceipt = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(API_ENDPOINTS.CASHBOX.RECEIPT_REANALYZE(id)).then((res) => res.data),
    onSettled: () => refreshReceiptQueries(client),
  });
};

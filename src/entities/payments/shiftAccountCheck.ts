import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS } from "../../shared/api";
import { api, LONG_REQUEST_TIMEOUT_MS } from "../../shared/api/api";

/**
 * SMENA YOPILISHI: HAR KARTA / HISOB QOLDIG'INI TASDIQLASH (kiZgTybn, backend `docs/frontend/FRONTEND_CHANGELOG.md`
 * 2026-10-26). Bu modul — kontrakt turlari, normalizatorlar, backend 400 qoidalarining AYNAN nusxasi
 * (`shift-account-check.rules.ts`) va so'rovlar:
 *  - `GET finance/shift/settings` — global `account_check_enabled` / `photo_required` / `ai_check_enabled` va kassa
 *    kartalari (hisoblangan `photo_required` / `ai_enabled`); `PATCH` — faqat superadmin;
 *  - `POST finance/shift/account-photo` (multipart `photo` jpeg/png/webp ≤ 5 MB, `card_id`, `shift_id`,
 *    `entered_balance?`, `comment?`) → `data.check` (qoralama qatori), AI yoqilgan kartada `ai_status = pending`;
 *  - `GET finance/shift/:id/report` — naqd + karta + `accounts[]` (ochiq smenada ham — yopish oynasining qoralamalari
 *    shu yerdan o'qiladi), `accounts_summary`, `operations[]`;
 *  - realtime `finance.shift.account_checked` → `[shift]` so'rovlari qayta o'qiladi (`app/providers/realtimeFinance`),
 *    ya'ni oynadagi AI holati jonli yangilanadi; socket bo'lmasa — `pending` paytida 5 s lik so'rov.
 *
 * 2026-10-26 (y8Tqm9Ap, gWI4gYkw): sozlamalarda `auto_close` (`enabled`, `times[]` — Toshkent `HH:MM`, `scope`,
 * `warn_before_min`) va `report` (`recipients` superadmin / couriers / markets × `telegram` / `in_app`, `format`
 * pdf | xlsx); hisobotda `close_reason` (manual | auto), `closed_by_system`, `auto_close` (`{closed_at, label}` —
 * sariq banner), `report` (yuborish holati, fayl — faqat superadmin) va `deliveries[]` («Hisobot kimlarga
 * yuborildi», faqat superadmin); `POST finance/shift/:id/report/resend` — qayta yuborish (faqat superadmin).
 */

const shiftKey = "shift";
const cashboxKey = "cashbox";

export const SHIFT_AI_STATUSES = [
  "not_required",
  "pending",
  "match",
  "mismatch",
  "unreadable",
  "disabled",
  "error",
] as const;
export type ShiftAiStatus = (typeof SHIFT_AI_STATUSES)[number];

/** Backend `AI_MATCH_TOLERANCE`: |farq| ≤ 1 so'm — mos. */
export const SHIFT_AI_MATCH_TOLERANCE = 1;
/** Rasm chegaralari (gateway `SHIFT_PHOTO_*`). */
export const SHIFT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const SHIFT_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** `pending` paytida so'rov oralig'i (realtime kelmasa ham holat yangilansin). */
export const SHIFT_PENDING_POLL_MS = 5000;
/** Yopish AI natijasini 30 s gacha kutadi (gateway 45 s) — mijoz kutishi undan uzunroq. */
export const SHIFT_CLOSE_TIMEOUT_MS = 60_000;

export type ShiftCheckCardSettings = {
  card_id: string;
  name: string;
  kind: string | null;
  bank_name: string | null;
  last4: string | null;
  is_default: boolean;
  require_photo_on_shift_close: boolean;
  ai_check_enabled: boolean;
  /** Hisoblangan: global `photo_required` && karta `require_photo_on_shift_close`. */
  photo_required: boolean;
  /** Hisoblangan: global `ai_check_enabled` && karta `ai_check_enabled`. */
  ai_enabled: boolean;
};

/** y8Tqm9Ap: avtomatik yopish qamrovi — faqat asosiy kassa yoki filial kassalari ham. */
export const SHIFT_AUTO_CLOSE_SCOPES = ["main", "main+branches"] as const;
export type ShiftAutoCloseScope = (typeof SHIFT_AUTO_CLOSE_SCOPES)[number];
/** Backend chegaralari (`shift-schedule.rules.ts`): kuniga 1–12 marta, ogohlantirish 0–180 daqiqa (0 — yo'q). */
export const SHIFT_AUTO_CLOSE_MAX_TIMES = 12;
export const SHIFT_AUTO_CLOSE_MAX_WARN_MIN = 180;
export const SHIFT_AUTO_CLOSE_DEFAULT_WARN_MIN = 15;
const SHIFT_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isShiftCloseTime = (value: unknown): value is string =>
  typeof value === "string" && SHIFT_TIME_RE.test(value.trim());

export type ShiftAutoCloseSettings = {
  enabled: boolean;
  /** Toshkent vaqti `HH:MM`, o'sish tartibida, takrorsiz. */
  times: string[];
  scope: ShiftAutoCloseScope;
  /** 0 — ogohlantirish yo'q. */
  warn_before_min: number;
};

/** gWI4gYkw: hisobot qabul qiluvchilari guruhlari va kanallari. */
export const SHIFT_REPORT_RECIPIENT_GROUPS = ["superadmin", "couriers", "markets"] as const;
export type ShiftReportRecipientGroup = (typeof SHIFT_REPORT_RECIPIENT_GROUPS)[number];
export type ShiftReportChannels = { telegram: boolean; in_app: boolean };
export const SHIFT_REPORT_FORMATS = ["pdf", "xlsx"] as const;
export type ShiftReportFormat = (typeof SHIFT_REPORT_FORMATS)[number];
export type ShiftReportSendSettings = {
  recipients: Record<ShiftReportRecipientGroup, ShiftReportChannels>;
  format: ShiftReportFormat;
};

export type ShiftCheckSettings = {
  account_check_enabled: boolean;
  photo_required: boolean;
  ai_check_enabled: boolean;
  cashbox_user_id: string | null;
  cashbox_type: "main" | "branch" | null;
  cards: ShiftCheckCardSettings[];
  /** y8Tqm9Ap — javobda yo'q bo'lsa (eski backend) `null`: blok chizilmaydi. */
  auto_close: ShiftAutoCloseSettings | null;
  /** gWI4gYkw — javobda yo'q bo'lsa `null`. */
  report: ShiftReportSendSettings | null;
};

export type ShiftAccountCard = {
  id: string;
  name: string;
  kind: string | null;
  bank_name: string | null;
  card_network: string | null;
  last4: string | null;
  is_default: boolean;
};

export type ShiftAccountCheck = {
  id: string | null;
  card_id: string;
  card: ShiftAccountCard | null;
  expected_balance: number | null;
  entered_balance: number | null;
  difference: number | null;
  has_photo: boolean;
  photo_url: string | null;
  photo_uploaded_at: string | null;
  ai_status: ShiftAiStatus;
  ai_read_balance: number | null;
  ai_last4_detected: string | null;
  ai_entered_ok: boolean | null;
  ai_checked_at: string | null;
  comment: string | null;
  comment_required: boolean;
  photo_required_snap: boolean | null;
  ai_enabled_snap: boolean | null;
};

export type ShiftReportMoney = {
  opening_balance: number | null;
  total_income: number | null;
  total_expense: number | null;
  expected_balance: number | null;
  closing_balance: number | null;
  discrepancy: number | null;
};

export type ShiftReportOperation = {
  operation_type: string;
  payment_method: string | null;
  count: number;
  total: number;
};

/** y8Tqm9Ap: smena qanday yopilgan (ochiq — `null`). */
export type ShiftCloseReason = "manual" | "auto";

/** gWI4gYkw: hisobot yuborish holati (`shifts.report_status`). */
export type ShiftReportSendStatus = "pending" | "processing" | "sent" | "skipped" | "failed";
const SHIFT_REPORT_SEND_STATUSES: readonly ShiftReportSendStatus[] = ["pending", "processing", "sent", "skipped", "failed"];

export type ShiftReportDeliveryStatus = "queued" | "sent" | "failed" | "skipped";
const SHIFT_REPORT_DELIVERY_STATUSES: readonly ShiftReportDeliveryStatus[] = ["queued", "sent", "failed", "skipped"];
export type ShiftReportDeliveryChannel = "in_app" | "telegram" | "telegram_group";
const SHIFT_REPORT_DELIVERY_CHANNELS: readonly ShiftReportDeliveryChannel[] = ["in_app", "telegram", "telegram_group"];
export type ShiftReportRecipientKind = "superadmin" | "courier" | "market";
const SHIFT_REPORT_RECIPIENT_KINDS: readonly ShiftReportRecipientKind[] = ["superadmin", "courier", "market"];

/** «Hisobot kimlarga yuborildi» qatori (faqat superadmin ko'radi; boshqalarga bo'sh massiv). */
export type ShiftReportDelivery = {
  id: string | null;
  round: number;
  recipient_id: string;
  recipient_name: string | null;
  recipient_kind: ShiftReportRecipientKind;
  channel: ShiftReportDeliveryChannel;
  status: ShiftReportDeliveryStatus;
  /** Masalan «Telegram ulanmagan». */
  failed_reason: string | null;
  sent_at: string | null;
  created_at: string | null;
};

export type ShiftReportSendState = {
  status: ShiftReportSendStatus | null;
  round: number;
  file_format: ShiftReportFormat | null;
  has_file: boolean;
  /** Imzolangan havola (300 s) — faqat superadmin. */
  file_url: string | null;
};

export type ShiftReport = {
  shift: {
    id: string;
    status: "open" | "closed";
    opened_at: string | null;
    closed_at: string | null;
    opened_by_name: string | null;
    closed_by_name: string | null;
    comment: string | null;
  };
  cashbox_type: "main" | "branch" | null;
  cash: ShiftReportMoney;
  card: ShiftReportMoney;
  accounts: ShiftAccountCheck[];
  accounts_summary: Record<string, number> | null;
  operations: ShiftReportOperation[];
  close_reason: ShiftCloseReason | null;
  closed_by_system: boolean;
  /** Avtomatik yopilgan smena — sariq banner (`label` — backend matni «Avtomatik yopildi — HH:MM, kassir yopmagan»). */
  auto_close: { closed_at: string | null; label: string | null } | null;
  report: ShiftReportSendState | null;
  deliveries: ShiftReportDelivery[];
};

/** Yopish so'rovidagi bitta karta qatori (`POST finance/shift/close` → `accounts[]`). */
export type CloseShiftAccount = {
  card_id: string;
  entered_balance: number;
  comment?: string;
};

export type UpdateShiftSettingsRequest = {
  account_check_enabled?: boolean;
  photo_required?: boolean;
  ai_check_enabled?: boolean;
  cards?: Array<{ card_id: string; require_photo_on_shift_close?: boolean; ai_check_enabled?: boolean }>;
  /** y8Tqm9Ap — qisman (faqat o'zgargan maydonlar). */
  auto_close?: Partial<ShiftAutoCloseSettings>;
  /** gWI4gYkw — qisman: `recipients` da faqat o'zgargan guruh/kanal, backend qolganini saqlaydi. */
  report?: {
    recipients?: Partial<Record<ShiftReportRecipientGroup, Partial<ShiftReportChannels>>>;
    format?: ShiftReportFormat;
  };
};

// ───────────────────────── normalizatorlar ─────────────────────────

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const text = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() ? value : null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const bool = (value: unknown): boolean => value === true || value === "true";
const boolOrNull = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

export const toShiftAiStatus = (value: unknown): ShiftAiStatus => {
  const raw = String(value ?? "").toLowerCase();
  return (SHIFT_AI_STATUSES as readonly string[]).includes(raw) ? (raw as ShiftAiStatus) : "not_required";
};

/** `response.data.data` yoki `response.data` — ikkalasi ham. */
const payload = (value: unknown): Record<string, unknown> => {
  const root = record(value);
  return "data" in root && root.data && typeof root.data === "object" ? record(root.data) : root;
};

/** `["23:00", "14:00", "14:00", "25:00"]` → `["14:00", "23:00"]` (yaroqsizlari tashlanadi). */
export const normalizeShiftCloseTimes = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter(isShiftCloseTime).map((item) => item.trim()))].sort() : [];

const normalizeAutoClose = (value: unknown): ShiftAutoCloseSettings | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = record(value);
  const warn = num(raw.warn_before_min);
  return {
    enabled: bool(raw.enabled),
    times: normalizeShiftCloseTimes(raw.times),
    scope: raw.scope === "main+branches" ? "main+branches" : "main",
    warn_before_min:
      warn !== null && Number.isInteger(warn) && warn >= 0 && warn <= SHIFT_AUTO_CLOSE_MAX_WARN_MIN
        ? warn
        : SHIFT_AUTO_CLOSE_DEFAULT_WARN_MIN,
  };
};

const normalizeReportSettings = (value: unknown): ShiftReportSendSettings | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = record(value);
  const recipients = record(raw.recipients);
  return {
    recipients: Object.fromEntries(
      SHIFT_REPORT_RECIPIENT_GROUPS.map((group) => {
        const channels = record(recipients[group]);
        return [group, { telegram: bool(channels.telegram), in_app: bool(channels.in_app) }];
      }),
    ) as Record<ShiftReportRecipientGroup, ShiftReportChannels>,
    format: raw.format === "xlsx" ? "xlsx" : "pdf",
  };
};

export const normalizeShiftCheckSettings = (value: unknown): ShiftCheckSettings => {
  const data = payload(value);
  const cards = Array.isArray(data.cards) ? data.cards : [];
  const cashboxType = data.cashbox_type === "main" || data.cashbox_type === "branch" ? data.cashbox_type : null;
  return {
    account_check_enabled: bool(data.account_check_enabled),
    photo_required: bool(data.photo_required),
    ai_check_enabled: bool(data.ai_check_enabled),
    cashbox_user_id: text(data.cashbox_user_id),
    cashbox_type: cashboxType,
    cards: cards
      .map((item) => {
        const card = record(item);
        const id = text(card.card_id ?? card.id);
        if (!id) return null;
        return {
          card_id: id,
          name: text(card.name) ?? "—",
          kind: text(card.kind),
          bank_name: text(card.bank_name),
          last4: text(card.last4),
          is_default: bool(card.is_default),
          require_photo_on_shift_close: bool(card.require_photo_on_shift_close),
          ai_check_enabled: bool(card.ai_check_enabled),
          photo_required: bool(card.photo_required),
          ai_enabled: bool(card.ai_enabled),
        } satisfies ShiftCheckCardSettings;
      })
      .filter((card): card is ShiftCheckCardSettings => card !== null),
    auto_close: normalizeAutoClose(data.auto_close),
    report: normalizeReportSettings(data.report),
  };
};

export const normalizeShiftAccountCheck = (value: unknown): ShiftAccountCheck | null => {
  const row = record(value);
  const cardId = text(row.card_id ?? row.cashbox_card_id);
  if (!cardId) return null;
  const rawCard = record(row.card);
  const card: ShiftAccountCard | null = text(rawCard.id ?? rawCard.name)
    ? {
        id: text(rawCard.id) ?? cardId,
        name: text(rawCard.name) ?? "—",
        kind: text(rawCard.kind),
        bank_name: text(rawCard.bank_name),
        card_network: text(rawCard.card_network),
        last4: text(rawCard.last4),
        is_default: bool(rawCard.is_default),
      }
    : null;
  return {
    id: text(row.id),
    card_id: cardId,
    card,
    expected_balance: num(row.expected_balance),
    entered_balance: num(row.entered_balance),
    difference: num(row.difference),
    has_photo: bool(row.has_photo) || Boolean(text(row.photo_url)),
    photo_url: text(row.photo_url),
    photo_uploaded_at: text(row.photo_uploaded_at),
    ai_status: toShiftAiStatus(row.ai_status),
    ai_read_balance: num(row.ai_read_balance),
    ai_last4_detected: text(row.ai_last4_detected),
    ai_entered_ok: boolOrNull(row.ai_entered_ok),
    ai_checked_at: text(row.ai_checked_at),
    comment: text(row.comment),
    comment_required: bool(row.comment_required),
    photo_required_snap: boolOrNull(row.photo_required_snap),
    ai_enabled_snap: boolOrNull(row.ai_enabled_snap),
  };
};

const normalizeMoneyBlock = (value: unknown): ShiftReportMoney => {
  const block = record(value);
  return {
    opening_balance: num(block.opening_balance),
    total_income: num(block.total_income),
    total_expense: num(block.total_expense),
    expected_balance: num(block.expected_balance),
    closing_balance: num(block.closing_balance),
    discrepancy: num(block.discrepancy),
  };
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null => {
  const raw = String(value ?? "").toLowerCase();
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
};

export const normalizeShiftReportDelivery = (value: unknown): ShiftReportDelivery | null => {
  const row = record(value);
  const recipientId = text(row.recipient_id);
  const kind = oneOf(row.recipient_kind, SHIFT_REPORT_RECIPIENT_KINDS);
  const channel = oneOf(row.channel, SHIFT_REPORT_DELIVERY_CHANNELS);
  if (!recipientId || !kind || !channel) return null;
  return {
    id: text(row.id),
    round: num(row.round) ?? 1,
    recipient_id: recipientId,
    recipient_name: text(row.recipient_name),
    recipient_kind: kind,
    channel,
    status: oneOf(row.status, SHIFT_REPORT_DELIVERY_STATUSES) ?? "queued",
    failed_reason: text(row.failed_reason),
    sent_at: text(row.sent_at),
    created_at: text(row.created_at),
  };
};

const normalizeReportSendState = (value: unknown): ShiftReportSendState | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = record(value);
  return {
    status: oneOf(raw.status, SHIFT_REPORT_SEND_STATUSES),
    round: num(raw.round) ?? 0,
    file_format: oneOf(raw.file_format, SHIFT_REPORT_FORMATS),
    has_file: bool(raw.has_file),
    file_url: text(raw.file_url),
  };
};

export const normalizeShiftReport = (value: unknown): ShiftReport | null => {
  const data = payload(value);
  const shiftRow = record(data.shift);
  const id = text(shiftRow.id);
  if (!id) return null;
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  const operations = Array.isArray(data.operations) ? data.operations : [];
  const summary = record(data.accounts_summary);
  const cashboxType = data.cashbox_type === "main" || data.cashbox_type === "branch" ? data.cashbox_type : null;
  const autoClose = record(data.auto_close);
  const closeReason = oneOf<ShiftCloseReason>(data.close_reason, ["manual", "auto"]);
  return {
    shift: {
      id,
      status: String(shiftRow.status ?? "").toLowerCase() === "closed" ? "closed" : "open",
      opened_at: text(shiftRow.opened_at),
      closed_at: text(shiftRow.closed_at),
      opened_by_name: text(shiftRow.opened_by_name),
      closed_by_name: text(shiftRow.closed_by_name),
      comment: text(shiftRow.comment),
    },
    cashbox_type: cashboxType,
    cash: normalizeMoneyBlock(data.cash),
    card: normalizeMoneyBlock(data.card),
    accounts: accounts
      .map(normalizeShiftAccountCheck)
      .filter((row): row is ShiftAccountCheck => row !== null),
    accounts_summary: data.accounts_summary
      ? Object.fromEntries(Object.entries(summary).map(([key, count]) => [key, num(count) ?? 0]))
      : null,
    operations: operations.map((item) => {
      const op = record(item);
      return {
        operation_type: text(op.operation_type) ?? "",
        payment_method: text(op.payment_method),
        count: num(op.count) ?? 0,
        total: num(op.total) ?? 0,
      };
    }),
    close_reason: closeReason,
    closed_by_system: bool(data.closed_by_system),
    auto_close:
      closeReason === "auto" || (data.auto_close && typeof data.auto_close === "object")
        ? { closed_at: text(autoClose.closed_at) ?? text(shiftRow.closed_at), label: text(autoClose.label) }
        : null,
    report: normalizeReportSendState(data.report),
    deliveries: (Array.isArray(data.deliveries) ? data.deliveries : [])
      .map(normalizeShiftReportDelivery)
      .filter((row): row is ShiftReportDelivery => row !== null),
  };
};

// ───────────────────────── qoidalar (backend nusxasi) ─────────────────────────

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Backend `deriveEnteredOk`: kiritilgan qiymat rasmdagisi bilan bir xilmi (±1 so'm). */
export const deriveEnteredOk = (entered: number | null, read: number | null): boolean | null => {
  if (entered === null || read === null) return null;
  return Math.abs(entered - read) <= SHIFT_AI_MATCH_TOLERANCE;
};

/** Backend `isCommentRequired`: farq ≠ 0, AI `mismatch` yoki kiritilgan ≠ rasmdagi — izoh majburiy. */
export const isAccountCommentRequired = (input: {
  difference: number | null;
  ai_status: ShiftAiStatus | null;
  ai_entered_ok: boolean | null;
}): boolean =>
  (input.difference !== null && round2(input.difference) !== 0) ||
  input.ai_status === "mismatch" ||
  input.ai_entered_ok === false;

export type ShiftAccountRowError = "entered" | "photo" | "comment";

export type ShiftAccountRowState = {
  /** Kiritilgan qoldiq (bo'sh — `null`). */
  entered: number | null;
  /** Tizim bo'yicha kutilgan (noma'lum — `null`: farqni yopishda backend hisoblaydi). */
  expected: number | null;
  photoRequired: boolean;
  hasPhoto: boolean;
  aiStatus: ShiftAiStatus;
  aiReadBalance: number | null;
  comment: string;
};

/** Qatorning hosila holati: farq, `ai_entered_ok`, izoh majburiyligi va xatolar (yuborishdan oldin). */
export const evaluateShiftAccountRow = (row: ShiftAccountRowState) => {
  const difference = row.entered !== null && row.expected !== null ? round2(row.entered - row.expected) : null;
  const enteredOk = deriveEnteredOk(row.entered, row.aiReadBalance);
  const commentRequired = isAccountCommentRequired({
    difference,
    ai_status: row.aiStatus,
    ai_entered_ok: enteredOk,
  });
  const errors: ShiftAccountRowError[] = [];
  if (row.entered === null) errors.push("entered");
  if (row.photoRequired && !row.hasPhoto) errors.push("photo");
  if (commentRequired && !row.comment.trim()) errors.push("comment");
  return { difference, enteredOk, commentRequired, errors };
};

/** Rasmni yuklashdan oldin mijoz tomonida: tur va hajm (backend ham tekshiradi — 400 / 413). */
export const validateShiftPhoto = (file: Pick<File, "type" | "size">): "type" | "size" | null => {
  const type = String(file.type ?? "").toLowerCase();
  if (!(SHIFT_PHOTO_MIME_TYPES as readonly string[]).includes(type === "image/jpg" ? "image/jpeg" : type)) {
    return "type";
  }
  if (file.size > SHIFT_PHOTO_MAX_BYTES) return "size";
  return null;
};

// ───────────────────────── so'rovlar ─────────────────────────

export const shiftCheckSettingsKey = [shiftKey, "check-settings"] as const;
export const shiftReportKey = (id: string) => [shiftKey, "report", id] as const;
export const cashboxCardsKey = [cashboxKey, "cards"] as const;

/** `GET finance/shift/settings` — yopuvchi rollar o'qiydi; xato (403) — tasdiqlash o'chiq deb hisoblanadi. */
export const useShiftCheckSettings = (enabled = true) =>
  useQuery({
    queryKey: shiftCheckSettingsKey,
    queryFn: () => api.get(API_ENDPOINTS.CASHBOX.SHIFT_SETTINGS).then((res) => normalizeShiftCheckSettings(res.data)),
    enabled,
    meta: { silentError: true },
  });

export const useUpdateShiftCheckSettings = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateShiftSettingsRequest) =>
      api.patch(API_ENDPOINTS.CASHBOX.SHIFT_SETTINGS, body).then((res) => res.data),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: shiftCheckSettingsKey }),
        client.invalidateQueries({ queryKey: cashboxCardsKey }),
      ]);
    },
  });
};

const hasPending = (report: ShiftReport | null | undefined) =>
  Boolean(report?.accounts.some((row) => row.ai_status === "pending"));

/**
 * `GET finance/shift/:id/report`. `pollPending` — AI `pending` qatori bor ekan 5 s da qayta o'qiladi (realtime
 * `finance.shift.account_checked` ham `[shift]` ni yangilaydi — bu faqat zaxira).
 */
export const useShiftReport = (id: string | null | undefined, options: { enabled?: boolean; pollPending?: boolean } = {}) =>
  useQuery({
    queryKey: shiftReportKey(String(id ?? "")),
    queryFn: () =>
      api.get(API_ENDPOINTS.CASHBOX.SHIFT_REPORT(String(id))).then((res) => normalizeShiftReport(res.data)),
    enabled: Boolean(id) && (options.enabled ?? true),
    refetchInterval: (query) => (options.pollPending && hasPending(query.state.data) ? SHIFT_PENDING_POLL_MS : false),
    meta: options.pollPending ? { silentError: true } : undefined,
  });

export type ResendShiftReportResult = { round: number | null; status: string | null; deliveries: ShiftReportDelivery[] };

/**
 * gWI4gYkw: `POST finance/shift/:id/report/resend` — faqat superadmin, yangi raund (ochiq smena / hozir
 * yuborilayotgan — 400). Muvaffaqiyatda hisobot qayta o'qiladi («Hisobot kimlarga yuborildi» yangilanadi).
 */
export const useResendShiftReport = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (shiftId: string) =>
      api.post(API_ENDPOINTS.CASHBOX.SHIFT_REPORT_RESEND(shiftId)).then((res): ResendShiftReportResult => {
        const data = payload(res.data);
        return {
          round: num(data.round),
          status: text(data.status),
          deliveries: (Array.isArray(data.deliveries) ? data.deliveries : [])
            .map(normalizeShiftReportDelivery)
            .filter((row): row is ShiftReportDelivery => row !== null),
        };
      }),
    onSuccess: (_result, shiftId) => client.invalidateQueries({ queryKey: shiftReportKey(shiftId) }),
  });
};

export type CashboxCardBalance = { id: string; balance: number | null };

/**
 * `GET finance/cashbox/cards` — har kartaning JONLI tizim qoldig'i (Asosiy karta — `balance_card − Σ nomli`).
 * Registrator uchun ruxsat yo'q (403) — kutilgan «—», yakuniy farqni yopishda backend hisoblaydi.
 */
export const useCashboxCardBalances = (enabled = true) =>
  useQuery({
    queryKey: cashboxCardsKey,
    queryFn: () =>
      api.get(API_ENDPOINTS.CASHBOX.CARDS).then((res): CashboxCardBalance[] => {
        const data = payload(res.data);
        const cards = Array.isArray(data.cards) ? data.cards : [];
        return cards
          .map((item) => {
            const card = record(item);
            const id = text(card.id);
            return id ? { id, balance: num(card.balance) } : null;
          })
          .filter((card): card is CashboxCardBalance => card !== null);
      }),
    enabled,
    meta: { silentError: true },
  });

export type UploadShiftAccountPhotoInput = {
  shiftId: string;
  cardId: string;
  photo: File;
  enteredBalance?: number | null;
  comment?: string;
};

/** `POST finance/shift/account-photo` (multipart). Javob — qoralama qatori; smena hisoboti qayta o'qiladi. */
export const useUploadShiftAccountPhoto = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftId, cardId, photo, enteredBalance, comment }: UploadShiftAccountPhotoInput) => {
      const form = new FormData();
      form.append("photo", photo);
      form.append("card_id", cardId);
      form.append("shift_id", shiftId);
      if (enteredBalance !== null && enteredBalance !== undefined) {
        form.append("entered_balance", String(enteredBalance));
      }
      if (comment?.trim()) form.append("comment", comment.trim());
      return api
        .post(API_ENDPOINTS.CASHBOX.SHIFT_ACCOUNT_PHOTO, form, { timeout: LONG_REQUEST_TIMEOUT_MS })
        .then((res) => normalizeShiftAccountCheck(payload(res.data).check));
    },
    onSuccess: (_check, { shiftId }) => client.invalidateQueries({ queryKey: shiftReportKey(shiftId) }),
  });
};

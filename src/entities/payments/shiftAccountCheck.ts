import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS } from "../../shared/api";
import { api, LONG_REQUEST_TIMEOUT_MS } from "../../shared/api/api";
import { getApiErrorMessage } from "../../shared/lib/apiError";
import { prepareImage } from "../../shared/lib/downscaleImage";
import { getErrorStatus } from "../../shared/lib/errorKind";

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
 * BE-A (2026-11-10, backend PR #625): tasdiqlash endi kassa turiga qarab — ASOSIY kassa kaliti
 * (`shift.account_check.enabled`, sukut yoqiq) va FILIALLAR kaliti (`shift.account_check.branch_enabled`, sukut o'chiq).
 * GET javobidagi `account_check_enabled` — so'ralgan kassa uchun AMALDAGI qiymat (yopish oynasi shuni ishlatadi),
 * `main_account_check_enabled` / `branch_account_check_enabled` — ikkala global kalit (sozlamalar sahifasi). Eski backend
 * bu maydonlarni bermaydi — `null` (sahifa filial kalitini chizmaydi). Karta talabi — serverning hisoblagani
 * (`cards[].photo_required` / `ai_enabled`), bo'lmasa `master && karta bayrog'i` (`effectiveShiftCardFlags`).
 *
 * 2026-10-26 (y8Tqm9Ap, gWI4gYkw): sozlamalarda `auto_close` (`enabled`, `times[]` — Toshkent `HH:MM`, `scope`,
 * `warn_before_min`) va `report` (`recipients` superadmin / couriers / markets × `telegram` / `in_app`, `format`
 * pdf | xlsx); hisobotda `close_reason` (manual | auto), `closed_by_system`, `auto_close` (`{closed_at, label}` —
 * sariq banner), `report` (yuborish holati, fayl — faqat superadmin) va `deliveries[]` («Hisobot kimlarga
 * yuborildi», faqat superadmin); `POST finance/shift/:id/report/resend` — qayta yuborish (faqat superadmin).
 *
 * BE-B (2026-11-11, backend PR #629; ega qarori 2026-11-10): ASOSIY kassa smenasi jadval bo'yicha AVTOMATIK yopilsa,
 * superadmin / admin karta qoldig'i rasmini `closed_at` dan keyin 24 soat ichida yuklaydi —
 * `POST finance/shift/:shift_id/accounts/:card_id/late-photo` (multipart `photo`, `entered_balance`, `comment?`) → `data`
 * — hisobot qatori shaklida. Hisobot qatorida hisoblangan `photo_status` (uploaded | not_required | pending | missing),
 * `late_upload_deadline`, `late_uploaded`, `can_upload_late` (rolni gateway qo'shadi — menejer / registratorga `false`).
 * Eski backend bu maydonlarni bermaydi — `photo_status: null` (UI avvalgidek). Xatolar `code` bilan
 * (`SHIFT_LATE_PHOTO_ERROR_CODES`), matn — backenddan aynan.
 */

const shiftKey = "shift";
const cashboxKey = "cashbox";

/** BE-B: kartaning rasm holati (hisoblangan, DB'da yo'q). */
export const SHIFT_PHOTO_STATUSES = ["uploaded", "not_required", "pending", "missing"] as const;
export type ShiftPhotoStatus = (typeof SHIFT_PHOTO_STATUSES)[number];

/** BE-B: keyin yuklash izohi chegarasi (gateway `@MaxLength(1000)`). */
export const SHIFT_LATE_PHOTO_COMMENT_MAX = 1000;

/** BE-B: keyin yuklash xatolari (`code` — javob konvertining yuqori qatlamida; `EXPIRED` da `deadline` ham). */
export const SHIFT_LATE_PHOTO_ERROR_CODES = {
  /** 400 — filial kassasi smenasi. */
  mainOnly: "SHIFT_LATE_PHOTO_MAIN_ONLY",
  /** 409 — smena ochiq yoki qo'lda yopilgan. */
  notAutoClosed: "SHIFT_LATE_PHOTO_NOT_AUTO_CLOSED",
  /** 409 — 24 soatlik oyna tugagan (`deadline` — ISO). */
  expired: "SHIFT_LATE_PHOTO_EXPIRED",
  /** 404 — smena hisobotida bu karta qatori yo'q. */
  cardNotInShift: "SHIFT_LATE_PHOTO_CARD_NOT_IN_SHIFT",
} as const;
export type ShiftLatePhotoErrorCode = (typeof SHIFT_LATE_PHOTO_ERROR_CODES)[keyof typeof SHIFT_LATE_PHOTO_ERROR_CODES];

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
/**
 * AI `pending` shundan uzoq tursa (mijoz birinchi ko'rgan paytdan) 5 s lik so'rov to'xtaydi va «AI natijasi kelmadi»
 * ko'rsatiladi — ai-service javob bermasa sahifa cheksiz so'rov yubormasin. Realtime `finance.shift.account_checked`
 * kelsa — holat baribir yangilanadi; rasm qayta yuklansa (`photo_uploaded_at` yangi) hisob qaytadan boshlanadi.
 */
export const SHIFT_PENDING_MAX_MS = 3 * 60_000;
/**
 * Smenani yopish so'rovining kutish muddati — HAR yopishda (kartalar bo'lmasa ham: MAIN da backend «Asosiy karta»ni o'zi
 * yaratib tekshiradi). AI `pending` bo'lsa backend ~15 s kutadi (ega chegarasi 30 s, gateway 45 s) — mijoz undan uzunroq.
 */
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

/**
 * «Kun tartibi» (Ops, 2026-11-10; backend vazifasi — `finance/shift/settings` ga `auto_open`): belgilangan vaqtda
 * qamrovdagi kassada ochiq smena bo'lmasa — tizim o'zi ochadi. `times` va `scope` — `auto_close` qoidalari bilan bir xil
 * (kuniga 1–12, Toshkent `HH:MM`). Javobda yo'q (eski backend) — `null`, blok chizilmaydi.
 */
export type ShiftAutoOpenSettings = {
  enabled: boolean;
  times: string[];
  scope: ShiftAutoCloseScope;
};
/**
 * Kechikish xabari (`late_alert`, 2026-11-10): ochish / yopish vaqtidan `grace_min` daqiqa o'tib smena ochilmagan /
 * yopilmagan bo'lsa (yoki tizim ochish / yopishi xato bilan tugasa) — superadminlarga «Smena vaqtida ochilmadi /
 * yopilmadi». Kanallar — hisobot yuborishdagidek (Telegram / ilova ichida). Javobda yo'q — `null`.
 */
export const SHIFT_LATE_ALERT_MAX_GRACE_MIN = 180;
export const SHIFT_LATE_ALERT_DEFAULT_GRACE_MIN = 15;
export type ShiftLateAlertSettings = {
  enabled: boolean;
  grace_min: number;
  channels: ShiftReportChannels;
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
  /** SHU kassa (so'ralgan `cashbox_user_id`) uchun amaldagi qiymat — yopish oynasi shuni ishlatadi. */
  account_check_enabled: boolean;
  /** BE-A: ASOSIY kassa kaliti (`shift.account_check.enabled`); eski backend — `null`. */
  main_account_check_enabled: boolean | null;
  /** BE-A: FILIALLAR kaliti (`shift.account_check.branch_enabled`); eski backend — `null` (sahifada kalit chizilmaydi). */
  branch_account_check_enabled: boolean | null;
  photo_required: boolean;
  ai_check_enabled: boolean;
  cashbox_user_id: string | null;
  cashbox_type: "main" | "branch" | null;
  cards: ShiftCheckCardSettings[];
  /** y8Tqm9Ap — javobda yo'q bo'lsa (eski backend) `null`: blok chizilmaydi. */
  auto_close: ShiftAutoCloseSettings | null;
  /** «Kun tartibi» (2026-11-10) — javobda yo'q bo'lsa `null`: blok chizilmaydi. */
  auto_open: ShiftAutoOpenSettings | null;
  /** «Kun tartibi» (2026-11-10) — javobda yo'q bo'lsa `null`: blok chizilmaydi. */
  late_alert: ShiftLateAlertSettings | null;
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
  /** BE-B: rasm holati; eski backend bermaydi — `null` (hisobot avvalgidek chiziladi). */
  photo_status: ShiftPhotoStatus | null;
  /** BE-B: avto-yopilgan ASOSIY smenada `closed_at + 24 soat` (ISO; muddat o'tgach ham qoladi), aks holda `null`. */
  late_upload_deadline: string | null;
  /** BE-B: rasm smena yopilgandan KEYIN yuklangan. */
  late_uploaded: boolean;
  /** BE-B: «Rasm yuklash» tugmasi — avto-yopilgan ASOSIY smena, muddat ichida va so'rovchi superadmin / admin. */
  can_upload_late: boolean;
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
  /** BE-A: faqat ASOSIY kassa (eski backend — barcha kassalar). */
  account_check_enabled?: boolean;
  /** BE-A: filial kassalari kaliti. */
  branch_account_check_enabled?: boolean;
  photo_required?: boolean;
  ai_check_enabled?: boolean;
  cards?: Array<{ card_id: string; require_photo_on_shift_close?: boolean; ai_check_enabled?: boolean }>;
  /** y8Tqm9Ap — qisman (faqat o'zgargan maydonlar). */
  auto_close?: Partial<ShiftAutoCloseSettings>;
  /** «Kun tartibi» — qisman (faqat o'zgargan maydonlar). */
  auto_open?: Partial<ShiftAutoOpenSettings>;
  /** «Kun tartibi» — qisman: `channels` da faqat o'zgargan kanal. */
  late_alert?: { enabled?: boolean; grace_min?: number; channels?: Partial<ShiftReportChannels> };
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
/** Javobda bor-yo'qligi muhim maydon: `true` / `false` (satr ham) — qiymat, boshqasi (yo'q) — `null`. */
const flagOrNull = (value: unknown): boolean | null =>
  value === true || value === "true" ? true : value === false || value === "false" ? false : null;

/**
 * Kartaning amaldagi smena talabi: server hisoblagan `photo_required` / `ai_enabled` (`master && karta`) ustun; javobda
 * yo'q bo'lsa (eski backend) — o'sha qoida mijozda: global `photo_required` && `require_photo_on_shift_close`, global
 * `ai_check_enabled` && karta `ai_check_enabled`.
 */
export const effectiveShiftCardFlags = (
  card: Record<string, unknown>,
  masters: { photo_required: boolean; ai_check_enabled: boolean },
): { photo_required: boolean; ai_enabled: boolean } => ({
  photo_required: flagOrNull(card.photo_required) ?? (masters.photo_required && bool(card.require_photo_on_shift_close)),
  ai_enabled: flagOrNull(card.ai_enabled) ?? (masters.ai_check_enabled && bool(card.ai_check_enabled)),
});

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null => {
  const raw = String(value ?? "").toLowerCase();
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
};

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

const normalizeAutoOpen = (value: unknown): ShiftAutoOpenSettings | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = record(value);
  return {
    enabled: bool(raw.enabled),
    times: normalizeShiftCloseTimes(raw.times),
    scope: raw.scope === "main+branches" ? "main+branches" : "main",
  };
};

const normalizeLateAlert = (value: unknown): ShiftLateAlertSettings | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = record(value);
  const grace = num(raw.grace_min);
  const channels = record(raw.channels);
  return {
    enabled: bool(raw.enabled),
    grace_min:
      grace !== null && Number.isInteger(grace) && grace >= 0 && grace <= SHIFT_LATE_ALERT_MAX_GRACE_MIN
        ? grace
        : SHIFT_LATE_ALERT_DEFAULT_GRACE_MIN,
    channels: { telegram: bool(channels.telegram), in_app: bool(channels.in_app) },
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
  const masters = { photo_required: bool(data.photo_required), ai_check_enabled: bool(data.ai_check_enabled) };
  return {
    account_check_enabled: bool(data.account_check_enabled),
    main_account_check_enabled: flagOrNull(data.main_account_check_enabled),
    branch_account_check_enabled: flagOrNull(data.branch_account_check_enabled),
    ...masters,
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
          ...effectiveShiftCardFlags(card, masters),
        } satisfies ShiftCheckCardSettings;
      })
      .filter((card): card is ShiftCheckCardSettings => card !== null),
    auto_close: normalizeAutoClose(data.auto_close),
    auto_open: normalizeAutoOpen(data.auto_open),
    late_alert: normalizeLateAlert(data.late_alert),
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
    photo_status: oneOf(row.photo_status, SHIFT_PHOTO_STATUSES),
    late_upload_deadline: text(row.late_upload_deadline),
    late_uploaded: bool(row.late_uploaded),
    can_upload_late: bool(row.can_upload_late),
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

/**
 * Skrinshotni yuborishga tayyorlaydi (bphdLYJM): brauzerda kichraytirib ≤ 5 MB JPEG qiladi — telefon surati ko'pincha
 * 5 MB dan katta (chek rasmidagi `prepareReceiptPhoto` bilan bir xil yo'l). Xato — `PrepareImageError` (sabab bilan).
 */
export const prepareShiftPhoto = async (file: File): Promise<File> => (await prepareShiftPhotoWithPreview(file)).file;

/** `prepareShiftPhoto` + ko'rinish uchun `data:` URL (BE-B: keyin yuklash oynasida tanlangan rasm ko'rinadi). */
export const prepareShiftPhotoWithPreview = async (file: File): Promise<{ file: File; preview: string }> => {
  const prepared = await prepareImage(file, { maxBytes: SHIFT_PHOTO_MAX_BYTES });
  const bytes = Uint8Array.from(atob(prepared.data_base64), (char) => char.charCodeAt(0));
  return { file: new File([bytes], prepared.name, { type: prepared.media_type }), preview: prepared.preview };
};

// ───────────────────────── so'rovlar ─────────────────────────

export const shiftCheckSettingsKey = [shiftKey, "check-settings"] as const;
export const shiftReportKey = (id: string) => [shiftKey, "report", id] as const;
export const cashboxCardsKey = [cashboxKey, "cards"] as const;

/**
 * `GET finance/shift/settings` — yopuvchi rollar o'qiydi; xato (403) — tasdiqlash o'chiq deb hisoblanadi. `fresh` —
 * har yoqilganda serverdan qayta o'qiladi (smena yopish oynasi: kartalar va sozlama oyna ochilgan paytdagi holat bo'lsin,
 * aks holda yangi karta yoki yoqilgan kalit oynada ko'rinmay, backend 400 qaytaradi).
 */
export const useShiftCheckSettings = (enabled = true, { fresh = false }: { fresh?: boolean } = {}) =>
  useQuery({
    queryKey: shiftCheckSettingsKey,
    queryFn: () => api.get(API_ENDPOINTS.CASHBOX.SHIFT_SETTINGS).then((res) => normalizeShiftCheckSettings(res.data)),
    enabled,
    ...(fresh ? { staleTime: 0, refetchOnMount: "always" as const } : {}),
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

// ───────────────────────── AI `pending` muddati ─────────────────────────

/** `smena:karta:rasm vaqti` → mijoz `pending` ni birinchi ko'rgan lahza (server soatiga bog'liq emas). */
const pendingSeenAt = new Map<string, number>();
const pendingKey = (shiftId: string, row: Pick<ShiftAccountCheck, "card_id" | "photo_uploaded_at">) =>
  `${shiftId}:${row.card_id}:${row.photo_uploaded_at ?? ""}`;

/** `pending` qator birinchi ko'rilgan lahza (birinchi chaqiruvda yoziladi). */
export const shiftAiPendingSince = (
  shiftId: string,
  row: Pick<ShiftAccountCheck, "card_id" | "photo_uploaded_at">,
  now: number = Date.now(),
): number => {
  const key = pendingKey(shiftId, row);
  const seen = pendingSeenAt.get(key);
  if (seen !== undefined) return seen;
  pendingSeenAt.set(key, now);
  return now;
};

/** AI natijasi kutish muddatidan (3 daqiqa) o'tdimi — faqat `pending` qator uchun `true` bo'lishi mumkin. */
export const isShiftAiPendingStale = (
  shiftId: string,
  row: Pick<ShiftAccountCheck, "card_id" | "photo_uploaded_at" | "ai_status">,
  now: number = Date.now(),
): boolean => row.ai_status === "pending" && now - shiftAiPendingSince(shiftId, row, now) >= SHIFT_PENDING_MAX_MS;

/** Testlar uchun: kuzatuvni tozalash. */
export const resetShiftAiPendingTracker = () => pendingSeenAt.clear();

/** Muddati o'tmagan `pending` qator bormi — bo'lsa so'rov davom etadi. */
const hasFreshPending = (shiftId: string, report: ShiftReport | null | undefined, now: number = Date.now()) =>
  Boolean(report?.accounts.some((row) => row.ai_status === "pending" && !isShiftAiPendingStale(shiftId, row, now)));

/**
 * Kutish muddati o'tgan `pending` kartalar (`card_id`). Muddat kelganda o'zi qayta chiziladi (taymer), ya'ni
 * so'rov to'xtagach ham «AI natijasi kelmadi» o'z vaqtida chiqadi.
 */
export const useShiftAiTimedOut = (
  shiftId: string | null | undefined,
  accounts: readonly ShiftAccountCheck[] | null | undefined,
): ReadonlySet<string> => {
  const id = String(shiftId ?? "");
  const [now, setNow] = useState(() => Date.now());
  const pending = useMemo(() => (accounts ?? []).filter((row) => row.ai_status === "pending"), [accounts]);
  const next = pending
    .map((row) => shiftAiPendingSince(id, row) + SHIFT_PENDING_MAX_MS)
    .filter((deadline) => deadline > now)
    .sort((a, b) => a - b)[0];
  useEffect(() => {
    if (next === undefined) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, next - Date.now()) + 20);
    return () => clearTimeout(timer);
  }, [next]);
  return useMemo(
    () => new Set(pending.filter((row) => isShiftAiPendingStale(id, row, now)).map((row) => row.card_id)),
    [id, now, pending],
  );
};

/**
 * `GET finance/shift/:id/report`. `pollPending` — AI `pending` qatori bor ekan 5 s da qayta o'qiladi (realtime
 * `finance.shift.account_checked` ham `[shift]` ni yangilaydi — bu faqat zaxira); `pending` 3 daqiqadan oshsa
 * (`SHIFT_PENDING_MAX_MS`) so'rov to'xtaydi — UI «AI natijasi kelmadi» (`useShiftAiTimedOut`).
 */
export const useShiftReport = (id: string | null | undefined, options: { enabled?: boolean; pollPending?: boolean } = {}) =>
  useQuery({
    queryKey: shiftReportKey(String(id ?? "")),
    queryFn: () =>
      api.get(API_ENDPOINTS.CASHBOX.SHIFT_REPORT(String(id))).then((res) => normalizeShiftReport(res.data)),
    enabled: Boolean(id) && (options.enabled ?? true),
    refetchInterval: (query) =>
      options.pollPending && hasFreshPending(String(id ?? ""), query.state.data) ? SHIFT_PENDING_POLL_MS : false,
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

export type UploadShiftLatePhotoInput = {
  shiftId: string;
  cardId: string;
  /** Tayyorlangan (≤ 5 MB JPEG) rasm — `prepareShiftPhoto`. */
  photo: File;
  /** MAJBURIY, ≥ 0 (`0` ham qiymat). */
  enteredBalance: number;
  comment?: string;
};

/**
 * BE-B: `POST finance/shift/:shift_id/accounts/:card_id/late-photo` (multipart: `photo`, `entered_balance`, `comment?`).
 * 201 → `data` — yangilangan hisobot qatori: keshdagi hisobotda shu qator almashtiriladi va hisobot qayta o'qiladi.
 * 409 (`NOT_AUTO_CLOSED` / `EXPIRED`) va 404 (`CARD_NOT_IN_SHIFT`, smena yo'q) — hisobot qayta o'qiladi
 * (`can_upload_late` yangilanadi, tugma yashirinadi).
 */
export const useUploadShiftLatePhoto = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftId, cardId, photo, enteredBalance, comment }: UploadShiftLatePhotoInput) => {
      const form = new FormData();
      form.append("photo", photo);
      form.append("entered_balance", String(enteredBalance));
      const note = comment?.trim();
      if (note) form.append("comment", note);
      return api
        .post(API_ENDPOINTS.CASHBOX.SHIFT_ACCOUNT_LATE_PHOTO(shiftId, cardId), form, { timeout: LONG_REQUEST_TIMEOUT_MS })
        .then((res) => normalizeShiftAccountCheck(payload(res.data)));
    },
    onSuccess: (row, { shiftId }) => {
      if (row) {
        client.setQueryData<ShiftReport | null>(shiftReportKey(shiftId), (report) =>
          report
            ? { ...report, accounts: report.accounts.map((item) => (item.card_id === row.card_id ? row : item)) }
            : report,
        );
      }
      void client.invalidateQueries({ queryKey: shiftReportKey(shiftId) });
    },
    onError: (error, { shiftId }) => {
      const status = getErrorStatus(error);
      if (status === 409 || status === 404) void client.invalidateQueries({ queryKey: shiftReportKey(shiftId) });
    },
  });
};

export type ShiftLatePhotoError = {
  status: number | null;
  code: ShiftLatePhotoErrorCode | null;
  /** Backend matni (aynan); bo'lmasa — `null`. */
  message: string | null;
  /** `SHIFT_LATE_PHOTO_EXPIRED` da — muddat (ISO). */
  deadline: string | null;
  /** Qayta urinish foyda bermaydi (muddat o'tgan, avto-yopilmagan, karta yo'q, ruxsat yo'q). */
  terminal: boolean;
  /** 400 «… izoh majburiy» — kiritilgan qoldiq snapshot'dan farq qiladi. */
  commentRequired: boolean;
};

const LATE_PHOTO_CODES: readonly string[] = Object.values(SHIFT_LATE_PHOTO_ERROR_CODES);

/** Keyin yuklash xatosi: HTTP holati, `code`, backend matni (aynan) va `deadline`. */
export const readShiftLatePhotoError = (error: unknown): ShiftLatePhotoError => {
  const body = record(record(record(error).response).data);
  const rawCode = typeof body.code === "string" ? body.code.trim() : "";
  const code = LATE_PHOTO_CODES.includes(rawCode) ? (rawCode as ShiftLatePhotoErrorCode) : null;
  const status = getErrorStatus(error) ?? null;
  const message = getApiErrorMessage(error) || null;
  return {
    status,
    code,
    message,
    deadline: text(body.deadline),
    terminal: code !== null || status === 403 || status === 404,
    commentRequired: status === 400 && /izoh majburiy/iu.test(message ?? ""),
  };
};

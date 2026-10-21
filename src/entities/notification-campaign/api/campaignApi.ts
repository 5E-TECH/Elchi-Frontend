import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import type { AudienceTarget } from "../model/audience";
import {
  isCampaignDisplayStatus,
  type Campaign,
  type CampaignCreated,
  type CampaignListPage,
  type CampaignListParams,
  type CampaignPayload,
  type CampaignStatus,
} from "../model/campaign";

/**
 * Auditoriya va bildirishnoma kampaniyasi API'si (KM-2; backend `notification-campaign-gateway.controller.ts`,
 * superadmin/admin). Javoblar ehtiyotkor ochiladi — noma'lum maydon yiqitmaydi. Xom backend matni (`message`,
 * `hint`, `notes`, `last_error`) olinmaydi: foydalanuvchiga faqat i18n matn.
 */

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const unwrap = (payload: unknown) => {
  const record = asRecord(payload);
  return "data" in record &&
    record.data &&
    typeof record.data === "object" &&
    !Array.isArray(record.data)
    ? asRecord(record.data)
    : record;
};

const toCount = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** `null` — backend sanamagan (masalan auditoriya chegaradan katta — push soni yo'q). */
const toNullableCount = (value: unknown) =>
  value === null || value === undefined ? null : toCount(value);

const toText = (value: unknown): string | null =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : null;

const CAMPAIGN_STATUSES: readonly CampaignStatus[] = [
  "draft",
  "queued",
  "running",
  "done",
  "failed",
  "cancelled",
];
const toStatus = (value: unknown): CampaignStatus | null =>
  typeof value === "string" && (CAMPAIGN_STATUSES as readonly string[]).includes(value)
    ? (value as CampaignStatus)
    : null;

// ───────────────────────────── Auditoriya preview ─────────────────────────────

export interface AudienceSampleItem {
  id: string;
  role: string | null;
  /** Faqat maska (`***7434`) — to'liq raqam javobda yo'q. */
  phone: string | null;
}

export interface AudiencePreview {
  /** `false` — auditoriya kampaniya chegarasidan katta: son identity statistikasidan, push sanalmagan. */
  exact: boolean;
  total: number;
  byRole: Record<string, number>;
  /** Kamida bitta push obunasi bor foydalanuvchilar (qurilma emas). */
  push: number | null;
  dispatchMax: number | null;
  campaignMax: number | null;
  campaignAllowed: boolean;
  sample: AudienceSampleItem[] | null;
}

export const normalizeAudiencePreview = (payload: unknown): AudiencePreview => {
  const data = unwrap(payload);
  const total = toCount(data.total);
  const limits = asRecord(data.limits);
  const byChannel = asRecord(data.by_channel);
  const campaignMax = toNullableCount(limits.campaign_max);
  return {
    exact: data.exact !== false,
    total,
    byRole: Object.fromEntries(
      Object.entries(asRecord(data.by_role)).map(([role, n]) => [role, toCount(n)]),
    ),
    push: toNullableCount(byChannel.push),
    dispatchMax: toNullableCount(limits.dispatch_max),
    campaignMax,
    campaignAllowed:
      typeof data.campaign_allowed === "boolean"
        ? data.campaign_allowed
        : total > 0 && (campaignMax === null || total <= campaignMax),
    sample: Array.isArray(data.sample)
      ? data.sample.map((raw) => {
          const item = asRecord(raw);
          return { id: toText(item.id) ?? "", role: toText(item.role), phone: toText(item.phone) };
        })
      : null,
  };
};

/**
 * `POST /notifications/audience/preview` — HECH NARSA yuborilmaydi. Katta auditoriya sahifalab sanaladi (gateway
 * 30 s kutadi). `withSample` — 20 tagacha maskalangan qator («Namunani ko'rish»).
 */
export const previewAudience = async (
  target: AudienceTarget | { broadcast: true } | { recipient_ids: string[] },
  { withSample = false }: { withSample?: boolean } = {},
) =>
  normalizeAudiencePreview(
    (
      await api.post(API_ENDPOINTS.NOTIFICATIONS.AUDIENCE_PREVIEW, {
        ...target,
        ...(withSample ? { with_sample: true } : {}),
      })
    ).data,
  );

// ───────────────────────────── Saqlangan segmentlar ─────────────────────────────

export interface SavedAudienceSegment {
  id: string;
  name: string;
  description: string | null;
  /** Saqlangan SHART (`draftFromSavedAudience`). */
  audience: Record<string, unknown>;
  lastTotal: number | null;
  lastCountedAt: string | null;
}

const toSegment = (raw: unknown): SavedAudienceSegment => {
  const item = asRecord(raw);
  return {
    id: toText(item.id) ?? "",
    name: toText(item.name) ?? "",
    description: toText(item.description),
    audience: asRecord(item.audience),
    lastTotal: toNullableCount(item.last_total),
    lastCountedAt: toText(item.last_counted_at),
  };
};

export const normalizeSegments = (payload: unknown): SavedAudienceSegment[] => {
  const data = unwrap(payload);
  const items = Array.isArray(data.items) ? data.items : Array.isArray(payload) ? payload : [];
  return items.map(toSegment).filter((segment) => segment.id && segment.name);
};

export const getAudienceSegments = async () =>
  normalizeSegments((await api.get(API_ENDPOINTS.NOTIFICATIONS.AUDIENCE_SEGMENTS)).data);

export type CreateSegmentInput = AudienceTarget & { name: string; description?: string };

export const createAudienceSegment = async (input: CreateSegmentInput) =>
  toSegment(unwrap((await api.post(API_ENDPOINTS.NOTIFICATIONS.AUDIENCE_SEGMENTS, input)).data));

export const deleteAudienceSegment = async (id: string) => {
  await api.delete(API_ENDPOINTS.NOTIFICATIONS.AUDIENCE_SEGMENT_BY_ID(id));
};

// ───────────────────────────── Kampaniya ─────────────────────────────

export const normalizeCampaignCreated = (payload: unknown): CampaignCreated => {
  const data = unwrap(payload);
  return {
    campaign_id: toText(data.campaign_id) ?? "",
    status: toStatus(data.status),
    total: toCount(data.total),
    scheduled_at: toText(data.scheduled_at),
    duplicate: data.duplicate === true,
    quiet_hours_shifted: data.quiet_hours_shifted === true,
  };
};

/**
 * `POST /notifications/campaigns` — darhol 202 `{ campaign_id }`, yuborish fonda 200 tadan. `Idempotency-Key`
 * majburiy: ayni kalit bilan takror — mavjud kampaniya (200, `duplicate`), boshqa mazmun — 409.
 */
export const createCampaign = async (payload: CampaignPayload, idempotencyKey: string) =>
  normalizeCampaignCreated(
    (
      await api.post(API_ENDPOINTS.NOTIFICATIONS.CAMPAIGNS, payload, {
        headers: { "Idempotency-Key": idempotencyKey },
      })
    ).data,
  );

export const normalizeCampaign = (payload: unknown): Campaign => {
  const data = unwrap(payload);
  const total = toCount(data.total);
  const sent = toCount(data.sent);
  const failed = toCount(data.failed);
  const skipped = toCount(data.skipped);
  const pct = Number(data.progress_pct);
  return {
    id: toText(data.id) ?? "",
    status: toStatus(data.status),
    display_status: isCampaignDisplayStatus(data.display_status) ? data.display_status : null,
    title: toText(data.title) ?? "",
    category: toText(data.category),
    channels: Array.isArray(data.channels) ? data.channels.map(String) : [],
    audience: data.audience && typeof data.audience === "object" ? asRecord(data.audience) : null,
    total,
    sent,
    failed,
    skipped,
    progress_pct: Number.isFinite(pct)
      ? Math.min(100, Math.max(0, Math.round(pct)))
      : total
        ? Math.min(100, Math.round(((sent + failed + skipped) / total) * 100))
        : 0,
    created_at: toText(data.created_at),
    scheduled_at: toText(data.scheduled_at),
    finished_at: toText(data.finished_at),
    can_cancel: data.can_cancel === true,
    is_promo: data.is_promo === true,
  };
};

export const getCampaign = async (id: string) =>
  normalizeCampaign((await api.get(API_ENDPOINTS.NOTIFICATIONS.CAMPAIGN_BY_ID(id))).data);

/** `POST …/:id/cancel` — keyingi partiyalar boshlanmaydi; yakunlangan kampaniya — 409. */
export const cancelCampaign = async (id: string) =>
  normalizeCampaign((await api.post(API_ENDPOINTS.NOTIFICATIONS.CAMPAIGN_CANCEL(id))).data);

export const normalizeCampaignList = (payload: unknown): CampaignListPage => {
  const data = unwrap(payload);
  const items = (Array.isArray(data.items) ? data.items : []).map(normalizeCampaign);
  const meta = asRecord(data.meta);
  const limit = toCount(meta.limit) || 20;
  const total = toCount(meta.total);
  return {
    items,
    meta: {
      page: toCount(meta.page) || 1,
      limit,
      total,
      totalPages: toCount(meta.totalPages) || Math.max(1, Math.ceil(total / limit)),
    },
  };
};

/** `GET /notifications/campaigns` — tarix (yangisi birinchi), `state` — ro'yxat holati. */
export const getCampaigns = async (params: CampaignListParams = {}) =>
  normalizeCampaignList((await api.get(API_ENDPOINTS.NOTIFICATIONS.CAMPAIGNS, { params })).data);

export interface CampaignSchedulePolicy {
  /** Reklama taqiq oynasi (Toshkent, `HH:MM`); `enabled: false` — taqiq yo'q. */
  quietHours: { start: string; end: string; enabled: boolean } | null;
  /** `scheduled_at` tekshiruvi: surildimi va haqiqiy yuborish lahzasi. */
  check: { shifted: boolean; effectiveAt: string | null } | null;
}

export const normalizeSchedulePolicy = (payload: unknown): CampaignSchedulePolicy => {
  const data = unwrap(payload);
  const quiet = asRecord(data.promo_quiet_hours);
  const check = data.check && typeof data.check === "object" ? asRecord(data.check) : null;
  return {
    quietHours:
      typeof quiet.start === "string" && typeof quiet.end === "string"
        ? { start: quiet.start, end: quiet.end, enabled: quiet.enabled !== false }
        : null,
    check: check
      ? { shifted: check.shifted === true, effectiveAt: toText(check.effective_at) }
      : null,
  };
};

/** `GET …/schedule-policy` — reklama tungi taqiqi va vaqt tekshiruvi (hech narsa yaratilmaydi). */
export const getSchedulePolicy = async (params: { scheduled_at?: string; category?: string }) =>
  normalizeSchedulePolicy(
    (await api.get(API_ENDPOINTS.NOTIFICATIONS.CAMPAIGN_SCHEDULE_POLICY, { params })).data,
  );

/**
 * Hisobot va yetkazilmaganlar (KM-3 chizadi): ochilgan `data` obyekti qaytadi, maydonlarni KM-3 normallashtiradi.
 * Sabab matnlari (`reason`) xom — faqat kod xaritasi orqali ko'rsatiladi.
 */
export const getCampaignReport = async (id: string) =>
  unwrap((await api.get(API_ENDPOINTS.NOTIFICATIONS.CAMPAIGN_REPORT(id))).data);

export const getCampaignUndelivered = async (
  id: string,
  params: { page?: number; limit?: number } = {},
) => unwrap((await api.get(API_ENDPOINTS.NOTIFICATIONS.CAMPAIGN_UNDELIVERED(id), { params })).data);

/** `Blob` → matn (`blob.text` bo'lmagan muhitda — `FileReader`). */
const readBlobText = (blob: unknown): Promise<string> => {
  if (!(blob instanceof Blob)) return Promise.resolve(typeof blob === "string" ? blob : "");
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsText(blob);
  });
};

/** CSV (faqat superadmin): ≤10 000 — fayl (200), kattasi — fon vazifasi (202 `{ export_id }`). */
export type CampaignExportResult = { kind: "file"; blob: Blob } | { kind: "job"; exportId: string };

export const exportCampaignUndelivered = async (id: string): Promise<CampaignExportResult> => {
  const response = await api.get(API_ENDPOINTS.NOTIFICATIONS.CAMPAIGN_UNDELIVERED_EXPORT(id), {
    responseType: "blob",
  });
  const blob = response.data as Blob;
  if (response.status === 202) {
    const text = await readBlobText(blob);
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    return { kind: "job", exportId: toText(unwrap(parsed).export_id) ?? "" };
  }
  return { kind: "file", blob };
};

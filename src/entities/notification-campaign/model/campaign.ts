import type { Tone } from "../../../shared/ui/primitives";
import type { AudienceTarget } from "./audience";

/** Xom holat (`notification_campaigns.status`). */
export type CampaignStatus = "draft" | "queued" | "running" | "done" | "failed" | "cancelled";

/** Ro'yxat holati (backend `display_status`, WIsb9Ytq): rejalashtirilgan · yuborilmoqda · yuborilgan · xato · bekor. */
export const CAMPAIGN_DISPLAY_STATUSES = [
  "scheduled",
  "sending",
  "sent",
  "failed",
  "cancelled",
] as const;
export type CampaignDisplayStatus = (typeof CAMPAIGN_DISPLAY_STATUSES)[number];

/**
 * Holat → ton (maket `superadmin-notifications-send-audience` «Kampaniyalar tarixi», ega S3): rejalashtirilgan —
 * info, yuborilmoqda — warning, yuborilgan — success, xato — danger, bekor qilingan — danger (`outline`).
 */
export const CAMPAIGN_STATUS_META: Record<
  CampaignDisplayStatus,
  { tone: Tone; variant: "soft" | "outline"; labelKey: string }
> = {
  scheduled: { tone: "info", variant: "soft", labelKey: "campaign.status.scheduled" },
  sending: { tone: "warning", variant: "soft", labelKey: "campaign.status.sending" },
  sent: { tone: "success", variant: "soft", labelKey: "campaign.status.sent" },
  failed: { tone: "danger", variant: "soft", labelKey: "campaign.status.failed" },
  cancelled: { tone: "danger", variant: "outline", labelKey: "campaign.status.cancelled" },
};

export const isCampaignDisplayStatus = (value: unknown): value is CampaignDisplayStatus =>
  typeof value === "string" && (CAMPAIGN_DISPLAY_STATUSES as readonly string[]).includes(value);

/** Kampaniya hali ishlayaptimi (progress har 3 s yangilanadi, «Bekor qilish» bor). */
export const isCampaignActive = (status: CampaignStatus | null | undefined) =>
  status === "draft" || status === "queued" || status === "running";

/** Kampaniya kanallari — backend `CAMPAIGN_ALLOWED_CHANNELS` (SMS — KM-5, Telegram — kampaniyada yo'q). */
export const CAMPAIGN_CHANNELS = ["in_app", "realtime", "push"] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

/**
 * `POST /notifications/campaigns` tanasi. `scheduled_at` — faqat «Belgilangan vaqtda» (KM-3), Toshkent vaqti
 * `+05:00` bilan; «Darhol» da umuman yuborilmaydi.
 */
export type CampaignPayload = AudienceTarget & {
  type: string;
  category: string;
  priority: string;
  title: string;
  body?: string;
  link?: string;
  channels: CampaignChannel[];
  scheduled_at?: string;
};

/** `POST` javobi (202 yangi / 200 takroriy `Idempotency-Key`). */
export interface CampaignCreated {
  campaign_id: string;
  status: CampaignStatus | null;
  total: number;
  /** Haqiqiy yuborish lahzasi (kechiktirilgan bo'lsa); «Darhol» — `null`. */
  scheduled_at: string | null;
  duplicate: boolean;
  /** Reklama tungi taqiqqa tushib ertangi ochilishga surildi. */
  quiet_hours_shifted: boolean;
}

/** `GET /notifications/campaigns/:id` (progress) va ro'yxat qatori. */
export interface Campaign {
  id: string;
  status: CampaignStatus | null;
  display_status: CampaignDisplayStatus | null;
  title: string;
  category: string | null;
  channels: string[];
  audience: Record<string, unknown> | null;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  progress_pct: number;
  created_at: string | null;
  scheduled_at: string | null;
  finished_at: string | null;
  can_cancel: boolean;
  is_promo: boolean;
  /** Reklama tungi taqiqda to'xtagan — shu lahzada davom etadi (WIsb9Ytq). */
  paused_until: string | null;
}

export interface CampaignListPage {
  items: Campaign[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CampaignListParams {
  page?: number;
  limit?: number;
  state?: CampaignDisplayStatus;
}

/**
 * Progress chizig'i (foiz): yuborilgan kampaniyada — backend `progress_pct`; qolganida — `sent / total`. Backend
 * bekor qilish va xatoda qolganlarni `skipped` / `failed` ga yozadi, shuning uchun ularning `progress_pct` i doim 100 —
 * «406 / 1 312» yonida to'la chiziq «hammasi ketdi» degan yolg'on bo'lardi (maketda 31%).
 */
export const campaignBarPct = (
  campaign: Pick<Campaign, "status" | "display_status" | "sent" | "total" | "progress_pct">,
) =>
  campaignDisplayStatus(campaign) === "sent" || !campaign.total
    ? campaign.progress_pct
    : Math.min(100, Math.max(0, Math.round((campaign.sent / campaign.total) * 100)));

/**
 * Haqiqiy yuborish lahzasi: reklama tungi taqiqda to'xtagan bo'lsa (`paused_until` keyinroq) — o'sha, aks holda
 * `scheduled_at`. Backend navbatdagi reklamani ham `paused_until` bilan «rejalashtirilgan» deb ko'rsatadi.
 */
export const campaignEffectiveAt = (campaign: Pick<Campaign, "scheduled_at" | "paused_until">) =>
  campaign.paused_until &&
  (!campaign.scheduled_at || Date.parse(campaign.paused_until) > Date.parse(campaign.scheduled_at))
    ? campaign.paused_until
    : campaign.scheduled_at;

/** Reklama hozir tungi taqiqda to'xtab turibdimi (`paused_until` kelajakda). */
export const isCampaignPaused = (campaign: Pick<Campaign, "paused_until">, now: number = Date.now()) =>
  Boolean(campaign.paused_until && Date.parse(campaign.paused_until) > now);

/** Ko'rsatiladigan holat: `display_status` bo'lmasa xom holatdan. */
export const campaignDisplayStatus = (
  campaign: Pick<Campaign, "status" | "display_status">,
): CampaignDisplayStatus => {
  if (campaign.display_status) return campaign.display_status;
  switch (campaign.status) {
    case "done":
      return "sent";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "sending";
  }
};

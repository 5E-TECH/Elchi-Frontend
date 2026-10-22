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

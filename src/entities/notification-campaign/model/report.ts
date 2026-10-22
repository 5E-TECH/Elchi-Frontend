import type { CampaignDisplayStatus } from "./campaign";

/**
 * KAMPANIYA HISOBOTI (KM-3, backend H7kpCman — `GET /notifications/campaigns/:id/report`, `…/undelivered`,
 * `…/undelivered/export`). Javob shakli bildirishnoma va SMS kampaniyasida bir xil; bu yerda bildirishnoma
 * kampaniyasi (maket `superadmin-notifications-campaign-report-dialog`).
 */

/** Kanal kesimi (`by_channel`): holatlar hisobot ustunlariga yig'ilgan. */
export interface CampaignReportChannel {
  channel: string;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  /** Xom holat → son (`no_subscription: 70`) — sabab izohi uchun. */
  statuses: Record<string, number>;
}

export interface CampaignReport {
  campaign: {
    id: string;
    title: string;
    category: string | null;
    channels: string[];
    display_status: CampaignDisplayStatus | null;
    scheduled_at: string | null;
    created_at: string | null;
    finished_at: string | null;
  };
  stats: {
    audience: number;
    sent: number;
    /** `null` — o'lchanmagan (in_app / realtime / push da DLR yo'q) — HECH QACHON 0 deb ko'rsatilmaydi. */
    delivered: number | null;
    failed: number;
    skipped: number;
    pending: number;
    /** «Yetkazilmaganlar» ro'yxatidagi qatorlar soni. */
    undelivered: number;
  };
  byChannel: CampaignReportChannel[];
  /** CSV — faqat superadmin (`permissions.can_export`). */
  canExport: boolean;
  /** Shu sondan katta eksport fonda tayyorlanadi (202). */
  exportSyncLimit: number;
}

export interface CampaignUndeliveredFailure {
  channel: string;
  /** `failed` · `skipped` · `no_provider` · `not_eligible` · `no_subscription` · `blocked`. */
  status: string;
  /** Kod yoki xom matn — foydalanuvchiga faqat kod xaritasi orqali. */
  reason: string | null;
}

export interface CampaignUndeliveredItem {
  ref_id: string;
  recipient_id: string | null;
  name: string | null;
  role: string | null;
  /** Faqat maska (`***7434`, SMS); bildirishnomada `null`. */
  phone: string | null;
  failures: CampaignUndeliveredFailure[];
}

export interface CampaignUndeliveredPage {
  items: CampaignUndeliveredItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  /** Qatori yozilmay qolgan (kimligi noma'lum) xatolar — ro'yxatda yo'q. */
  unlistedFailed: number;
}

/** Fon eksporti holati (`GET …/exports/:export_id`). */
export type CampaignExportStatus = "queued" | "running" | "done" | "failed";

export interface CampaignExportJob {
  exportId: string;
  status: CampaignExportStatus;
  filename: string | null;
}

/** Hisobot ustunlari (maket): Yuborildi · Xato · O'tkazildi · Jarayonda. */
export const REPORT_BUCKETS = ["sent", "failed", "skipped", "pending"] as const;
export type ReportBucket = (typeof REPORT_BUCKETS)[number];

/** Barcha kanallar bo'yicha yig'indi (statistika kartalari): Xato va O'tkazib yuborildi — kanal kesimidan. */
export const sumReportBucket = (channels: readonly CampaignReportChannel[], bucket: ReportBucket) =>
  channels.reduce((total, row) => total + row[bucket], 0);

import type { CampaignDisplayStatus } from "./campaign";

/**
 * KAMPANIYA HISOBOTI (KM-3, backend H7kpCman — `GET /notifications/campaigns/:id/report`, `…/undelivered`,
 * `…/undelivered/export`). Javob shakli bildirishnoma va SMS kampaniyasida bir xil (`kind`); SMS kampaniyasi —
 * `GET /notifications/sms/campaigns/:id/report` va h.k. (maket `superadmin-notifications-campaign-report-dialog`).
 */

/** Qaysi kampaniya: bildirishnoma (`/notifications/campaigns`) yoki SMS (`/notifications/sms/campaigns`). */
export type CampaignReportKind = "notification" | "sms";

/** Hisobot manzili: SMS va bildirishnoma kampaniyalarining id'lari alohida jadvallarda (bir xil bo'lishi mumkin). */
export type CampaignReportRef = { id: string; kind: CampaignReportKind };

/** Kesh / eksport kaliti: bildirishnomada — id'ning o'zi (avvalgidek), SMS'da — `sms:<id>`. */
export const campaignReportKey = ({ id, kind }: CampaignReportRef) => (kind === "sms" ? `sms:${id}` : id);

/**
 * SMS bloki (`sms`) — faqat SMS bo'lgan kampaniyada (SMS kampaniyasi yoki SMS kanalli bildirishnoma kampaniyasi);
 * aks holda `null` → blok umuman chizilmaydi. `null` qiymat — o'lchanmagan / tarif sozlanmagan («—», 0 emas).
 */
export interface CampaignReportSms {
  messages: number;
  partsTotal: number;
  /** Bitta xabardagi bo'laklar (min–max) — faqat SMS kampaniyasida. */
  partsPerMessage: { min: number; max: number } | null;
  /** `GSM-7` · `UCS-2` · `mixed` — faqat SMS kampaniyasida (SMS kanalli bildirishnomada backend bermaydi). */
  encoding: string | null;
  /** Operator yetkazish hisoboti (DLR): yakuniy · yetkazildi · xato · kutilmoqda. */
  dlr: { final: number; delivered: number; failed: number; awaiting: number } | null;
  /** Bir bo'lak narxi (so'm); `null` — tarif sozlanmagan. */
  tariffPerPart: number | null;
  /** Provayder qabul qilganlar narxi (tarif × bo'lak); `null` — tarif sozlanmagan. */
  costOfSent: number | null;
}

/** Narx (`cost`) — doim TAXMIN (tarif × bo'laklar); faktik summa provayder hisobidan keladi. */
export interface CampaignReportCost {
  /** `null` — tarif sozlanmagan («—»); bepul kanallarda 0. */
  estimated: number | null;
  costOfSent: number | null;
  /** Pulli kanallar (`['sms']`); bo'sh — bepul kanallar (in_app / realtime / push). */
  paidChannels: string[];
}

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
  kind: CampaignReportKind;
  campaign: {
    id: string;
    title: string;
    /** SMS kampaniyasida sarlavha yo'q — matn. */
    text: string | null;
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
  /** DLR: `supported: false` — kanalda yetkazish hisoboti yo'q (in_app / realtime / push); `received` — kelganlar. */
  dlr: { supported: boolean; received: number | null; awaiting: number | null };
  sms: CampaignReportSms | null;
  cost: CampaignReportCost;
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
  /** N9 (lkQiuyQu): sabab KODI (`subscription_expired`, `no_consent` …) — matn shundan tanlanadi; yo'q — `null`. */
  reason_code: string | null;
}

export interface CampaignUndeliveredItem {
  ref_id: string;
  recipient_id: string | null;
  name: string | null;
  role: string | null;
  /** Faqat maska (`***7434`) — N9 dan beri bildirishnoma kampaniyasida ham; topilmasa `null`. */
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

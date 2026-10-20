/**
 * Qo'lda yuborilgan xabar tarixi (backend 7Vozou5x, `notification-service/history/dispatch-history.service.ts`).
 *
 *   GET /notifications/sent/:dispatch_id?page&limit — to'liq matn, JONLI kanal × holat (`channel_status`) va
 *   «Yetkazilmaganlar» (ism + rol + kod sabab, telefon YO'Q).
 *
 * `dispatch_id` — yuborishdagi `client_request_id` (UUID): 504 dan keyin ham shu id bilan tarixni ochish mumkin.
 */

/** Tarix holati (`DISPATCH_HISTORY_STATUSES`). */
export const DISPATCH_HISTORY_STATUSES = [
  "running",
  "sent",
  "partial",
  "inbox_only",
  "skipped",
  "failed",
] as const;
export type DispatchHistoryStatus = (typeof DISPATCH_HISTORY_STATUSES)[number];

/** `{ kanal: { holat: son } }` — masalan `{ telegram: { queued: 131, skipped: 17 } }`. `in_app` ham bor. */
export type ChannelStatusCounts = Record<string, Record<string, number>>;

/** Tarixdagi nishon sharti — ism/telefon emas (`audienceSummary`). */
export type DispatchAudience = {
  /** `recipient_id` + `recipient_ids` soni. */
  recipient_ids?: number;
  roles?: string[];
  broadcast?: boolean;
  include_customers?: boolean;
};

export type UndeliveredFailure = {
  channel: string;
  /** `failed` · `skipped` · `no_provider` · `not_eligible` · `no_subscription` · `blocked`. */
  status: string;
  /** Kod (`bot_blocked`, `no_phone`…) yoki xom matn — foydalanuvchiga faqat `reasons.ts` orqali. */
  reason: string | null;
};

export type UndeliveredItem = {
  notification_id: string;
  recipient_id: string;
  name: string | null;
  role: string | null;
  failures: UndeliveredFailure[];
};

export type SentDetail = {
  dispatch_id: string;
  status: DispatchHistoryStatus;
  type: string;
  category: string | null;
  priority: string | null;
  title: string;
  body: string | null;
  link: string | null;
  channels: string[];
  recipients: number;
  dispatched: number;
  skipped_by_preference: number;
  by_channel: Record<string, number>;
  channel_status: ChannelStatusCounts | null;
  no_provider: string[];
  audience: DispatchAudience | null;
  created_by: { id: string; name: string | null; role: string | null } | null;
  created_at: string | null;
  finished_at: string | null;
  undelivered: {
    items: UndeliveredItem[];
    page: number;
    limit: number;
    total: number;
  };
};

export type SentDetailParams = { page?: number; limit?: number };

import {
  BellRing,
  CircleCheck,
  CircleMinus,
  CircleQuestionMark,
  CircleX,
  Clock,
  Inbox,
  LoaderCircle,
  MessageSquareText,
  Send,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ChartTone } from "../../../shared/ui/charts";
import type { Tone } from "../../../shared/ui/primitives";
import {
  DISPATCH_HISTORY_STATUSES,
  type ChannelStatusCounts,
  type DispatchHistoryStatus,
} from "./types";

/**
 * HOLAT → TON (ega S3, 2026-10-19): navbatda / yuborilmoqda — sariq; o'tkazib yuborildi / provayder ulanmagan —
 * kulrang; xato — qizil; yetkazildi — yashil. Matn — `notifications:dispatch.*` (komponent tarjima qiladi).
 */

type BadgeMeta = { tone: Tone; icon: LucideIcon; labelKey: string };

/** Natija holati (tarix `status`) + «Noma'lum» (504 — javob kelmadi). */
export type DispatchOutcome = DispatchHistoryStatus | "unknown";

export const DISPATCH_STATUS_META: Record<DispatchOutcome, BadgeMeta> = {
  running: { tone: "warning", icon: LoaderCircle, labelKey: "dispatch.historyStatus.running" },
  sent: { tone: "success", icon: CircleCheck, labelKey: "dispatch.historyStatus.sent" },
  partial: { tone: "warning", icon: TriangleAlert, labelKey: "dispatch.historyStatus.partial" },
  inbox_only: { tone: "neutral", icon: Inbox, labelKey: "dispatch.historyStatus.inbox_only" },
  skipped: { tone: "neutral", icon: CircleMinus, labelKey: "dispatch.historyStatus.skipped" },
  failed: { tone: "danger", icon: CircleX, labelKey: "dispatch.historyStatus.failed" },
  unknown: { tone: "neutral", icon: CircleQuestionMark, labelKey: "dispatch.historyStatus.unknown" },
};

export const isDispatchHistoryStatus = (value: unknown): value is DispatchHistoryStatus =>
  typeof value === "string" && (DISPATCH_HISTORY_STATUSES as readonly string[]).includes(value);

/** Bitta qabul qiluvchining kanal holati guruhi (`delivery[kanal]`). */
export type DeliveryBucket = "sent" | "queued" | "failed" | "skipped" | "no_provider";

/** Chiziq va legenda tartibi (maket: Yuborildi · Navbatda · Xato · O'tkazib yuborildi). */
export const DELIVERY_BUCKETS: readonly DeliveryBucket[] = ["sent", "queued", "failed", "skipped", "no_provider"];

/**
 * Backend `NotificationDeliveryStatus` + SMS darvozasi `blocked` → guruh.
 *  - `emitted` (realtime brokerga uzatildi) — maketda «Yuborildi»;
 *  - `queued` · `pending` · `accepted` — hali yo'lda («Navbatda»);
 *  - `skipped` · `not_eligible` · `no_subscription` · `blocked` — o'tkazib yuborildi;
 *  - noma'lum yangi holat — o'tkazib yuborildi deb hisoblanmaydi, `null` (chizilmaydi).
 */
export const deliveryBucket = (status: string): DeliveryBucket | null => {
  switch (status) {
    case "sent":
    case "emitted":
      return "sent";
    case "queued":
    case "pending":
    case "accepted":
      return "queued";
    case "failed":
      return "failed";
    case "no_provider":
      return "no_provider";
    case "skipped":
    case "not_eligible":
    case "no_subscription":
    case "blocked":
      return "skipped";
    default:
      return null;
  }
};

export type BucketCounts = Record<DeliveryBucket, number>;

const emptyBuckets = (): BucketCounts => ({ sent: 0, queued: 0, failed: 0, skipped: 0, no_provider: 0 });

export const bucketCounts = (counts: Record<string, number> | undefined): BucketCounts => {
  const out = emptyBuckets();
  for (const [status, value] of Object.entries(counts ?? {})) {
    const bucket = deliveryBucket(status);
    const n = Number(value);
    if (bucket && Number.isFinite(n) && n > 0) out[bucket] += n;
  }
  return out;
};

export const bucketTotal = (buckets: BucketCounts) =>
  DELIVERY_BUCKETS.reduce((sum, bucket) => sum + buckets[bucket], 0);

export const DELIVERY_META: Record<DeliveryBucket, BadgeMeta & { chart: ChartTone }> = {
  sent: { tone: "success", chart: "success", icon: CircleCheck, labelKey: "dispatch.delivery.sent" },
  queued: { tone: "warning", chart: "warning", icon: Clock, labelKey: "dispatch.delivery.queued" },
  failed: { tone: "danger", chart: "danger", icon: CircleX, labelKey: "dispatch.delivery.failed" },
  skipped: { tone: "neutral", chart: "neutral", icon: CircleMinus, labelKey: "dispatch.delivery.skipped" },
  no_provider: { tone: "neutral", chart: "neutral", icon: TriangleAlert, labelKey: "dispatch.delivery.no_provider" },
};

/**
 * Kanal qatori badge'i: hali yo'ldagi bor — «Navbatda»; bitta guruh — o'sha; yetkazilgan + yetmagan aralash —
 * «Qisman» (maket `sent-detail-dialog`: Telegram 125 / xato 6 / o'tkazib 17).
 */
export const channelBadge = (buckets: BucketCounts): BadgeMeta | null => {
  const present = DELIVERY_BUCKETS.filter((bucket) => buckets[bucket] > 0);
  if (!present.length) return null;
  if (buckets.queued > 0) return DELIVERY_META.queued;
  if (present.length === 1) return DELIVERY_META[present[0]];
  if (buckets.sent > 0) return { tone: "warning", icon: TriangleAlert, labelKey: "dispatch.delivery.partial" };
  // Yetkazilgani yo'q: xato bor — xato, aks holda o'tkazib yuborildi.
  return buckets.failed > 0 ? DELIVERY_META.failed : DELIVERY_META.skipped;
};

/** «Yetkazilmaganlar» ro'yxatidagi bitta kanal belgisi. */
export const failureBadge = (status: string): BadgeMeta => {
  const bucket = deliveryBucket(status);
  if (bucket === "failed") return DELIVERY_META.failed;
  if (bucket === "no_provider") return DELIVERY_META.no_provider;
  return DELIVERY_META.skipped;
};

/**
 * Tashqi kanallar tartibi (maket: Darhol · Telegram · SMS · Push). `in_app` — qatorning o'zi, natija emas; `email` —
 * formada yo'q (provayderi ham yo'q), chizilmaydi.
 */
export const EXTERNAL_CHANNELS = ["realtime", "telegram", "sms", "push"] as const;

export const CHANNEL_ICON: Record<string, LucideIcon> = {
  realtime: Zap,
  telegram: Send,
  sms: MessageSquareText,
  push: BellRing,
};

/** Ko'rsatiladigan tashqi kanallar: so'ralganlar + `channel_status` da borlar, tartib bilan. */
export const externalChannels = (channels: readonly string[], channelStatus: ChannelStatusCounts | null) => {
  const known = new Set([...channels, ...Object.keys(channelStatus ?? {})]);
  return EXTERNAL_CHANNELS.filter((channel) => known.has(channel));
};

/** Kanal natijasi (`POST /notifications/dispatch` javobidagi `channel_outcome`, NS-4). */
export type ChannelOutcome = "full" | "partial" | "none";

export const isChannelOutcome = (value: unknown): value is ChannelOutcome =>
  value === "full" || value === "partial" || value === "none";

/**
 * Javobda `status` ham, `channel_outcome` ham bo'lmasa (eski backend) — backend qoidasining aynan nusxasi (aNynHYU0,
 * 2026-10-26): tashqi kanal har bir qabul qiluvchiga ketgandagina «to'liq» (`by_channel[kanal] >= dispatched`);
 * Telegram GURUH relay'i (`telegram_group`) — bitta xabar = to'liq (`> 0`). Hamma filtrlangan — `skipped`; hamma kanal
 * to'liq — `sent`; biror kanal ketgan, lekin hammasi to'liq emas — `partial`; hech biri — `inbox_only`.
 */
export const deriveDispatchStatus = ({
  channels,
  by_channel,
  dispatched,
  skipped_by_preference,
  telegram_group = false,
}: {
  channels: readonly string[];
  by_channel: Record<string, number>;
  dispatched: number;
  skipped_by_preference: number;
  telegram_group?: boolean;
}): DispatchHistoryStatus => {
  if (!dispatched && skipped_by_preference) return "skipped";
  const external = channels.filter((channel) => channel !== "in_app");
  const sentTo = (channel: string) => Number(by_channel[channel] ?? 0);
  const full = external.filter((channel) =>
    channel === "telegram" && telegram_group ? sentTo(channel) > 0 : sentTo(channel) > 0 && sentTo(channel) >= dispatched,
  );
  if (full.length === external.length) return "sent";
  return external.some((channel) => sentTo(channel) > 0) ? "partial" : "inbox_only";
};

/** `channel_outcome` dan holat (backend `summarizeChannels` bilan bir xil): hammasi `full` — `sent`. */
export const statusFromChannelOutcome = (
  outcome: Record<string, ChannelOutcome>,
  dispatched: number,
  skippedByPreference: number,
): DispatchHistoryStatus => {
  if (!dispatched && skippedByPreference) return "skipped";
  const values = Object.entries(outcome)
    .filter(([channel]) => channel !== "in_app")
    .map(([, value]) => value);
  if (values.every((value) => value === "full")) return "sent";
  return values.some((value) => value !== "none") ? "partial" : "inbox_only";
};

/**
 * Yuborish natijasining holati (NS-4): backend javobidagi `status` (tarixdagi bilan AYNI — `sent | partial |
 * inbox_only | skipped`) asosiy manba; yo'q bo'lsa — `channel_outcome`; u ham yo'q bo'lsa — `deriveDispatchStatus`.
 */
export const resolveDispatchStatus = (result: {
  status: string | null;
  channel_outcome: Record<string, ChannelOutcome> | null;
  channels: readonly string[];
  by_channel: Record<string, number>;
  dispatched: number;
  skipped_by_preference: number;
  telegram?: unknown;
}): DispatchHistoryStatus => {
  if (isDispatchHistoryStatus(result.status)) return result.status;
  if (result.channel_outcome && Object.keys(result.channel_outcome).length) {
    return statusFromChannelOutcome(result.channel_outcome, result.dispatched, result.skipped_by_preference);
  }
  return deriveDispatchStatus({ ...result, telegram_group: Boolean(result.telegram) });
};

/** Hali o'zgarishi mumkin: yuborilmoqda yoki biror kanal navbatda — tafsilot jonli yangilanadi. */
export const isDispatchLive = (status: DispatchHistoryStatus, channelStatus: ChannelStatusCounts | null) =>
  status === "running" ||
  Object.entries(channelStatus ?? {}).some(
    ([channel, counts]) => channel !== "in_app" && bucketCounts(counts).queued > 0,
  );

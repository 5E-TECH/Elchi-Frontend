/**
 * Qo'lda yuborilgan bildirishnoma natijasi va tarixi (NS-1; `/notifications/send` natija kartasi, keyin NS-2
 * `/notifications/sent`). Faqat nomli eksport.
 */
export type {
  ChannelStatusCounts,
  DispatchAudience,
  DispatchHistoryStatus,
  SentDetail,
  SentDetailParams,
  UndeliveredFailure,
  UndeliveredItem,
} from "./model/types";
export { DISPATCH_HISTORY_STATUSES } from "./model/types";
export {
  DELIVERY_BUCKETS,
  DELIVERY_META,
  DISPATCH_STATUS_META,
  EXTERNAL_CHANNELS,
  bucketCounts,
  channelBadge,
  deliveryBucket,
  deriveDispatchStatus,
  externalChannels,
  isDispatchHistoryStatus,
  isDispatchLive,
} from "./model/status";
export type { BucketCounts, DeliveryBucket, DispatchOutcome } from "./model/status";
export { failureReasonKey } from "./model/reasons";
export { getSentDetail, normalizeSentDetail, toChannelStatus, toCountMap } from "./api/sentApi";
export { SENT_DETAIL_LIVE_INTERVAL_MS, useSentDetail } from "./api/useSentDetail";
export { ChannelBreakdown } from "./ui/ChannelBreakdown";
export type { ChannelBreakdownProps } from "./ui/ChannelBreakdown";
export { DispatchStatusBadge, FailureBadge } from "./ui/DispatchBadges";
export { SENT_DETAIL_PAGE_SIZE, SentDetailDialog } from "./ui/SentDetailDialog";
export type { SentDetailDialogProps } from "./ui/SentDetailDialog";
export { UndeliveredList } from "./ui/UndeliveredList";
export type { UndeliveredListProps } from "./ui/UndeliveredList";

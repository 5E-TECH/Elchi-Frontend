export {
  isCustomerSegmentEmpty,
  isOrderRangeInverted,
  MAX_MIN_ORDERS,
  nextIsoDay,
  parseMinOrders,
  toCustomerSegmentPayload,
  type CustomerSegment,
  type CustomerSegmentPayload,
} from "./model/segment";
export { CustomerSegmentFilters, type CustomerSegmentFiltersProps } from "./ui/CustomerSegmentFilters";
// KM-2 — «Auditoriya» rejimi (kampaniya).
export {
  AUDIENCE_KINDS,
  AUDIENCE_STAFF_ROLES,
  audienceGate,
  audienceSegmentPayload,
  audienceTargetKey,
  createAudienceDraft,
  draftFromSavedAudience,
  isAudienceSegmentEmpty,
  toAudienceTarget,
  type AudienceDraft,
  type AudienceGate,
  type AudienceKind,
  type AudienceStaffRole,
  type AudienceTarget,
} from "./model/audience";
export {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_DISPLAY_STATUSES,
  CAMPAIGN_STATUS_META,
  campaignDisplayStatus,
  isCampaignActive,
  isCampaignDisplayStatus,
  type Campaign,
  type CampaignChannel,
  type CampaignCreated,
  type CampaignDisplayStatus,
  type CampaignListPage,
  type CampaignListParams,
  type CampaignPayload,
  type CampaignStatus,
} from "./model/campaign";
export {
  CAMPAIGN_BATCH_SIZE,
  audiencePreviewErrorKind,
  audiencePreviewState,
  canSendAudience,
  type AudiencePreviewErrorKind,
  type AudiencePreviewState,
} from "./model/previewState";
export { useAudienceDescription, type AudienceDescription } from "./model/useAudienceDescription";
export {
  cancelCampaign,
  createAudienceSegment,
  createCampaign,
  deleteAudienceSegment,
  exportCampaignUndelivered,
  getAudienceSegments,
  getCampaign,
  getCampaignReport,
  getCampaignUndelivered,
  getCampaigns,
  getSchedulePolicy,
  normalizeAudiencePreview,
  normalizeCampaign,
  normalizeCampaignCreated,
  normalizeCampaignList,
  normalizeSchedulePolicy,
  normalizeSegments,
  previewAudience,
  type AudiencePreview,
  type AudienceSampleItem,
  type CampaignExportResult,
  type CampaignSchedulePolicy,
  type CreateSegmentInput,
  type SavedAudienceSegment,
} from "./api/campaignApi";
export {
  AUDIENCE_PREVIEW_DEBOUNCE_MS,
  CAMPAIGN_PROGRESS_INTERVAL_MS,
  CAMPAIGN_SCHEDULED_INTERVAL_MS,
  campaignRefetchInterval,
  useAudiencePreview,
  useAudienceSample,
  useAudienceSegments,
  useCampaign,
  useCancelCampaign,
  useCreateAudienceSegment,
  useCreateCampaign,
  useDeleteAudienceSegment,
  useRecountAudience,
  useSchedulePolicy,
} from "./api/hooks";
export { AudienceBuilder, type AudienceBuilderErrors, type AudienceBuilderProps } from "./ui/AudienceBuilder";
export { AudienceSampleDialog, type AudienceSampleDialogProps } from "./ui/AudienceSampleDialog";
export { AudienceSummary, type AudienceSummaryProps } from "./ui/AudienceSummary";
export { CampaignStatusBadge } from "./ui/CampaignStatusBadge";
export { SaveSegmentDialog, type SaveSegmentDialogProps } from "./ui/SaveSegmentDialog";

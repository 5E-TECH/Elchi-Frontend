/**
 * AI moliyaviy yordamchi (F7PWp6cK; T2 6gKt64FN): suhbat — kontrakt tiplari, API, so'rovlar va «Manba» qatori; SSE
 * oqimi va suhbat holati — `features/ai-chat`. Maslahatchi ogohlantirishlari R1–R8 (60PWUbgC, shartnoma v0.3) —
 * `advisor*` modullari (snake_case, mavjudlik zondi bilan); amallar — `features/ai-alerts`. Sahifa —
 * `pages/ai-assistant`.
 */
export {
  AI_ASSISTANT_BACKEND_MAX_CHARS,
  AI_ASSISTANT_TOOL_NAMES,
} from "./model/types";
export type {
  AiAccessReason,
  AiAccessState,
  AiAssistantErrorCode,
  AiAssistantEvent,
  AiAssistantToolName,
  AiConversation,
  AiConversationList,
  AiConversationSummary,
  AiLimits,
  AiMessage,
  AiSource,
  AiSourcePeriod,
} from "./model/types";
export {
  normalizeAccessState,
  normalizeAssistantEvent,
  normalizeConversation,
  normalizeConversationList,
  normalizeMessage,
  normalizeSource,
  unwrapData,
} from "./model/normalize";
export { formatSource, formatSourcePeriod, formatSourcesLine, sourceLabel, visibleSources } from "./model/sources";
export { ANSWER_STOPS, failedStopCode, isAnswerStop, messageKind } from "./model/messageKind";
export type { AiMessageKind } from "./model/messageKind";
export { getAiAccessMe, getAiConversation, getAiConversations } from "./api/aiAssistantApi";
export {
  AI_CONVERSATIONS_PAGE_SIZE,
  invalidateAiAfterQuestion,
  isConversationId,
  refetchAiAccessMe,
  useAiAccessMe,
  useAiConversation,
  useAiConversations,
  writeAiLimits,
} from "./model/queries";

// ── Maslahatchi: ogohlantirishlar R1–R8 va qoidalar sozlamasi ──────────────────────────────────────────────
export {
  AI_ADVISOR_ALERT_STATUSES,
  AI_ADVISOR_CORRECTION_KINDS,
  AI_ADVISOR_ERROR_CODES,
  AI_ADVISOR_EXPLANATION_STATUSES,
  AI_ADVISOR_LINK_KINDS,
  AI_ADVISOR_NOTE_MAX,
  AI_ADVISOR_NOTE_MIN,
  AI_ADVISOR_RULE_KEYS,
  AI_ADVISOR_SEVERITIES,
  AI_ADVISOR_THRESHOLD_FIELDS,
} from "./model/advisorTypes";
export type {
  AiAdvisorAlertDetail,
  AiAdvisorAlertListData,
  AiAdvisorAlertListItem,
  AiAdvisorAlertListParams,
  AiAdvisorAlertPatchRequest,
  AiAdvisorAlertStatus,
  AiAdvisorBranchRef,
  AiAdvisorBudgetPeriod,
  AiAdvisorBudgetScope,
  AiAdvisorCashboxRef,
  AiAdvisorCorrectionKind,
  AiAdvisorErrorCode,
  AiAdvisorEvidence,
  AiAdvisorEvidenceBranchTransfers,
  AiAdvisorEvidenceCardBalanceCheck,
  AiAdvisorEvidenceCorrections,
  AiAdvisorEvidenceCourierDays,
  AiAdvisorEvidenceExpenseStats,
  AiAdvisorEvidenceKind,
  AiAdvisorEvidenceMarketDebtDays,
  AiAdvisorEvidenceProfitDays,
  AiAdvisorEvidenceReceiptCheck,
  AiAdvisorEvidenceShifts,
  AiAdvisorExplainResult,
  AiAdvisorExplanationError,
  AiAdvisorExplanationStatus,
  AiAdvisorFactsByRule,
  AiAdvisorFactsR1,
  AiAdvisorFactsR2,
  AiAdvisorFactsR3,
  AiAdvisorFactsR4,
  AiAdvisorFactsR5,
  AiAdvisorFactsR6,
  AiAdvisorFactsR7,
  AiAdvisorFactsR8,
  AiAdvisorFieldLimit,
  AiAdvisorGenericAlert,
  AiAdvisorKnownAlert,
  AiAdvisorLimitUnit,
  AiAdvisorLink,
  AiAdvisorLinkKind,
  AiAdvisorOverview,
  AiAdvisorOverviewAlerts,
  AiAdvisorPaginationMeta,
  AiAdvisorRuleKey,
  AiAdvisorRuleLimits,
  AiAdvisorRulePatch,
  AiAdvisorRuleSettings,
  AiAdvisorRuleSnapshot,
  AiAdvisorSettings,
  AiAdvisorSettingsPatch,
  AiAdvisorSeverity,
  AiAdvisorShiftRow,
  AiAdvisorSubject,
  AiAdvisorThresholdField,
  AiAdvisorThresholds,
  AiAdvisorUserRef,
} from "./model/advisorTypes";
export {
  AdvisorShapeError,
  isAdvisorShapeError,
  normalizeAlertDetail,
  normalizeAlertList,
  normalizeAlertListItem,
  normalizeEvidence,
  normalizeExplainResult,
  normalizeFacts,
  normalizeOverview,
  normalizeSettings,
  safeAppHref,
} from "./model/advisorNormalize";
export { classifyProbeError, readAdvisorError } from "./model/advisorErrors";
export type { AdvisorErrorFields, AdvisorErrorInfo, AdvisorUnavailableReason } from "./model/advisorErrors";
export {
  ADVISOR_EXPLAIN_POLL_DEFAULT_MS,
  ADVISOR_EXPLAIN_POLL_MAX_WAIT_MS,
  ADVISOR_EXPLAIN_POLL_MIN_MS,
  DEFAULT_RULE_LIMITS,
  RULE_SEVERITY_DEFAULT,
  RULE_TELEGRAM_DEFAULT,
  THRESHOLD_FIELDS,
  explanationPollInterval,
  isAlertId,
  isAlertOpen,
  isAlertStatus,
  isRuleKey,
} from "./model/advisorRules";
export type { ThresholdFieldSpec, ThresholdInputMode } from "./model/advisorRules";
export {
  addAdvisorDays,
  advisorDayOf,
  advisorDaysBetween,
  advisorIsoWeekday,
  advisorUserName,
  alertDialogTitle,
  alertInlineName,
  alertListTitle,
  alertShortLabel,
  alertShortName,
  alertSubline,
  formatAdvisorDay,
  formatAdvisorDayMonth,
  formatAdvisorDayRange,
  formatAdvisorDayRelative,
  formatAdvisorWeekRange,
  ruleConditionText,
  ruleName,
  subjectName,
} from "./model/alertText";
export type { AdvisorTranslate } from "./model/alertText";
export { AlertSeverityBadge } from "./ui/AlertSeverityBadge";
export { AlertStatusBadge } from "./ui/AlertStatusBadge";
export {
  ADVISOR_PROBE_TIMEOUT_MS,
  explainAdvisorAlert,
  getAdvisorAlert,
  getAdvisorAlerts,
  getAdvisorOverview,
  getAdvisorSettings,
  updateAdvisorAlert,
  updateAdvisorSettings,
} from "./api/aiAdvisorApi";
export {
  ADVISOR_AVAILABLE_STALE_MS,
  ADVISOR_OVERVIEW_POLL_MS,
  ADVISOR_TRANSIENT_STALE_MS,
  advisorProbeStaleTime,
  fetchAdvisorAvailability,
  fetchAdvisorSettings,
  runAdvisorProbe,
  useAdvisorAlert,
  useAdvisorAlertCount,
  useAdvisorAlerts,
  useAdvisorAvailability,
  useAdvisorSettings,
} from "./model/advisorQueries";
export type {
  AdvisorAlertCountParams,
  AdvisorAvailability,
  AdvisorProbe,
  AdvisorSettingsState,
} from "./model/advisorQueries";

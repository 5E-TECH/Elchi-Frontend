// T6 N2 — to'lovni qaytarish va summasini tuzatish (faqat superadmin). Public API.
export {
  useCorrectPaymentAmount,
  useReversePayment,
  normalizePaymentCorrectionResult,
  paymentCorrectionFingerprint,
} from "./api/usePaymentCorrectionMutations";
export type {
  CorrectPaymentAmountInput,
  PaymentCorrectionResult,
  ReversePaymentInput,
} from "./api/usePaymentCorrectionMutations";

export {
  PAYMENT_CORRECTION_ERROR_CODES,
  correctionErrorNeedsRefresh,
  correctionErrorResetsKeys,
  readCorrectionError,
} from "./model/errors";
export type { CorrectionError, PaymentCorrectionErrorCode } from "./model/errors";

export {
  describeCorrectionError,
  renderCorrectionError,
  toConfirmErrorView,
  usePaymentCorrectionErrors,
} from "./model/errorView";
export type {
  CorrectionAction,
  CorrectionErrorContext,
  CorrectionErrorKind,
  CorrectionErrorModel,
} from "./model/errorView";

export { buildCorrectionTarget, correctionFooterState, deriveCorrectionShape } from "./model/target";
export type {
  BuildCorrectionTargetInput,
  CorrectionFooterState,
  CorrectionKind,
  CorrectionShape,
  CorrectionTarget,
} from "./model/target";

export { createCorrectionTexts, nowrapText, usePaymentCorrectionTexts } from "./model/texts";
export type { CorrectTexts, CorrectionConsequence, CorrectionTexts, ReverseTexts } from "./model/texts";

export {
  CORRECTION_REASON_LIMITS,
  correctionAmountDiff,
  correctionAmountState,
  correctionReasonState,
  isValidCorrectionReason,
  normalizeCorrectionReason,
  parseCorrectionAmount,
} from "./model/validation";
export type {
  CorrectionAmountRejection,
  CorrectionAmountState,
  CorrectionReasonState,
} from "./model/validation";

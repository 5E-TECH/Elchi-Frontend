/**
 * AI maslahatchi ogohlantirishlari (60PWUbgC): «Hal qilindi» / «Ahamiyatsiz» (tasdiq, izoh maydoni, toast), AI izohi
 * (so'rash, 60 s kutish, holatlar bloki) va qoidalar sozlamasi (forma, tekshiruv, tasdiq, saqlash — `RulesSettingsDialog`). Tiplar, API va so'rovlar — `entities/ai-advisor`, sahifa — `pages/ai-assistant` («Ogohlantirishlar» tabi).
 */
export {
  mergeExplainResult,
  useDismissAlert,
  useExplainAlert,
  useResolveAlert,
} from "./model/useAlertMutations";
export type { DismissAlertInput, ResolveAlertInput } from "./model/useAlertMutations";
export { useSaveAdvisorSettings } from "./model/useSaveAdvisorSettings";
export { useExplanationPoll } from "./model/useExplanationPoll";
export { explanationView } from "./model/explanationView";
export type { ExplanationView } from "./model/explanationView";
export { ExplanationSection } from "./ui/ExplanationSection";
export type { ExplanationSectionProps } from "./ui/ExplanationSection";
export { ResolutionNote } from "./ui/ResolutionNote";
export type { ResolutionNoteProps } from "./ui/ResolutionNote";
export { useResolutionFlow } from "./ui/useResolutionFlow";
export {
  diffSettings,
  editableFields,
  fieldLimit,
  formatThresholdValue,
  parseServerField,
  rebaseSettingsForm,
  serverFieldError,
  settingsFieldErrorText,
  toSettingsForm,
  validateFieldInput,
  validateSettingsForm,
} from "./model/settingsForm";
export type {
  RuleForm,
  SettingsChange,
  SettingsErrors,
  SettingsFieldError,
  SettingsFieldKey,
  SettingsForm,
} from "./model/settingsForm";
export { RulesSettingsDialog } from "./ui/RulesSettingsDialog";
export type { RulesSettingsDialogProps } from "./ui/RulesSettingsDialog";
export { RuleSettingsRow } from "./ui/RuleSettingsRow";
export type { RuleSettingsRowProps } from "./ui/RuleSettingsRow";

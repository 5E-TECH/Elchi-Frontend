/**
 * AI maslahatchi ogohlantirishlari (60PWUbgC): «Hal qilindi» / «Ahamiyatsiz», AI izohi va qoidalar sozlamasini
 * saqlash. Tiplar, API va so'rovlar — `entities/ai-advisor`, sahifa — `pages/ai-assistant` («Ogohlantirishlar» tabi).
 */
export {
  mergeExplainResult,
  useDismissAlert,
  useExplainAlert,
  useResolveAlert,
} from "./model/useAlertMutations";
export type { DismissAlertInput, ResolveAlertInput } from "./model/useAlertMutations";
export { useSaveAdvisorSettings } from "./model/useSaveAdvisorSettings";

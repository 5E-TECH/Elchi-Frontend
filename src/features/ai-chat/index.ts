/**
 * AI yordamchi suhbati (F7PWp6cK): SSE oqimi (`fetch` + `ReadableStream`), holat mashinasi va xato ko'rinishi.
 * UI — `pages/ai-assistant`.
 */
export { createSseParser } from "./lib/sseParser";
export type { SseMessage, SseParser } from "./lib/sseParser";
export { parseRetryAfter, streamAssistantMessage } from "./api/streamMessage";
export type { StreamMessageInput, StreamMessageOptions, StreamOutcome } from "./api/streamMessage";
export {
  CUT_VIEW,
  classifyAfterAccess,
  classifyHttpFailure,
  classifyNetworkFailure,
  classifyStreamError,
} from "./model/errorView";
export type { ChatFailure, TurnErrorView } from "./model/errorView";
export {
  CUT_POLL_INTERVAL_MS,
  CUT_POLL_MAX_MS,
  findAnswerAfter,
  turnItemKey,
  useAiChat,
  visibleHistory,
} from "./model/useAiChat";
export type { PendingTurn, SendOptions, TurnAnswer, TurnPhase, UseAiChatOptions } from "./model/useAiChat";

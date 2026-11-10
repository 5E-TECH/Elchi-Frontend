import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { notify } from "../../../shared/lib/notify";
import { queryKeys } from "../../../shared/config/queryKeys";
import {
  invalidateAiAfterQuestion,
  isConversationId,
  refetchAiAccessMe,
  useAiConversation,
  writeAiLimits,
  type AiAccessState,
  type AiAssistantEvent,
  type AiMessage,
  type AiSource,
} from "../../../entities/ai-advisor";
import { streamAssistantMessage } from "../api/streamMessage";
import {
  classifyAfterAccess,
  classifyHttpFailure,
  classifyNetworkFailure,
  classifyStreamError,
  type ChatFailure,
  type TurnErrorView,
} from "./errorView";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  SUHBAT HOLATI — bitta «joriy savol» (pending) va server tarixi
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Holatlar: `sending` (so'rov ketdi, `meta` kutilmoqda) → `streaming` (`meta` keldi — savol saqlandi va limitdan
 *  ketdi) → `done` | `error` | `stopped` («To'xtatish») | `cut` (oqim o'rtada uzildi).
 *
 *   - `meta` — suhbat ID si saqlanadi, yangi suhbatda URL `?conversation=` (replace) yoziladi;
 *   - jonli matn — faqat JORIY qadamning `delta` lari (`step` da tozalanadi; yakuniy matn — `done.answer`); tool
 *     kutilayotganda «Ma'lumot yig'ilmoqda…»;
 *   - `done` — `limits` → `access/me` keshi; ro'yxat va suhbat yangilanadi; tarixda javob paydo bo'lgach joriy savol
 *     tarixga «qo'shiladi» (takror chizilmaydi);
 *   - `meta` dan keyingi har yakun (xato, uzilish, to'xtatish) — savol limitdan ketgan: `access/me`, ro'yxat va suhbat
 *     yangilanadi;
 *   - uzilish (`cut`) — ai-service javobni baribir oxiriga yetkazib saqlaydi: suhbat har 5 s da (≈150 s gacha) qayta
 *     so'raladi, javob kelsa qisman matn o'rnini egallaydi;
 *   - suhbat almashsa yoki «Yangi suhbat» — oqim to'xtatiladi (server javobni baribir saqlaydi).
 */

export type TurnPhase = "sending" | "streaming" | "done" | "error" | "stopped" | "cut";

export interface TurnAnswer {
  text: string;
  sources: AiSource[];
  stop: string;
  messageId: string;
  at: string;
}

export interface PendingTurn {
  /** Har yuborishda yangi — eski oqimning kech hodisalari yangi savolga tegmaydi. */
  key: number;
  question: string;
  askedAt: string;
  phase: TurnPhase;
  /** `meta.message_id` — savol qatori (tarixda shu ID dan boshlab joriy savolga tegishli). */
  questionId: string | null;
  conversationId: string | null;
  /** Joriy qadamning jonli matni. */
  text: string;
  /** Tool chaqiruvi javobini kutmoqda («Ma'lumot yig'ilmoqda…»). */
  collecting: boolean;
  answer: TurnAnswer | null;
  error: TurnErrorView | null;
  /** Uzilishdan keyingi kutish tugadi (tarixda javob paydo bo'lmadi). */
  pollExhausted: boolean;
}

export interface UseAiChatOptions {
  conversationId: string | null;
  /** Birinchi savolda `meta` keldi — URL'ga yozish (`replace`). */
  onConversationStarted: (id: string) => void;
  /** Savol yuborilmadi — matn maydonga qaytadi. */
  onRestoreDraft: (text: string) => void;
  /** 400 / `invalid_message` — maydon ostidagi xato matni (`null` — tozalash). */
  onFieldError: (message: string | null) => void;
}

/** Uzilishdan keyin suhbatni qayta so'rash oralig'i va jami kutish. */
export const CUT_POLL_INTERVAL_MS = 5_000;
export const CUT_POLL_MAX_MS = 150_000;

const LIVE_PHASES: ReadonlySet<TurnPhase> = new Set(["sending", "streaming"]);

/** Tarixda savoldan keyingi birinchi assistant qatori (savol topilmasa — `null`). */
export const findAnswerAfter = (messages: readonly AiMessage[], questionId: string | null): AiMessage | null => {
  if (!questionId) return null;
  const index = messages.findIndex((message) => message.id === questionId);
  if (index === -1) return null;
  return messages.slice(index + 1).find((message) => message.role === "assistant") ?? null;
};

/** Ko'rsatiladigan tarix: joriy savol tarixga yozilgan bo'lsa — undan oldingisi (savol va javob pending'da chiziladi). */
export const visibleHistory = (messages: readonly AiMessage[], pending: PendingTurn | null): readonly AiMessage[] => {
  if (!pending?.questionId) return messages;
  const index = messages.findIndex((message) => message.id === pending.questionId);
  return index === -1 ? messages : messages.slice(0, index);
};

const nextMidnightTashkent = () => {
  // Toshkent UTC+5, yozgi vaqtsiz.
  const now = Date.now();
  const tashkent = new Date(now + 5 * 3_600_000);
  const midnightUtc = Date.UTC(tashkent.getUTCFullYear(), tashkent.getUTCMonth(), tashkent.getUTCDate() + 1) - 5 * 3_600_000;
  return new Date(midnightUtc).toISOString();
};

export const useAiChat = ({ conversationId, onConversationStarted, onRestoreDraft, onFieldError }: UseAiChatOptions) => {
  const { t } = useTranslation("aiAdvisor");
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingTurn | null>(null);
  const [capUntil, setCapUntil] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const keyRef = useRef(0);
  /** Oqim qaysi suhbatga yozyapti (`meta` da sinxron yangilanadi — URL o'zgarishi «suhbat almashdi» deb olinmasin). */
  const streamConversationRef = useRef<string | null>(conversationId);
  const callbacks = useRef({ onConversationStarted, onRestoreDraft, onFieldError });
  useEffect(() => {
    callbacks.current = { onConversationStarted, onRestoreDraft, onFieldError };
  });

  const detail = useAiConversation(conversationId);

  const patch = useCallback((key: number, update: (turn: PendingTurn) => PendingTurn) => {
    setPending((prev) => (prev && prev.key === key ? update(prev) : prev));
  }, []);

  const abortStream = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  /** Pending'ni olib, matnni maydonga qaytaradi (savol yuborilmagan holatlar). */
  const dropPending = useCallback((key: number, question: string) => {
    setPending((prev) => (prev && prev.key === key ? null : prev));
    callbacks.current.onRestoreDraft(question);
  }, []);

  const applyFailure = useCallback(
    (key: number, question: string, failure: ChatFailure) => {
      switch (failure.action) {
        case "turn":
          if (failure.view.variant === "cap") setCapUntil(failure.view.resetAt ?? nextMidnightTashkent());
          patch(key, (turn) => ({ ...turn, phase: failure.view.variant === "cut" ? "cut" : "error", error: failure.view, collecting: false }));
          return;
        case "notify":
          dropPending(key, question);
          notify.warning(t(failure.titleKey), {
            description: failure.descriptionKey ? t(failure.descriptionKey, failure.values) : undefined,
          });
          return;
        case "field":
          dropPending(key, question);
          callbacks.current.onFieldError(t(failure.messageKey));
          return;
        case "access":
          dropPending(key, question);
          void queryClient.invalidateQueries({ queryKey: queryKeys.aiAssistant.accessMe });
          return;
        case "silent":
          dropPending(key, question);
          return;
      }
    },
    [dropPending, patch, queryClient, t],
  );

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question) return;
      if (pending && LIVE_PHASES.has(pending.phase)) return;

      abortStream();
      const controller = new AbortController();
      controllerRef.current = controller;
      keyRef.current += 1;
      const key = keyRef.current;
      const startConversation = isConversationId(conversationId) ? conversationId : null;
      streamConversationRef.current = startConversation;
      callbacks.current.onFieldError(null);

      setPending({
        key,
        question,
        askedAt: new Date().toISOString(),
        phase: "sending",
        questionId: null,
        conversationId: startConversation,
        text: "",
        collecting: false,
        answer: null,
        error: null,
        pollExhausted: false,
      });

      let afterMeta = false;
      let savedConversation: string | null = startConversation;
      const pendingTools = new Set<string>();

      const onEvent = (event: AiAssistantEvent) => {
        if (keyRef.current !== key) return;
        switch (event.type) {
          case "meta":
            afterMeta = true;
            savedConversation = event.conversationId;
            streamConversationRef.current = event.conversationId;
            patch(key, (turn) => ({
              ...turn,
              phase: "streaming",
              questionId: event.messageId,
              conversationId: event.conversationId,
            }));
            if (event.conversationId !== startConversation) callbacks.current.onConversationStarted(event.conversationId);
            return;
          case "step":
            pendingTools.clear();
            patch(key, (turn) => ({ ...turn, text: "", collecting: false }));
            return;
          case "delta":
            patch(key, (turn) => ({ ...turn, text: turn.text + event.text }));
            return;
          case "tool_call":
            pendingTools.add(event.id);
            patch(key, (turn) => ({ ...turn, collecting: true }));
            return;
          case "tool_result":
            pendingTools.delete(event.id);
            patch(key, (turn) => ({ ...turn, collecting: pendingTools.size > 0 }));
            return;
          case "done": {
            const conversation = event.conversationId || savedConversation;
            patch(key, (turn) => ({
              ...turn,
              phase: "done",
              collecting: false,
              conversationId: conversation,
              answer: {
                text: event.answer,
                sources: event.sources,
                stop: event.stop,
                messageId: event.messageId,
                at: new Date().toISOString(),
              },
            }));
            if (event.limits) writeAiLimits(queryClient, event.limits);
            void invalidateAiAfterQuestion(queryClient, conversation, { accessMe: !event.limits });
            return;
          }
          case "error":
            applyFailure(key, question, classifyStreamError(event, afterMeta));
            if (afterMeta) void invalidateAiAfterQuestion(queryClient, savedConversation);
            return;
        }
      };

      const outcome = await streamAssistantMessage(
        { message: question, conversationId: startConversation },
        { signal: controller.signal, onEvent },
      );
      if (controllerRef.current === controller) controllerRef.current = null;
      if (keyRef.current !== key) return;

      switch (outcome.kind) {
        case "ended":
          if (outcome.terminal) return;
          applyFailure(key, question, classifyNetworkFailure(afterMeta));
          if (afterMeta) void invalidateAiAfterQuestion(queryClient, savedConversation);
          return;
        case "network":
          applyFailure(key, question, classifyNetworkFailure(afterMeta));
          if (afterMeta) void invalidateAiAfterQuestion(queryClient, savedConversation);
          return;
        case "aborted":
          return;
        case "http": {
          const failure = classifyHttpFailure(outcome.status, outcome.body);
          if (failure.action !== "check-access") {
            applyFailure(key, question, failure);
            return;
          }
          let access: AiAccessState | null = null;
          try {
            access = await refetchAiAccessMe(queryClient);
          } catch {
            access = null;
          }
          if (keyRef.current !== key) return;
          applyFailure(key, question, classifyAfterAccess(outcome.status, access, outcome.retryAfter));
          return;
        }
      }
    },
    [abortStream, applyFailure, conversationId, patch, pending, queryClient],
  );

  /** «To'xtatish» — oqim uziladi, qisman matn qoladi. Savol `meta` dan keyin limitdan baribir ketgan. */
  const stop = useCallback(() => {
    if (!pending || !LIVE_PHASES.has(pending.phase)) return;
    abortStream();
    const wasSaved = pending.phase === "streaming";
    setPending((prev) => (prev && prev.key === pending.key ? { ...prev, phase: "stopped", collecting: false } : prev));
    if (wasSaved) void invalidateAiAfterQuestion(queryClient, pending.conversationId);
  }, [abortStream, pending, queryClient]);

  /** «Qayta yuborish» — o'sha savol yangi savol sifatida (limitdan yana bittasi). */
  const retry = useCallback(() => {
    if (!pending || LIVE_PHASES.has(pending.phase)) return;
    void send(pending.question);
  }, [pending, send]);

  /** «Yangi suhbat» / boshqa suhbatga o'tish — oqim to'xtatiladi, joriy savol tozalanadi. */
  const reset = useCallback(() => {
    abortStream();
    keyRef.current += 1;
    streamConversationRef.current = null;
    setPending(null);
    callbacks.current.onFieldError(null);
  }, [abortStream]);

  // Suhbat tashqaridan almashdi (ro'yxatdan tanlandi, «Orqaga») — oqim shu suhbatniki bo'lmasa to'xtatiladi.
  useEffect(() => {
    if (conversationId === streamConversationRef.current) return;
    abortStream();
    keyRef.current += 1;
    streamConversationRef.current = conversationId;
    setPending(null);
  }, [abortStream, conversationId]);

  // Sahifadan chiqildi — oqim yopiladi.
  useEffect(() => () => controllerRef.current?.abort(), []);

  // Tarixda javob paydo bo'ldi — joriy savol tarixga o'tadi (javob yoki uzilishdan keyin to'liq javob).
  const history = detail.data?.messages;
  useEffect(() => {
    if (!pending || !history) return;
    if (pending.phase !== "done" && pending.phase !== "cut") return;
    const answer = findAnswerAfter(history, pending.questionId);
    if (!answer) return;
    // Uzilishdan keyin tarixda faqat xato qatori bo'lsa ham — u yakuniy holat (backend yozgan).
    setPending((prev) => (prev && prev.key === pending.key ? null : prev));
  }, [history, pending]);

  // Uzilish: ai-service javobni baribir saqlaydi — suhbat qayta so'raladi.
  const cutKey = pending?.phase === "cut" && pending.questionId ? pending.key : null;
  const cutConversation = pending?.conversationId ?? null;
  useEffect(() => {
    if (cutKey === null || !cutConversation) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - startedAt >= CUT_POLL_MAX_MS) {
        window.clearInterval(timer);
        patch(cutKey, (turn) => ({ ...turn, pollExhausted: true }));
        return;
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiAssistant.conversation(cutConversation) });
    }, CUT_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [cutConversation, cutKey, patch, queryClient]);

  // Xarajat shifti — `reset_at` gacha kiritish o'chiq (`access/me` uni bilmaydi), keyin o'zi ochiladi.
  useEffect(() => {
    if (capUntil === null) return;
    const left = Date.parse(capUntil) - Date.now();
    const timer = window.setTimeout(() => setCapUntil(null), Number.isFinite(left) ? Math.max(0, left) : 0);
    return () => window.clearTimeout(timer);
  }, [capUntil]);

  const capped = capUntil !== null;

  return {
    pending,
    detail,
    live: pending !== null && LIVE_PHASES.has(pending.phase),
    capped,
    capUntil: capped ? capUntil : null,
    send,
    stop,
    retry,
    reset,
  };
};


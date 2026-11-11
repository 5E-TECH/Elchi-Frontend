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
 *     yangilanadi; jonli savoldan chiqish («To'xtatish», suhbat almashishi, «Yangi suhbat») — `meta` gacha ham
 *     (server savolni qabul qilib bo'lgan bo'lishi mumkin) ro'yxat va `access/me` yangilanadi;
 *   - uzilish (`cut`) — ai-service javobni baribir oxiriga yetkazib saqlaydi: suhbat har 5 s da (≈150 s gacha) qayta
 *     so'raladi, javob kelsa qisman matn o'rnini egallaydi. Kutish joriy savoldan alohida: shu orada yuborilgan yangi
 *     savol (yoki «Qayta yuborish») uni to'xtatmaydi;
 *   - savol qabul qilinmadi (`busy`, 400, limit, sessiya) — ekran yuborishdan oldingi holatiga qaytadi (oldingi
 *     savol — masalan uzilgan javob — joyida qoladi), matn maydonga faqat maydondan yuborilgan bo'lsa qaytadi;
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
}

export interface SendOptions {
  /**
   * Matn maydondan yuborildi: savol qabul qilinmasa (`busy`, 400, limit, sessiya) matn maydonga qaytadi. Tavsiya va
   * «Qayta yuborish» — qaytmaydi (maydondagi foydalanuvchi matni ustiga yozilmaydi).
   */
  restoreDraft?: boolean;
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

/**
 * Joriy savol qatorlarining React kaliti (`q` — savol, `a` — javob). Tarixga o'tgach o'sha xabarlar shu kalit bilan
 * chiziladi (`messageKey`) — DOM tuguni saqlanadi, `role="log"` savol va javobni ikkinchi marta o'qimaydi.
 */
export const turnItemKey = (turnKey: number, part: "q" | "a") => `turn-${turnKey}-${part}`;

/** Uzilgan javobni kutish (tarixda savoldan keyin javob paydo bo'lguncha). */
type AnswerWatch = { conversationId: string; questionId: string; since: number };

/** Xarajat shifti: `reset_at` gacha kiritish o'chiq. */
type CapState = { until: string; titleKey: string };

type SendContext = { key: number; question: string; previous: PendingTurn | null; restoreDraft: boolean };

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
  const [cap, setCap] = useState<CapState | null>(null);
  const [watch, setWatch] = useState<AnswerWatch | null>(null);
  /** Tarixga o'tgan joriy savol xabarlari → ularning `turnItemKey` i. */
  const [turnKeys, setTurnKeys] = useState<Readonly<Record<string, string>>>({});
  const pendingRef = useRef<PendingTurn | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const keyRef = useRef(0);
  /** Oqim qaysi suhbatga yozyapti (`meta` da sinxron yangilanadi — URL o'zgarishi «suhbat almashdi» deb olinmasin). */
  const streamConversationRef = useRef<string | null>(conversationId);
  const callbacks = useRef({ onConversationStarted, onRestoreDraft, onFieldError });
  useEffect(() => {
    callbacks.current = { onConversationStarted, onRestoreDraft, onFieldError };
    pendingRef.current = pending;
  });

  const detail = useAiConversation(conversationId);

  const patch = useCallback((key: number, update: (turn: PendingTurn) => PendingTurn) => {
    setPending((prev) => (prev && prev.key === key ? update(prev) : prev));
  }, []);

  const abortStream = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  /**
   * Savol qabul qilinmadi: ekran yuborishdan oldingi holatga qaytadi (oldingi savol — masalan uzilgan javob va uning
   * kutilishi — joyida), matn maydonga faqat maydondan yuborilgan bo'lsa qaytadi.
   */
  const dropPending = useCallback(({ key, question, previous, restoreDraft }: SendContext) => {
    setPending((prev) => (prev && prev.key === key ? previous : prev));
    if (restoreDraft) callbacks.current.onRestoreDraft(question);
  }, []);

  const applyFailure = useCallback(
    (context: SendContext, failure: ChatFailure) => {
      switch (failure.action) {
        case "turn":
          if (failure.view.variant === "cap") {
            setCap({ until: failure.view.resetAt ?? nextMidnightTashkent(), titleKey: failure.view.titleKey });
          }
          patch(context.key, (turn) => ({
            ...turn,
            phase: failure.view.variant === "cut" ? "cut" : "error",
            error: failure.view,
            collecting: false,
          }));
          return;
        case "notify":
          dropPending(context);
          notify.warning(t(failure.titleKey), {
            description: failure.descriptionKey ? t(failure.descriptionKey, failure.values) : undefined,
          });
          return;
        case "field":
          dropPending(context);
          // Maydondagi matn foydalanuvchiniki (tavsiya / «Qayta yuborish» uni o'zgartirmagan) — uni xato deb belgilamaymiz.
          if (context.restoreDraft) callbacks.current.onFieldError(t(failure.messageKey));
          else notify.warning(t(failure.messageKey));
          return;
        case "access":
          dropPending(context);
          void queryClient.invalidateQueries({ queryKey: queryKeys.aiAssistant.accessMe });
          return;
        case "silent":
          dropPending(context);
          return;
      }
    },
    [dropPending, patch, queryClient, t],
  );

  const send = useCallback(
    async (raw: string, { restoreDraft = false }: SendOptions = {}) => {
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
      const context: SendContext = { key, question, previous: pending, restoreDraft };

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
      });

      let afterMeta = false;
      let savedConversation: string | null = startConversation;
      let questionId: string | null = null;
      const pendingTools = new Set<string>();

      const fail = (failure: ChatFailure) => {
        applyFailure(context, failure);
        // Uzildi — ai-service javobni baribir saqlaydi: suhbat qayta so'raladi (joriy savoldan alohida).
        if (failure.action === "turn" && failure.view.variant === "cut" && savedConversation && questionId) {
          setWatch({ conversationId: savedConversation, questionId, since: Date.now() });
        }
      };

      const onEvent = (event: AiAssistantEvent) => {
        if (keyRef.current !== key) return;
        switch (event.type) {
          case "meta":
            afterMeta = true;
            savedConversation = event.conversationId;
            questionId = event.messageId;
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
            fail(classifyStreamError(event, afterMeta));
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
          fail(classifyNetworkFailure(afterMeta));
          if (afterMeta) void invalidateAiAfterQuestion(queryClient, savedConversation);
          return;
        case "network":
          fail(classifyNetworkFailure(afterMeta));
          if (afterMeta) void invalidateAiAfterQuestion(queryClient, savedConversation);
          return;
        case "aborted":
          return;
        case "http": {
          const failure = classifyHttpFailure(outcome.status, outcome.body);
          if (failure.action !== "check-access") {
            fail(failure);
            return;
          }
          let access: AiAccessState | null = null;
          try {
            access = await refetchAiAccessMe(queryClient);
          } catch {
            access = null;
          }
          if (keyRef.current !== key) return;
          fail(classifyAfterAccess(outcome.status, access, outcome.retryAfter));
          return;
        }
      }
    },
    [abortStream, applyFailure, conversationId, patch, pending, queryClient],
  );

  /**
   * «To'xtatish» — oqim uziladi, qisman matn qoladi. `meta` dan keyin savol saqlangan (limitdan ketgan) — ro'yxat,
   * suhbat va `access/me`; `meta` gacha ham server savolni qabul qilgan bo'lishi mumkin (gateway uzilishni obunadan
   * keyin ko'radi) — ro'yxat va `access/me` (suhbat tarixi so'ralmaydi: savol ikki marta chizilmasin).
   */
  const stop = useCallback(() => {
    if (!pending || !LIVE_PHASES.has(pending.phase)) return;
    abortStream();
    const wasSaved = pending.phase === "streaming";
    setPending((prev) => (prev && prev.key === pending.key ? { ...prev, phase: "stopped", collecting: false } : prev));
    void invalidateAiAfterQuestion(queryClient, wasSaved ? pending.conversationId : null);
  }, [abortStream, pending, queryClient]);

  /** «Qayta yuborish» — o'sha savol yangi savol sifatida (limitdan yana bittasi). */
  const retry = useCallback(() => {
    if (!pending || LIVE_PHASES.has(pending.phase)) return;
    void send(pending.question);
  }, [pending, send]);

  /**
   * Joriy savoldan chiqish (suhbat almashdi, «Yangi suhbat»): oqim to'xtatiladi, joriy savol va uzilish kutilishi
   * tozalanadi. Savol jonli bo'lsa — server uni qabul qilgan bo'lishi mumkin: ro'yxat, suhbat va `access/me` yangilanadi.
   */
  const abandon = useCallback(() => {
    const current = pendingRef.current;
    abortStream();
    keyRef.current += 1;
    setPending(null);
    setWatch(null);
    setTurnKeys({});
    if (current && LIVE_PHASES.has(current.phase)) void invalidateAiAfterQuestion(queryClient, current.conversationId);
  }, [abortStream, queryClient]);

  /** «Yangi suhbat» / boshqa suhbatga o'tish — oqim to'xtatiladi, joriy savol tozalanadi. */
  const reset = useCallback(() => {
    abandon();
    streamConversationRef.current = null;
    callbacks.current.onFieldError(null);
  }, [abandon]);

  // Suhbat tashqaridan almashdi (ro'yxatdan tanlandi, «Orqaga») — oqim shu suhbatniki bo'lmasa to'xtatiladi.
  useEffect(() => {
    if (conversationId === streamConversationRef.current) return;
    abandon();
    streamConversationRef.current = conversationId;
  }, [abandon, conversationId]);

  // Sahifadan chiqildi — oqim yopiladi.
  useEffect(() => () => controllerRef.current?.abort(), []);

  // Tarixda javob paydo bo'ldi — joriy savol tarixga o'tadi (javob yoki uzilishdan keyin to'liq javob).
  const history = detail.data?.messages;
  useEffect(() => {
    if (!history) return;
    if (watch && findAnswerAfter(history, watch.questionId)) setWatch(null);
    if (!pending?.questionId) return;
    if (pending.phase !== "done" && pending.phase !== "cut") return;
    const answer = findAnswerAfter(history, pending.questionId);
    if (!answer) return;
    // Uzilishdan keyin tarixda faqat xato qatori bo'lsa ham — u yakuniy holat (backend yozgan).
    const questionKey = pending.questionId;
    setTurnKeys((prev) => ({ ...prev, [questionKey]: turnItemKey(pending.key, "q"), [answer.id]: turnItemKey(pending.key, "a") }));
    setPending((prev) => (prev && prev.key === pending.key ? null : prev));
  }, [history, pending, watch]);

  // Uzilish: ai-service javobni baribir saqlaydi — suhbat qayta so'raladi (≈150 s gacha).
  useEffect(() => {
    if (!watch) return;
    const timer = window.setInterval(() => {
      if (Date.now() - watch.since >= CUT_POLL_MAX_MS) {
        window.clearInterval(timer);
        setWatch((prev) => (prev === watch ? null : prev));
        return;
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiAssistant.conversation(watch.conversationId) });
    }, CUT_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [queryClient, watch]);

  // Xarajat shifti — `reset_at` gacha kiritish o'chiq (`access/me` uni bilmaydi), keyin o'zi ochiladi.
  useEffect(() => {
    if (cap === null) return;
    const left = Date.parse(cap.until) - Date.now();
    const timer = window.setTimeout(() => setCap(null), Number.isFinite(left) ? Math.max(0, left) : 0);
    return () => window.clearTimeout(timer);
  }, [cap]);

  /** Tarix xabarining React kaliti (joriy savoldan o'tgan bo'lsa — o'sha `turnItemKey`). */
  const messageKey = useCallback((id: string) => turnKeys[id] ?? id, [turnKeys]);

  return {
    pending,
    detail,
    live: pending !== null && LIVE_PHASES.has(pending.phase),
    capped: cap !== null,
    capUntil: cap?.until ?? null,
    /** Shift sarlavhasi (`errors.codes.assistant_usd_cap` | `errors.codes.cap_exceeded`). */
    capTitleKey: cap?.titleKey ?? null,
    messageKey,
    send,
    stop,
    retry,
    reset,
  };
};


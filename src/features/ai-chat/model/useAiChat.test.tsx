import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { notify, toastStore } from "../../../shared/lib/notify";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { AiAccessState, AiAssistantEvent, AiConversation } from "../../../entities/ai-advisor";
import type { StreamOutcome } from "../api/streamMessage";

type FakeStream = {
  input: { message: string; conversationId?: string | null };
  signal: AbortSignal;
  emit: (event: AiAssistantEvent) => void;
  finish: (outcome: StreamOutcome) => void;
};

const mocks = vi.hoisted(() => ({
  streams: [] as FakeStream[],
  access: null as unknown as AiAccessState,
  conversation: null as unknown as AiConversation,
  getAiConversation: vi.fn(),
  getAiAccessMe: vi.fn(),
}));

vi.mock("../api/streamMessage", () => ({
  streamAssistantMessage: (
    input: FakeStream["input"],
    { signal, onEvent }: { signal: AbortSignal; onEvent: (event: AiAssistantEvent) => void },
  ) =>
    new Promise<StreamOutcome>((resolve) => {
      signal.addEventListener("abort", () => resolve({ kind: "aborted" }));
      mocks.streams.push({ input, signal, emit: onEvent, finish: resolve });
    }),
}));

vi.mock("../../../entities/ai-advisor/api/aiAssistantApi", () => ({
  getAiConversation: mocks.getAiConversation,
  getAiAccessMe: mocks.getAiAccessMe,
  getAiConversations: vi.fn(async () => ({ items: [], total: 0, limit: 50, offset: 0 })),
}));

import { CUT_POLL_INTERVAL_MS, findAnswerAfter, useAiChat, visibleHistory, type PendingTurn } from "./useAiChat";

const ACCESS: AiAccessState = {
  allowed: true,
  reason: null,
  featureEnabled: true,
  dailyLimit: 100,
  usedToday: 38,
  remainingToday: 62,
  resetAt: "2026-11-11T00:00:00+05:00",
};

const question = (id: string, text = "Savol") => ({ id, role: "user" as const, text, createdAt: null, sources: [], stop: null });
const answer = (id: string, text = "Javob", stop = "end_turn") => ({
  id,
  role: "assistant" as const,
  text,
  createdAt: null,
  sources: [],
  stop,
});

const setup = (initial: string | null = null) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(queryKeys.aiAssistant.accessMe, ACCESS);
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const calls = { started: [] as string[], drafts: [] as string[], fieldErrors: [] as (string | null)[] };
  let conversationId = initial;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </I18nextProvider>
  );
  const hook = renderHook(
    (props: { conversationId: string | null }) =>
      useAiChat({
        conversationId: props.conversationId,
        onConversationStarted: (id) => {
          calls.started.push(id);
          conversationId = id;
        },
        onRestoreDraft: (text) => calls.drafts.push(text),
        onFieldError: (message) => calls.fieldErrors.push(message),
      }),
    { wrapper, initialProps: { conversationId } },
  );
  /** URL'ga yozilgan suhbat — sahifadagidek qayta chizish. */
  const syncUrl = () => hook.rerender({ conversationId });
  const invalidatedKeys = () => invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
  return { hook, queryClient, calls, syncUrl, invalidatedKeys, setConversation: (id: string | null) => hook.rerender({ conversationId: id }) };
};

const lastStream = () => mocks.streams[mocks.streams.length - 1];
const pendingOf = (hook: { result: { current: { pending: PendingTurn | null } } }) => hook.result.current.pending;

beforeEach(() => {
  mocks.streams.length = 0;
  mocks.access = { ...ACCESS };
  mocks.conversation = { id: "42", title: "t", turns: 0, createdAt: null, lastMessageAt: null, messages: [] };
  mocks.getAiConversation.mockImplementation(async () => mocks.conversation);
  mocks.getAiAccessMe.mockImplementation(async () => mocks.access);
  notify.dismiss();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useAiChat — holat mashinasi", () => {
  it("yangi suhbat: sending → meta (URL replace) → joriy qadam matni → tool → done (limit keshga, ro'yxat va suhbat yangilanadi) → tarixga o'tadi", async () => {
    const { hook, queryClient, calls, syncUrl, invalidatedKeys } = setup();

    act(() => void hook.result.current.send("  Bu oy kassaga qancha tushdi?  "));
    expect(pendingOf(hook)).toMatchObject({ phase: "sending", question: "Bu oy kassaga qancha tushdi?" });
    expect(lastStream().input).toEqual({ message: "Bu oy kassaga qancha tushdi?", conversationId: null });
    expect(hook.result.current.live).toBe(true);

    act(() => lastStream().emit({ type: "meta", conversationId: "42", messageId: "900", maxSteps: 6 }));
    expect(calls.started).toEqual(["42"]);
    syncUrl();
    expect(pendingOf(hook)).toMatchObject({ phase: "streaming", questionId: "900", conversationId: "42" });
    // Yangi suhbat tarixi so'raladi (hozircha faqat savol) — joriy savol uni yashiradi.
    await waitFor(() => expect(hook.result.current.detail.isSuccess).toBe(true));
    expect(lastStream().signal.aborted).toBe(false);

    act(() => {
      lastStream().emit({ type: "step", step: 1 });
      lastStream().emit({ type: "delta", step: 1, text: "Hisoblayapman" });
      lastStream().emit({ type: "tool_call", step: 1, id: "t1", tool: "get_cashbox_history" });
    });
    expect(pendingOf(hook)).toMatchObject({ text: "Hisoblayapman", collecting: true });

    act(() => {
      lastStream().emit({ type: "tool_result", step: 1, id: "t1", tool: "get_cashbox_history", ok: true });
      lastStream().emit({ type: "step", step: 2 });
      lastStream().emit({ type: "delta", step: 2, text: "Kassaga " });
      lastStream().emit({ type: "delta", step: 2, text: "286 mln" });
    });
    expect(pendingOf(hook)).toMatchObject({ text: "Kassaga 286 mln", collecting: false });

    mocks.conversation = { ...mocks.conversation, messages: [question("900"), answer("905", "**286 mln**")] };
    act(() => {
      lastStream().emit({
        type: "done",
        conversationId: "42",
        messageId: "905",
        answer: "**286 mln**",
        stop: "end_turn",
        sources: [],
        limits: { dailyLimit: 100, usedToday: 39, remainingToday: 61 },
      });
      lastStream().finish({ kind: "ended", terminal: "done" });
    });
    expect(queryClient.getQueryData<AiAccessState>(queryKeys.aiAssistant.accessMe)).toMatchObject({ usedToday: 39, remainingToday: 61 });
    expect(invalidatedKeys()).toEqual(expect.arrayContaining([JSON.stringify(queryKeys.aiAssistant.conversations), JSON.stringify(queryKeys.aiAssistant.conversation("42"))]));
    // Tarixda javob paydo bo'lgach — joriy savol olinadi (takror chizilmaydi).
    await waitFor(() => expect(pendingOf(hook)).toBeNull());
    expect(hook.result.current.live).toBe(false);
  });

  it("`meta` dan keyingi xato ham limitdan ketgan: access/me, ro'yxat va suhbat yangilanadi (B11)", async () => {
    const { hook, syncUrl, invalidatedKeys } = setup();
    act(() => void hook.result.current.send("Savol"));
    act(() => lastStream().emit({ type: "meta", conversationId: "42", messageId: "900", maxSteps: 6 }));
    syncUrl();
    act(() => {
      lastStream().emit({ type: "error", code: "refused", message: "AI bu savolga javob bera olmadi", conversationId: "42", resetAt: null });
      lastStream().finish({ kind: "ended", terminal: "error" });
    });
    expect(pendingOf(hook)).toMatchObject({ phase: "error", error: { descriptionKey: "errors.codes.refused", canRetry: true } });
    expect(invalidatedKeys()).toEqual(
      expect.arrayContaining([
        JSON.stringify(queryKeys.aiAssistant.accessMe),
        JSON.stringify(queryKeys.aiAssistant.conversations),
        JSON.stringify(queryKeys.aiAssistant.conversation("42")),
      ]),
    );
  });

  it("uzilish (`meta` dan keyin): «cut», suhbat har 5 s da qayta so'raladi, javob kelsa qisman matn o'rnini egallaydi (B12)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { hook, syncUrl, invalidatedKeys } = setup();
    act(() => void hook.result.current.send("Savol"));
    act(() => {
      lastStream().emit({ type: "meta", conversationId: "42", messageId: "900", maxSteps: 6 });
      lastStream().emit({ type: "delta", step: 1, text: "Hozir marketlarga" });
    });
    syncUrl();
    mocks.conversation = { ...mocks.conversation, messages: [question("900")] };
    await act(async () => lastStream().finish({ kind: "network", error: new TypeError("network") }));
    expect(pendingOf(hook)).toMatchObject({ phase: "cut", text: "Hozir marketlarga" });

    const before = invalidatedKeys().filter((key) => key === JSON.stringify(queryKeys.aiAssistant.conversation("42"))).length;
    mocks.conversation = { ...mocks.conversation, messages: [question("900"), answer("905", "To'liq javob")] };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CUT_POLL_INTERVAL_MS);
    });
    const after = invalidatedKeys().filter((key) => key === JSON.stringify(queryKeys.aiAssistant.conversation("42"))).length;
    expect(after).toBeGreaterThan(before);
    await waitFor(() => expect(pendingOf(hook)).toBeNull());
  });

  it("«To'xtatish»: oqim uziladi, qisman matn qoladi («stopped»), savol limitdan ketgani uchun yangilanadi", async () => {
    const { hook, syncUrl, invalidatedKeys } = setup();
    act(() => void hook.result.current.send("Savol"));
    act(() => {
      lastStream().emit({ type: "meta", conversationId: "42", messageId: "900", maxSteps: 6 });
      lastStream().emit({ type: "delta", step: 1, text: "Sentyabrda sof foyda" });
    });
    syncUrl();
    const stream = lastStream();
    act(() => hook.result.current.stop());
    expect(stream.signal.aborted).toBe(true);
    expect(pendingOf(hook)).toMatchObject({ phase: "stopped", text: "Sentyabrda sof foyda" });
    expect(invalidatedKeys()).toContain(JSON.stringify(queryKeys.aiAssistant.accessMe));

    // «Qayta yuborish» — o'sha savol yangi savol sifatida, o'sha suhbatda.
    act(() => hook.result.current.retry());
    expect(lastStream().input).toEqual({ message: "Savol", conversationId: "42" });
  });

  it("suhbat almashsa (ro'yxatdan / «Orqaga») oqim to'xtatiladi va joriy savol tozalanadi", async () => {
    const { hook, setConversation } = setup("42");
    act(() => void hook.result.current.send("Savol"));
    act(() => lastStream().emit({ type: "meta", conversationId: "42", messageId: "900", maxSteps: 6 }));
    const stream = lastStream();
    setConversation("17");
    expect(stream.signal.aborted).toBe(true);
    expect(pendingOf(hook)).toBeNull();
  });

  it("busy — xabar (savol olinadi, matn maydonga qaytadi); invalid_message — maydon xatosi", async () => {
    const { hook, calls } = setup();
    act(() => void hook.result.current.send("Birinchi"));
    await act(async () => {
      lastStream().emit({ type: "error", code: "busy", message: "…", conversationId: null, resetAt: null });
      lastStream().finish({ kind: "ended", terminal: "error" });
    });
    expect(pendingOf(hook)).toBeNull();
    expect(calls.drafts).toEqual(["Birinchi"]);
    expect(toastStore.getSnapshot().some((toast) => toast.message === "Oldingi savolga javob tayyorlanmoqda — biroz kuting")).toBe(true);

    act(() => void hook.result.current.send("Ikkinchi"));
    await act(async () => lastStream().finish({ kind: "http", status: 400, body: { message: ["bad"] }, retryAfter: null }));
    expect(calls.drafts).toEqual(["Birinchi", "Ikkinchi"]);
    expect(calls.fieldErrors.at(-1)).toBe("Savol bo'sh yoki juda uzun");
  });

  it("429: access/me qayta so'raladi — limit tugagan bo'lsa sahifa holati, aks holda «Juda ko'p so'rov» (B8)", async () => {
    const { hook, calls, queryClient } = setup();
    mocks.access = { ...ACCESS, usedToday: 100, remainingToday: 0 };
    act(() => void hook.result.current.send("Savol"));
    await act(async () => lastStream().finish({ kind: "http", status: 429, body: null, retryAfter: 60 }));
    await waitFor(() => expect(pendingOf(hook)).toBeNull());
    expect(calls.drafts).toEqual(["Savol"]);
    expect(queryClient.getQueryData<AiAccessState>(queryKeys.aiAssistant.accessMe)).toMatchObject({ remainingToday: 0 });

    mocks.access = { ...ACCESS };
    act(() => void hook.result.current.send("Yana"));
    await act(async () => lastStream().finish({ kind: "http", status: 429, body: null, retryAfter: 60 }));
    await waitFor(() =>
      expect(toastStore.getSnapshot().some((toast) => toast.message === "Juda ko'p so'rov" && toast.description === "60 soniyadan keyin qayta urining.")).toBe(true),
    );
  });

  it("xarajat shifti: ogohlantirish va `reset_at` gacha kiritish o'chiq (`capped`)", async () => {
    const { hook } = setup();
    act(() => void hook.result.current.send("Savol"));
    await act(async () => {
      lastStream().emit({ type: "error", code: "assistant_usd_cap", message: "…", conversationId: null, resetAt: new Date(Date.now() + 3_600_000).toISOString() });
      lastStream().finish({ kind: "ended", terminal: "error" });
    });
    expect(pendingOf(hook)).toMatchObject({ phase: "error", error: { variant: "cap" } });
    expect(hook.result.current.capped).toBe(true);
  });

  it("`meta` dan oldin tarmoq xatosi — «Savol saqlanmadi», yangilash yo'q", async () => {
    const { hook, invalidatedKeys } = setup();
    act(() => void hook.result.current.send("Savol"));
    await act(async () => lastStream().finish({ kind: "network", error: new TypeError("x") }));
    expect(pendingOf(hook)).toMatchObject({ phase: "error", error: { descriptionKey: "errors.notSaved" } });
    expect(invalidatedKeys()).toEqual([]);
  });
});

describe("tarix va joriy savol", () => {
  it("findAnswerAfter / visibleHistory", () => {
    const messages = [question("1"), answer("2"), question("3"), answer("4", "x", "network")];
    expect(findAnswerAfter(messages, "3")?.id).toBe("4");
    expect(findAnswerAfter(messages, "9")).toBeNull();
    const pending = { questionId: "3" } as PendingTurn;
    expect(visibleHistory(messages, pending).map((message) => message.id)).toEqual(["1", "2"]);
    expect(visibleHistory(messages, null)).toHaveLength(4);
  });
});

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import type {
  AiAccessState,
  AiAssistantEvent,
  AiConversation,
  AiConversationList,
} from "../../entities/ai-advisor";
import type { StreamOutcome } from "../../features/ai-chat";

/**
 * `/ai-assistant` (F7PWp6cK, maketlar superadmin-ai-assistant, -empty, -answering, -limit-reached, -unavailable,
 * -offline): bo'sh holat va tavsiya kartalari, suhbat (markdown, «Manba», javobsiz qator), yozilmoqda va
 * «To'xtatish», AI o'chiq, limit tugadi, suhbat topilmadi, ro'yxat xatosi, holat yuklanmadi.
 */

type FakeStream = {
  input: { message: string; conversationId?: string | null };
  signal: AbortSignal;
  emit: (event: AiAssistantEvent) => void;
  finish: (outcome: StreamOutcome) => void;
};

const mocks = vi.hoisted(() => ({
  streams: [] as FakeStream[],
  access: null as unknown as AiAccessState,
  list: null as unknown as AiConversationList,
  conversation: null as unknown as AiConversation,
  getAiAccessMe: vi.fn(),
  getAiConversations: vi.fn(),
  getAiConversation: vi.fn(),
}));

vi.mock("../../features/ai-chat/api/streamMessage", () => ({
  streamAssistantMessage: (
    input: FakeStream["input"],
    { signal, onEvent }: { signal: AbortSignal; onEvent: (event: AiAssistantEvent) => void },
  ) =>
    new Promise<StreamOutcome>((resolve) => {
      signal.addEventListener("abort", () => resolve({ kind: "aborted" }));
      mocks.streams.push({ input, signal, emit: onEvent, finish: resolve });
    }),
}));

vi.mock("../../entities/ai-advisor/api/aiAssistantApi", () => ({
  getAiAccessMe: mocks.getAiAccessMe,
  getAiConversations: mocks.getAiConversations,
  getAiConversation: mocks.getAiConversation,
}));

import AiAssistantPage from ".";

const ACCESS: AiAccessState = {
  allowed: true,
  reason: null,
  featureEnabled: true,
  dailyLimit: 100,
  usedToday: 38,
  remainingToday: 62,
  resetAt: "2026-11-11T00:00:00+05:00",
};

const LIST: AiConversationList = {
  items: [
    { id: "41", title: "Oktabr tushumi va kuryer qarzlari", turns: 2, lastMessageAt: new Date().toISOString(), createdAt: null },
    { id: "40", title: "Marketlarga to'lanmagan summa", turns: 1, lastMessageAt: "2026-10-21T06:30:00.000Z", createdAt: null },
  ],
  total: 2,
  limit: 50,
  offset: 0,
};

const CONVERSATION: AiConversation = {
  id: "41",
  title: "Oktabr tushumi va kuryer qarzlari",
  turns: 2,
  createdAt: null,
  lastMessageAt: null,
  messages: [
    { id: "1", role: "user", text: "Bu oy kassaga qancha pul tushdi?", createdAt: new Date().toISOString(), sources: [], stop: null },
    {
      id: "2",
      role: "assistant",
      text: "Kassaga **286,4 mln so'm** tushdi.\n\n| Kuryer | Qarz |\n|---|---:|\n| Jasur Tursunov | 2 840 000 so'm |",
      createdAt: new Date().toISOString(),
      sources: [{ tool: "get_cashbox_history", period: { from: "2026-10-01", to: "2026-10-23" }, records: 1284, truncated: false, ok: true }],
      stop: "end_turn",
    },
    { id: "3", role: "user", text: "Kecha-chi?", createdAt: null, sources: [], stop: null },
    { id: "4", role: "assistant", text: "AI bu savolga javob bera olmadi", createdAt: null, sources: [], stop: "refused" },
  ],
};

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data: {} } });

const renderPage = (route = "/ai-assistant") => renderWithProviders(<AiAssistantPage />, { route });

const lastStream = () => mocks.streams[mocks.streams.length - 1];

beforeEach(() => {
  mocks.streams.length = 0;
  mocks.access = { ...ACCESS };
  mocks.list = { ...LIST };
  mocks.conversation = CONVERSATION;
  mocks.getAiAccessMe.mockImplementation(async () => mocks.access);
  mocks.getAiConversations.mockImplementation(async () => mocks.list);
  mocks.getAiConversation.mockImplementation(async () => mocks.conversation);
});

afterEach(() => vi.clearAllMocks());

describe("AI moliyaviy yordamchi sahifasi", () => {
  it("bo'sh suhbat: salomlashuv, 6 tavsiya kartasi, limit 38 / 100; karta bosilsa savol darhol yuboriladi", async () => {
    mocks.list = { items: [], total: 0, limit: 50, offset: 0 };
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "AI moliyaviy yordamchi" })).toBeInTheDocument();
    expect(screen.getByText("Pul oqimi, kassa va hisob-kitoblar bo'yicha savol bering. Yordamchi faqat ma'lumot o'qiydi.")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Moliya bo'yicha savol bering" })).toBeInTheDocument();
    const cards = within(screen.getByRole("group", { name: "Tavsiya savollar" })).getAllByRole("button");
    expect(cards).toHaveLength(6);
    expect(await screen.findByText("Hali suhbat yo'q.")).toBeInTheDocument();
    expect(screen.getAllByText("38 / 100 savol").length).toBeGreaterThan(0);
    // Yon ustun (≥ 1024) va ingichka qator (< 1024) — CSS bilan bittasi ko'rinadi.
    expect(screen.getAllByRole("meter", { name: "Bugungi limit: 100 savoldan 38 tasi ishlatilgan" })).toHaveLength(2);
    // T2 qismlari chizilmaydi.
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByText("Sozlamalar")).toBeNull();
    expect(screen.queryByText(/Chuqur tahlil/)).toBeNull();
    expect(screen.queryByText("Oylik budjet")).toBeNull();

    await userEvent.click(within(cards[1]).getByText("Qaysi kuryerlarda qarz ko'p?"));
    expect(lastStream().input).toEqual({ message: "Qaysi kuryerlarda qarz ko'p?", conversationId: null });
    expect(await screen.findByText("AI yordamchi · yozmoqda")).toBeInTheDocument();
  });

  it("suhbat: savol, markdown javob (jadval), «Manba», ogohlantirish; javobsiz qator — xira izoh; tanlangan suhbat ro'yxatda belgilangan", async () => {
    renderPage("/ai-assistant?conversation=41");
    const log = await screen.findByRole("log", { name: "Suhbat" });
    expect(await within(log).findByText("Bu oy kassaga qancha pul tushdi?")).toBeInTheDocument();
    expect(within(log).getByText("286,4 mln so'm").tagName).toBe("STRONG");
    expect(within(log).getByRole("cell", { name: "2 840 000 so'm" })).toBeInTheDocument();
    expect(within(log).getByText("Manba: kassa operatsiyalari 01.10–23.10.2026, 1 284 ta yozuv")).toBeInTheDocument();
    expect(within(log).getAllByText("AI xato qilishi mumkin — muhim qarordan oldin manbani tekshiring.")).toHaveLength(1);
    expect(within(log).getByRole("note")).toHaveTextContent("Javob olib bo'lmadiAI bu savolga javob bera olmadi");
    expect(within(log).getAllByRole("button", { name: "Javobni nusxalash" })).toHaveLength(1);

    const nav = await screen.findByRole("navigation", { name: "Suhbatlar tarixi" });
    expect(within(nav).getByRole("link", { name: /Oktabr tushumi va kuryer qarzlari/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("2 ta")).toBeInTheDocument();
    // Suhbat ostida 5 chip (aria-pressed yo'q — amal tugmasi).
    const chips = within(screen.getByRole("group", { name: "Tavsiya savollar" })).getAllByRole("button");
    expect(chips).toHaveLength(5);
    expect(chips[0]).not.toHaveAttribute("aria-pressed");
  });

  it("yozilmoqda: maydon o'chiq «Javob yozilmoqda…», «To'xtatish» (ikonkasiz) → «Javob to'xtatildi» + «Qayta yuborish»", async () => {
    mocks.list = { items: [], total: 0, limit: 50, offset: 0 };
    renderPage();
    const field = await screen.findByRole("textbox", { name: "Savolingiz" });
    await userEvent.type(field, "Sentyabrda nega zarar bo'ldi?");
    expect(screen.getByText("29 / 1 000")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Yuborish" }));

    expect(field).toBeDisabled();
    expect(field).toHaveAttribute("placeholder", "Javob yozilmoqda…");
    expect(screen.getByText("To'xtatish — javob shu joyda to'xtaydi")).toBeInTheDocument();
    const stop = screen.getByRole("button", { name: "To'xtatish" });
    expect(stop.querySelector("svg")).toBeNull();

    lastStream().emit({ type: "meta", conversationId: "77", messageId: "900", maxSteps: 6 });
    lastStream().emit({ type: "tool_call", step: 1, id: "t1", tool: "get_revenue_profit" });
    expect(await screen.findByText("Ma'lumot yig'ilmoqda…")).toBeInTheDocument();
    lastStream().emit({ type: "tool_result", step: 1, id: "t1", tool: "get_revenue_profit", ok: true });
    lastStream().emit({ type: "delta", step: 2, text: "Sentyabrda sof foyda" });
    expect(await screen.findByText("Sentyabrda sof foyda")).toBeInTheDocument();

    await userEvent.click(stop);
    expect(await screen.findByText("Javob to'xtatildi")).toBeInTheDocument();
    expect(screen.getByText("Sentyabrda sof foyda")).toBeInTheDocument();
    expect(screen.getByText("AI xato qilishi mumkin.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Qayta yuborish" }));
    expect(lastStream().input).toEqual({ message: "Sentyabrda nega zarar bo'ldi?", conversationId: "77" });
  });

  it("Ctrl + Enter yuboradi, Enter — yangi qator", async () => {
    mocks.list = { items: [], total: 0, limit: 50, offset: 0 };
    renderPage();
    const field = await screen.findByRole("textbox", { name: "Savolingiz" });
    await userEvent.type(field, "Bir{Enter}ikki");
    expect(field).toHaveValue("Bir\nikki");
    expect(mocks.streams).toHaveLength(0);
    fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });
    expect(lastStream().input.message).toBe("Bir\nikki");
  });

  it("AI o'chiq (feature_disabled): «AI yordamchi hozir ishlamayapti», kiritish «AI o'chiq», tarix ochiq", async () => {
    mocks.access = { ...ACCESS, allowed: false, reason: "feature_disabled", featureEnabled: false };
    renderPage();
    expect(await screen.findByText("AI yordamchi hozir ishlamayapti")).toBeInTheDocument();
    expect(screen.getByText("Xizmat vaqtincha o'chiq. Suhbatlar tarixi ochiq.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Savolingiz" })).toHaveAttribute("placeholder", "AI o'chiq");
    expect(screen.getByRole("textbox", { name: "Savolingiz" })).toBeDisabled();
    expect(await screen.findByRole("link", { name: /Marketlarga to'lanmagan summa/ })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Tavsiya savollar" })).toBeNull();

    mocks.access = { ...ACCESS };
    await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(screen.queryByText("AI yordamchi hozir ishlamayapti")).toBeNull());
  });

  it("limit tugadi: ogohlantirish, kiritish o'chiq, yon ustunda «Limit tugadi …»", async () => {
    mocks.access = { ...ACCESS, usedToday: 100, remainingToday: 0 };
    renderPage("/ai-assistant?conversation=41");
    expect(await screen.findByText("Bugungi 100 ta savol ishlatildi")).toBeInTheDocument();
    expect(screen.getByText("Yangi savol ertaga, 00:00 dan.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Savolingiz" })).toHaveAttribute("placeholder", "Limit ertaga, 00:00 da yangilanadi");
    expect(screen.getByText("Limit tugadi — ertaga, 00:00 da yangilanadi (Toshkent vaqti).")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Tavsiya savollar" })).toBeNull();
  });

  it("limit yaqin (≤ 5): «N ta savol qoldi»", async () => {
    mocks.access = { ...ACCESS, usedToday: 95, remainingToday: 5 };
    renderPage();
    expect(await screen.findByText("5 ta savol qoldi · ertaga, 00:00 da yangilanadi")).toBeInTheDocument();
  });

  it("suhbat topilmadi (404 yoki noto'g'ri ID) — «Yangi suhbat» bo'sh suhbatga qaytaradi", async () => {
    mocks.getAiConversation.mockRejectedValue(httpError(404));
    renderPage("/ai-assistant?conversation=999");
    expect(await screen.findByText("Suhbat topilmadi")).toBeInTheDocument();
    const actions = screen.getAllByRole("button", { name: "Yangi suhbat" });
    await userEvent.click(actions[actions.length - 1]);
    expect(await screen.findByRole("heading", { name: "Moliya bo'yicha savol bering" })).toBeInTheDocument();
  });

  it("suhbatlar ro'yxati yuklanmadi — xato va «Qayta urinish»", async () => {
    mocks.getAiConversations.mockRejectedValueOnce(httpError(500));
    renderPage();
    expect(await screen.findByText("Suhbatlarni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Internet aloqasini tekshirib, qayta urining.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByRole("link", { name: /Oktabr tushumi/ })).toBeInTheDocument();
  });

  it("holat (access/me) yuklanmadi — sahifa xatosi va «Qayta urinish»", async () => {
    mocks.getAiAccessMe.mockRejectedValueOnce(httpError(504));
    renderPage();
    expect(await screen.findByText("AI yordamchini ochib bo'lmadi")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByRole("textbox", { name: "Savolingiz" })).toBeInTheDocument();
  });

  it("javobni nusxalash — buferga yoziladi va xabar", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderPage("/ai-assistant?conversation=41");
    await userEvent.click(await screen.findByRole("button", { name: "Javobni nusxalash" }));
    expect(writeText).toHaveBeenCalledWith(CONVERSATION.messages[1].text);
    expect(await screen.findByText("Javob nusxalandi")).toBeInTheDocument();
  });
});

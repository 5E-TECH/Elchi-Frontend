import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiAccessState, AiConversation, AiConversationList } from "../../entities/ai-advisor";
import type { StreamOutcome } from "../../features/ai-chat";
import { advisorHttpError, advisorNetworkError, createAdvisorFixtures } from "../../test/aiAdvisorFixtures";
import { renderWithProviders } from "../../test/test-utils";

/**
 * `/ai-assistant` qobig'i (60PWUbgC, D1–D5, D12, D13; maketlar `superadmin-ai-assistant`, `-alerts`, `-tab-select`):
 * maslahatchi backend'ini aniqlash (`overview` zondi — bitta so'rov, keshlanadi), backend yo'q — avvalgi faqat suhbat
 * sahifasi (`?tab` e'tiborga olinmaydi), tablar va URL, zond kutilayotgandagi `?tab=alerts` (skelet, suhbat emas),
 * tab almashganda suhbat qoralamasi saqlanadi, sarlavha amallari, telefonda «Bo'lim» tanlovi.
 */

const mocks = vi.hoisted(() => ({
  getAiAccessMe: vi.fn(),
  getAiConversations: vi.fn(),
  getAiConversation: vi.fn(),
  getAdvisorOverview: vi.fn(),
  getAdvisorAlerts: vi.fn(),
  getAdvisorSettings: vi.fn(),
}));

vi.mock("../../features/ai-chat/api/streamMessage", () => ({
  streamAssistantMessage: (_input: unknown, { signal }: { signal: AbortSignal }) =>
    new Promise<StreamOutcome>((resolve) => signal.addEventListener("abort", () => resolve({ kind: "aborted" }))),
}));

vi.mock("../../entities/ai-advisor/api/aiAssistantApi", () => ({
  getAiAccessMe: mocks.getAiAccessMe,
  getAiConversations: mocks.getAiConversations,
  getAiConversation: mocks.getAiConversation,
}));

vi.mock("../../entities/ai-advisor/api/aiAdvisorApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/ai-advisor/api/aiAdvisorApi")>()),
  getAdvisorOverview: mocks.getAdvisorOverview,
  getAdvisorAlerts: mocks.getAdvisorAlerts,
  getAdvisorSettings: mocks.getAdvisorSettings,
}));

import AiAssistantPage from ".";

const fx = createAdvisorFixtures();

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
  items: [{ id: "41", title: "Oktabr tushumi", turns: 1, lastMessageAt: new Date().toISOString(), createdAt: null }],
  total: 1,
  limit: 50,
  offset: 0,
};

const CONVERSATION: AiConversation = {
  id: "41",
  title: "Oktabr tushumi",
  turns: 1,
  createdAt: null,
  lastMessageAt: null,
  messages: [
    { id: "1", role: "user", text: "Bu oy kassaga qancha pul tushdi?", createdAt: new Date().toISOString(), sources: [], stop: null },
    {
      id: "2",
      role: "assistant",
      text: "Kassaga **286,4 mln so'm** tushdi.",
      createdAt: new Date().toISOString(),
      sources: [{ tool: "get_cashbox_history", period: { from: "2026-10-01", to: "2026-10-23" }, records: 1284, truncated: false, ok: true }],
      stop: "end_turn",
    },
  ],
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const LocationProbe = () => {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
};
const currentParams = () => new URLSearchParams(screen.getByTestId("search").textContent ?? "");

const renderPage = (route = "/ai-assistant") =>
  renderWithProviders(
    <>
      <AiAssistantPage />
      <LocationProbe />
    </>,
    { route },
  );

const PHONE_QUERY = "(max-width: 767px)";
const usePhoneViewport = () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === PHONE_QUERY,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

const composer = () => screen.getByRole("textbox", { name: "Savolingiz" });
const emptyChatHeading = () => screen.findByRole("heading", { name: "Moliya bo'yicha savol bering" });

beforeEach(() => {
  mocks.getAiAccessMe.mockResolvedValue({ ...ACCESS });
  mocks.getAiConversations.mockResolvedValue({ ...LIST });
  mocks.getAiConversation.mockResolvedValue(CONVERSATION);
  mocks.getAdvisorOverview.mockResolvedValue(fx.overview);
  mocks.getAdvisorAlerts.mockResolvedValue(fx.list);
  mocks.getAdvisorSettings.mockRejectedValue(advisorHttpError(404));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("AI yordamchi qobig'i — backend yo'q (faqat suhbat)", () => {
  it.each([
    ["404", () => advisorHttpError(404)],
    ["501", () => advisorHttpError(501)],
    ["403", () => advisorHttpError(403)],
    ["tarmoq", () => advisorNetworkError()],
  ])("%s: tablar va «Sozlamalar» yo'q, ?tab=alerts e'tiborga olinmaydi, zond bir marta", async (_label, error) => {
    mocks.getAdvisorOverview.mockRejectedValue(error());
    renderPage("/ai-assistant?tab=alerts&alert=1041&status=new");

    expect(await emptyChatHeading()).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "AI moliyaviy yordamchi" })).toBeInTheDocument();
    expect(screen.getByText("Pul oqimi, kassa va hisob-kitoblar bo'yicha savol bering. Yordamchi faqat ma'lumot o'qiydi.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Yangi suhbat" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("tabpanel")).toBeNull();
    expect(screen.queryByText("Sozlamalar")).toBeNull();
    expect(screen.queryByText("Ogohlantirishlar")).toBeNull();
    // Xato UI yo'q, URL tegilmaydi.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(currentParams().toString()).toBe("tab=alerts&alert=1041&status=new");

    expect(mocks.getAdvisorOverview).toHaveBeenCalledTimes(1);
    expect(mocks.getAdvisorSettings).not.toHaveBeenCalled();
    expect(mocks.getAdvisorAlerts).not.toHaveBeenCalled();
  });

  it("«Yangi suhbat» (MessageSquarePlus) sarlavhada; «Manba» qatori — Database ikonkasi", async () => {
    mocks.getAdvisorOverview.mockRejectedValue(advisorHttpError(404));
    const { container } = renderPage("/ai-assistant?conversation=41");
    const log = await screen.findByRole("log", { name: "Suhbat" });
    const source = await within(log).findByText("Manba: kassa operatsiyalari 01.10–23.10.2026, 1 284 ta yozuv");
    expect(source.parentElement?.querySelector("svg.lucide-database")).not.toBeNull();

    const newChat = await screen.findByRole("button", { name: "Yangi suhbat" });
    expect(newChat.querySelector("svg.lucide-message-square-plus")).not.toBeNull();
    expect(container.querySelector("svg.lucide-plus")).toBeNull();
    await userEvent.click(newChat);
    await waitFor(() => expect(currentParams().has("conversation")).toBe(false));
    expect(await emptyChatHeading()).toBeInTheDocument();
  });
});

describe("AI yordamchi qobig'i — backend bor", () => {
  it("tablar «Suhbat · Ogohlantirishlar 3», yangi izoh; tab almashsa URL va panel, suhbat qoralamasi saqlanadi", async () => {
    const user = userEvent.setup();
    renderPage();

    const tablist = await screen.findByRole("tablist", { name: "AI yordamchi bo'limlari" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Suhbat", "Ogohlantirishlar 3"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Kassa, qarzlar va xarajatlar bo'yicha savol va ogohlantirishlar. Yordamchi faqat ma'lumot o'qiydi.")).toBeInTheDocument();
    // Hisobotlar, Tavsiyalar, Sarf — backend yo'q.
    expect(screen.queryByRole("tab", { name: /Hisobotlar|Tavsiyalar|Sarf/ })).toBeNull();

    const chatPanel = screen.getByRole("tabpanel", { name: "Suhbat" });
    expect(tabs[0]).toHaveAttribute("aria-controls", chatPanel.id);
    expect(await emptyChatHeading()).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Yangi suhbat" })).toBeInTheDocument();

    await user.type(composer(), "Kecha-chi?");
    await user.click(tabs[1]);

    expect(currentParams().get("tab")).toBe("alerts");
    const table = await screen.findByRole("table", { name: "Ogohlantirishlar ro'yxati" });
    expect(within(table).getAllByRole("row").slice(1)).toHaveLength(8);
    expect(screen.getByRole("tabpanel", { name: "Ogohlantirishlar 3" })).toContainElement(table);
    // Suhbat yashirin (o'chirilmagan), sarlavhada «Yangi suhbat» yo'q.
    expect(screen.queryByRole("textbox", { name: "Savolingiz" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Yangi suhbat" })).toBeNull();
    expect(mocks.getAdvisorAlerts).toHaveBeenCalledWith({ page: 1, limit: 10 });

    await user.click(screen.getByRole("tab", { name: "Suhbat" }));
    expect(currentParams().has("tab")).toBe(false);
    expect(composer()).toHaveValue("Kecha-chi?");
    expect(screen.getByRole("button", { name: "Yangi suhbat" })).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Ogohlantirishlar ro'yxati" })).toBeNull();
    // Zond bitta; sozlamalar (S6) hali so'ralmaydi.
    expect(mocks.getAdvisorOverview).toHaveBeenCalledTimes(1);
    expect(mocks.getAiAccessMe).toHaveBeenCalledTimes(1);
  });

  it("«Ogohlantirishlar» dan chiqishda ochiq oyna (`alert`) olinadi, filtrlar va boshqa kalitlar qoladi", async () => {
    const user = userEvent.setup();
    mocks.getAdvisorAlerts.mockResolvedValue({ ...fx.list, items: fx.list.items.filter((item) => item.status === "new") });
    renderPage("/ai-assistant?tab=alerts&status=new&alert=1041");

    expect(await screen.findByRole("table", { name: "Ogohlantirishlar ro'yxati" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ogohlantirishlar 3" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Suhbat" }));

    const params = currentParams();
    expect(params.has("tab")).toBe(false);
    expect(params.has("alert")).toBe(false);
    expect(params.get("status")).toBe("new");
    expect(await emptyChatHeading()).toBeInTheDocument();
  });

  it("noma'lum ?tab — «Suhbat»; yangi ogohlantirish yo'q — nishonsiz", async () => {
    mocks.getAdvisorOverview.mockResolvedValue({ ...fx.overview, alerts: { ...fx.overview.alerts, new: 0, critical: 0, critical_rule_keys: [] } });
    renderPage("/ai-assistant?tab=usage");
    const tablist = await screen.findByRole("tablist", { name: "AI yordamchi bo'limlari" });
    expect(within(tablist).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Suhbat", "Ogohlantirishlar"]);
    expect(within(tablist).getByRole("tab", { name: "Suhbat" })).toHaveAttribute("aria-selected", "true");
    expect(await emptyChatHeading()).toBeInTheDocument();
  });
});

describe("AI yordamchi qobig'i — zond kutilayotganda", () => {
  it("?tab=alerts: sarlavha + skelet, suhbat ko'rinmaydi; zond javobidan keyin — panel", async () => {
    const probe = deferred<typeof fx.overview>();
    mocks.getAdvisorOverview.mockReturnValue(probe.promise);
    renderPage("/ai-assistant?tab=alerts");

    expect(screen.getByRole("heading", { level: 1, name: "AI moliyaviy yordamchi" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Ogohlantirishlar yuklanmoqda" })).toBeInTheDocument();
    // Suhbat holati yuklansa ham ko'rinmaydi.
    await waitFor(() => expect(mocks.getAiAccessMe).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Moliya bo'yicha savol bering" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Savolingiz" })).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();

    probe.resolve(fx.overview);
    expect(await screen.findByRole("table", { name: "Ogohlantirishlar ro'yxati" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ogohlantirishlar 3" })).toHaveAttribute("aria-selected", "true");
  });

  it("?tab=alerts: zond 404 bo'lsa — avvalgi suhbat sahifasi", async () => {
    const probe = deferred<typeof fx.overview>();
    mocks.getAdvisorOverview.mockReturnValue(probe.promise);
    renderPage("/ai-assistant?tab=alerts");
    expect(screen.getByRole("status", { name: "Ogohlantirishlar yuklanmoqda" })).toBeInTheDocument();

    probe.reject(advisorHttpError(404));
    expect(await emptyChatHeading()).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Ogohlantirishlar yuklanmoqda" })).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(mocks.getAdvisorAlerts).not.toHaveBeenCalled();
  });

  it("?tab=chat (sukut): suhbat darhol, tablar zonddan keyin — qoralama yo'qolmaydi", async () => {
    const user = userEvent.setup();
    const probe = deferred<typeof fx.overview>();
    mocks.getAdvisorOverview.mockReturnValue(probe.promise);
    renderPage();

    expect(await emptyChatHeading()).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    await user.type(composer(), "Bu oy-chi?");

    probe.resolve(fx.overview);
    expect(await screen.findByRole("tablist", { name: "AI yordamchi bo'limlari" })).toBeInTheDocument();
    expect(composer()).toHaveValue("Bu oy-chi?");
  });
});

describe("AI yordamchi qobig'i — telefon", () => {
  it("tablar o'rnida «Bo'lim» tanlovi: «3 yangi» nishoni, tanlansa — panel (region)", async () => {
    usePhoneViewport();
    const user = userEvent.setup();
    renderPage();

    const select = await screen.findByRole("combobox", { name: "Bo'lim: Suhbat" });
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("region", { name: "Suhbat" })).toBeInTheDocument();

    await user.click(select);
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Suhbat", "Ogohlantirishlar3 yangi"]);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    await user.click(options[1]);

    expect(currentParams().get("tab")).toBe("alerts");
    expect(await screen.findByRole("combobox", { name: "Bo'lim: Ogohlantirishlar" })).toBeInTheDocument();
    const region = screen.getAllByRole("region", { name: "Ogohlantirishlar" })[0];
    expect(region).toHaveAttribute("id", "ai-assistant-panel-alerts");
    expect(await within(region).findByText("Jasur Tursunov kassasida 2 840 000 so'm — 4 kundan beri topshirilmagan")).toBeInTheDocument();
  });
});

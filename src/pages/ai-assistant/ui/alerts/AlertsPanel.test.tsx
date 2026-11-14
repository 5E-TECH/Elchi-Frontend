import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiAdvisorAlertListData, AiAdvisorAlertListItem } from "../../../../entities/ai-advisor";
import {
  advisorEnvelope,
  advisorHttpError,
  createAdvisorFixtures,
} from "../../../../test/aiAdvisorFixtures";
import { renderWithProviders } from "../../../../test/test-utils";
import AlertsPanel from "./AlertsPanel";

/**
 * «Ogohlantirishlar» paneli (maketlar `superadmin-ai-assistant-alerts`, `-alerts-filters-mobile`): filtrlar ↔ URL
 * (`status`, `severity`, `rule` → `rule_key`, `page`, `limit`; noto'g'ri qiymatlar tozalanadi), jiddiylar banneri,
 * segment sonlari, bo'sh / filtr bo'yicha bo'sh / xato holatlari, sahifani qisish, telefon kartalari va filtr varag'i
 * (qoralama, «Natijalarni ko'rsatish (N)», × — bekor).
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const fx = createAdvisorFixtures();

type ListParams = Record<string, string | number | undefined>;
type ListHandler = (params: ListParams) => Promise<{ data: unknown }>;

const listOf = (items: AiAdvisorAlertListItem[], meta: Partial<AiAdvisorAlertListData["meta"]> = {}): AiAdvisorAlertListData => ({
  items,
  meta: { page: 1, limit: 10, total: items.length, totalPages: Math.max(1, Math.ceil(items.length / 10)), ...meta },
  counts: fx.list.counts,
});

const ok = (data: unknown) => Promise.resolve({ data: advisorEnvelope(data) });

let overviewHandler: () => Promise<{ data: unknown }>;
let listHandler: ListHandler;

const listCalls = () =>
  mocks.get.mock.calls
    .filter(([url, config]) => url === "ai/advisor/alerts" && (config as { params: ListParams }).params.limit !== 1)
    .map(([, config]) => (config as { params: ListParams }).params);
const countCalls = () =>
  mocks.get.mock.calls
    .filter(([url, config]) => url === "ai/advisor/alerts" && (config as { params: ListParams }).params.limit === 1)
    .map(([, config]) => (config as { params: ListParams }).params);

const LocationProbe = () => {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
};
const currentParams = () => new URLSearchParams(screen.getByTestId("search").textContent ?? "");

const open = (route = "/ai-assistant?tab=alerts") =>
  renderWithProviders(
    <>
      <AlertsPanel />
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

const table = () => screen.findByRole("table", { name: "Ogohlantirishlar ro'yxati" });

beforeEach(() => {
  overviewHandler = () => ok(fx.overview);
  listHandler = () => ok(fx.list);
  mocks.get.mockImplementation((url: string, config?: { params?: ListParams }) => {
    if (url === "ai/advisor/overview") return overviewHandler();
    if (url === "ai/advisor/alerts") return listHandler(config?.params ?? {});
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("AlertsPanel — ro'yxat (desktop)", () => {
  it("renders the banner, status counts, rows and pagination as in the mockup", async () => {
    open();

    const rows = within(await table()).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(8);

    // Banner: faqat yangi jiddiylar, qoidalar nomi.
    const banner = await screen.findByTestId("ai-alerts-critical-banner");
    expect(banner).toHaveTextContent("2 ta jiddiy ogohlantirish ko'rib chiqilmagan");
    expect(banner).toHaveTextContent("Kuryer qarzi o'smoqda · Chek yoki karta farqi");
    expect(within(banner).getByRole("button", { name: "Faqat jiddiylar" })).toHaveAttribute("aria-pressed", "false");

    // Holat segmenti: son faqat ochiq holatlarda.
    const status = screen.getByRole("radiogroup", { name: "Holat" });
    expect(within(status).getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
      "Barchasi",
      "Yangi 3",
      "Ko'rildi 3",
      "Hal qilindi",
      "Ahamiyatsiz",
    ]);
    expect(within(status).getByRole("radio", { name: "Barchasi" })).toHaveAttribute("aria-checked", "true");

    // Birinchi qator: R2 — «Jiddiy», sarlavha-havola oynani ochadi (`?alert=1041`, tab saqlanadi), «Yangi», «1 marta».
    const first = within(rows[0]);
    expect(first.getByText("Jiddiy")).toBeInTheDocument();
    const link = first.getByRole("link", { name: "Jasur Tursunov kassasida 2 840 000 so'm — 4 kundan beri topshirilmagan" });
    expect(link).toHaveAttribute("href", "/ai-assistant?tab=alerts&alert=1041");
    expect(first.getByText("Kuryer qarzi o'smoqda · Toshkent HQ")).toBeInTheDocument();
    expect(first.getByText("Yangi")).toBeInTheDocument();
    expect(first.getByText("1 marta")).toBeInTheDocument();
    expect(first.getByText(/^Bugun, \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(
      first.getByRole("link", { name: "«Jasur Tursunov kassasida 2 840 000 so'm — 4 kundan beri topshirilmagan» ogohlantirishini ochish" }),
    ).toBeInTheDocument();
    expect(within(rows[1]).getByText("3 marta")).toBeInTheDocument();
    expect(within(rows[6]).getByText("Hal qilindi")).toBeInTheDocument();
    expect(within(rows[7]).getByText("Ahamiyatsiz")).toBeInTheDocument();

    expect(screen.getByText("22 ta")).toBeInTheDocument();
    expect(screen.getByText("1–10 / 22 ta ogohlantirish")).toBeInTheDocument();
    expect(screen.getByText("Yordamchi faqat ogohlantiradi — pul amali tegishli bo'limning o'zida qilinadi.")).toBeInTheDocument();

    expect(listCalls()).toEqual([{ page: 1, limit: 10 }]);
  });

  it("opens an alert with a history push (row click and title link)", async () => {
    const user = userEvent.setup();
    open("/ai-assistant?tab=alerts&status=new");
    const rows = within(await table()).getAllByRole("row").slice(1);

    await user.click(within(rows[1]).getByText("Smena kamomadi · Samarqand filiali"));
    expect(currentParams().get("alert")).toBe("1040");
    expect(currentParams().get("status")).toBe("new");
    // Tafsilot so'ralmaydi (GET ogohlantirishni «Ko'rildi» qiladi — oyna S4 da).
    expect(mocks.get.mock.calls.some(([url]) => String(url).startsWith("ai/advisor/alerts/"))).toBe(false);
  });

  it("reads filters from the URL and sends rule as rule_key", async () => {
    listHandler = (params) => ok(listOf([fx.byRule.R3], { page: Number(params.page), limit: Number(params.limit), total: 30, totalPages: 2 }));
    open("/ai-assistant?tab=alerts&status=seen&severity=warning&rule=R3&page=2&limit=25");

    await table();
    expect(listCalls()).toEqual([{ page: 2, limit: 25, status: "seen", severity: "warning", rule_key: "R3" }]);
    expect(screen.getByRole("radio", { name: /^Ko'rildi/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("combobox", { name: "Jiddiylik" })).toHaveTextContent("Diqqat");
    expect(screen.getByRole("combobox", { name: "Turi" })).toHaveTextContent("G'ayrioddiy xarajat");
  });

  it("drops invalid URL values and keeps foreign keys", async () => {
    open("/ai-assistant?tab=alerts&conversation=9&status=foo&severity=high&rule=R9&page=0&limit=7");

    await table();
    await waitFor(() => expect(currentParams().toString()).toBe("tab=alerts&conversation=9"));
    expect(listCalls()).toEqual([{ page: 1, limit: 10 }]);
  });

  it("writes filter changes with replace and resets the page", async () => {
    const user = userEvent.setup();
    listHandler = (params) => ok(listOf(fx.items, { page: Number(params.page), total: 22, totalPages: 3 }));
    open("/ai-assistant?tab=alerts&page=2");
    await table();

    await user.click(screen.getByRole("radio", { name: /^Yangi/ }));
    await waitFor(() => expect(currentParams().toString()).toBe("tab=alerts&status=new"));

    await user.click(screen.getByRole("combobox", { name: "Turi" }));
    await user.click(await screen.findByRole("option", { name: "Zarar" }));
    await waitFor(() => expect(currentParams().get("rule")).toBe("R6"));
    await waitFor(() => expect(listCalls().at(-1)).toEqual({ page: 1, limit: 10, status: "new", rule_key: "R6" }));

    // Sahifa — URL'da, filtr o'zgarmaydi.
    await waitFor(() => expect(screen.getByRole("button", { name: "2" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "2" }));
    await waitFor(() => expect(currentParams().get("page")).toBe("2"));
    expect(currentParams().get("rule")).toBe("R6");
  });

  it("clamps a page past the end after the response", async () => {
    listHandler = (params) =>
      ok(Number(params.page) > 3 ? listOf([], { page: Number(params.page), total: 22, totalPages: 3 }) : listOf(fx.items, { page: Number(params.page), total: 22, totalPages: 3 }));
    open("/ai-assistant?tab=alerts&page=7");

    await waitFor(() => expect(currentParams().get("page")).toBe("3"));
    await table();
    // Oraliqda bo'sh holat chizilmaydi.
    expect(screen.queryByText("Hammasi joyida")).not.toBeInTheDocument();
  });
});

describe("AlertsPanel — banner", () => {
  it("«Faqat jiddiylar» narrows the table, then «Hammasini ko'rsatish» clears severity", async () => {
    const user = userEvent.setup();
    listHandler = (params) =>
      ok(params.severity === "critical" ? listOf([fx.byRule.R2, fx.byRule.R7, fx.byRule.R6]) : fx.list);
    open();
    const banner = await screen.findByTestId("ai-alerts-critical-banner");
    await table();

    await user.click(within(banner).getByRole("button", { name: "Faqat jiddiylar" }));
    await waitFor(() => expect(currentParams().get("severity")).toBe("critical"));
    expect(await within(banner).findByText("Jadvalda faqat jiddiylar: 3 ta")).toBeInTheDocument();
    const showAll = within(banner).getByRole("button", { name: "Hammasini ko'rsatish" });
    expect(showAll).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Jiddiylik" })).toHaveTextContent("Jiddiy");

    await user.click(showAll);
    await waitFor(() => expect(currentParams().has("severity")).toBe(false));
    expect(within(banner).getByText("Kuryer qarzi o'smoqda · Chek yoki karta farqi")).toBeInTheDocument();
  });

  it("has no banner without new critical alerts or without the advisor overview", async () => {
    overviewHandler = () => ok({ ...fx.overview, alerts: { ...fx.overview.alerts, critical: 0, critical_rule_keys: [] } });
    const first = open();
    await table();
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("ai/advisor/overview", expect.anything()));
    expect(screen.queryByTestId("ai-alerts-critical-banner")).not.toBeInTheDocument();
    first.unmount();

    overviewHandler = () => Promise.reject(advisorHttpError(404));
    open();
    await table();
    expect(screen.queryByTestId("ai-alerts-critical-banner")).not.toBeInTheDocument();
  });
});

describe("AlertsPanel — holatlar", () => {
  it("shows «Hammasi joyida» without filters", async () => {
    listHandler = () => ok(listOf([]));
    open();
    expect(await screen.findByText("Hammasi joyida")).toBeInTheDocument();
    expect(screen.getByText("Ochiq ogohlantirish yo'q. Qoidalar har 30 daqiqada tekshiriladi.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Sahifalar" })).not.toBeInTheDocument();
  });

  it("shows the filter summary and clears filters", async () => {
    const user = userEvent.setup();
    listHandler = (params) => ok(params.status ? listOf([]) : fx.list);
    open("/ai-assistant?tab=alerts&status=new&severity=critical&rule=R6");

    expect(await screen.findByText("Bu filtr bo'yicha ogohlantirish yo'q")).toBeInTheDocument();
    expect(screen.getByText("Jiddiy · Zarar · Yangi — hech narsa topilmadi.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));
    await waitFor(() => expect(currentParams().toString()).toBe("tab=alerts"));
    await table();
  });

  it("shows the error state and retries", async () => {
    const user = userEvent.setup();
    let fail = true;
    listHandler = () => (fail ? Promise.reject(advisorHttpError(500)) : ok(fx.list));
    open();

    expect(await screen.findByText("Ogohlantirishlarni yuklab bo'lmadi")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(within(await table()).getAllByRole("row")).toHaveLength(9);
  });
});

describe("AlertsPanel — telefon", () => {
  beforeEach(() => usePhoneViewport());

  it("renders cards with occurrences only when repeated", async () => {
    open();
    const cards = await screen.findByRole("list", { name: "Ogohlantirishlar ro'yxati" });
    const links = within(cards).getAllByRole("link");
    expect(links).toHaveLength(8);
    expect(links[0]).toHaveAttribute("href", "/ai-assistant?tab=alerts&alert=1041");
    expect(links[0]).toHaveTextContent(/Kuryer qarzi o'smoqda · Toshkent HQ · Bugun, \d{2}:\d{2}/);
    expect(links[0]).not.toHaveTextContent("marta");
    expect(links[1]).toHaveTextContent(/Smena kamomadi · Samarqand filiali · 3 marta · Bugun/);
    expect(screen.queryByRole("radiogroup", { name: "Holat" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Holat" })).toHaveTextContent("Barchasi");
  });

  it("filters sheet: draft, live count and apply", async () => {
    const user = userEvent.setup();
    listHandler = (params) => {
      if (params.limit === 1) return ok(listOf([fx.byRule.R6], { limit: 1, total: params.rule_key === "R6" ? 2 : 22, totalPages: 22 }));
      return ok(fx.list);
    };
    open();
    await screen.findByRole("list", { name: "Ogohlantirishlar ro'yxati" });

    await user.click(screen.getByRole("button", { name: "Filtrlar" }));
    const sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    expect(within(sheet).getByText("0 ta filtr tanlangan")).toBeInTheDocument();
    expect(within(sheet).getByText("8 ta qoida")).toBeInTheDocument();
    expect(await within(sheet).findByRole("button", { name: /^Natijalarni ko'rsatish\s*\(22\)$/ })).toBeInTheDocument();

    await user.click(within(sheet).getByRole("radio", { name: /^Yangi/ }));
    await user.click(within(within(sheet).getByRole("radiogroup", { name: "Jiddiylik" })).getByRole("radio", { name: "Jiddiy" }));
    await user.click(within(sheet).getByRole("button", { name: "Zarar" }));
    expect(within(sheet).getByRole("button", { name: "Zarar" })).toHaveAttribute("aria-pressed", "true");
    expect(within(sheet).getByRole("button", { name: "Barchasi" })).toHaveAttribute("aria-pressed", "false");
    expect(within(sheet).getByText("3 ta filtr tanlangan")).toBeInTheDocument();
    expect(await within(sheet).findByRole("button", { name: /^Natijalarni ko'rsatish\s*\(2\)$/ })).toBeInTheDocument();
    expect(countCalls().at(-1)).toEqual({ page: 1, limit: 1, status: "new", severity: "critical", rule_key: "R6" });
    // Qoralama URL'ga yozilmagan.
    expect(currentParams().toString()).toBe("tab=alerts");

    await user.click(within(sheet).getByRole("button", { name: /^Natijalarni ko'rsatish\s*\(2\)$/ }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filtrlar" })).not.toBeInTheDocument());
    expect(currentParams().toString()).toBe("tab=alerts&status=new&severity=critical&rule=R6");
    expect(screen.getByRole("combobox", { name: "Holat" })).toHaveTextContent("Yangi");
    // «Filtrlar» tugmasida — varaqadagi (qatorda ko'rinmaydigan) filtrlar soni.
    expect(screen.getByRole("button", { name: /^Filtrlar\s*2$/ })).toBeInTheDocument();
  });

  it("filters sheet: × discards the draft, «Tozalash» clears only the draft", async () => {
    const user = userEvent.setup();
    open("/ai-assistant?tab=alerts&severity=warning");
    await screen.findByRole("list", { name: "Ogohlantirishlar ro'yxati" });

    await user.click(screen.getByRole("button", { name: /^Filtrlar\s*1$/ }));
    let sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    expect(within(within(sheet).getByRole("radiogroup", { name: "Jiddiylik" })).getByRole("radio", { name: "Diqqat" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(within(sheet).getByRole("button", { name: "Tozalash" }));
    expect(within(sheet).getByText("0 ta filtr tanlangan")).toBeInTheDocument();
    expect(currentParams().get("severity")).toBe("warning");

    await user.click(within(sheet).getByRole("button", { name: "Filtrlarni yopish" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filtrlar" })).not.toBeInTheDocument());
    expect(currentParams().toString()).toBe("tab=alerts&severity=warning");

    // Qayta ochilganda — URL'dagi qiymat (bekor qilingan qoralama emas).
    await user.click(screen.getByRole("button", { name: /^Filtrlar\s*1$/ }));
    sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    expect(within(sheet).getByText("1 ta filtr tanlangan")).toBeInTheDocument();
  });
});

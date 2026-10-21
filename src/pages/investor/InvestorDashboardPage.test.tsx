import { screen, waitFor, within } from "@testing-library/react";
import type { AxiosRequestConfig } from "axios";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RootState } from "../../app/config/store";
import { api } from "../../shared/api/api";
import { renderWithProviders } from "../../test/test-utils";
import InvestorDashboardPage from "./InvestorDashboardPage";

/**
 * IN-1 — investor bosh sahifasi (maketlar `investor-dashboard-home`, `-home-table`, `-loading`, `-empty`, `-error`,
 * `-forbidden`, `-not-linked`). API — `api.get` soxta; xom backend matni hech qayerda ko'rinmaydi.
 */

const NOW = new Date(2026, 9, 21, 12, 0);

const logoutAndRedirect = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../auth/authService", () => ({ default: { logoutAndRedirect } }));

const MONTHS_12 = [
  ["2025-11", 0, 0],
  ["2025-12", 0, 0],
  ["2026-01", 2_400_000, 0],
  ["2026-02", 3_100_000, 0],
  ["2026-03", 3_600_000, 0],
  ["2026-04", 4_400_000, 0],
  ["2026-05", 5_000_000, 0],
  ["2026-06", 5_300_000, 0],
  ["2026-07", 4_900_000, 0],
  ["2026-08", 5_600_000, 0],
  ["2026-09", 0, 6_200_000],
  ["2026-10", 0, 0],
] as const;

const dashboardBody = (months = 12) => ({
  statusCode: 200,
  message: "success",
  data: {
    investor: { id: "7", name: "Habibulla Nazirov", phone_number: "+998901112233", status: "active" },
    summary: {
      total_invested: 450_000_000,
      investments_count: 5,
      last_invested_at: "2026-08-01T00:00:00+05:00",
      total_paid_profit: 34_300_000,
      total_unpaid_profit: 6_200_000,
      total_profit: 40_500_000,
      profit_shares_count: 9,
      current_percentage: 12.5,
      last_paid_at: "2026-09-05T10:00:00+05:00",
    },
    monthly: {
      months,
      items: MONTHS_12.slice(12 - Math.min(months, 12)).map(([month, paid, unpaid]) => ({
        month,
        paid_amount: paid,
        unpaid_amount: unpaid,
        total_amount: paid + unpaid,
      })),
    },
  },
});

const investmentsBody = {
  data: {
    items: [
      { id: "1", amount: 100_000_000, invested_at: "2026-08-01T00:00:00+05:00" },
      { id: "2", amount: 50_000_000, invested_at: "2026-06-20T00:00:00+05:00" },
      { id: "3", amount: 100_000_000, invested_at: "2026-04-12T00:00:00+05:00" },
    ],
    meta: { page: 1, limit: 3, total: 5, totalPages: 2 },
    summary: { total_amount: 450_000_000 },
  },
};

const profitsBody = {
  data: {
    items: [
      {
        id: "11",
        amount: 6_200_000,
        percentage: 12.5,
        period_start: "2026-09-01T00:00:00+05:00",
        period_end: "2026-09-30T23:59:59+05:00",
        is_paid: false,
        paid_at: null,
      },
      {
        id: "10",
        amount: 5_600_000,
        percentage: 12.5,
        period_start: "2026-08-01T00:00:00+05:00",
        period_end: "2026-08-31T23:59:59+05:00",
        is_paid: true,
        paid_at: "2026-09-05T10:00:00+05:00",
      },
    ],
    meta: { page: 1, limit: 5, total: 2, totalPages: 1 },
    summary: { total_paid_amount: 34_300_000, total_unpaid_amount: 6_200_000 },
  },
};

const emptyBodies = {
  dashboard: {
    data: {
      investor: { id: "7", name: "Habibulla Nazirov", status: "active" },
      summary: {
        total_invested: 0,
        investments_count: 0,
        last_invested_at: null,
        total_paid_profit: 0,
        total_unpaid_profit: 0,
        profit_shares_count: 0,
        current_percentage: null,
        last_paid_at: null,
      },
      monthly: { months: 12, items: MONTHS_12.map(([month]) => ({ month, paid_amount: 0, unpaid_amount: 0, total_amount: 0 })) },
    },
  },
  list: { data: { items: [], meta: { page: 1, limit: 3, total: 0, totalPages: 1 }, summary: { total_amount: 0 } } },
};

const httpError = (status: number, message = "investor profile is inactive") =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: { statusCode: status, message } },
  });

type Handler = (url: string, params: Record<string, unknown> | undefined) => unknown;

const mockApi = (handler: Handler) =>
  vi.spyOn(api, "get").mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
    const result = handler(url, config?.params as Record<string, unknown> | undefined);
    if (result instanceof Error) throw result;
    return { data: result } as never;
  });

const happy: Handler = (url, params) => {
  if (url === "investors/me/dashboard") return dashboardBody(Number(params?.months ?? 12));
  if (url === "investors/me/investments") return investmentsBody;
  if (url === "investors/me/profits") return profitsBody;
  throw new Error(`kutilmagan so'rov: ${url}`);
};

const investorState = {
  role: { id: "42", role: "investor", region: null, name: null },
  user: {
    user: { id: "42", role: "investor", name: "Habibulla Nazirov" },
    isAuthenticated: true,
    accessToken: "t",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as unknown as Partial<RootState>;

const renderPage = () =>
  renderWithProviders(<InvestorDashboardPage now={NOW} />, { route: "/", preloadedState: investorState });

const asPhone = () => {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query.includes("max-width: 767px"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
};

beforeEach(() => {
  logoutAndRedirect.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InvestorDashboardPage — ma'lumot bilan (investor-dashboard-home)", () => {
  it("sarlavha, KPI, oylik foyda grafigi va izoh; so'rovlar maket parametrlari bilan", async () => {
    const get = mockApi(happy);
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Bosh sahifa" })).toBeInTheDocument();
    expect(await screen.findByText("Investor kabineti · Habibulla Nazirov")).toBeInTheDocument();

    const kpis = screen.getByRole("region", { name: "Asosiy ko'rsatkichlar" });
    expect(within(kpis).getByText("Mening investitsiyam")).toBeInTheDocument();
    expect(await within(kpis).findByText("5 ta investitsiya · oxirgisi 01.08.2026")).toBeInTheDocument();
    expect(within(kpis).getByText("Oxirgi davr stavkasi")).toBeInTheDocument();
    expect(within(kpis).getByText("Oxirgi to'lov: 05.09.2026")).toBeInTheDocument();
    expect(within(kpis).getByText("Hisoblangan, hali to'lanmagan")).toBeInTheDocument();
    const values = Array.from(kpis.querySelectorAll("[data-stat-value]")).map((el) => el.textContent);
    expect(values).toEqual(["450 mln so'm", "12,5 %", "34,3 mln so'm", "6,2 mln so'm"]);

    const chart = screen.getByRole("img", { name: /^Oylik foyda, noyabr 2025 – oktabr 2026/ });
    expect(chart).toHaveAccessibleName(
      "Oylik foyda, noyabr 2025 – oktabr 2026: jami 40,5 mln so'm, to'langan 34,3 mln so'm, kutilmoqda 6,2 mln so'm",
    );
    expect(chart.querySelectorAll("[data-stack]")).toHaveLength(9);
    expect(screen.getByText("Jami foyda · 12 oy")).toBeInTheDocument();
    expect(screen.getByText("Oktabr davri hali yopilmagan — foyda davr tugagach hisoblanadi")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "12 oy" })).toHaveAttribute("aria-checked", "true");

    const calls = get.mock.calls.map(([url, config]) => [url, (config as { params?: unknown } | undefined)?.params]);
    expect(calls).toEqual(
      expect.arrayContaining([
        ["investors/me/dashboard", { months: 12 }],
        ["investors/me/investments", { limit: 3 }],
        ["investors/me/profits", { limit: 5 }],
      ]),
    );
  });

  it("«So'nggi investitsiyalar» va «Foyda tarixi»: jami, sanalar, holat badge'lari; «Barchasi» hali yo'q (IN-2)", async () => {
    mockApi(happy);
    renderPage();

    const investments = await screen.findByRole("region", { name: "So'nggi investitsiyalar" });
    expect(await within(investments).findByText("Jami: 450 000 000 so'm")).toBeInTheDocument();
    const investmentRows = within(within(investments).getByRole("table")).getAllByRole("row");
    expect(investmentRows.map((row) => row.textContent)).toEqual([
      "Kiritilgan sanaSumma",
      "01.08.2026100 000 000 so'm",
      "20.06.202650 000 000 so'm",
      "12.04.2026100 000 000 so'm",
    ]);

    const profits = screen.getByRole("region", { name: "Foyda tarixi" });
    const table = await within(profits).findByRole("table");
    const [, pending, paid] = within(table).getAllByRole("row");
    expect(pending).toHaveTextContent("01.09 – 30.09.2026");
    expect(pending).toHaveTextContent("Sentabr 2026");
    expect(pending).toHaveTextContent("12,5%");
    expect(within(pending).getByText("Kutilmoqda")).toBeInTheDocument();
    expect(within(paid).getByText("To'langan")).toBeInTheDocument();
    expect(paid).toHaveTextContent("05.09.2026");

    expect(screen.queryByRole("link", { name: /Barchasi/ })).not.toBeInTheDocument();
  });

  it("davr 6 oy — yangi so'rov; «Jadval» — oylar yangi tepada, joriy oy belgisi va «Jami · 12 oy»", async () => {
    const user = userEvent.setup();
    const get = mockApi(happy);
    renderPage();
    await screen.findByText("Jami foyda · 12 oy");

    await user.click(screen.getByRole("radio", { name: "Jadval" }));
    const table = screen.getByRole("table", { name: "Oylik foyda jadvali" });
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Oktabr 2026");
    expect(within(rows[1]).getByText("Joriy oy")).toBeInTheDocument();
    expect(rows[2]).toHaveTextContent("Sentabr 2026—6 200 000 so'm6 200 000 so'm");
    expect(rows.at(-1)).toHaveTextContent("Jami · 12 oy34 300 000 so'm6 200 000 so'm40 500 000 so'm");
    expect(screen.queryByRole("img", { name: /Oylik foyda/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "6 oy" }));
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith("investors/me/dashboard", expect.objectContaining({ params: { months: 6 } })),
    );
    expect(await screen.findByText("Jami foyda · 6 oy")).toBeInTheDocument();
  });

  it("telefon: jadval egizagi kartalarda — ikkala qism alohida qatorda (ega IN-S3), «Jami» qatori yo'q", async () => {
    asPhone();
    const user = userEvent.setup();
    mockApi(happy);
    renderPage();
    await screen.findByText("Jami foyda · 12 oy");
    await user.click(screen.getByRole("radio", { name: "Jadval" }));

    const cards = screen.getByRole("list", { name: "Oylik foyda jadvali" });
    const items = within(cards).getAllByRole("listitem");
    expect(items).toHaveLength(12);
    expect(items[0]).toHaveTextContent("Oktabr 2026Davr hali hisoblanmagan");
    expect(within(items[1]).getByText("To'langan: —")).toBeInTheDocument();
    expect(within(items[1]).getByText("Kutilmoqda: 6 200 000 so'm")).toHaveClass("text-warning-fg");
    expect(items[11]).toHaveTextContent("Noyabr 2025Foyda yo'q");

    const profits = screen.getByRole("list", { name: "Foyda tarixi" });
    expect(within(profits).getAllByRole("listitem")[0]).toHaveTextContent("Hali to'lanmagan");
    expect(within(profits).getAllByRole("listitem")[1]).toHaveTextContent("To'langan: 05.09.2026");
  });
});

describe("InvestorDashboardPage — holatlar", () => {
  it("yuklanish: KPI skeleti (aria-busy), yorliqlar joyida", () => {
    vi.spyOn(api, "get").mockImplementation(() => new Promise(() => undefined));
    renderPage();
    const kpis = screen.getByRole("region", { name: "Asosiy ko'rsatkichlar" });
    expect(within(kpis).getByText("Ulush")).toBeInTheDocument();
    expect(kpis.querySelectorAll('[aria-busy="true"]')).toHaveLength(4);
    expect(screen.getByRole("region", { name: "Oylik foyda" })).toHaveAttribute("aria-busy", "true");
  });

  it("bo'sh (investor-dashboard-empty): KPI 0 va izohlar, grafik o'rnida bo'sh holat, boshqaruvlar yashirin", async () => {
    mockApi((url) => (url === "investors/me/dashboard" ? emptyBodies.dashboard : emptyBodies.list));
    renderPage();

    expect(await screen.findByText("Hali foyda hisoblanmagan")).toBeInTheDocument();
    expect(screen.getByText("Hali investitsiya kiritilmagan")).toBeInTheDocument();
    expect(screen.getByText("Foyda davri hali yo'q")).toBeInTheDocument();
    expect(screen.getByText("Hali to'lov bo'lmagan")).toBeInTheDocument();
    expect(screen.getByText("Hisoblangan foyda yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Grafik davri" })).not.toBeInTheDocument();
    expect(await screen.findByText("Hali investitsiya yo'q")).toBeInTheDocument();
    expect(screen.getByText("Hali foyda yozuvi yo'q")).toBeInTheDocument();
    expect(screen.getByText("Jami: 0 so'm")).toBeInTheDocument();
  });

  it("xato 500 (investor-dashboard-error): KPI o'rnida xato kartasi, ro'yxatlar ishlaydi; «Qayta urinish» qayta so'raydi", async () => {
    const user = userEvent.setup();
    let fail = true;
    const get = mockApi((url, params) =>
      url === "investors/me/dashboard" && fail ? httpError(500, "QueryFailedError: relation does not exist") : happy(url, params),
    );
    renderPage();

    const card = await screen.findByRole("region", { name: "Ko'rsatkichlar va oylik foyda" });
    expect(within(card).getByText("Ko'rsatkichlarni yuklab bo'lmadi")).toBeInTheDocument();
    expect(
      within(card).getByText("Server xatosi (500). Birozdan keyin qayta urinib ko'ring. Investitsiyalar va foyda tarixi quyida."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/QueryFailedError/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Asosiy ko'rsatkichlar" })).not.toBeInTheDocument();
    expect(await screen.findByText("Jami: 450 000 000 so'm")).toBeInTheDocument();

    fail = false;
    await user.click(within(card).getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByRole("region", { name: "Asosiy ko'rsatkichlar" })).toBeInTheDocument();
    expect(get.mock.calls.filter(([url]) => url === "investors/me/dashboard")).toHaveLength(2);
  });

  it.each([
    [403, "Xato kodi 403", "Investor profilingiz nofaol", /Profil vaqtincha to'xtatilgan/],
    [404, "Xato kodi 404", "Investor profili hali bog'lanmagan", /Hisobingiz investor yozuviga ulanmagan/],
    [409, "Xato kodi 409", "Investor profilini aniqlab bo'lmadi", /bir nechta investor profili ulangan/],
  ])("%s: butun sahifa holati — «Qayta urinish» va «Chiqish», backend matnisiz", async (status, overline, title, text) => {
    const user = userEvent.setup();
    const get = mockApi(() => httpError(status, "investor profile not linked to this user"));
    renderPage();

    expect(await screen.findByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    expect(screen.getByText(overline)).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByText("Investor kabineti")).toBeInTheDocument();
    expect(screen.queryByText(/investor profile/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Asosiy ko'rsatkichlar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "So'nggi investitsiyalar" })).not.toBeInTheDocument();

    const before = get.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThanOrEqual(before + 3));

    await user.click(screen.getByRole("button", { name: "Chiqish" }));
    expect(logoutAndRedirect).toHaveBeenCalledTimes(1);
  });
});

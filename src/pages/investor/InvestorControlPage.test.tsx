import { screen, waitFor, within } from "@testing-library/react";
import type { AxiosRequestConfig } from "axios";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RootState } from "../../app/config/store";
import { api } from "../../shared/api/api";
import { renderWithProviders } from "../../test/test-utils";
import InvestorDashboardPage from "./InvestorDashboardPage";

/**
 * vpKijXce — superadmin investor kabinetini nazorat uchun ko'radi: `GET investors/:id/dashboard` (javob investorniki
 * bilan bir xil). Ro'yxatlar (`investors/me/*`) so'ralmaydi; investor holat ekrani va «Chiqish» ko'rsatilmaydi.
 */

const logoutAndRedirect = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../auth/authService", () => ({ default: { logoutAndRedirect } }));

const NOW = new Date(2026, 9, 21, 12, 0);

const dashboardBody = {
  statusCode: 200,
  data: {
    investor: { id: "7", name: "Habibulla Nazirov", phone_number: "+998901112233", status: "active" },
    summary: {
      total_invested: 450_000_000,
      investments_count: 5,
      last_invested_at: "2026-08-01T12:00:00+05:00",
      total_paid_profit: 34_300_000,
      total_unpaid_profit: 6_200_000,
      total_profit: 40_500_000,
      profit_shares_count: 9,
      current_percentage: 12.5,
      last_paid_at: "2026-09-05T10:00:00+05:00",
    },
    monthly: { months: 12, items: [{ month: "2026-09", paid_amount: 5_000_000, unpaid_amount: 0, total_amount: 5_000_000 }] },
  },
};

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Bosh admin" } } as unknown as Partial<RootState>;

const calls: Array<{ url: string; params?: unknown }> = [];
const mockApi = (dashboard: () => Promise<unknown> = () => Promise.resolve({ data: dashboardBody })) => {
  calls.length = 0;
  vi.spyOn(api, "get").mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
    calls.push({ url, params: config?.params });
    if (url === "investors/7/dashboard") return dashboard();
    return { data: { data: { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } } } };
  });
};

const renderControl = () =>
  renderWithProviders(<InvestorDashboardPage now={NOW} investorId="7" />, { route: "/investor/7", preloadedState: superadmin });

afterEach(() => {
  vi.restoreAllMocks();
  logoutAndRedirect.mockClear();
});

const termsBody = {
  statusCode: 200,
  data: {
    ...dashboardBody.data,
    investor: { ...dashboardBody.data.investor, share_percent: 15, profit_basis: "gross" },
    summary: {
      ...dashboardBody.data.summary,
      accrued_profit: 2_100_000,
      accrued_through: "2026-10-21",
      share_started_at: "2026-09-01",
      profit_basis: "gross",
    },
    share_terms: [
      { share_percent: 10, profit_basis: "net", effective_from: "2026-09-01", effective_to: "2026-10-01" },
      { share_percent: 15, profit_basis: "gross", effective_from: "2026-10-01", effective_to: null },
    ],
  },
};

describe("Investor kabineti — «Ulush shartlari» (ega 2026-11-28)", () => {
  it("⭐ joriy ulush, asos, investorlik sanasi, hisoblangan va shartlar tarixi", async () => {
    mockApi(() => Promise.resolve({ data: termsBody }));
    renderControl();

    const card = await screen.findByRole("region", { name: "Ulush shartlari" });
    const current = within(card).getByText("Joriy ulush").closest("div") as HTMLElement;
    expect(current).toHaveTextContent("Joriy ulush15 %");
    expect(within(card).getByText("Ulush nimadan olinadi").closest("div")).toHaveTextContent(
      "Ulush nimadan olinadiDaromadXarajat ayrilmaydi",
    );
    expect(within(card).getByText("01.09.2026")).toBeInTheDocument();
    expect(within(card).getByText("Hisoblangan · 21.10.2026 gacha")).toBeInTheDocument();
    expect(within(card).getByText("2 100 000 so'm")).toBeInTheDocument();
    const rows = within(within(card).getByRole("table", { name: "Shartlar tarixi" })).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("01.10.2026 dan hozirgacha15 %Daromad");
    // `effective_to` eksklyuziv — oxirgi kun 30.09.
    expect(rows[2]).toHaveTextContent("01.09.2026 – 30.09.202610 %Sof foyda");
  });

  it("⭐ «Shartni o'zgartirish» → PUT share-terms (foiz, asos, bugungi sana); dashboard qayta so'raladi", async () => {
    const user = userEvent.setup();
    mockApi(() => Promise.resolve({ data: termsBody }));
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: { statusCode: 200 } } as never);
    renderControl();

    const card = await screen.findByRole("region", { name: "Ulush shartlari" });
    await user.click(within(card).getByRole("button", { name: "Shartni o'zgartirish" }));
    const dialog = await screen.findByRole("dialog", { name: "Ulush shartini o'zgartirish" });
    const share = within(dialog).getByRole("textbox", { name: "Ulush (%)" });
    expect(share).toHaveValue("15");
    expect(within(dialog).getByRole("radio", { name: "Daromad" })).toBeChecked();

    await user.clear(share);
    await user.type(share, "12,5");
    await user.click(within(dialog).getByRole("radio", { name: "Sof foyda" }));
    const before = calls.filter((call) => call.url === "investors/7/dashboard").length;
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("investors/7/share-terms", {
        share_percent: 12.5,
        profit_basis: "net",
        effective_from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
    expect(await screen.findByText("Ulush sharti saqlandi")).toBeInTheDocument();
    await waitFor(() =>
      expect(calls.filter((call) => call.url === "investors/7/dashboard").length).toBeGreaterThan(before),
    );
  });

  it("noto'g'ri ulush — maydon ostida xato, so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    mockApi(() => Promise.resolve({ data: termsBody }));
    const put = vi.spyOn(api, "put");
    renderControl();

    const card = await screen.findByRole("region", { name: "Ulush shartlari" });
    await user.click(within(card).getByRole("button", { name: "Shartni o'zgartirish" }));
    const dialog = await screen.findByRole("dialog", { name: "Ulush shartini o'zgartirish" });
    const share = within(dialog).getByRole("textbox", { name: "Ulush (%)" });
    await user.clear(share);
    await user.type(share, "101");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    expect(
      await within(dialog).findByText("Ulush 0 dan 100 gacha, ko'pi bilan 2 kasr xonali son bo'lsin"),
    ).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it("ulush hali yo'q — «Ulush belgilash», izoh «hisob hali boshlanmagan»", async () => {
    mockApi();
    renderControl();

    const card = await screen.findByRole("region", { name: "Ulush shartlari" });
    expect(within(card).getByText("Ulush kiritilmagan — hisob hali boshlanmagan")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Ulush belgilash" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Sanani tuzatish" })).toBeNull();
  });
});

describe("Investor kabineti — superadmin nazorati (vpKijXce)", () => {
  it("⭐ `investors/7/dashboard` so'raladi, `investors/me/*` hech qachon; sarlavhada investor nomi va «Nazorat»", async () => {
    mockApi();
    renderControl();

    expect(await screen.findByRole("heading", { level: 1, name: "Investor kabineti · Habibulla Nazirov" })).toBeInTheDocument();
    expect(screen.getByText("Nazorat")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Investorlar/ })).toHaveAttribute("href", "/all-users?role=investor");
    expect(calls.find((call) => call.url === "investors/7/dashboard")?.params).toEqual({ months: 12 });
    expect(calls.some((call) => call.url.startsWith("investors/me"))).toBe(false);
  });

  it("⭐ KPI investor ko'rinishidagidek; ro'yxatlar o'rnida izoh", async () => {
    mockApi();
    renderControl();

    expect(await screen.findByText("Mening investitsiyam")).toBeInTheDocument();
    const kpis = screen.getByRole("region", { name: "Asosiy ko'rsatkichlar" });
    // Yorliqlar yuklanishda ham turadi — qiymat kelguncha kutiladi.
    expect(await within(kpis).findByText("5 ta investitsiya · oxirgisi 01.08.2026")).toBeInTheDocument();
    const values = Array.from(kpis.querySelectorAll("[data-stat-value]")).map((el) => el.textContent);
    expect(values).toEqual(["450 mln so'm", "12,5 %", "34,3 mln so'm", "6,2 mln so'm"]);
    expect(screen.getByText("Investitsiyalar va foyda tarixi ro'yxati faqat investorning o'z kabinetida ko'rinadi.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "So'nggi investitsiyalar" })).toBeNull();
  });

  it("davr almashsa — o'sha investorga yangi `months` bilan", async () => {
    const user = userEvent.setup();
    mockApi();
    renderControl();

    await user.click(await screen.findByRole("radio", { name: "24 oy" }));
    await waitFor(() => expect(calls.filter((call) => call.url === "investors/7/dashboard").at(-1)?.params).toEqual({ months: 24 }));
  });

  it("⭐ boshqa investor ochilsa — uning so'rovi, oldingisining ismi qolmaydi", async () => {
    const { Route, Routes, useNavigate } = await import("react-router-dom");
    const InvestorControlPage = (await import("./InvestorControlPage")).default;
    calls.length = 0;
    vi.spyOn(api, "get").mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
      calls.push({ url, params: config?.params });
      if (url === "investors/7/dashboard") return { data: dashboardBody };
      if (url === "investors/8/dashboard") return new Promise(() => undefined);
      return { data: { data: { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } } } };
    });
    const Next = () => {
      const navigate = useNavigate();
      return <button onClick={() => navigate("/investor/8")}>Keyingi</button>;
    };
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/investor/:investorId" element={<><Next /><InvestorControlPage /></>} />
      </Routes>,
      { route: "/investor/7", preloadedState: superadmin },
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Investor kabineti · Habibulla Nazirov" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keyingi" }));

    await waitFor(() => expect(calls.some((call) => call.url === "investors/8/dashboard")).toBe(true));
    expect(screen.queryByText("Investor kabineti · Habibulla Nazirov")).toBeNull();
  });

  it("⭐ 404 — «Investor topilmadi», investor holat ekrani va «Chiqish» yo'q", async () => {
    mockApi(() => Promise.reject({ isAxiosError: true, response: { status: 404, data: { message: "raw backend" } } }));
    renderControl();

    expect(await screen.findByText("Investor topilmadi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chiqish" })).toBeNull();
    expect(screen.queryByText(/raw backend/)).toBeNull();
    expect(logoutAndRedirect).not.toHaveBeenCalled();
  });

  it("investor o'zi — avvalgidek `investors/me/*`, nazorat belgisi yo'q", async () => {
    mockApi();
    vi.spyOn(api, "get").mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
      calls.push({ url, params: config?.params });
      if (url === "investors/me/dashboard") return { data: dashboardBody };
      return { data: { data: { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } } } };
    });
    renderWithProviders(<InvestorDashboardPage now={NOW} />, {
      route: "/",
      preloadedState: { role: { id: "42", role: "investor", region: null, name: "Habibulla Nazirov" } } as unknown as Partial<RootState>,
    });

    expect(await screen.findByRole("heading", { level: 1, name: "Bosh sahifa" })).toBeInTheDocument();
    expect(screen.queryByText("Nazorat")).toBeNull();
    expect(calls.some((call) => call.url === "investors/me/dashboard")).toBe(true);
    expect(calls.some((call) => /^investors\/\d+\/dashboard$/.test(call.url))).toBe(false);
  });
});

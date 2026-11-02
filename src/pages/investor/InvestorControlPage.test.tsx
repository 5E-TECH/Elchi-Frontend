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

describe("Investor kabineti — superadmin nazorati (vpKijXce)", () => {
  it("⭐ `investors/7/dashboard` so'raladi, `investors/me/*` hech qachon; sarlavhada investor nomi va «faqat o'qish»", async () => {
    mockApi();
    renderControl();

    expect(await screen.findByRole("heading", { level: 1, name: "Investor kabineti · Habibulla Nazirov" })).toBeInTheDocument();
    expect(screen.getByText("Nazorat · faqat o'qish")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Investorlar/ })).toHaveAttribute("href", "/ops?tab=investors");
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
    expect(screen.queryByText("Nazorat · faqat o'qish")).toBeNull();
    expect(calls.some((call) => call.url === "investors/me/dashboard")).toBe(true);
    expect(calls.some((call) => /^investors\/\d+\/dashboard$/.test(call.url))).toBe(false);
  });
});

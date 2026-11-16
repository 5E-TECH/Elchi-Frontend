import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import type { LogistDashboardModel } from "./model/logistDashboard";
import LogistDashboardPage from "./LogistDashboardPage";

/**
 * QKCeGZ3N: logist bosh sahifasining har widgeti o'z xato chegarasida — «Viloyatlar muvaffaqiyati» yiqilsa KPI,
 * «Muvaffaqiyat darajasi» va «Viloyatlarim» jadvali joyida; «Qayta urinish» — `region/stats/all` qayta yuboriladi
 * va javob tuzalgach karta tiklanadi. So'rov — haqiqiy `useRegionStats`, faqat `api.get` soxta.
 */
const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

/** «Viloyatlar muvaffaqiyati» o'rinbosari: jami 13 ta — buzilgan javob (prod'dagi «r.forEach is not a function»). */
vi.mock("./ui/LogistRegionSuccessCard", () => ({
  LogistRegionSuccessCard: ({ model }: { model: LogistDashboardModel }) => {
    if (model.summary.total === 13) throw new TypeError("r.forEach is not a function");
    return <section aria-label="Viloyatlar muvaffaqiyati">Jami: {model.summary.total}</section>;
  },
}));

const ME = "42";
const stats = (total: number) => ({
  data: {
    data: {
      regions: [
        {
          id: 1,
          name: "Samarqand viloyati",
          sato_code: "1701",
          logist_id: ME,
          districts_count: 16,
          totalOrders: total,
          deliveredOrders: 9,
          cancelledOrders: 1,
          activeCouriers: 5,
          totalCouriers: 6,
        },
      ],
      summary: { totalRegions: 1, totalOrders: total, deliveredOrders: 9, cancelledOrders: 1 },
    },
  },
});

const logistState = {
  role: { id: ME, role: "logist", region: null, name: "Aziz Rahimov" },
  user: {
    user: { id: ME, name: "Aziz Rahimov", role: "logist" } as never,
    isAuthenticated: true,
    accessToken: "token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const SECTION_ERROR = "Bu bo'limni ochishda xatolik yuz berdi";

describe("LogistDashboardPage — widget xato chegaralari va «Qayta urinish» (QKCeGZ3N)", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    window.sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("⭐ «Viloyatlar muvaffaqiyati» yiqildi — qolgan bosh sahifa ishlaydi; «Qayta urinish» so'rovni qayta yuboradi", async () => {
    mocks.get.mockResolvedValueOnce(stats(13)).mockResolvedValue(stats(14));

    renderWithProviders(<LogistDashboardPage />, { route: "/", preloadedState: logistState });

    expect(await screen.findByText(SECTION_ERROR)).toBeInTheDocument();
    expect(screen.queryByText("Sahifani ko'rsatib bo'lmadi")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Bosh sahifa" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Viloyatlarim bo'yicha umumiy ko'rsatkichlar" })).toHaveTextContent("13");
    expect(screen.getByRole("heading", { name: "Muvaffaqiyat darajasi" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Viloyatlarim jadvali" })).toBeInTheDocument();
    expect(screen.getAllByText(SECTION_ERROR)).toHaveLength(1);
    expect(mocks.get).toHaveBeenCalledTimes(1);

    const errorCard = screen.getByText(SECTION_ERROR).closest("section") as HTMLElement;
    await userEvent.click(within(errorCard).getByRole("button", { name: "Qayta urinish" }));

    expect(await screen.findByRole("region", { name: "Viloyatlar muvaffaqiyati" })).toHaveTextContent("Jami: 14");
    expect(screen.queryByText(SECTION_ERROR)).toBeNull();
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });
});

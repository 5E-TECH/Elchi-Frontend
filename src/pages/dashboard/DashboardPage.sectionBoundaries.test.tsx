import { useQuery } from "@tanstack/react-query";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./DashboardPage";
import type { AnalyticsDateParams } from "../../entities/dashboard";
import { DASHBOARD_QUERY_KEY, REVENUE_QUERY_KEY } from "../../entities/dashboard/lib/queryKeys";
import { renderWithProviders } from "../../test/test-utils";

/**
 * QKCeGZ3N (2026-11-10 tekshiruvi): bosh sahifaning har widgeti o'z xato chegarasida — bittasi yiqilsa faqat uning
 * o'rnida «Bo'lim xatosi», qolgan bosh sahifa ishlayveradi («Sahifani ko'rsatib bo'lmadi» yo'q); «Qayta urinish» —
 * o'sha bo'lim so'rovi qayta yuboriladi va javob tuzalgach bo'lim tiklanadi.
 *
 * `analytics/dashboard` va «Moliyaviy tahlil» — haqiqiy react-query (kesh, qayta yuborish), javoblar — soxta.
 */
type DashboardPayload = { data: { orders: { acceptedCount: number; soldAndPaid: number; cancelled: number; profit: number; totalRevenue: number } } };

const fetchDashboard = vi.fn<(params?: AnalyticsDateParams) => Promise<DashboardPayload>>();
const fetchRevenue = vi.fn<() => Promise<{ chart?: unknown }>>();
const staticQuery = (data: unknown) => ({ data, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() });

const useDashboardQuery = (params?: AnalyticsDateParams, enabled = true, scope = "anonymous") =>
  useQuery({
    queryKey: [...DASHBOARD_QUERY_KEY, scope, params],
    queryFn: () => fetchDashboard(params),
    enabled,
  });

vi.mock("../../entities/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/dashboard")>()),
  useDashboard: () => ({
    getDashboard: useDashboardQuery,
    getKpi: () => staticQuery({ data: { averageOrderValue: 96000, marketRating: [] } }),
    getRevenue: () => staticQuery(undefined),
  }),
}));

vi.mock("../../entities/region", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/region")>()),
  useRegionStats: () => staticQuery({ regions: [], summary: null, scopedDetail: null }),
}));

vi.mock("../../widgets/dm-delivery/ui/DmDeliveryCard", () => ({ default: () => null }));

/** «Moliyaviy tahlil» o'rinbosari: o'z so'rovi (`revenue`), buzilgan javobda chizishda yiqiladi. */
vi.mock("../../widgets/financial-analysis/ui/FinancialAnalysis", () => ({
  default: function FinancialAnalysisStub() {
    const { data } = useQuery({ queryKey: [...REVENUE_QUERY_KEY, "test"], queryFn: () => fetchRevenue() });
    if (!data) return null;
    const labels = data.chart as string[];
    return <section aria-label="Moliyaviy tahlil">{labels.map((label) => label.trim()).join(" · ")}</section>;
  },
}));

/** «Buyurtmalar holati» o'rinbosari: `total === 13` — buzilgan javob (prod'dagi «r.forEach is not a function»). */
vi.mock("../../widgets/dashboard-statistics/ui/OrderStatusCard", () => ({
  default: ({ total }: { total: number }) => {
    if (total === 13) throw new TypeError("r.forEach is not a function");
    return <section aria-label="Buyurtmalar holati">Jami: {total}</section>;
  },
}));

const adminState = { role: { id: "admin-1", role: "admin", region: null, name: "admin" } } as never;
const orders = (acceptedCount: number) => ({
  data: { orders: { acceptedCount, soldAndPaid: 5, cancelled: 2, profit: 480000, totalRevenue: 960000 } },
});
const SECTION_ERROR = "Bu bo'limni ochishda xatolik yuz berdi";
const sectionErrorCard = () => screen.getByText(SECTION_ERROR).closest("section") as HTMLElement;

describe("DashboardPage — widget xato chegaralari va «Qayta urinish» (QKCeGZ3N)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchDashboard.mockResolvedValue(orders(12));
    fetchRevenue.mockResolvedValue({ chart: ["Yan", "Fev"] });
  });
  afterEach(() => vi.restoreAllMocks());

  it("⭐ «Moliyaviy tahlil» yiqildi — qolgan bosh sahifa ishlaydi; «Qayta urinish» faqat uning so'rovini qayta yuboradi", async () => {
    fetchRevenue.mockResolvedValueOnce({ chart: { broken: true } });

    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    expect(await screen.findByText(SECTION_ERROR)).toBeInTheDocument();
    expect(screen.queryByText("Sahifani ko'rsatib bo'lmadi")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Bosh sahifa" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Asosiy ko'rsatkichlar" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Buyurtmalar holati" })).toHaveTextContent("Jami: 12");
    expect(screen.getByRole("heading", { name: "Top marketlar" })).toBeInTheDocument();
    expect(screen.getAllByText(SECTION_ERROR)).toHaveLength(1);
    expect(fetchRevenue).toHaveBeenCalledTimes(1);
    const dashboardCalls = fetchDashboard.mock.calls.length;

    await userEvent.click(within(sectionErrorCard()).getByRole("button", { name: "Qayta urinish" }));

    expect(await screen.findByRole("region", { name: "Moliyaviy tahlil" })).toHaveTextContent("Yan · Fev");
    expect(screen.queryByText(SECTION_ERROR)).toBeNull();
    expect(fetchRevenue).toHaveBeenCalledTimes(2);
    // Boshqa bo'limlar so'rovi qayta yuborilmaydi.
    expect(fetchDashboard).toHaveBeenCalledTimes(dashboardCalls);
  });

  it("⭐ to'rdagi karta («Buyurtmalar holati») yiqildi — yonidagi kartalar joyida; «Qayta urinish» dashboard so'rovini qayta yuboradi", async () => {
    fetchDashboard.mockResolvedValueOnce(orders(13));

    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    expect(await screen.findByText(SECTION_ERROR)).toBeInTheDocument();
    // Bir fragmentdagi qo'shni karta («Muvaffaqiyat darajasi») va alohida widget yiqilmaydi.
    expect(screen.getByRole("heading", { name: "Muvaffaqiyat darajasi" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Moliyaviy tahlil" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Buyurtmalar holati" })).toBeNull();
    expect(fetchDashboard).toHaveBeenCalledTimes(1);

    await userEvent.click(within(sectionErrorCard()).getByRole("button", { name: "Qayta urinish" }));

    expect(await screen.findByRole("region", { name: "Buyurtmalar holati" })).toHaveTextContent("Jami: 12");
    expect(screen.queryByText(SECTION_ERROR)).toBeNull();
    expect(fetchDashboard).toHaveBeenCalledTimes(2);
    expect(fetchRevenue).toHaveBeenCalledTimes(1);
  });
});

import { useQuery } from "@tanstack/react-query";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DASHBOARD_QUERY_KEY } from "../../../entities/dashboard/lib/queryKeys";
import { renderWithProviders } from "../../../test/test-utils";
import BranchDashboardPage from "./BranchDashboardPage";

/**
 * QKCeGZ3N: filial panelining har widgeti o'z xato chegarasida — yon ustundagi «Faol paketlar» yiqilsa «Kuryerlar»,
 * qolgan kartalar va «Top filiallar» joyida; «Qayta urinish» — filial paneli so'rovi (`analytics/dashboard`) qayta
 * yuboriladi va javob tuzalgach karta tiklanadi. `getDashboard` — haqiqiy react-query, javob soxta.
 */
const fetchDashboard = vi.fn<() => Promise<unknown>>();

const useDashboardQuery = (params: unknown, enabled = true, scope = "anonymous") =>
  useQuery({ queryKey: [...DASHBOARD_QUERY_KEY, scope, params], queryFn: () => fetchDashboard(), enabled });

vi.mock("../../../entities/dashboard", () => ({
  useDashboard: () => ({ getDashboard: useDashboardQuery }),
}));

/** «Faol paketlar» o'rinbosari: yo'ldagi 13 ta — buzilgan javob (prod'dagi «r.forEach is not a function»). */
vi.mock("./BranchCards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./BranchCards")>();
  return {
    ...actual,
    ActivePackagesCard: ({ packages }: { packages: { onTheWay: number } }) => {
      if (packages.onTheWay === 13) throw new TypeError("r.forEach is not a function");
      return <section aria-label="Faol paketlar">Yo'lda: {packages.onTheWay}</section>;
    },
  };
});

const response = (onTheWay: number) => ({
  data: {
    orders: { acceptedCount: 99, soldAndPaid: 3, cancelled: 1, profit: 0, totalRevenue: 0 },
    branchDashboard: {
      role: "MANAGER",
      cards: {
        orders: { total: 7, new: 1, on_the_road: 2, delivered: 3, returned: 1 },
        markets: [{ id: "m1", name: "Baraka Shop", orders: 5, amount: 4_800_000 }],
        packages: { on_the_way: onTheWay, waiting_for_acceptance: 2 },
        couriers: { total: 8, active: 6 },
      },
    },
    topBranches: [{ branch_id: "b-1", branch_name: "Filial 1", total_orders: 30, successful_orders: 25, success_rate: 83.3 }],
  },
});

const managerState = {
  role: { id: "manager-1", role: "manager", region: null, name: "Manager" },
  user: {
    user: { id: "manager-user-1", branch_id: "branch-1", branch: { name: "Urgut filiali", type: "HYBRID" } } as never,
    isAuthenticated: true,
    accessToken: "token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const SECTION_ERROR = "Bu bo'limni ochishda xatolik yuz berdi";
const section = (title: string) => screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;

describe("BranchDashboardPage — widget xato chegaralari va «Qayta urinish» (QKCeGZ3N)", () => {
  beforeEach(() => {
    fetchDashboard.mockReset();
    window.sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("⭐ «Faol paketlar» yiqildi — «Kuryerlar» va qolgan panel ishlaydi; «Qayta urinish» so'rovni qayta yuboradi", async () => {
    fetchDashboard.mockResolvedValueOnce(response(13)).mockResolvedValue(response(4));

    renderWithProviders(<BranchDashboardPage />, { preloadedState: managerState });

    expect(await screen.findByText(SECTION_ERROR)).toBeInTheDocument();
    expect(screen.queryByText("Sahifani ko'rsatib bo'lmadi")).toBeNull();
    expect(section("Kuryerlar")).toHaveTextContent("6 / 8 ta");
    expect(section("Muvaffaqiyat darajasi")).toBeInTheDocument();
    expect(section("Marketlar bo'yicha")).toHaveTextContent("Baraka Shop");
    expect(screen.getByTestId("ranking-branches")).toHaveTextContent("Filial 1");
    expect(screen.getAllByText(SECTION_ERROR)).toHaveLength(1);
    expect(fetchDashboard).toHaveBeenCalledTimes(1);

    const errorCard = screen.getByText(SECTION_ERROR).closest("section") as HTMLElement;
    await userEvent.click(within(errorCard).getByRole("button", { name: "Qayta urinish" }));

    expect(await screen.findByRole("region", { name: "Faol paketlar" })).toHaveTextContent("Yo'lda: 4");
    expect(screen.queryByText(SECTION_ERROR)).toBeNull();
    expect(fetchDashboard).toHaveBeenCalledTimes(2);
    expect(section("Kuryerlar")).toHaveTextContent("6 / 8 ta");
  });
});

import type { ReactNode } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import BranchMetricsSection from "./BranchMetricsSection";

/**
 * «Filial ko'rsatkichlari» (6CYRjoZG, maket `superadmin-branches-detail`): bitta `GET analytics/dashboard?branch_id=`
 * so'rovidan KPI (delta + sparkline), muvaffaqiyat, kunlik daromad, holatlar, kuryerlar reytingi; davr almashadi;
 * xato / bo'sh / backend filialni qo'llamagan / olinmagan bo'lak holatlari.
 */
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/instance", () => ({ api }));
// `entities/dashboard` so'rovi `shared/api/api` dan (instance shu modulni qayta eksport qiladi).
vi.mock("../../../shared/api/api", async (importOriginal) => ({ ...(await importOriginal<object>()), api }));

// recharts — faqat plot chunk'ida; testda nuqtalar ko'rinadigan qilib almashtiriladi.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children, data }: { children: ReactNode; data: Array<{ label: string; current: number }> }) => (
    <div data-testid="revenue-chart" data-points={JSON.stringify(data.map((point) => [point.label, point.current]))}>
      {children}
    </div>
  ),
  Area: () => <div data-testid="current-area" />,
  Line: () => <div data-testid="previous-line" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

const SERIES = Array.from({ length: 14 }, (_, index) => ({
  date: `2026-09-${String(index + 25 > 30 ? index - 5 : index + 25).padStart(2, "0")}`,
  acceptedCount: 22 + (index % 5) * 6,
  soldAndPaid: 17 + (index % 4) * 5,
  cancelled: 2,
  totalRevenue: 3_100_000 + index * 280_000,
  profit: 310_000 + index * 28_000,
}));

const healthy = (overrides: Record<string, unknown> = {}) => ({
  branch_id: "15",
  orders: { acceptedCount: 186, soldAndPaid: 141, cancelled: 17, totalRevenue: 26_400_000, profit: 2_900_000 },
  previous: { acceptedCount: 179, soldAndPaid: 129, cancelled: 15, totalRevenue: 24_420_000, profit: 2_675_000 },
  series: SERIES,
  dailyRevenue: {
    data: [
      { period: "2026-10-05", label: "05.10", ordersCount: 30, revenue: 6_217_000 },
      { period: "2026-10-06", label: "06.10", ordersCount: 34, revenue: 6_759_000 },
      { period: "2026-10-07", label: "07.10", ordersCount: 41, revenue: 7_118_000 },
      { period: "2026-10-08", label: "08.10", ordersCount: 36, revenue: 6_306_000 },
    ],
    summary: { totalRevenue: 26_400_000, totalOrders: 141 },
  },
  statusDistribution: {
    distribution: { new: 6, "on the road": 22, sold: 120, paid: 21, cancelled: 17 },
    total: 186,
  },
  topCouriers: [
    { courier_id: "209", courier_name: "Bahodir Karimov", total_orders: 71, successful_orders: 58, success_rate: 81.7 },
    { courier_id: "210", courier_name: "Sherzod Qurbonov", total_orders: 63, successful_orders: 49, success_rate: 77.8 },
    { courier_id: "211", courier_name: "Akmal Usmonov", total_orders: 46, successful_orders: 34, success_rate: 73.9 },
  ],
  topCouriersMeta: { period_rule: "selected_range", from: "2026-10-05", to: "2026-10-08", min_orders: 5 },
  branchDashboard: { role: "SUPER", stats_unavailable: false, cards: { couriers: { branch_couriers: 3, active_today: 3 } } },
  degraded: false,
  failed_parts: [],
  ...overrides,
});

type DashboardReply = Record<string, unknown> | Error;
let replies: DashboardReply[] = [];
const dashboardCalls = () => api.get.mock.calls.filter(([url]) => url === "analytics/dashboard");

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const renderSection = (route = "/branches/15") =>
  renderWithProviders(
    <Routes>
      <Route
        path="/branches/:id"
        element={
          <>
            <BranchMetricsSection branchId="15" branchName="Urgut filiali" />
            <LocationProbe />
          </>
        }
      />
    </Routes>,
    { route, preloadedState: { role: { id: "1", role: "superadmin", region: null, name: "SA" } } as never },
  );

const section = () => screen.getByRole("region", { name: "Filial ko'rsatkichlari" });
const kpi = (name: string) => section().querySelector(`[data-kpi="${name}"]`) as HTMLElement;
/** KPI «Qabul qilingan» shu qiymatni ko'rsatguncha (yuklanishda KPI kartasi `data-kpi` siz). */
const waitForAccepted = (text: string) => waitFor(() => expect(kpi("acceptedCount")).toHaveTextContent(text));

describe("BranchMetricsSection (6CYRjoZG)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 8, 14, 0, 0));
    for (const fn of Object.values(api)) fn.mockReset();
    replies = [];
    api.get.mockImplementation((url: string) => {
      if (url !== "analytics/dashboard") return Promise.resolve({ data: { statusCode: 200, data: [] } });
      const next = replies.length > 1 ? replies.shift()! : (replies[0] ?? healthy());
      if (next instanceof Error) return Promise.reject({ isAxiosError: true, response: { status: 503, data: { message: next.message } } });
      return Promise.resolve({ data: { statusCode: 200, message: "Dashboard infos", data: next } });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("maket: sarlavha, davr, 4 KPI (delta + sparkline), muvaffaqiyat, kunlik daromad, holatlar, reyting", async () => {
    renderSection();

    await waitForAccepted("186 ta");
    expect(dashboardCalls()[0][1]).toEqual({
      params: { branch_id: "15", start_day: "2026-10-05", end_day: "2026-10-08" },
    });
    expect(within(section()).getByRole("heading", { level: 2, name: "Filial ko'rsatkichlari" })).toBeInTheDocument();
    expect(within(section()).getByText("Bu hafta · 05.10 – 08.10.2026 · Urgut filiali buyurtmalari")).toBeInTheDocument();
    const periods = within(section()).getByRole("radiogroup", { name: "Davr" });
    expect(within(periods).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Bugun", "Bu hafta", "Bu oy", "Barchasi"]);
    expect(within(periods).getByRole("radio", { name: "Bu hafta" })).toBeChecked();

    // KPI: qiymat, birlik, oldingi teng davrga nisbatan delta, 14 kunlik sparkline.
    expect(kpi("acceptedCount")).toHaveTextContent("Qabul qilingan");
    expect(kpi("acceptedCount")).toHaveTextContent("186 ta");
    expect(kpi("acceptedCount")).toHaveTextContent("+3,9%");
    expect(kpi("acceptedCount")).toHaveTextContent("oldingi davrga nisbatan");
    expect(within(kpi("acceptedCount")).getByRole("img", { name: /^Qabul qilingan, oxirgi 14 kun: kuniga/ })).toBeInTheDocument();
    expect(kpi("soldAndPaid")).toHaveTextContent("141 ta");
    expect(kpi("soldAndPaid")).toHaveTextContent("+9,3%");
    expect(kpi("totalRevenue")).toHaveTextContent("26,4 mln so'm");
    expect(kpi("totalRevenue")).toHaveTextContent("+8,1%");
    expect(kpi("profit")).toHaveTextContent("2,9 mln so'm");
    expect(kpi("profit")).toHaveTextContent("+8,4%");

    // Muvaffaqiyat: 141 / 186 = 75,8%, oldingi davr 129 / 179 = 72,1% → +3,7 p.p.
    const success = screen.getByRole("region", { name: "Muvaffaqiyat darajasi" });
    expect(within(success).getByText("75,8%")).toBeInTheDocument();
    expect(within(success).getByText("+3,7 p.p.")).toBeInTheDocument();
    expect(within(success).getByText("Oldingi davr · 72,1%")).toBeInTheDocument();

    // Kunlik daromad: dailyRevenue bandlari grafikda; «Jadval» — sana, summa, buyurtmalar.
    const revenue = screen.getByTestId("branch-metrics-revenue");
    expect(within(revenue).getByText("Bu hafta · 05.10 – 08.10.2026")).toBeInTheDocument();
    expect(await within(revenue).findByTestId("revenue-chart")).toHaveAttribute(
      "data-points",
      JSON.stringify([["05.10", 6_217_000], ["06.10", 6_759_000], ["07.10", 7_118_000], ["08.10", 6_306_000]]),
    );
    expect(within(revenue).queryByTestId("previous-line")).not.toBeInTheDocument();
    expect(within(revenue).getByText("Joriy davr · 05.10 – 08.10.2026")).toBeInTheDocument();
    await userEvent.setup().click(within(revenue).getByRole("radio", { name: "Jadval" }));
    const table = within(revenue).getByRole("table", { name: "Kunlik daromad" });
    expect(within(table).getByText("7 118 000 so'm")).toBeInTheDocument();
    expect(within(table).getByText("41 ta")).toBeInTheDocument();

    // Holatlar: Sotilgan · Yo'lda · Yangi · Bekor qilingan, «Ro'yxat ›» — filial va davr filtri bilan.
    const status = screen.getByTestId("branch-metrics-status");
    const legend = within(status).getByRole("list", { name: "Holatlar bo'yicha taqsimot" });
    expect(within(legend).getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      "Sotilgan141 ta75,8%",
      "Yo'lda22 ta11,8%",
      "Yangi6 ta3,2%",
      "Bekor qilingan17 ta9,1%",
    ]);
    expect(within(status).getByRole("link", { name: "Ro'yxat" })).toHaveAttribute(
      "href",
      "/orders?orderBranchId=15&startDay=2026-10-05&endDay=2026-10-08",
    );

    // Kuryerlar reytingi: «3 / 3 faol», qatorlar, izoh.
    const couriers = screen.getByTestId("branch-metrics-couriers");
    expect(within(couriers).getByText("3 / 3 faol")).toBeInTheDocument();
    expect(within(couriers).getByText("Sotuv foizi · sotilgan / biriktirilgan")).toBeInTheDocument();
    expect(within(couriers).getByText("Bahodir Karimov")).toBeInTheDocument();
    expect(within(couriers).getByText("81,7%")).toBeInTheDocument();
    expect(within(couriers).getByText("58 / 71 ta")).toBeInTheDocument();
    expect(
      within(couriers).getByText("Shu filial kuryerlari · bu hafta · 6 ta yangi (biriktirilmagan) buyurtma kirmaydi"),
    ).toBeInTheDocument();
  });

  it("davr almashadi: «Bu oy» — yangi sanalar va `?period=month`; «Barchasi» — `all=true`, delta yo'q", async () => {
    const user = userEvent.setup();
    renderSection();
    await waitForAccepted("186 ta");

    replies = [healthy({ orders: { acceptedCount: 412, soldAndPaid: 300, cancelled: 40, totalRevenue: 51_000_000, profit: 5_100_000 } })];
    await user.click(screen.getByRole("radio", { name: "Bu oy" }));
    await waitForAccepted("412 ta");
    expect(dashboardCalls().at(-1)![1]).toEqual({ params: { branch_id: "15", start_day: "2026-10-01", end_day: "2026-10-08" } });
    expect(screen.getByTestId("location")).toHaveTextContent("/branches/15?period=month");
    expect(screen.getByText("Bu oy · 01.10 – 08.10.2026 · Urgut filiali buyurtmalari")).toBeInTheDocument();

    replies = [healthy({ previous: null, series: null })];
    await user.click(screen.getByRole("radio", { name: "Barchasi" }));
    await waitFor(() => expect(dashboardCalls().at(-1)![1]).toEqual({ params: { branch_id: "15", all: true } }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "Barchasi" })).toBeChecked());
    await waitForAccepted("186 ta");
    expect(kpi("acceptedCount")).not.toHaveTextContent("nisbatan");
    expect(within(kpi("acceptedCount")).queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("branch-metrics-status").querySelector("a")).toHaveAttribute("href", "/orders?orderBranchId=15");

    // Sukut davriga qaytsa — URL'dan kalit olinadi.
    await user.click(screen.getByRole("radio", { name: "Bu hafta" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/branches\/15$/));
  });

  it("URL'dagi davr o'qiladi (`?period=today`) — «kechaga nisbatan», reyting oxirgi 30 kun bo'yicha", async () => {
    replies = [healthy({ topCouriersMeta: { period_rule: "last_30_days", period_days: 30, min_orders: 5 } })];
    renderSection("/branches/15?period=today");

    await waitForAccepted("186 ta");
    expect(dashboardCalls()[0][1]).toEqual({ params: { branch_id: "15", start_day: "2026-10-08", end_day: "2026-10-08" } });
    expect(screen.getByRole("radio", { name: "Bugun" })).toBeChecked();
    expect(kpi("acceptedCount")).toHaveTextContent("kechaga nisbatan");
    expect(screen.getByRole("region", { name: "Muvaffaqiyat darajasi" })).toHaveTextContent("Kecha · 72,1%");
    // Reyting oynasi davrdan farq qiladi — «yangi kirmaydi» yozilmaydi.
    expect(within(screen.getByTestId("branch-metrics-couriers")).getByText("Shu filial kuryerlari · oxirgi 30 kun")).toBeInTheDocument();
  });

  it("so'rov xatosi — «Filial ko'rsatkichlarini yuklab bo'lmadi» + «Qayta urinish» (qayta so'raydi)", async () => {
    const user = userEvent.setup();
    replies = [new Error("boom"), healthy()];
    renderSection();

    expect(await screen.findByText("Filial ko'rsatkichlarini yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByText("186")).not.toBeInTheDocument();
    await user.click(within(section()).getByRole("button", { name: "Qayta urinish" }));
    await waitForAccepted("186 ta");
    expect(dashboardCalls()).toHaveLength(2);
  });

  it("backend filialni qo'llamagan (`branch_id` yo'q) — kompaniya raqamlari emas, «hozircha mavjud emas»", async () => {
    replies = [healthy({ branch_id: undefined })];
    renderSection();

    expect(await screen.findByText(/Filial ko'rsatkichlari hozircha mavjud emas/)).toBeInTheDocument();
    expect(screen.queryByText("186")).not.toBeInTheDocument();
    expect(within(section()).getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
  });

  it("bo'sh davr — `EmptyState`", async () => {
    replies = [healthy({ orders: { acceptedCount: 0, soldAndPaid: 0, cancelled: 0, totalRevenue: 0, profit: 0 } })];
    renderSection();

    expect(await screen.findByText("Bu davrda filial buyurtmalari yo'q")).toBeInTheDocument();
    expect(screen.queryByTestId("branch-metrics-status")).not.toBeInTheDocument();
  });

  it("olinmagan bo'laklar (`failed_parts`) — kartalar joyida xato, nollar emas; `stats_unavailable` — belgi yo'q", async () => {
    replies = [
      healthy({
        dailyRevenue: null,
        statusDistribution: null,
        topCouriers: null,
        previous: null,
        series: null,
        degraded: true,
        failed_parts: ["dailyRevenue", "statusDistribution", "topCouriers", "trend"],
      }),
    ];
    renderSection();

    await waitForAccepted("186 ta");
    for (const id of ["branch-metrics-revenue", "branch-metrics-status", "branch-metrics-couriers"]) {
      const card = screen.getByTestId(id);
      expect(card).toHaveAttribute("data-part-failed");
      expect(within(card).getByText("Ma'lumotni yuklab bo'lmadi")).toBeInTheDocument();
    }
    expect(screen.queryByText("0 ta")).not.toBeInTheDocument();
    // `trend` olinmadi — delta va sparkline yo'q.
    expect(kpi("soldAndPaid")).not.toHaveTextContent("nisbatan");

    // Filial paneli `stats_unavailable` — «x / y faol» yo'q, reyting esa bor.
    replies = [healthy({ branchDashboard: { stats_unavailable: true, cards: { couriers: { branch_couriers: 3, active_today: 0 } } } })];
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Bu oy" }));
    await waitFor(() =>
      expect(within(screen.getByTestId("branch-metrics-couriers")).getByText("Bahodir Karimov")).toBeInTheDocument(),
    );
    expect(within(screen.getByTestId("branch-metrics-couriers")).queryByText(/faol$/)).not.toBeInTheDocument();
  });
});

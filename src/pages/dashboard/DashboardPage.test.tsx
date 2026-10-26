import type { ReactNode } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import DashboardPage from "./DashboardPage";
import { normalizeDashboardResponse } from "../../entities/dashboard";
import { renderWithProviders } from "../../test/test-utils";
import { getPreviousPeriodRange, getThisWeekRange, getTodayRange } from "../../shared/lib/dateRange";

const getDashboardMock = vi.fn();
const getKpiMock = vi.fn();
const getRevenueMock = vi.fn();
const useRegionStatsMock = vi.fn();
const myCashboxMock = vi.fn();

vi.mock("../../entities/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/dashboard")>()),
  useDashboard: () => ({ getDashboard: getDashboardMock, getKpi: getKpiMock, getRevenue: getRevenueMock }),
}));

vi.mock("../../entities/region", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/region")>()),
  useRegionStats: (...args: unknown[]) => useRegionStatsMock(...args),
}));

vi.mock("../../entities/payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/payments")>()),
  useCashBox: () => ({ useGetCashboxMyCashbox: (...args: unknown[]) => myCashboxMock(...args) }),
}));

// 2crjWf7v: «Kvitansiya yetkazilishi» (o'z testi — `DmDeliveryCard.test.tsx`); bu yerda faqat qaysi rolga va qaysi
// davr bilan chiziladi.
const dmDeliveryMock = vi.fn();
vi.mock("../../widgets/dm-delivery/ui/DmDeliveryCard", () => ({
  default: (props: { enabled: boolean; from?: string; to?: string }) => {
    dmDeliveryMock(props);
    return props.enabled ? <section aria-label="Kvitansiya yetkazilishi" /> : null;
  },
}));

// Viloyat oynasi (egasi «regions») — lazy; testda props'ni ko'rsatadigan o'rinbosar.
const regionDialogMock = vi.fn();
vi.mock("../../widgets/region-detail", () => ({
  default: (props: { open: boolean; region: { id: string; name: string } | null; periodLabel: string; dateParams: unknown; company?: unknown; onClose: () => void }) => {
    regionDialogMock(props);
    return props.open ? (
      <div role="dialog" aria-label={props.region?.name}>
        {props.periodLabel}
        <button type="button" onClick={props.onClose}>
          Yopish
        </button>
      </div>
    ) : null;
  },
}));

const settingsState: { data: unknown } = { data: undefined };
vi.mock("../../entities/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/settings")>()),
  useSettings: () => settingsState,
}));

// recharts — faqat «Moliyaviy tahlil» plotida (lazy); testda bo'sh o'ram.
vi.mock("recharts", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Nothing = () => null;
  return { ResponsiveContainer: Pass, ComposedChart: Pass, Area: Nothing, Line: Nothing, XAxis: Nothing, YAxis: Nothing, CartesianGrid: Nothing, Tooltip: Nothing };
});

const role = (name: string) => ({ role: { id: `${name}-1`, role: name, region: null, name } }) as never;
const adminState = role("admin");
const registratorState = role("registrator");
const courierState = role("courier");
const operatorState = role("operator");

const today = getTodayRange();
const yesterday = getPreviousPeriodRange(today)!;

const ordersFixture = { acceptedCount: 12, soldAndPaid: 5, cancelled: 2, profit: 480000, totalRevenue: 960000 };
const query = (data: unknown, extra: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  ...extra,
});

/** Joriy so'rov — `current`, kechagi (oldingi davr) — `previous`. */
const routeDashboard = (current: unknown, previous: unknown = { data: { orders: ordersFixture } }) =>
  getDashboardMock.mockImplementation((params: { start_day?: string }) =>
    query(params?.start_day === yesterday.from ? previous : current),
  );

const sectionOf = (title: string) => screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;

describe("DashboardPage (v2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsState.data = undefined;
    routeDashboard({ data: { orders: ordersFixture } });
    getKpiMock.mockReturnValue(
      query({
        data: {
          averageOrderValue: 96000,
          averageFulfillmentHours: 5.6667,
          onTimeRate: 80,
          cancellationRate: 16.67,
          courierEfficiency: 0,
          marketRating: [],
        },
      }),
    );
    getRevenueMock.mockReturnValue(query({ data: { summary: { totalRevenue: 0, totalOrders: 0, avgRevenue: 0 }, chart: { labels: [], values: [] } } }));
    useRegionStatsMock.mockReturnValue(query({ regions: [], summary: null, scopedDetail: null }));
    myCashboxMock.mockReturnValue(query(undefined));
  });

  it("sarlavha, izoh va davr boshqaruvlari; SA/admin uchun dashboard + kpi so'rovi", () => {
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    expect(getDashboardMock).toHaveBeenCalledWith({ start_day: "", end_day: "" }, true, "admin:unknown");
    expect(getKpiMock).toHaveBeenCalledWith({ start_day: "", end_day: "" }, true, "admin:unknown");
    expect(screen.getByRole("heading", { level: 1, name: "Bosh sahifa" })).toBeInTheDocument();
    expect(screen.getByText("Bugungi ko'rsatkichlar · butun kompaniya bo'yicha")).toBeInTheDocument();
    for (const name of ["Bugun", "Bu hafta", "Bu oy", "Barchasi"]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: "Bugun" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("combobox", { name: "Yilni tanlash" })).toBeInTheDocument();
  });

  it("ko'rsatkichlar haqiqiy kartalarda: KPI, muvaffaqiyat, holat, sifat (eski javobda «Yo'qotilgan daromad» — «—»)", () => {
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    const kpis = screen.getByRole("region", { name: "Asosiy ko'rsatkichlar" });
    expect(within(kpis).getByText("Jami daromad").closest("div")).toBeTruthy();
    expect(kpis).toHaveTextContent("960");
    expect(kpis).toHaveTextContent("ming so'm");
    expect(kpis).toHaveTextContent("480");
    expect(kpis).toHaveTextContent("96 000");
    // l9NNdsCH: 4-KPI — backend `lostRevenue` bermasa 0 emas, «—».
    const lost = kpis.querySelector('[data-kpi="lostRevenue"]') as HTMLElement;
    expect(within(lost).getByText("Yo'qotilgan daromad")).toBeInTheDocument();
    expect(within(lost).getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Buyurtmalar vaqti")).not.toBeInTheDocument();

    // 5 / 12 = 41,7% — o'rtacha zona
    const success = sectionOf("Muvaffaqiyat darajasi");
    expect(within(success).getByText("41,7%")).toBeInTheDocument();
    expect(within(success).getByText("O'rtacha · 40–70%")).toBeInTheDocument();

    const status = sectionOf("Buyurtmalar holati");
    const legend = within(status).getByRole("list", { name: "Holatlar bo'yicha taqsimot" });
    expect(legend).toHaveTextContent("Sotilgan5 ta");
    expect(legend).toHaveTextContent("Jarayonda5 ta");
    expect(legend).toHaveTextContent("Bekor qilingan2 ta");
    expect(within(status).getByRole("link", { name: /Ro'yxat/ })).toHaveAttribute(
      "href",
      `/orders?startDay=${today.from}&endDay=${today.to}`,
    );

    const quality = sectionOf("Yetkazish sifati");
    expect(quality).toHaveTextContent("80%");
    expect(quality).toHaveTextContent("16,7%");
    expect(quality).toHaveTextContent("2 / 12 ta");
    expect(quality).toHaveTextContent("5 soat 40 daq");
    expect(screen.getByRole("heading", { name: "Moliyaviy tahlil" })).toBeInTheDocument();
  });

  it("DwrMygfo: oldingi davr joriy javobning `previous` bo'lagidan — ikkinchi so'rov yo'q, delta «kechaga nisbatan»", () => {
    routeDashboard({
      data: {
        orders: { ...ordersFixture, lostRevenue: 150000 },
        previous: { ...ordersFixture, totalRevenue: 800000, profit: 400000, lostRevenue: 200000, from: null, to: null },
        series: null,
      },
    });
    getKpiMock.mockReturnValue(
      query({
        data: {
          averageOrderValue: 96000,
          averageFulfillmentHours: 5.6667,
          onTimeRate: 80,
          cancellationRate: 16.67,
          courierEfficiency: 0,
          marketRating: [],
          previous: { averageOrderValue: 80000, averageFulfillmentHours: 6, onTimeRate: 75, deliveryCount: 4, cancellationRate: 20 },
        },
      }),
    );
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    // Oldingi davr uchun ikkinchi og'ir so'rov yuborilmaydi (dashboard ham, kpi ham).
    for (const mock of [getDashboardMock, getKpiMock]) {
      expect(mock.mock.calls.some(([params, enabled]) => enabled && (params as { start_day?: string }).start_day === yesterday.from)).toBe(false);
    }
    const kpis = screen.getByRole("region", { name: "Asosiy ko'rsatkichlar" });
    // Daromad 960 000 / 800 000 → +20%; foyda 480 000 / 400 000 → +20%; o'rtacha 96 000 / 80 000 → +20%.
    expect(within(kpis).getAllByText("+20%")).toHaveLength(3);
    expect(within(kpis).getAllByText("kechaga nisbatan").length).toBe(4);
    // Yo'qotilgan daromad 150 000 / 200 000 → −25%, kamayish — yaxshi (yashil).
    const lost = kpis.querySelector('[data-kpi="lostRevenue"]') as HTMLElement;
    expect(lost).toHaveTextContent("150");
    const lostDelta = lost.querySelector("[data-stat-delta]") as HTMLElement;
    expect(lostDelta).toHaveTextContent("−25%");
    expect(lostDelta).toHaveAttribute("data-quality", "good");
    // Muvaffaqiyat: kecha 5/12 = 41,7% (oldingi davr `previous` dan).
    expect(within(sectionOf("Muvaffaqiyat darajasi")).getByText(/Kecha · 41,7%/)).toBeInTheDocument();
  });

  it("DwrMygfo: 14 kunlik seriya — KPI kartalarida sparkline (o'rtacha buyurtma — kpi seriyasidan)", () => {
    const days = Array.from({ length: 14 }, (_, index) => `2026-10-${String(index + 10).padStart(2, "0")}`);
    routeDashboard({
      data: {
        orders: { ...ordersFixture, lostRevenue: 0 },
        previous: null,
        series: days.map((date, index) => ({
          date,
          acceptedCount: 10,
          soldAndPaid: 5,
          cancelled: 1,
          totalRevenue: 100000 * (index + 1),
          profit: 50000 * (index + 1),
          lostRevenue: index % 2 ? 0 : 20000,
        })),
      },
    });
    getKpiMock.mockReturnValue(
      query({
        data: {
          averageOrderValue: 96000,
          averageFulfillmentHours: 0,
          onTimeRate: 0,
          cancellationRate: 0,
          courierEfficiency: 0,
          marketRating: [],
          series: days.map((date, index) => ({ date, averageOrderValue: 90000 + index * 1000, averageFulfillmentHours: 0, onTimeRate: 0, deliveryCount: 0, cancellationRate: 0 })),
        },
      }),
    );
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    const kpis = screen.getByRole("region", { name: "Asosiy ko'rsatkichlar" });
    const sparks = kpis.querySelectorAll("[data-sparkline]");
    expect(sparks).toHaveLength(4);
    expect(within(kpis).getByRole("img", { name: /^Jami daromad, oxirgi 14 kun: kuniga 100 ming so'm – 1,4 mln so'm, oxirgi kun 1,4 mln so'm$/ })).toBeInTheDocument();
    expect(within(kpis).getByRole("img", { name: /^O'rtacha buyurtma, oxirgi 14 kun: kuniga 90 000 so'm – 103 000 so'm/ })).toBeInTheDocument();
    // Oldingi davr yo'q — delta va «kechaga nisbatan» yo'q.
    expect(within(kpis).queryByText("kechaga nisbatan")).not.toBeInTheDocument();
  });

  it("l9NNdsCH: maqsad `targets.successRate` — «Maqsad · 80%» va izohda «maqsad 80%» («Yaxshi chegarasi · 70%» o'rniga)", () => {
    routeDashboard({ data: { orders: ordersFixture, targets: { successRate: 80 } } });
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    const success = sectionOf("Muvaffaqiyat darajasi");
    expect(within(success).getByText("Bugun · maqsad 80%")).toBeInTheDocument();
    expect(within(success).getByText("Maqsad · 80%")).toBeInTheDocument();
    expect(within(success).queryByText("Yaxshi chegarasi · 70%")).not.toBeInTheDocument();
    expect(success.querySelector("[data-gauge-target]")).not.toBeNull();
  });

  it("XdKajqLe: «Barchasi» → dashboard, kpi va revenue `all: true` bilan; sifat, moliyaviy tahlil va kassa chiziladi", async () => {
    const user = userEvent.setup();
    getKpiMock.mockImplementation((params: { all?: boolean }) =>
      query({
        data: {
          averageOrderValue: 96000,
          averageFulfillmentHours: 5.6667,
          onTimeRate: 80,
          cancellationRate: 16.67,
          courierEfficiency: 0,
          marketRating: [],
          ...(params?.all ? { appliedRange: { clamped: true, from: "2025-10-21", to: "2026-10-21" } } : {}),
        },
      }),
    );
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    await user.click(screen.getByRole("radio", { name: "Barchasi" }));

    expect(getDashboardMock).toHaveBeenCalledWith({ all: true }, true, "admin:unknown");
    expect(getKpiMock).toHaveBeenLastCalledWith({ all: true }, true, "admin:unknown");
    expect(getRevenueMock).toHaveBeenCalledWith({ period: "monthly", all: true }, true, "admin:unknown");
    expect(screen.getByText("Barcha davr ko'rsatkichlari · butun kompaniya bo'yicha")).toBeInTheDocument();
    const quality = sectionOf("Yetkazish sifati");
    expect(quality).toHaveTextContent("Barcha davr · oxirgi 366 kun");
    expect(quality).toHaveTextContent("80%");
    expect(screen.getByRole("heading", { name: "Moliyaviy tahlil" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kassa balansi" })).toBeInTheDocument();
    // O'rtacha buyurtma «—» emas — qiymat.
    const kpis = screen.getByRole("region", { name: "Asosiy ko'rsatkichlar" });
    expect(kpis.querySelector('[data-kpi="average"]')).toHaveTextContent("96 000");
    expect(screen.queryByText(/kuryerlar kesimi hisoblanmaydi/)).not.toBeInTheDocument();
  });

  it("tya24blo: «Barchasi» va backend oraliqni qisqartirgan (`clamped`) — sana maydonida haqiqiy oraliq", async () => {
    const user = userEvent.setup();
    getDashboardMock.mockImplementation((params: { all?: boolean }) =>
      query({ data: { orders: ordersFixture, ...(params?.all ? { appliedRange: { clamped: true, from: "2025-10-21", to: "2026-10-20" } } : {}) } }),
    );
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });
    expect(screen.queryByText(/21\.10\.2025/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Barchasi" }));

    expect(getDashboardMock).toHaveBeenCalledWith({ all: true }, true, "admin:unknown");
    expect(screen.getByText(/^21\.10\.2025\s–\s20\.10\.2026$/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Barchasi" })).toBeChecked();
  });

  it("davr redux'dan tiklanadi (sahifa qayta ochilganda) va «Tanlangan davr» izohi", () => {
    renderWithProviders(<DashboardPage />, {
      preloadedState: {
        role: { id: "admin-1", role: "admin", region: null, name: "admin" },
        filter: { dashboardFromDate: "2026-04-01", dashboardToDate: "2026-04-14" },
      } as never,
    });
    expect(getDashboardMock).toHaveBeenCalledWith({ start_day: "2026-04-01", end_day: "2026-04-14" }, true, "admin:unknown");
    expect(screen.getByText("Tanlangan davr ko'rsatkichlari · butun kompaniya bo'yicha")).toBeInTheDocument();
    expect(sectionOf("Muvaffaqiyat darajasi")).toHaveTextContent("01.04 – 14.04 · sotilgan / qabul qilingan");
  });

  it("⭐ dushanba: «Bu hafta» bosilsa o'zi belgilanadi, sarlavha — «Tanlangan davr»", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 26, 12)); // dushanba: «Bu hafta» = «Bugun» oralig'i
    try {
      const user = userEvent.setup();
      renderWithProviders(<DashboardPage />, { preloadedState: adminState });
      await user.click(screen.getByRole("radio", { name: "Bu hafta" }));

      expect(screen.getByRole("radio", { name: "Bu hafta" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Bugun" })).not.toBeChecked();
      expect(screen.getByText("Tanlangan davr ko'rsatkichlari · butun kompaniya bo'yicha")).toBeInTheDocument();
      expect(getDashboardMock).toHaveBeenCalledWith({ start_day: "2026-10-26", end_day: "2026-10-26" }, true, "admin:unknown");

      await user.click(screen.getByRole("radio", { name: "Bugun" }));
      expect(screen.getByRole("radio", { name: "Bugun" })).toBeChecked();
      expect(screen.getByText("Bugungi ko'rsatkichlar · butun kompaniya bo'yicha")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("dushanba: bosilgan «Bu hafta» redux'dan tiklanadi (sahifa qayta ochilganda)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 26, 12)); // dushanba: «Bu hafta» = «Bugun» oralig'i
    try {
      renderWithProviders(<DashboardPage />, {
        preloadedState: {
          role: { id: "admin-1", role: "admin", region: null, name: "admin" },
          filter: { dashboardFromDate: "2026-10-26", dashboardToDate: "2026-10-26", dashboardPreset: "week" },
        } as never,
      });
      expect(screen.getByRole("radio", { name: "Bu hafta" })).toBeChecked();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reytinglar: Top marketlar (backend reytingi), Top filiallar, Top kuryerlar (`couriers` dan saralangan)", async () => {
    const user = userEvent.setup();
    const performer = (index: number) => ({ total_orders: 20, successful_orders: 20 - index, success_rate: ((20 - index) / 20) * 100 });
    routeDashboard({
      data: {
        orders: ordersFixture,
        topMarkets: [{ market_id: "m-1", market_name: "Chilonzor Market", total_orders: 50, successful_orders: 45, success_rate: 90 }],
        markets: Array.from({ length: 12 }, (_, i) => ({ market_id: `m${i}`, market_name: `Market ${String(i + 1).padStart(2, "0")}`, ...performer(i) })),
        topBranches: [{ branch_id: "b-1", branch_name: "Yunusobod filiali", total_orders: 40, successful_orders: 32, success_rate: 80 }],
        couriers: [
          { courier_id: "c-1", courier_name: "Aziz", ...performer(5) },
          { courier_id: "c-2", courier_name: "Bobur", ...performer(1) },
        ],
      },
    });
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    const markets = sectionOf("Top marketlar");
    expect(within(markets).getByText("Chilonzor Market")).toBeInTheDocument();
    expect(within(markets).getByText("45 / 50 ta")).toBeInTheDocument();
    // «Yana ko'rsatish» — to'liq `markets` statistikasi (12 ta), «Kamroq ko'rsatish» — qaytadi.
    await user.click(within(markets).getByRole("button", { name: /Yana ko'rsatish · 11 ta/ }));
    expect(within(markets).getAllByRole("listitem")).toHaveLength(12);
    await user.click(within(markets).getByRole("button", { name: "Kamroq ko'rsatish" }));
    expect(within(markets).getAllByRole("listitem")).toHaveLength(1);

    expect(within(sectionOf("Top filiallar")).getByText("Yunusobod filiali")).toBeInTheDocument();
    // Ma'lumot kam (< 5 qator) — izoh
    expect(within(sectionOf("Top filiallar")).getByText("Ma'lumot hali kam — reyting natijalari o'zgarishi mumkin")).toBeInTheDocument();

    const couriers = within(sectionOf("Top kuryerlar")).getAllByRole("listitem");
    expect(couriers[0]).toHaveTextContent("Bobur");
    expect(couriers[1]).toHaveTextContent("Aziz");
  });

  it("PMa5dgYQ: reytinglarda sotuv foizi 50% dan past qator — qizil meter, qolganlari maketdagidek ko'k", () => {
    routeDashboard({
      data: {
        orders: ordersFixture,
        topMarkets: [
          { market_id: "m-1", market_name: "Yaxshi Market", total_orders: 50, successful_orders: 42, success_rate: 84 },
          { market_id: "m-2", market_name: "Past Market", total_orders: 20, successful_orders: 7, success_rate: 35 },
        ],
        couriers: [
          { courier_id: "c-1", courier_name: "Aziz", total_orders: 20, successful_orders: 19, success_rate: 95 },
          { courier_id: "c-2", courier_name: "Bobur", total_orders: 20, successful_orders: 9, success_rate: 45 },
        ],
      },
    });
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    const fillOf = (section: string, name: string) =>
      within(sectionOf(section))
        .getAllByRole("listitem")
        .find((item) => item.textContent?.includes(name))!
        .querySelector("[aria-hidden] > span, [role=meter] > span");
    expect(fillOf("Top marketlar", "Past Market")).toHaveClass("bg-danger");
    expect(fillOf("Top marketlar", "Yaxshi Market")).toHaveClass("bg-chart-1");
    expect(fillOf("Top kuryerlar", "Bobur")).toHaveClass("bg-danger");
    expect(fillOf("Top kuryerlar", "Aziz")).toHaveClass("bg-chart-1");
  });

  it("to'liq statistika bo'sh bo'lsa (Barchasi) — reyting top ro'yxatdan", () => {
    routeDashboard({
      data: {
        orders: ordersFixture,
        markets: [],
        couriers: [],
        topMarkets: [
          { market_id: "m-1", market_name: "A", total_orders: 50, successful_orders: 22, success_rate: 44 },
          { market_id: "m-2", market_name: "B", total_orders: 66, successful_orders: 16, success_rate: 24 },
        ],
      },
    });
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });
    expect(within(sectionOf("Top marketlar")).getAllByRole("listitem")).toHaveLength(2);
    expect(within(sectionOf("Top kuryerlar")).getByText("Reyting uchun ma'lumot hali kam")).toBeInTheDocument();
  });

  it("sozlamada yashirilgan bloklar chizilmaydi", async () => {
    const { DEFAULT_SETTINGS } = await import("../../entities/settings");
    settingsState.data = {
      ...DEFAULT_SETTINGS,
      dashboard: { widgets: { ...DEFAULT_SETTINGS.dashboard.widgets, financial: false, topPerformers: false, performanceChart: false, region: false } },
    };
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });
    expect(screen.getByRole("heading", { name: "Muvaffaqiyat darajasi" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Moliyaviy tahlil" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Top marketlar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Top kuryerlar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hududlar bo'yicha" })).not.toBeInTheDocument();
    expect(useRegionStatsMock).not.toHaveBeenCalled();
  });

  it("registrator: KPI yo'q, kpi va revenue so'ralmaydi, «Yetkazish natijalari», hududlarda daromad yo'q", async () => {
    const user = userEvent.setup();
    useRegionStatsMock.mockReturnValue(
      query({
        regions: [
          { id: "1", name: "Toshkent shahri", districtCount: 11, activeCouriers: 20, ordersCount: 112, deliveredOrders: 91, cancelledOrders: 8, pendingOrders: 13, totalRevenue: 18_500_000, successRate: 81.3 },
        ],
        summary: null,
        scopedDetail: null,
      }),
    );
    renderWithProviders(<DashboardPage />, { preloadedState: registratorState });

    expect(getKpiMock).toHaveBeenCalledWith({ start_day: "", end_day: "" }, false, "registrator:unknown");
    expect(getKpiMock).not.toHaveBeenCalledWith(expect.anything(), true, expect.anything());
    expect(getRevenueMock).not.toHaveBeenCalled();
    // Oldingi davr so'rovi registratorga yuborilmaydi (KPI qatori yo'q).
    expect(getDashboardMock).not.toHaveBeenCalledWith(expect.objectContaining({ start_day: yesterday.from }), true, expect.anything());
    expect(screen.queryByRole("region", { name: "Asosiy ko'rsatkichlar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Moliyaviy tahlil" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Yetkazish sifati" })).not.toBeInTheDocument();
    const results = sectionOf("Yetkazish natijalari");
    expect(results).toHaveTextContent("5 ta");
    expect(sectionOf("Muvaffaqiyat darajasi")).toHaveTextContent("Zonalar: 40% dan kam");
    const regions = sectionOf("Hududlar bo'yicha");
    expect(within(regions).queryByRole("radio", { name: "Daromad" })).not.toBeInTheDocument();
    expect(within(regions).getByRole("radio", { name: "Muvaffaqiyat" })).toBeInTheDocument();
    expect(within(regions).getByRole("table")).not.toHaveTextContent("so'm");
    // Registrator ham viloyat oynasini ochadi, lekin daromadsiz (eski xulq: daromad ko'rsatilmas edi).
    expect(regions).toHaveTextContent("Hududni bosing");
    await user.click(within(regions).getByRole("button", { name: "Toshkent sh.: 112 ta buyurtma" }));
    expect(await screen.findByRole("dialog", { name: "Toshkent shahri" })).toBeInTheDocument();
    expect(regionDialogMock).toHaveBeenLastCalledWith(expect.objectContaining({ open: true, showRevenue: false }));
  });

  it("hududlar: kartogramma, jadval va xulosa `region/stats/all` dan (sana bo'sh — bugun)", () => {
    useRegionStatsMock.mockReturnValue(
      query({
        regions: [
          { id: "1", name: "Toshkent shahri", districtCount: 11, activeCouriers: 20, ordersCount: 112, deliveredOrders: 91, cancelledOrders: 8, pendingOrders: 13, totalRevenue: 18_500_000, successRate: 81.3 },
          { id: "2", name: "Andijon viloyati", districtCount: 14, activeCouriers: 6, ordersCount: 21, deliveredOrders: 15, cancelledOrders: 3, pendingOrders: 3, totalRevenue: 3_000_000, successRate: 71.4 },
        ],
        summary: null,
        scopedDetail: null,
      }),
    );
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    expect(useRegionStatsMock).toHaveBeenCalledWith({ startDate: today.from, endDate: today.to }, true);
    const card = sectionOf("Hududlar bo'yicha");
    expect(within(card).getByRole("button", { name: "Toshkent sh.: 112 ta buyurtma" })).toBeInTheDocument();
    const table = within(card).getByRole("table");
    expect(within(table).getByText("18,5 mln so'm")).toBeInTheDocument();
    expect(within(table).getByText("Jami · 2 hudud")).toBeInTheDocument();
    expect(card).toHaveTextContent("Eng past sotuv (10+ ta)Andijon71,4% · 15 / 21 ta");
    expect(card).toHaveTextContent("Faol kuryerlar26 ta2 hududda");
    expect(card).toHaveTextContent("Hududni bosing — tumanlar kesimi ochiladi");
    // Oyna bosilmaguncha mount bo'lmaydi (lazy chunk ham yuklanmaydi).
    expect(regionDialogMock).not.toHaveBeenCalled();
  });

  it("hudud katagi yoki jadval qatori bosilsa — `RegionDetailDialog` (lazy) shu viloyat va davr bilan ochiladi", async () => {
    const user = userEvent.setup();
    useRegionStatsMock.mockReturnValue(
      query({
        regions: [
          { id: "1", name: "Toshkent shahri", districtCount: 11, activeCouriers: 20, ordersCount: 112, deliveredOrders: 91, cancelledOrders: 8, pendingOrders: 13, totalRevenue: 18_500_000, successRate: 81.3 },
          { id: "2", name: "Andijon viloyati", districtCount: 14, activeCouriers: 6, ordersCount: 21, deliveredOrders: 15, cancelledOrders: 3, pendingOrders: 3, totalRevenue: 3_000_000, successRate: 71.4 },
        ],
        summary: null,
        scopedDetail: null,
      }),
    );
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });
    const card = sectionOf("Hududlar bo'yicha");

    await user.click(within(card).getByRole("button", { name: "Toshkent sh.: 112 ta buyurtma" }));
    expect(await screen.findByRole("dialog", { name: "Toshkent shahri" })).toHaveTextContent("Bugun");
    expect(regionDialogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        region: { id: "1", name: "Toshkent shahri" },
        dateParams: { startDate: today.from, endDate: today.to },
        periodLabel: "Bugun",
        company: { totalOrders: 133, totalRevenue: 21_500_000, successRate: (106 / 133) * 100 },
        showRevenue: true,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Yopish" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Jadval qatori (klaviatura — ismdagi tugma).
    const table = within(card).getByRole("table");
    within(table).getByRole("button", { name: "Andijon" }).focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "Andijon viloyati" })).toBeInTheDocument();
  });

  it("kuryer: o'z KPI'lari, kpi/revenue yo'q, kompaniya bloklari yo'q, «Siz» va «Sizning o'rningiz»", () => {
    routeDashboard(
      {
        data: {
          myStat: { totalOrders: 27, soldOrders: 20, canceledOrders: 2, profit: 500000, successRate: 74.1 },
          topCouriers: [
            { courier_id: "c-9", courier_name: "Rustam Qosimov", total_orders: 21, successful_orders: 17, success_rate: 81 },
            { courier_id: "c-8", courier_name: "Eldor Mahmudov", total_orders: 21, successful_orders: 16, success_rate: 76.2 },
            { courier_id: "courier-1", courier_name: "Jasur Tursunov", total_orders: 27, successful_orders: 20, success_rate: 74.1 },
          ],
          myRank: 3,
          myRanking: { courier_id: "courier-1", courier_name: "Jasur Tursunov", total_orders: 27, successful_orders: 20, success_rate: 74.1 },
        },
      },
      { data: { myStat: { totalOrders: 25, soldOrders: 18, canceledOrders: 3, profit: 450000, successRate: 72 } } },
    );
    renderWithProviders(<DashboardPage />, { preloadedState: courierState });

    const grid = screen.getByTestId("courier-stats-grid");
    expect(grid.children).toHaveLength(4);
    expect(grid).toHaveTextContent("27");
    expect(grid).toHaveTextContent("500 000");
    expect(within(grid).getAllByText("kechaga nisbatan").length).toBe(4);
    expect(getDashboardMock).toHaveBeenCalledWith({ start_day: "", end_day: "" }, true, "courier:unknown");
    expect(getKpiMock).not.toHaveBeenCalledWith(expect.anything(), true, expect.anything());
    expect(getRevenueMock).not.toHaveBeenCalled();
    expect(myCashboxMock).toHaveBeenCalledWith({ fromDate: today.from, toDate: today.to }, { silentError: true });

    expect(sectionOf("Bugungi reja")).toHaveTextContent("Sizga biriktirilgan 27 ta buyurtma");
    expect(sectionOf("Bugungi reja")).toHaveTextContent("5 ta qoldi");
    expect(sectionOf("Muvaffaqiyat darajasi")).toHaveTextContent("Kecha · 72%");

    const top = sectionOf("Top kuryerlar");
    expect(within(top).getByRole("listitem", { name: "3. Jasur Tursunov (Siz)" })).toBeInTheDocument();
    expect(top).toHaveTextContent("Sizning o'rningiz");
    expect(top).toHaveTextContent("3-o'rin · 2-o'ringa 2,1 p.p. qoldi");

    expect(screen.queryByRole("heading", { name: "Top marketlar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hududlar bo'yicha" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Moliyaviy tahlil" })).not.toBeInTheDocument();
  });

  it("kuryer ma'lumoti yuklanayotganda — 4 ta KPI skeleti", () => {
    getDashboardMock.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderWithProviders(<DashboardPage />, { preloadedState: courierState });
    expect(screen.getByTestId("courier-stats-grid").children).toHaveLength(4);
    expect(container.querySelectorAll("[data-stat-skeleton]")).toHaveLength(4);
  });

  it("kuryer myStat kelmasa — nol kartalar o'rniga xato", () => {
    getDashboardMock.mockReturnValue(query({ data: { orders: {} } }));
    renderWithProviders(<DashboardPage />, { preloadedState: courierState });
    expect(screen.getByText("Kuryer statistikasi hozircha mavjud emas.")).toBeInTheDocument();
    expect(screen.queryByTestId("courier-stats-grid")).not.toBeInTheDocument();
  });

  it("kuryer so'rovi yiqilsa — «Qayta urinish» qayta so'raydi", async () => {
    const refetch = vi.fn();
    getDashboardMock.mockReturnValue({ isError: true, isLoading: false, refetch });
    renderWithProviders(<DashboardPage />, { preloadedState: courierState });
    expect(screen.getByText("Bosh sahifa ma'lumotlarini yuklab bo'lmadi.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("kuryer davrni almashtirsa — statistika yangi davr bilan so'raladi", async () => {
    getDashboardMock.mockImplementation((params: { start_day?: string }) =>
      query({ data: { myStat: { totalOrders: params.start_day ? 9 : 28, soldOrders: 5, canceledOrders: 1, profit: 120000, successRate: 55.56 } } }),
    );
    renderWithProviders(<DashboardPage />, { preloadedState: courierState });
    await userEvent.setup().click(screen.getByRole("radio", { name: "Bu hafta" }));
    const week = getThisWeekRange();
    expect(getDashboardMock).toHaveBeenCalledWith({ start_day: week.from, end_day: week.to }, true, "courier:unknown");
    expect(screen.getByTestId("courier-stats-grid")).toHaveTextContent("9");
  });

  it("javob bo'sh — nollar bilan (yiqilmaydi)", () => {
    getDashboardMock.mockReturnValue(query(undefined));
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });
    expect(within(sectionOf("Muvaffaqiyat darajasi")).getByText("0%")).toBeInTheDocument();
  });

  it("operator: asosiy kartalar bor, kompaniya reytinglari/hududlar/moliya yo'q", () => {
    renderWithProviders(<DashboardPage />, { preloadedState: operatorState });
    expect(screen.getByRole("heading", { name: "Muvaffaqiyat darajasi" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Yetkazish natijalari" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Top marketlar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hududlar bo'yicha" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Moliyaviy tahlil" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Asosiy ko'rsatkichlar" })).not.toBeInTheDocument();
  });

  it("SA/admin xatosi — kartalar o'rnida xato va ikkala so'rovni qayta yuborish", async () => {
    const refetchDashboard = vi.fn();
    const refetchKpi = vi.fn();
    getDashboardMock.mockReturnValue({ isError: true, isLoading: false, refetch: refetchDashboard });
    getKpiMock.mockReturnValue({ isError: false, isLoading: false, refetch: refetchKpi });
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });
    await userEvent.setup().click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetchDashboard).toHaveBeenCalled();
    expect(refetchKpi).toHaveBeenCalled();
  });
});

describe("DashboardPage (v2) — reytinglar: davr, yuklanish, bo'sh holat (9zbSDkUI)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsState.data = undefined;
    getKpiMock.mockReturnValue(query({ data: { averageOrderValue: 0, averageFulfillmentHours: 0, onTimeRate: 0, cancellationRate: 0, courierEfficiency: 0, marketRating: [] } }));
    getRevenueMock.mockReturnValue(query({ data: { summary: { totalRevenue: 0, totalOrders: 0, avgRevenue: 0 }, chart: { labels: [], values: [] } } }));
    useRegionStatsMock.mockReturnValue(query({ regions: [], summary: null, scopedDetail: null }));
    myCashboxMock.mockReturnValue(query(undefined));
  });

  it("yuklanishda reyting kartalarida skelet — bo'sh holat matni yozilmaydi", () => {
    getDashboardMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    for (const id of ["ranking-markets", "ranking-branches"]) {
      const card = screen.getByTestId(id);
      expect(card).toHaveAttribute("aria-busy", "true");
      expect(card).not.toHaveTextContent("Bu davrda reyting uchun buyurtma yo'q");
    }
  });

  it("izohda davr («oxirgi 30 kun»), bo'sh reyting — ixcham, «30 buyurtma» matnisiz", () => {
    routeDashboard({
      data: {
        orders: { acceptedCount: 1, soldAndPaid: 0, cancelled: 0, profit: 0, totalRevenue: 0 },
        topMarkets: [{ market_id: "m-1", market_name: "Baraka Shop", total_orders: 45, successful_orders: 38, success_rate: 84.4 }],
        topBranches: [],
        topMarketsMeta: { periodRule: "last_30_days", periodDays: 30, from: null, to: null, minOrders: 1, filteredOut: 0 },
        topBranchesMeta: { periodRule: "last_30_days", periodDays: 30, from: null, to: null, minOrders: 1, filteredOut: 0 },
      },
    });
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    const markets = screen.getByTestId("ranking-markets");
    expect(markets).toHaveTextContent("Sotuv foizi · sotilgan / jami · oxirgi 30 kun");
    expect(markets).toHaveTextContent("84,4%");
    expect(markets).toHaveTextContent("38 / 45 ta");
    // 45 ta buyurtma (≥ 30), chetda qolgan yo'q — «Kam ma'lumot» izohi yo'q.
    expect(markets).not.toHaveTextContent("Ma'lumot hali kam");

    const branches = screen.getByTestId("ranking-branches");
    expect(branches).toHaveAttribute("data-empty");
    expect(branches).toHaveClass("self-start");
    expect(branches.querySelector('[data-state-size="inline"]')).toHaveTextContent("Bu davrda reyting uchun buyurtma yo'q");
    expect(screen.queryByText(/kamida 30 buyurtma/)).not.toBeInTheDocument();
  });

  it("«Kam ma'lumot»: 30 dan kam buyurtmali qator bo'lsa — reyting + izoh", () => {
    routeDashboard({
      data: {
        orders: ordersFixture,
        topMarkets: [
          { market_id: "m-1", market_name: "Baraka Shop", total_orders: 45, successful_orders: 38, success_rate: 84.4 },
          { market_id: "m-2", market_name: "Nur", total_orders: 18, successful_orders: 13, success_rate: 72.2 },
        ],
      },
    });
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });
    expect(screen.getByTestId("ranking-markets")).toHaveTextContent("Ma'lumot hali kam — reyting natijalari o'zgarishi mumkin");
  });

  it("kuryer va operator: kompaniya reytinglari (`ranking-markets`/`ranking-branches`) yo'q", () => {
    routeDashboard({ data: { myStat: { totalOrders: 1, soldOrders: 1, canceledOrders: 0, profit: 0, successRate: 100 } } });
    const { unmount } = renderWithProviders(<DashboardPage />, { preloadedState: courierState });
    expect(screen.queryByTestId("ranking-markets")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ranking-branches")).not.toBeInTheDocument();
    unmount();

    routeDashboard({ data: { orders: ordersFixture } });
    renderWithProviders(<DashboardPage />, { preloadedState: operatorState });
    expect(screen.queryByTestId("ranking-markets")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ranking-branches")).not.toBeInTheDocument();
  });
});

describe("DashboardPage (v2) — qisman nosozlik: bo'lak 0 emas, xato holati (VkwhHqvW)", () => {
  const okKpi = { data: { averageOrderValue: 96000, averageFulfillmentHours: 24, onTimeRate: 80, cancellationRate: 0, courierEfficiency: 0, marketRating: [] } };

  beforeEach(() => {
    vi.clearAllMocks();
    settingsState.data = undefined;
    getKpiMock.mockReturnValue(query(okKpi));
    getRevenueMock.mockReturnValue(query({ data: { summary: { totalRevenue: 0, totalOrders: 0, avgRevenue: 0 }, chart: { labels: [], values: [] } } }));
    useRegionStatsMock.mockReturnValue(query({ regions: [], summary: null, scopedDetail: null }));
    myCashboxMock.mockReturnValue(query(undefined));
  });

  it("`failed_parts: topMarkets, markets` — «Top marketlar» joyida «Ma'lumotni yuklab bo'lmadi» + «Qayta urinish»; qolganlari odatdagidek", async () => {
    const refetch = vi.fn();
    getDashboardMock.mockReturnValue(
      query(
        {
          data: {
            orders: ordersFixture,
            topMarkets: [],
            markets: [],
            topBranches: [{ branch_id: "b-1", branch_name: "Samarqand filiali", total_orders: 40, successful_orders: 30, success_rate: 75 }],
            couriers: [{ courier_id: "c-1", courier_name: "Aziz", total_orders: 40, successful_orders: 30, success_rate: 75 }],
            degraded: true,
            failedParts: ["topMarkets", "markets"],
          },
        },
        { refetch },
      ),
    );
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    const markets = screen.getByTestId("ranking-markets");
    expect(markets).toHaveAttribute("data-part-failed");
    expect(markets).toHaveTextContent("Top marketlar");
    expect(markets).toHaveTextContent("Ma'lumotni yuklab bo'lmadi");
    expect(markets).not.toHaveTextContent("Bu davrda reyting uchun buyurtma yo'q");
    expect(screen.getByTestId("ranking-branches")).not.toHaveAttribute("data-part-failed");
    expect(screen.getByTestId("ranking-branches")).toHaveTextContent("Samarqand filiali");
    // Kuryerlar bo'limi (`couriers`) olingan — «Top kuryerlar» joyida.
    expect(screen.getByTestId("ranking-couriers")).not.toHaveAttribute("data-part-failed");
    expect(screen.getByTestId("ranking-couriers")).toHaveTextContent("Aziz");
    // Buyurtmalar statistikasi olingan — joyida.
    expect(screen.getByRole("region", { name: "Asosiy ko'rsatkichlar" })).toHaveTextContent("960");
    expect(sectionOf("Muvaffaqiyat darajasi")).toHaveTextContent("41,7%");

    const user = userEvent.setup();
    await user.click(within(markets).getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("`couriers` olinmasa (admin) — «Top kuryerlar» joyida xato kartasi", () => {
    getDashboardMock.mockReturnValue(query({ data: { orders: ordersFixture, couriers: [], degraded: true, failedParts: ["couriers"] } }));
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });
    const couriers = screen.getByTestId("ranking-couriers");
    expect(couriers).toHaveAttribute("data-part-failed");
    expect(couriers).toHaveTextContent("Top kuryerlar");
    expect(couriers).not.toHaveTextContent("Reyting uchun ma'lumot hali kam");
  });

  it("`orders` olinmasa — statistika 0 lar emas, xato", () => {
    getDashboardMock.mockReturnValue(query({ data: { orders: ordersFixture, degraded: true, failedParts: ["orders"] } }));
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });
    expect(screen.queryByRole("region", { name: "Asosiy ko'rsatkichlar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Muvaffaqiyat darajasi" })).not.toBeInTheDocument();
    expect(screen.getByText("Bosh sahifa ma'lumotlarini yuklab bo'lmadi.")).toBeInTheDocument();
  });

  it("KPI'ning statistikada chizilmaydigan bo'lagi (`marketRating`) olinmasa — buyurtmalar statistikasi yashirilmaydi", () => {
    getDashboardMock.mockReturnValue(query({ data: { orders: ordersFixture } }));
    getKpiMock.mockReturnValue(query({ data: { ...okKpi.data, degraded: true, failedParts: ["marketRating"] } }));
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    expect(screen.getByRole("region", { name: "Asosiy ko'rsatkichlar" })).toHaveTextContent("960");
    expect(sectionOf("Muvaffaqiyat darajasi")).toHaveTextContent("41,7%");
  });

  it("KPI `degraded` (masalan `fulfillment` olinmadi) — statistika bloki 0 lar emas, xato va «Qayta urinish»", async () => {
    const refetchKpi = vi.fn();
    getDashboardMock.mockReturnValue(query({ data: { orders: ordersFixture } }));
    getKpiMock.mockReturnValue(
      query({ data: { ...okKpi.data, averageFulfillmentHours: 0, onTimeRate: 0, degraded: true, failedParts: ["fulfillment"] } }, { refetch: refetchKpi }),
    );
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });

    expect(screen.queryByRole("region", { name: "Asosiy ko'rsatkichlar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Yetkazish sifati" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Qayta urinish" })[0]);
    expect(refetchKpi).toHaveBeenCalledTimes(1);
  });

  it("oldingi davr bo'lagi olinmagan (`failed_parts: trend`) — delta va sparkline yo'q (0 bilan solishtirilmaydi)", () => {
    // Sog' javobda 960 000 / 800 000 → «+20%» bo'lardi (yuqoridagi test); bo'lak olinmagan — delta yo'q.
    // Haqiqiy normalizatsiya orqali: backend `trend` olinmasa `previous`/`series` ni `null` qiladi.
    routeDashboard(
      normalizeDashboardResponse({
        statusCode: 200,
        data: {
          orders: ordersFixture,
          previous: { ...ordersFixture, totalRevenue: 800000 },
          series: [
            { date: "2026-10-20", ...ordersFixture },
            { date: "2026-10-21", ...ordersFixture },
          ],
          degraded: true,
          failed_parts: ["trend"],
        },
      }),
    );
    renderWithProviders(<DashboardPage />, { preloadedState: adminState });
    const kpis = screen.getByRole("region", { name: "Asosiy ko'rsatkichlar" });
    expect(within(kpis).queryByText("+20%")).not.toBeInTheDocument();
    expect(kpis.querySelector("[data-sparkline]")).toBeNull();
    // Statistika bloki yashirilmaydi (faqat trend bo'lagi olinmagan).
    expect(within(kpis).getByText("Jami daromad")).toBeInTheDocument();
  });

  it("kuryer: `failed_parts: topCouriers` — reyting joyida xato kartasi (yashirilmaydi, 0 emas)", () => {
    getDashboardMock.mockReturnValue(
      query({
        data: {
          orders: {},
          myStat: { totalOrders: 28, soldOrders: 19, canceledOrders: 3, profit: 480000, successRate: 67.86 },
          topCouriers: [],
          degraded: true,
          failedParts: ["topCouriers"],
        },
      }),
    );
    renderWithProviders(<DashboardPage />, { preloadedState: courierState });

    expect(screen.getByTestId("courier-stats-grid")).toBeInTheDocument();
    expect(screen.getByTestId("courier-ranking-failed")).toHaveTextContent("Top kuryerlar");
    expect(screen.getByTestId("courier-ranking-failed")).toHaveTextContent("Ma'lumotni yuklab bo'lmadi");
    expect(screen.queryByTestId("courier-ranking")).not.toBeInTheDocument();
  });
});

// KI-2: kartaning o'z xulqi `features/pwa-install` testlarida; bu yerda — faqat kuryer tarmog'ida joylashuvi.
// Qisman mock: boshqa eksportlar asliday qoladi — DashboardPage keyinroq barreldan yana nimadir olsa ham test buzilmaydi.
vi.mock("../../features/pwa-install", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/pwa-install")>()),
  InstallAppCard: ({ placement }: { placement: string }) => <div data-testid={`pwa-card-${placement}`} />,
}));

describe("DashboardPage (v2) — «Ilovani o'rnatish» (KI-2, courier-dashboard-pwa-install)", () => {
  beforeEach(() => {
    settingsState.data = undefined;
    getDashboardMock.mockReturnValue(query({ data: { orders: {} } }));
    getKpiMock.mockReturnValue(
      query({ data: { averageOrderValue: 0, averageFulfillmentHours: 0, onTimeRate: 0, cancellationRate: 0, courierEfficiency: 0, marketRating: [] } }),
    );
    getRevenueMock.mockReturnValue(query({ data: { summary: { totalRevenue: 0, totalOrders: 0, avgRevenue: 0 }, chart: { labels: [], values: [] } } }));
    useRegionStatsMock.mockReturnValue(query({ regions: [], summary: null, scopedDetail: null }));
    myCashboxMock.mockReturnValue(query(undefined));
  });

  it("kuryer — sarlavhadan keyin bir martalik karta (placement=dashboard)", () => {
    renderWithProviders(<DashboardPage />, { preloadedState: courierState });
    const card = screen.getByTestId("pwa-card-dashboard");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ["admin", adminState],
    ["registrator", registratorState],
  ])("%s — kartasiz (ega javobi KI-S3: faqat kuryer)", (_name, state) => {
    renderWithProviders(<DashboardPage />, { preloadedState: state });
    expect(screen.queryByTestId("pwa-card-dashboard")).not.toBeInTheDocument();
  });
});

describe("DashboardPage (v2) — «Kvitansiya yetkazilishi» (2crjWf7v)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsState.data = undefined;
    getDashboardMock.mockReturnValue(query({ data: { orders: {} } }));
    getKpiMock.mockReturnValue(
      query({ data: { averageOrderValue: 0, averageFulfillmentHours: 0, onTimeRate: 0, cancellationRate: 0, courierEfficiency: 0, marketRating: [] } }),
    );
    getRevenueMock.mockReturnValue(query({ data: { summary: { totalRevenue: 0, totalOrders: 0, avgRevenue: 0 }, chart: { labels: [], values: [] } } }));
    useRegionStatsMock.mockReturnValue(query({ regions: [], summary: null, scopedDetail: null }));
    myCashboxMock.mockReturnValue(query(undefined));
  });

  it("faqat superadmin — karta bosh sahifa davri bilan (sana bo'sh — backend sukuti)", () => {
    renderWithProviders(<DashboardPage />, { preloadedState: role("superadmin") });
    expect(screen.getByRole("region", { name: "Kvitansiya yetkazilishi" })).toBeInTheDocument();
    expect(dmDeliveryMock).toHaveBeenLastCalledWith({ enabled: true, from: "", to: "" });
  });

  it.each([
    ["admin", adminState],
    ["registrator", registratorState],
    ["kuryer", courierState],
  ])("%s — kartasiz (endpoint faqat superadmin)", (_name, state) => {
    renderWithProviders(<DashboardPage />, { preloadedState: state });
    expect(screen.queryByRole("region", { name: "Kvitansiya yetkazilishi" })).not.toBeInTheDocument();
  });
});

import type { ReactNode } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import FinancialAnalysis from "./FinancialAnalysis";
import { TrendTooltip } from "./FinancialTrendPlot";

const getRevenueMock = vi.fn();

vi.mock("../../../entities/dashboard", () => ({
  useDashboard: () => ({ getRevenue: getRevenueMock }),
}));

// recharts — faqat plot chunk'ida; testda nuqtalar va oldingi chiziq ko'rinadigan qilib almashtiriladi.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children, data }: { children: ReactNode; data: Array<{ previous?: number | null }> }) => (
    <div data-testid="revenue-chart" data-previous={JSON.stringify(data.map((point) => point.previous))}>
      {children}
    </div>
  ),
  Area: () => <div data-testid="current-area" />,
  Line: ({ dataKey }: { dataKey: string }) => <div data-testid={dataKey === "previous" ? "previous-line" : "other-line"} />,
  XAxis: () => null,
  YAxis: ({ tickFormatter }: { tickFormatter?: (value: number) => string }) => (
    <div data-testid="y-axis" data-sample-tick={tickFormatter ? tickFormatter(1_500_000) : undefined} />
  ),
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

const current = {
  data: {
    summary: { totalRevenue: 150000, totalOrders: 3, avgRevenue: 10000 },
    chart: { labels: ["01.09", "02.09"], values: [50000, 100000] },
    // Backend bo'laklari (2Fj7iw1k): «Jadval»dagi buyurtmalar soni shu yerdan.
    data: [
      { period: "2026-09-01", label: "01.09", revenue: 50000, ordersCount: 1 },
      { period: "2026-09-02", label: "02.09", revenue: 100000, ordersCount: 2 },
    ],
    finance: {
      currentSituation: 22_543_000,
      main: { balance: 24_615_000 },
      markets: { marketsTotalBalans: 13_458_000 },
      branches: { branchReceivable: 11_386_000 },
      couriers: { couriersTotalBalanse: 0 },
    },
  },
};
const previous = {
  data: {
    summary: { totalRevenue: 100000, totalOrders: 2, avgRevenue: 5000 },
    chart: { labels: ["17.08", "18.08"], values: [40000, 60000] },
  },
};

const revenueMetric = () => screen.getByText("Daromad · 15 kun").parentElement as HTMLElement;

describe("FinancialAnalysis — v2 (oldingi davr bilan solishtirish)", () => {
  beforeEach(() => {
    window.localStorage.removeItem("dashboard-comparison");
    getRevenueMock.mockReset();
    getRevenueMock.mockImplementation((params: { start_day: string }) => ({
      data: params.start_day === "2026-09-01" ? current : previous,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
  });

  it("teng uzunlikdagi oraliqlarni so'raydi, o'sishni va oldingi chiziqni ko'rsatadi", async () => {
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" analyticsScope="admin:1" />);

    expect(getRevenueMock).toHaveBeenCalledWith(
      { period: "daily", start_day: "2026-09-01", end_day: "2026-09-15" },
      true,
      "admin:1",
    );
    expect(getRevenueMock).toHaveBeenCalledWith(
      { period: "daily", start_day: "2026-08-17", end_day: "2026-08-31" },
      true,
      "admin:1",
    );
    // 150 000 / 100 000 → +50%
    expect(within(revenueMetric()).getByText("+50%")).toHaveAttribute("data-direction", "up");
    expect(revenueMetric()).toHaveTextContent("oldingi: 100 ming");
    expect(await screen.findByTestId("previous-line")).toBeInTheDocument();
    expect(screen.getByTestId("revenue-chart")).toHaveAttribute("data-previous", "[40000,60000]");
    expect(screen.getByText("Joriy davr · 01.09 – 15.09")).toBeInTheDocument();
    expect(screen.getByText("Oldingi davr · 17.08 – 31.08")).toBeInTheDocument();
  });

  it("oldingi davrda buyurtma bo'lmasa — delta va oldingi chiziq yo'q", async () => {
    getRevenueMock.mockImplementation((params: { start_day: string }) => ({
      data:
        params.start_day === "2026-09-01"
          ? current
          : { data: { summary: { totalRevenue: 0, totalOrders: 0, avgRevenue: 0 }, chart: { labels: ["17.08"], values: [0] } } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);

    await screen.findByTestId("revenue-chart");
    expect(revenueMetric().querySelector("[data-delta]")).toBeNull();
    expect(revenueMetric()).not.toHaveTextContent("oldingi:");
    expect(screen.queryByTestId("previous-line")).not.toBeInTheDocument();
  });

  it("kamayish — qizil, pastga o'q", () => {
    getRevenueMock.mockImplementation((params: { start_day: string }) => ({
      data:
        params.start_day === "2026-09-01"
          ? current
          : { data: { ...previous.data, summary: { ...previous.data.summary, totalRevenue: 200000 } } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);

    const chip = within(revenueMetric()).getByText("−25%");
    expect(chip).toHaveAttribute("data-direction", "down");
    expect(chip).toHaveClass("bg-danger-soft");
    expect(chip.querySelector(".lucide-trending-down")).toBeInTheDocument();
  });

  it("«Solishtirish» holati saqlanadi va o'chirilganda oldingi davr so'ralmaydi", async () => {
    const user = userEvent.setup();
    const view = renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);

    const toggle = screen.getByRole("switch", { name: "Oldingi davr bilan solishtirish" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);
    expect(window.localStorage.getItem("dashboard-comparison")).toBe("false");
    expect(screen.queryByTestId("previous-line")).not.toBeInTheDocument();
    expect(getRevenueMock).toHaveBeenLastCalledWith(
      { period: "daily", start_day: "2026-08-17", end_day: "2026-08-31" },
      false,
      undefined,
    );
    expect(screen.queryByText(/Oldingi davr ·/)).not.toBeInTheDocument();

    view.unmount();
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);
    expect(screen.getByRole("switch", { name: "Oldingi davr bilan solishtirish" })).toHaveAttribute("aria-checked", "false");
  });

  it("davr almashsa (Haftalik) — o'sha davr bilan qayta so'raladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" analyticsScope="admin:1" />);
    await user.click(screen.getByRole("radio", { name: "Haftalik" }));
    expect(getRevenueMock).toHaveBeenCalledWith(
      { period: "weekly", start_day: "2026-09-01", end_day: "2026-09-15" },
      true,
      "admin:1",
    );
    expect(screen.getByText("O'rtacha haftalik daromad")).toBeInTheDocument();
  });

  it("Y o'qi ixcham sonlarda (telefonda tor qoladi)", async () => {
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);
    expect(await screen.findByTestId("y-axis")).toHaveAttribute("data-sample-tick", "1,5 mln");
  });

  it("nuqtalar soni teng bo'lmasa — oldingi chiziq yashiriladi va ogohlantirish yoziladi", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    getRevenueMock.mockImplementation((params: { start_day: string }) => ({
      data:
        params.start_day === "2026-09-01"
          ? current
          : {
              data: {
                summary: { totalRevenue: 100000, totalOrders: 2, avgRevenue: 5000 },
                chart: { labels: ["17.08"], values: [40000] },
              },
            },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);

    await screen.findByTestId("revenue-chart");
    expect(screen.queryByTestId("previous-line")).not.toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("moslik ishonchli emas"));
    warnSpy.mockRestore();
  });

  it("oldingi davr yuklanayotganda — «—» emas, skelet (yolg'on «ma'lumot yo'q» yo'q)", () => {
    getRevenueMock.mockImplementation((params: { start_day: string }) =>
      params.start_day === "2026-09-01"
        ? { data: current, isLoading: false, isError: false, refetch: vi.fn() }
        : { data: undefined, isLoading: true, isError: false, refetch: vi.fn() },
    );
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);

    expect(revenueMetric().querySelector("[data-skeleton]")).not.toBeNull();
    expect(revenueMetric()).not.toHaveTextContent("—");
    expect(screen.queryByTestId("previous-line")).not.toBeInTheDocument();
  });

  it("oldingi davr so'rovi yiqilsa — xabar va «Qayta urinish», joriy ma'lumot qoladi", async () => {
    const refetchPrevious = vi.fn();
    getRevenueMock.mockImplementation((params: { start_day: string }) =>
      params.start_day === "2026-09-01"
        ? { data: current, isLoading: false, isError: false, refetch: vi.fn() }
        : { data: undefined, isLoading: false, isError: true, refetch: refetchPrevious },
    );
    const user = userEvent.setup();
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Oldingi davr ma'lumotlarini yuklab bo'lmadi.");
    await user.click(within(alert).getByRole("button", { name: "Qayta urinish" }));
    expect(refetchPrevious).toHaveBeenCalled();
    expect(revenueMetric()).toHaveTextContent("150 ming so'm");
  });

  it("«Jadval» ko'rinishi — har nuqta qatorda (grafik egizagi)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);
    await user.click(screen.getByRole("radio", { name: "Jadval" }));
    const table = screen.getByRole("table", { name: "Moliyaviy tahlil" });
    expect(within(table).getByText("02.09")).toBeInTheDocument();
    expect(within(table).getByText("100 000 so'm")).toBeInTheDocument();
    expect(within(table).getByText("60 000 so'm")).toBeInTheDocument();
  });

  it("2Fj7iw1k: «Grafik | Jadval» — «Aralash» yo'q; «Jadval»da buyurtmalar soni (`data[].ordersCount`)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);
    const view = screen.getByRole("radio", { name: "Jadval" }).closest("[role=radiogroup]") as HTMLElement;
    expect(within(view).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Grafik", "Jadval"]);
    expect(screen.queryByText(/Aralash/)).not.toBeInTheDocument();
    // Davr yakunida jami buyurtmalar (summary.totalOrders).
    expect(screen.getByText("Buyurtmalar").parentElement).toHaveTextContent("3 ta");

    await user.click(screen.getByRole("radio", { name: "Jadval" }));
    const table = screen.getByRole("table", { name: "Moliyaviy tahlil" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toContain("Buyurtmalar");
    const row = within(table).getByText("02.09").closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("2 ta");
  });

  it("2Fj7iw1k: bo'lakda `ordersCount` yo'q — «—» (yolg'on 0 emas)", async () => {
    const user = userEvent.setup();
    getRevenueMock.mockImplementation((params: { start_day: string }) => ({
      data: params.start_day === "2026-09-01" ? { data: { ...current.data, data: [] } } : previous,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);
    await user.click(screen.getByRole("radio", { name: "Jadval" }));
    const row = within(screen.getByRole("table", { name: "Moliyaviy tahlil" })).getByText("01.09").closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("—");
    expect(row).not.toHaveTextContent("0 ta");
  });

  it("2Fj7iw1k: eski zaxira yo'li yo'q — grafik `chart.labels/values` dan; raqamli kalitlardan nuqta yig'ilmaydi", () => {
    getRevenueMock.mockImplementation(() => ({
      data: {
        data: {
          summary: { totalRevenue: 150000, totalOrders: 3, avgRevenue: 10000 },
          chart: { labels: [], values: [] },
          "0": { period: "2026-09-01", label: "01.09", revenue: 50000 },
          "1": { period: "2026-09-02", label: "02.09", revenue: 100000 },
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);
    expect(screen.queryByTestId("revenue-chart")).not.toBeInTheDocument();
  });
});

describe("Kassa balansi (o'sha revenue javobidan)", () => {
  beforeEach(() => {
    getRevenueMock.mockReset();
    getRevenueMock.mockImplementation((params: { start_day: string }) => ({
      data: params.start_day === "2026-09-01" ? current : previous,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
    }));
  });

  it("joriy holat, sharshara va legenda-jadval — eski xarita formulasi bilan", () => {
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);
    const card = screen.getByRole("heading", { name: "Kassa balansi" }).closest("section") as HTMLElement;
    expect(within(card).getByText("Ijobiy")).toBeInTheDocument();
    expect(card).toHaveTextContent("22 543 000so'm");
    expect(within(card).getByRole("img", { name: /Joriy holat 22,5 mln/ })).toBeInTheDocument();
    expect(card).toHaveTextContent("+11 386 000 so'm");
    expect(card).toHaveTextContent("−13 458 000 so'm");
    expect(within(card).getByRole("link", { name: /Balansni ochish/ })).toHaveAttribute("href", "/financial-balance");
  });
});

describe("TrendTooltip", () => {
  it("2Fj7iw1k: maketdagidek — sana · joriy · oldingi davr · % farq", () => {
    renderWithProviders(
      <TrendTooltip
        active
        currentName="Joriy"
        previousName="Oldingi"
        showPrevious
        payload={[{ payload: { label: "02.09", current: 100000, previous: 80000, previousLabel: "18.08 (oldingi)" } }]}
      />,
    );
    expect(screen.getByText("02.09")).toBeInTheDocument();
    expect(screen.getByText("100 000 so'm")).toBeInTheDocument();
    expect(screen.getByText("80 000 so'm")).toBeInTheDocument();
    expect(screen.getByText("18.08 (oldingi)")).toBeInTheDocument();
    expect(screen.getByText(/\+25/)).toBeInTheDocument();
  });

  it("oldingi nuqta yo'q (null) — qator chizilmaydi, haqiqiy nol esa ko'rinadi", () => {
    renderWithProviders(
      <TrendTooltip
        active
        currentName="Joriy"
        previousName="Oldingi"
        showPrevious
        payload={[{ payload: { label: "17.08", current: 0, previous: null } }]}
      />,
    );
    expect(screen.getByText("0 so'm")).toBeInTheDocument();
    expect(screen.queryByText("Oldingi")).not.toBeInTheDocument();
  });
});

describe("FinancialAnalysis — qisman nosozlik (VkwhHqvW)", () => {
  it("revenue `degraded` — moliya bo'lagi 0 lar bilan emas, xato va «Qayta urinish»", async () => {
    const refetch = vi.fn();
    getRevenueMock.mockReturnValue({
      data: { data: { summary: { totalRevenue: 0, totalOrders: 0, avgRevenue: 0 }, chart: { labels: [], values: [] }, degraded: true, failedParts: ["finance"] } },
      isLoading: false,
      isError: false,
      refetch,
    });
    renderWithProviders(<FinancialAnalysis startDate="2026-09-01" endDate="2026-09-15" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Ma'lumotni yuklab bo'lmadi");
    expect(screen.queryByText("Jami daromad")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalled();
  });
});


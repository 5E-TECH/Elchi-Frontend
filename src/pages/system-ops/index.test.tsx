import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import SystemOpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: { get: (...a: unknown[]) => apiGetMock(...a) },
}));

/** `analytics-service` KPI konverti (backend `origin/main`). */
const KPI = {
  statusCode: 200,
  message: "KPI stats",
  data: {
    averageOrderValue: 236400,
    averageFulfillmentHours: 18.4,
    onTimeRate: 82.6,
    cancellationRate: 7.5,
    courierEfficiency: 12.4,
    marketRating: [],
    marketRatingMeta: {},
    degraded: false,
    failed_parts: [],
  },
};

describe("SystemOps page", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockImplementation((url: string) => {
      if (url === "analytics/kpi") return Promise.resolve({ data: KPI });
      return Promise.resolve({ data: {} });
    });
  });

  it("renders header \"Tizim — analitika va xizmatlar\" with the back link", () => {
    renderWithProviders(<SystemOpsPage />);
    expect(screen.getByText("Tizim — analitika va xizmatlar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ops vositalari/ })).toHaveAttribute("href", "/ops?tab=system");
  });

  it("calls api.get with \"analytics/kpi\" on mount", async () => {
    renderWithProviders(<SystemOpsPage />);
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("analytics/kpi", expect.anything()),
    );
  });

  it("KPI: SLA gauge, bekor qilish darajasi, o'rtacha qiymat va vaqt; kuryer — o'rtacha buyurtma soni (D3)", async () => {
    renderWithProviders(<SystemOpsPage />);

    expect(
      await screen.findByRole("img", { name: "O'z vaqtida yetkazish (SLA): 82,6% — 24 soat ichida yetkazilgan buyurtmalar ulushi" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Yaxshi · 70% va undan yuqori")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Bekor qilish darajasi 7,5%" })).toBeInTheDocument();
    expect(screen.getByText("236 400 so'm")).toBeInTheDocument();
    expect(screen.getByText("18 soat 24 daq")).toBeInTheDocument();
    expect(screen.getByText("O'rtacha 12,4 ta buyurtma")).toBeInTheDocument();
    expect(screen.queryByText("12,4%")).toBeNull();
    expect(screen.getByText("Ma'lumot yo'q — reyting hali hisoblanmagan")).toBeInTheDocument();
  });

  it("tizim holati: /health javob bersa «Ishlayapti», yiqilsa «Xatolik»", async () => {
    const { unmount } = renderWithProviders(<SystemOpsPage />);
    expect(await within(screen.getByRole("status", { name: "Tizim holati" })).findByText("Ishlayapti")).toBeInTheDocument();
    unmount();

    apiGetMock.mockImplementation((url: string) =>
      url === "analytics/kpi" ? Promise.resolve({ data: KPI }) : Promise.reject({ response: { status: 503 } }),
    );
    renderWithProviders(<SystemOpsPage />);
    expect(await within(screen.getByRole("status", { name: "Tizim holati" })).findByText("Xatolik")).toBeInTheDocument();
  });

  it("types scan token and clicks Tekshirish — calls api.get with scan/t1 and lists the result fields", async () => {
    const user = userEvent.setup();
    apiGetMock.mockImplementation((url: string) => {
      if (url === "analytics/kpi") return Promise.resolve({ data: KPI });
      if (url === "scan/t1")
        return Promise.resolve({
          data: { type: "batch", data: { id: "124", status: "RECEIVED", qr_code_token: "BTB-7F3K29QX", orders: [{}, {}] } },
        });
      return Promise.resolve({ data: {} });
    });
    renderWithProviders(<SystemOpsPage />);

    await user.type(screen.getByRole("searchbox", { name: "Token" }), "t1");
    await user.click(screen.getByRole("button", { name: "Tekshirish" }));

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith("scan/t1"));
    const result = await screen.findByRole("status", { name: "Natija" });
    expect(within(result).getByText("Paket")).toBeInTheDocument();
    expect(within(result).getByText("Qabul qilingan")).toBeInTheDocument();
    expect(within(result).getByText("BTB-7F3K29QX")).toBeInTheDocument();
    expect(within(result).getByText("2 ta")).toBeInTheDocument();
    // Xom JSON chiqmaydi.
    expect(screen.queryByText(/"type"/)).toBeNull();
  });

  it("404 — «Topilmadi»", async () => {
    const user = userEvent.setup();
    apiGetMock.mockImplementation((url: string) => {
      if (url === "analytics/kpi") return Promise.resolve({ data: KPI });
      if (url.startsWith("scan/")) return Promise.reject({ response: { status: 404, data: { message: "Topilmadi" } } });
      return Promise.resolve({ data: {} });
    });
    renderWithProviders(<SystemOpsPage />);

    await user.type(screen.getByRole("searchbox", { name: "Token" }), "nope");
    await user.click(screen.getByRole("button", { name: "Tekshirish" }));

    expect(await screen.findByText("Bu token bo'yicha buyurtma, paket yoki pochta topilmadi.")).toBeInTheDocument();
  });
});

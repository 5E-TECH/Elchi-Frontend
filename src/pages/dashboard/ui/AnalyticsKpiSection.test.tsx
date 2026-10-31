import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsKpiSection from "./AnalyticsKpiSection";
import { renderWithProviders } from "../../../test/test-utils";
import { expectNoRawBackendText, mockEnvelope, mockRejection } from "../../../test/mockEnvelope";

const apiGetMock = vi.fn();

vi.mock("../../../shared/api/api", () => ({
  api: { get: (...a: unknown[]) => apiGetMock(...a) },
}));

/** `analytics-service` KPI konverti (backend `origin/main`): `{ statusCode, message: "KPI stats", data }`. */
const KPI = mockEnvelope(
  {
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
  { message: "KPI stats" },
);

const mockKpi = (reply: () => Promise<unknown>) => apiGetMock.mockImplementation(reply);

/** Superadmin bosh sahifasi: SLA va «Analitika KPI» (F2NzXpMv, Ops → «Tizim» dan ko'chgan). */
describe("AnalyticsKpiSection", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    mockKpi(() => Promise.resolve(KPI));
  });

  it("javob bo'sh bo'lsa blok chizilmaydi", async () => {
    mockKpi(() => Promise.resolve(mockEnvelope({})));
    const { container } = renderWithProviders(<AnalyticsKpiSection />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector("[data-query-state]")).toBeNull());
    expect(screen.queryByText("Analitika KPI")).toBeNull();
  });

  it("yrLt5oMi: davrda yetkazish yo'q (`deliveryCount: 0`) — SLA «—» va neytral «O'lchanmagan», «Past» emas", async () => {
    mockKpi(
      () =>
        Promise.resolve(
          mockEnvelope(
            { averageOrderValue: 0, averageFulfillmentHours: 0, onTimeRate: 0, deliveryCount: 0, cancellationRate: 0, courierEfficiency: 0, marketRating: [] },
            { message: "KPI stats" },
          ),
        ),
    );
    renderWithProviders(<AnalyticsKpiSection />);

    expect(
      await screen.findByRole("img", {
        name: "O'z vaqtida yetkazish (SLA): o'lchanmagan — bu davrda yetkazilgan buyurtma yo'q",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("O'lchanmagan · yetkazish yo'q")).toBeInTheDocument();
    expect(screen.queryByText("Past · 70% dan kam")).toBeNull();
  });

  it("KPI: SLA gauge, bekor qilish darajasi, o'rtacha qiymat va vaqt; kuryer — o'rtacha buyurtma soni (D3)", async () => {
    renderWithProviders(<AnalyticsKpiSection />);

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

  it("KPI xatosi: danger ogohlantirish, xom matn yo'q; «Qayta urinish» qayta yuklaydi", async () => {
    const user = userEvent.setup();
    let attempt = 0;
    mockKpi(
      () => {
        attempt += 1;
        return attempt === 1
          ? Promise.reject(mockRejection(500))
          : Promise.resolve(KPI);
      },
    );
    renderWithProviders(<AnalyticsKpiSection />);
    const title = await screen.findByText("Analitika ko'rsatkichlarini olib bo'lmadi");
    const alert = title.closest<HTMLElement>("[role='alert']");
    expect(alert).not.toBeNull();
    expect(alert).toHaveTextContent("Analitika xizmati javob bermadi.");
    expectNoRawBackendText();
    expect(screen.getByRole("region", { name: "Analitika KPI" })).toBeInTheDocument();

    await user.click(within(alert as HTMLElement).getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByText("236 400 so'm")).toBeInTheDocument();
    // Tugma yo'qoldi — fokus «Analitika KPI» kartasiga.
    await waitFor(() => expect(screen.getByRole("region", { name: "Analitika KPI" })).toHaveFocus());
  });
});

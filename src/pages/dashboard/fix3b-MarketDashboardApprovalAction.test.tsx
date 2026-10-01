import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import MarketDashboardPage from "./MarketDashboardPage";

/**
 * fix3b M3 — marketning tasdiqlar ro'yxatida har so'rov QAYSI amal uchunligi
 * va tasdiq nimani bajarishi aniq ko'rinadi (tasdiq aynan shu amalni
 * bajaradi: sotish / qisman sotish / bekor qilish).
 */

vi.mock("../../entities/dashboard", () => ({
  useDashboard: () => ({
    getDashboard: () => ({ data: { data: {} }, isLoading: false, isError: false, refetch: vi.fn() }),
    getKpi: vi.fn(),
  }),
}));

const approval = (id: string, action: "sell" | "partly_sell" | "cancel", orderId: string) => ({
  id,
  order_id: orderId,
  market_id: "201",
  requested_by_user_id: "56",
  action,
  amount: 5000,
  status: "pending",
});

vi.mock("../../entities/orders", () => ({
  useOrders: () => ({
    useExtraCostApprovals: () => ({
      data: {
        data: [
          approval("ap-1", "sell", "9001"),
          approval("ap-2", "partly_sell", "9002"),
          approval("ap-3", "cancel", "9003"),
        ],
      },
      isLoading: false,
      isError: false,
    }),
    approveExtraCostApproval: { mutate: vi.fn(), isPending: false, variables: undefined },
    rejectExtraCostApproval: { mutate: vi.fn(), isPending: false, variables: undefined },
  }),
}));

vi.mock("../../widgets/dashboard-performance-chart/ui/PerformanceChart", () => ({ default: () => null }));

vi.mock("../../entities/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/settings")>()),
  useSettings: () => ({ data: undefined }),
}));

describe("MarketDashboardPage — tasdiq amali (fix3b M3)", () => {
  it("har so'rovda amal va tasdiq oqibati ko'rinadi", () => {
    renderWithProviders(<MarketDashboardPage />, {
      preloadedState: { role: { id: "201", role: "market", region: null, name: "Yandex" } },
    });

    expect(screen.getByText("Sotishdagi qo'shimcha xarajat")).toBeInTheDocument();
    expect(screen.getByText("Qisman sotishdagi qo'shimcha xarajat")).toBeInTheDocument();
    expect(screen.getByText("Bekor qilishdagi qo'shimcha xarajat")).toBeInTheDocument();

    expect(screen.getByTestId("approval-consequence-ap-1")).toHaveTextContent("Tasdiqlansa — buyurtma sotiladi");
    expect(screen.getByTestId("approval-consequence-ap-2")).toHaveTextContent("Tasdiqlansa — buyurtma qisman sotiladi");
    expect(screen.getByTestId("approval-consequence-ap-3")).toHaveTextContent("Tasdiqlansa — buyurtma bekor qilinadi");
  });
});

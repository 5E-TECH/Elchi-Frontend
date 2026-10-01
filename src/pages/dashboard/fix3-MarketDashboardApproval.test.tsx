import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import MarketDashboardPage from "./MarketDashboardPage";

/**
 * fix3 FE-ORD-02 — market qo'shimcha xarajatni tasdiqlasa/rad etsa va backend
 * rad javob qaytarsa, sabab ko'rinadi (avval tugma jimgina "qaytib" qolardi).
 */

const approveMutate = vi.fn();
const rejectMutate = vi.fn();

vi.mock("../../entities/dashboard", () => ({
  useDashboard: () => ({
    getDashboard: () => ({ data: { data: {} }, isLoading: false, isError: false, refetch: vi.fn() }),
    getKpi: vi.fn(),
  }),
}));

vi.mock("../../entities/orders", () => ({
  useOrders: () => ({
    useExtraCostApprovals: () => ({
      data: {
        data: [
          {
            id: "ap-1",
            order_id: "1251165",
            market_id: "market-1",
            requested_by_user_id: "56",
            action: "sell",
            amount: 5000,
            status: "pending",
          },
        ],
      },
      isLoading: false,
      isError: false,
    }),
    approveExtraCostApproval: { mutate: approveMutate, isPending: false, variables: undefined },
    rejectExtraCostApproval: { mutate: rejectMutate, isPending: false, variables: undefined },
  }),
}));

vi.mock("../../widgets/dashboard-performance-chart/ui/PerformanceChart", () => ({
  default: () => null,
}));

vi.mock("../../entities/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../entities/settings")>()),
  useSettings: () => ({ data: undefined }),
}));

const httpError = (status: number, message: string) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: { statusCode: status, message },
  } as AxiosResponse);

type MutateOptions = { onError?: (error: unknown) => void };

describe("MarketDashboardPage — tasdiqlash xatosi (fix3 FE-ORD-02)", () => {
  beforeEach(() => {
    approveMutate.mockReset();
    rejectMutate.mockReset();
  });

  const renderPage = () =>
    renderWithProviders(<MarketDashboardPage />, {
      preloadedState: { role: { id: "market-1", role: "market", region: null, name: "Market" } },
    });

  it("tasdiqlash rad etilsa — backend sababi ko'rinadi", async () => {
    const user = userEvent.setup();
    approveMutate.mockImplementation((_vars, options: MutateOptions) =>
      options.onError?.(httpError(409, "Bu so'rov allaqachon ko'rib chiqilgan")),
    );
    renderPage();

    await user.click(screen.getByRole("button", { name: "Tasdiqlash" }));

    expect(approveMutate).toHaveBeenCalledWith({ id: "ap-1" }, expect.objectContaining({ onError: expect.any(Function) }));
    expect(await screen.findByText("Bu so'rov allaqachon ko'rib chiqilgan")).toBeInTheDocument();
  });

  it("rad etish xabarsiz yiqilsa — umumiy xato matni", async () => {
    const user = userEvent.setup();
    rejectMutate.mockImplementation((_vars, options: MutateOptions) => options.onError?.(httpError(500, "")));
    renderPage();

    await user.click(screen.getByRole("button", { name: "Rad etish" }));

    expect(await screen.findByText("So'rovni bajarib bo'lmadi. Qayta urinib ko'ring.")).toBeInTheDocument();
  });
});

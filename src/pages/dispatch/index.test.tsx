import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import DispatchPage from "./index";

const useGetCouriersMock = vi.hoisted(() => vi.fn());

vi.mock("../../entities/user/api/userApi", () => ({
  useUser: () => ({ useGetCouriers: useGetCouriersMock }),
}));

vi.mock("../../entities/order/api/orderApi", () => ({
  useOrders: () => ({
    assignCourier: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

// Kamera oynasi yopiq — QR kutubxonasi testga kerak emas.
vi.mock("../../shared/components/ScannerCameraModal", () => ({
  default: () => null,
}));

const stateFor = (role: string, user: Record<string, unknown> | null) =>
  ({
    role: { id: `${role}-1`, role, region: null, name: role },
    user: {
      user,
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

// HQ registratori: filial turi HQ, viloyat YO'Q (HQ ning region_id si NULL).
const hqRegistrator = stateFor("registrator", {
  id: "269",
  role: "registrator",
  region_id: null,
  branch: { id: "1", type: "HQ", region_id: null },
});

const couriersResponse = (items: Array<{ id: string; name: string }>) => ({
  data: { items },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

const lastCourierQuery = () => {
  const calls = useGetCouriersMock.mock.calls;
  return calls[calls.length - 1] as [Record<string, unknown>, boolean | undefined];
};

describe("DispatchPage — kuryerlar ro'yxati", () => {
  beforeEach(() => {
    useGetCouriersMock.mockReturnValue(couriersResponse([{ id: "263", name: "HQ kuryer" }]));
  });

  it("HQ registratori: so'rov yoqilgan, region_id yo'q, faqat faol kuryerlar", () => {
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    const [params, enabled] = lastCourierQuery();
    expect(enabled).toBe(true);
    expect(params).toEqual({ page: 1, limit: 100, status: "active" });
    expect(params).not.toHaveProperty("region_id");
  });

  it("viloyati bor menejer ham region_id yubormaydi — backend filialga o'zi cheklaydi", () => {
    renderWithProviders(<DispatchPage />, {
      preloadedState: stateFor("manager", {
        id: "198",
        role: "manager",
        region_id: "12",
        branch: { id: "15", type: "REGIONAL", region_id: "12" },
      }),
    });

    const [params, enabled] = lastCourierQuery();
    expect(enabled).toBe(true);
    expect(params).toEqual({ page: 1, limit: 100, status: "active" });
  });

  it("superadmin parametrlari o'zgarmagan", () => {
    renderWithProviders(<DispatchPage />, {
      preloadedState: stateFor("superadmin", { id: "1", role: "superadmin" }),
    });

    const [params, enabled] = lastCourierQuery();
    expect(enabled).toBe(true);
    expect(params).toEqual({ page: 1, limit: 100 });
  });

  it("kuryer bo'lmasa — bo'sh holat matni chiqadi va biriktirish tugmasi o'chiq", () => {
    useGetCouriersMock.mockReturnValue(couriersResponse([]));

    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    expect(screen.getByText("Filialda faol kuryer yo'q")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Courierga biriktirish/ })).toBeDisabled();
  });

  it("kuryer bor bo'lsa bo'sh holat matni chiqmaydi", () => {
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });

    expect(screen.queryByText("Filialda faol kuryer yo'q")).not.toBeInTheDocument();
  });

  it("yuklanayotganda yoki xatoda bo'sh holat matni chiqmaydi", () => {
    useGetCouriersMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    const { unmount } = renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });
    expect(screen.queryByText("Filialda faol kuryer yo'q")).not.toBeInTheDocument();
    unmount();

    useGetCouriersMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    renderWithProviders(<DispatchPage />, { preloadedState: hqRegistrator });
    expect(screen.queryByText("Filialda faol kuryer yo'q")).not.toBeInTheDocument();
  });
});

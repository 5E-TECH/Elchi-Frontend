import { screen } from "@testing-library/react";
import { vi } from "vitest";
import Region from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();
const adminRoleState = {
  id: "admin-1",
  role: "admin",
  region: null,
  name: "Admin",
};

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

describe("Region page", () => {
  const renderRegionPage = () =>
    renderWithProviders(<Region />, {
      preloadedState: { role: adminRoleState },
    });

  beforeEach(() => {
    apiGetMock.mockResolvedValue({
      data: [
        {
          id: "1",
          name: "Toshkent viloyati",
          districtCount: 15,
          activeCouriers: 187,
          ordersCount: 4230,
          districts: [],
        },
      ],
    });
  });

  it("renders region page header", async () => {
    renderRegionPage();

    expect(await screen.findByText("Hududlar")).toBeInTheDocument();
  });

  it("renders region page description", async () => {
    renderRegionPage();

    expect(
      await screen.findByText("Hududlar kesimida buyurtmalar statistikasi"),
    ).toBeInTheDocument();
  });

  it("renders the current courier region districts even when statistics are zero", async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === "region/stats/all") {
        return Promise.resolve({
          data: {
            data: {
              regions: [
                {
                  id: "12",
                  name: "Jizzax",
                  districts_count: 2,
                  totalOrders: 0,
                  deliveredOrders: 0,
                  cancelledOrders: 0,
                  revenue: 0,
                },
              ],
              summary: {
                totalOrders: 0,
                deliveredOrders: 0,
                cancelledOrders: 0,
                totalRevenue: 0,
              },
            },
          },
        });
      }

      if (url === "orders") {
        return Promise.resolve({
          data: {
            data: {
              items: [{ id: "order-1", region_id: "12" }],
            },
          },
        });
      }

      if (url === "district") {
        return Promise.resolve({
          data: {
            data: [
              { id: "1", name: "Arnasoy tumani", region_id: "12" },
              { id: "2", name: "Baxmal tumani", region_id: "12" },
            ],
          },
        });
      }

      return Promise.reject(new Error(`Unexpected API request: ${url}`));
    });

    renderWithProviders(<Region />, {
      preloadedState: {
        role: {
          id: "courier-1",
          role: "courier",
          region: null,
          name: "Ali",
        },
        user: {
          user: {
            id: "courier-1",
            username: "ali",
            name: "Ali",
            phone_number: "+998900000000",
            role: "courier",
            status: "active",
            createdAt: "",
            updatedAt: "",
          },
          isAuthenticated: true,
          accessToken: "token",
          loading: false,
          isAppInitializing: false,
          error: null,
        },
      },
    });

    expect((await screen.findAllByText("Arnasoy tumani")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Baxmal tumani")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Bu foydalanuvchi uchun viloyat topilmadi")).not.toBeInTheDocument();
  });
});

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
});

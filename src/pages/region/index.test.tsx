import { screen } from "@testing-library/react";
import { vi } from "vitest";
import Region from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

describe("Region page", () => {
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
    renderWithProviders(<Region />);

    expect(
      await screen.findByText("O'zbekiston viloyatlari xaritasi"),
    ).toBeInTheDocument();
  });

  it("renders region page description", async () => {
    renderWithProviders(<Region />);

    expect(
      await screen.findByText(
        "Region ustiga bosganingizda shu hudud bo'yicha barcha tafsilotlar popup ichida ochiladi.",
      ),
    ).toBeInTheDocument();
  });
});

import { screen } from "@testing-library/react";
import Region from "./index";
import { renderWithProviders } from "../../test/test-utils";

vi.mock("../../shared/components/headerName", () => ({
  default: ({
    name,
    description,
  }: {
    name: string;
    description: string;
  }) => (
    <div>
      <h1>{name}</h1>
      <p>{description}</p>
    </div>
  ),
}));

describe("Region page", () => {
  it("renders region page header", () => {
    renderWithProviders(<Region />);

    expect(screen.getByText("Viloyat Statistikalari")).toBeInTheDocument();
  });

  it("renders region page description", () => {
    renderWithProviders(<Region />);

    expect(
      screen.getByText("Viloyat ustiga bosib batafsil ma'lumotlarni ko'ring"),
    ).toBeInTheDocument();
  });
});

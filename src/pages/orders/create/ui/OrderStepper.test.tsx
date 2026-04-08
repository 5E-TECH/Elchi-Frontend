import { screen } from "@testing-library/react";
import OrderStepper from "./OrderStepper";
import { renderWithProviders } from "../../../../test/test-utils";

const steps = [
  { id: 1, label: "1-qadam", description: "Market tanlang" },
  { id: 2, label: "2-qadam", description: "Mijoz ma'lumoti" },
];

describe("OrderStepper", () => {
  it("renders all step labels", () => {
    renderWithProviders(<OrderStepper steps={steps} currentStep={1} />);

    expect(screen.getByText("1-qadam")).toBeInTheDocument();
    expect(screen.getByText("2-qadam")).toBeInTheDocument();
  });

  it("shows descriptions by default", () => {
    renderWithProviders(<OrderStepper steps={steps} currentStep={1} />);

    expect(screen.getByText("Market tanlang")).toBeInTheDocument();
    expect(screen.getByText("Mijoz ma'lumoti")).toBeInTheDocument();
  });

  it("hides selected descriptions when configured", () => {
    renderWithProviders(
      <OrderStepper steps={steps} currentStep={2} hiddenDescriptions={[1]} />,
    );

    expect(screen.queryByText("Market tanlang")).not.toBeInTheDocument();
    expect(screen.getByText("Mijoz ma'lumoti")).toBeInTheDocument();
  });

  it("renders step notes", () => {
    renderWithProviders(
      <OrderStepper
        steps={steps}
        currentStep={2}
        stepNotes={{ 1: "Mega Market" }}
      />,
    );

    expect(screen.getByText("Mega Market")).toBeInTheDocument();
  });
});

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import SmsMeter from "./SmsMeter";

describe("SmsMeter (D5sxjGBY)", () => {
  it("160 Latin chars: GSM-7 (neutral badge), 1 part; 161: 2 parts", () => {
    const { rerender } = renderWithProviders(<SmsMeter text={"a".repeat(160)} tariff={95} />);
    expect(screen.getByTestId("sms-meter-encoding")).toHaveTextContent("GSM-7");
    expect(screen.getByTestId("sms-meter-encoding")).toHaveAttribute("data-tone", "neutral");
    expect(screen.getByTestId("sms-meter-parts")).toHaveTextContent("1");
    rerender(<SmsMeter text={"a".repeat(161)} tariff={95} />);
    expect(screen.getByTestId("sms-meter-parts")).toHaveTextContent("2");
  });

  it("one Cyrillic letter switches to UCS-2 (limit 70) with a token-coloured warning", () => {
    renderWithProviders(<SmsMeter text={"Salom д"} tariff={95} />);
    const badge = screen.getByTestId("sms-meter-encoding");
    expect(badge).toHaveTextContent("UCS-2");
    // v2: ogohlantirish toni (`Badge tone="warning"` — `bg-warning-soft text-warning-fg` tokenlari).
    expect(badge).toHaveAttribute("data-tone", "warning");
    expect(badge.className).toContain("text-warning-fg");
    expect(screen.getByText(/\/ 70/)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("UCS-2");
  });

  it("71 Cyrillic chars → 2 parts (67 rule)", () => {
    renderWithProviders(<SmsMeter text={"ж".repeat(71)} tariff={null} />);
    expect(screen.getByTestId("sms-meter-parts")).toHaveTextContent("2");
  });

  it("no tariff → '—' instead of 0; estimate is labelled as approximate", () => {
    const { rerender } = renderWithProviders(<SmsMeter text="Salom" tariff={null} />);
    expect(screen.getByTestId("sms-meter-cost")).toHaveTextContent("—");
    expect(screen.getByTestId("sms-meter-cost")).not.toHaveTextContent(/^0/);
    rerender(<SmsMeter text="Salom" tariff={95} recipients={10} />);
    expect(screen.getByTestId("sms-meter-cost")).toHaveTextContent("950");
    expect(screen.getByTestId("sms-meter-cost")).toHaveTextContent("taxminiy");
    // Pul `formatMoneyLocalized` orqali: «≈ 950 so'm (taxminiy)».
    expect(screen.getByTestId("sms-meter-cost")).toHaveTextContent("≈ 950 so'm (taxminiy)");
  });

  it("the cost follows the recipient count and a promo tariff", () => {
    const { rerender } = renderWithProviders(
      <SmsMeter text="Chegirma" tariff={95} recipients={2} />,
    );
    expect(screen.getByTestId("sms-meter-cost")).toHaveTextContent("190");
    rerender(<SmsMeter text="Chegirma" tariff={175} recipients={2} />);
    expect(screen.getByTestId("sms-meter-cost")).toHaveTextContent("350");
  });

  it("thousands are grouped by the locale formatter («≈ 1 050 so'm»)", () => {
    renderWithProviders(<SmsMeter text="Salom" tariff={105} recipients={10} />);
    expect(screen.getByTestId("sms-meter-cost").textContent?.replace(/\s/g, " ")).toBe(
      "≈ 1 050 so'm (taxminiy)",
    );
  });
});

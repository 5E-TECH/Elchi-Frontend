import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import { ReplacementTag } from "./ReplacementTag";

describe("ReplacementTag (lQjt6sKP)", () => {
  it("⭐ yangi buyurtma — «Almashtirish», maslahatda eski №EL-… raqami", () => {
    renderWithProviders(<ReplacementTag order={{ replacement_of_order_id: "81", replacement_state: "awaiting_old_pickup" }} />);
    const badge = screen.getByTestId("replacement-badge");
    expect(badge).toHaveTextContent("Almashtirish");
    expect(badge.className).toContain("bg-warning-soft");
    expect(badge).toHaveAttribute("title", "Almashtirish buyurtmasi — eski №EL-100081 o'rniga");
    expect(badge).toHaveAttribute("aria-label", "Almashtirish. Almashtirish buyurtmasi — eski №EL-100081 o'rniga");
  });

  it("eski buyurtma — «Almashtirish qaytarmasi», maslahatda holat", () => {
    renderWithProviders(<ReplacementTag order={{ is_replacement_return: true, replacement_state: "old_collected" }} />);
    const badge = screen.getByTestId("replacement-return-badge");
    expect(badge).toHaveTextContent("Almashtirish qaytarmasi");
    expect(badge).toHaveAttribute("title", "Eski mahsulot olingan — marketga qaytmoqda");
  });

  it("oddiy buyurtma — hech narsa", () => {
    const { container } = renderWithProviders(<ReplacementTag order={{ id: "5", replacement_of_order_id: null }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

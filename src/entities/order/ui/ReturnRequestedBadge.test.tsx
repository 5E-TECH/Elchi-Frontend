import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import ReturnRequestedBadge from "./ReturnRequestedBadge";
import { readReturnRequest } from "../model/returnRequest";

describe("ReturnRequestedBadge", () => {
  it("⭐ return_requested — amber \"Qaytarish so'ralgan\", sabab tooltip/aria'da", () => {
    renderWithProviders(<ReturnRequestedBadge order={{ return_requested: true, return_reason: " Mijoz rad etdi " }} />);
    const badge = screen.getByTestId("return-requested-badge");
    expect(badge).toHaveTextContent("Qaytarish so'ralgan");
    expect(badge.className).toContain("amber");
    expect(badge).toHaveAttribute("aria-label", "Qaytarish so'ralgan. Sabab: Mijoz rad etdi");
  });

  it("sababsiz — faqat yorliq", () => {
    renderWithProviders(<ReturnRequestedBadge order={{ return_requested: true, return_reason: null }} />);
    expect(screen.getByTestId("return-requested-badge")).toHaveAttribute("aria-label", "Qaytarish so'ralgan");
  });

  it("so'ralmagan (GET /orders/95: false, null) — hech narsa", () => {
    const { container } = renderWithProviders(
      <ReturnRequestedBadge order={{ return_requested: false, return_reason: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("readReturnRequest — faqat aniq true", () => {
    expect(readReturnRequest({ return_requested: true, return_reason: "x" })).toEqual({ requested: true, reason: "x" });
    expect(readReturnRequest({ return_requested: "true" })).toEqual({ requested: false, reason: null });
    expect(readReturnRequest(undefined)).toEqual({ requested: false, reason: null });
  });
});

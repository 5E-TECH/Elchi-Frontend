import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CancelStageChips from "./CancelStageChips";

/** BG4 bosqich chiplari (maket `superadmin-orders-list-cancelled`). */
describe("CancelStageChips", () => {
  it("maketdagi tartib va matnlar, tanlangani `aria-pressed`, bosilsa bosqich qaytadi", () => {
    const onChange = vi.fn();
    renderWithProviders(<CancelStageChips value="hq" onChange={onChange} />);

    const group = screen.getByRole("group", { name: "Bekor bosqichi bo'yicha" });
    const chips = Array.from(group.querySelectorAll("button"));
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "Barchasi",
      "Kuryerda",
      "Yo'lda",
      "Filialda",
      "HQ'da",
      "Topshirilgan",
    ]);
    expect(screen.getByRole("button", { name: "HQ'da" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Barchasi" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Topshirilgan" }));
    fireEvent.click(screen.getByRole("button", { name: "Barchasi" }));
    expect(onChange.mock.calls).toEqual([["market"], [""]]);
  });

  it("telefonda chiplar ≥ 44 px", () => {
    renderWithProviders(<CancelStageChips value="" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Kuryerda" })).toHaveClass("max-md:h-11");
  });
});

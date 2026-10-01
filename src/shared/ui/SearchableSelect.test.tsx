import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import SearchableSelect from "./SearchableSelect";

// Ochilganda tanlangan variant ko'rinishga aylantiriladi — jsdom'da yo'q.
const scrollIntoView = Element.prototype.scrollIntoView;
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});

const OPTIONS = [
  { value: "1", label: "Bosh ofis" },
  { value: "16", label: "Samarqand" },
];

const openPanel = async (placement?: "bottom" | "top") => {
  const user = userEvent.setup();
  renderWithProviders(
    <SearchableSelect
      label="Filial"
      name="branch"
      value=""
      onChange={() => undefined}
      options={OPTIONS}
      placeholder="Filialni tanlang"
      hideLabel
      placement={placement}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Filialni tanlang" }));
  return (await screen.findByRole("button", { name: "Samarqand" })).closest("[data-placement]");
};

describe("SearchableSelect placement", () => {
  it("opens below the control by default (existing behaviour)", async () => {
    const panel = await openPanel();
    expect(panel).toHaveAttribute("data-placement", "bottom");
    expect(panel).toHaveClass("top-full", "mt-2");
    expect(panel).not.toHaveClass("bottom-full");
  });

  it("opens above the control with placement='top'", async () => {
    const panel = await openPanel("top");
    expect(panel).toHaveAttribute("data-placement", "top");
    expect(panel).toHaveClass("bottom-full", "mb-2");
    expect(panel).not.toHaveClass("top-full");
  });
});

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import MobileCollapsibleSection from "./MobileCollapsibleSection";

const setMatchMediaMobile = (isMobile: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: isMobile,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

describe("MobileCollapsibleSection", () => {
  afterEach(() => {
    setMatchMediaMobile(false);
  });

  it("starts open on desktop widths (matchMedia does not match mobile)", () => {
    setMatchMediaMobile(false);
    renderWithProviders(
      <MobileCollapsibleSection title="Moliyaviy tahlil">
        <p>Ichki kontent</p>
      </MobileCollapsibleSection>,
    );

    expect(screen.getByText("Ichki kontent")).toBeVisible();
    expect(screen.getByRole("button", { name: /Moliyaviy tahlil/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("starts closed on mobile widths and expands on tap", async () => {
    setMatchMediaMobile(true);
    const user = userEvent.setup();
    renderWithProviders(
      <MobileCollapsibleSection title="Hududlar bo'yicha">
        <p>Xarita kontenti</p>
      </MobileCollapsibleSection>,
    );

    const trigger = screen.getByRole("button", { name: /Hududlar bo'yicha/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    // Content stays in the DOM (accessible), just visually hidden via `hidden sm:block`.
    expect(screen.getByText("Xarita kontenti")).toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});

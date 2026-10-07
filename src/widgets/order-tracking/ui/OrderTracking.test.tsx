import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { OrderTracking } from "./OrderTracking";

const tracking = vi.hoisted(() => ({
  state: { events: [] as unknown[], isLoading: false, isError: false, errorMessage: "", hasMore: false, loadMore: () => {} },
}));

vi.mock("../../../features/order-tracking", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../features/order-tracking")>()),
  useOrderTracking: () => tracking.state,
}));

const event = (id: string, created_at: string, action: string) => ({
  id,
  order_id: "1",
  action,
  created_at,
  changed_by_role: "superadmin",
  changed_by_name: "Dilshod",
  old_value: null,
  new_value: null,
});

const asAdmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;

const setViewport = (mobile: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: mobile && query.includes("max-width: 639px"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));

describe("OrderTracking (Ho5qcDn4)", () => {
  beforeEach(() => {
    // useOrderTracking yangidan eskiga saralab beradi.
    tracking.state = {
      ...tracking.state,
      isError: false,
      events: [
        event("3", "2026-10-07T10:00:00Z", "sold"),
        event("2", "2026-10-06T10:00:00Z", "received"),
        event("1", "2026-10-05T10:00:00Z", "created"),
      ],
    };
  });

  afterEach(() => vi.unstubAllGlobals());

  it("shows the NEWEST event on top, numbered chronologically (#3/3 first)", () => {
    setViewport(false);
    renderWithProviders(<OrderTracking orderId="1" />, { preloadedState: asAdmin });

    const items = screen.getAllByTestId("tracking-event");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("#3/3");
    expect(items[2]).toHaveTextContent("#1/3");
    expect(screen.getByText(/eng yangisi tepada/)).toBeInTheDocument();
  });

  it("is a vertical list — no horizontal scroller that stretches the phone page", () => {
    setViewport(false);
    const { container } = renderWithProviders(<OrderTracking orderId="1" />, { preloadedState: asAdmin });
    expect(container.querySelector(".overflow-x-auto")).toBeNull();
    expect(container.querySelector(".min-w-max")).toBeNull();
  });

  it("on a phone (≤639px) the block starts COLLAPSED and opens on tap", async () => {
    setViewport(true);
    const user = userEvent.setup();
    renderWithProviders(<OrderTracking orderId="1" />, { preloadedState: asAdmin });

    const toggle = screen.getByRole("button", { name: "Tarixni ko'rsatish" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("tracking-body")).toHaveClass("hidden");

    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Tarixni yig'ish" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("tracking-body")).not.toHaveClass("hidden");
  });

  it("on desktop the block is open", () => {
    setViewport(false);
    renderWithProviders(<OrderTracking orderId="1" />, { preloadedState: asAdmin });
    expect(screen.getByTestId("tracking-body")).not.toHaveClass("hidden");
  });

  it("an error stays inside the block (the page keeps working)", () => {
    setViewport(false);
    tracking.state = { ...tracking.state, events: [], isError: true, errorMessage: "Tarixni yuklab bo'lmadi" };
    renderWithProviders(<OrderTracking orderId="1" />, { preloadedState: asAdmin });
    expect(screen.getByText("Tarixni yuklab bo'lmadi")).toBeInTheDocument();
  });
});

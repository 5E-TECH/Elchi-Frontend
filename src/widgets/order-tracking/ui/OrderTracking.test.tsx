import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { OrderTracking } from "./OrderTracking";

const tracking = vi.hoisted(() => ({
  state: {
    events: [] as unknown[],
    isLoading: false,
    isError: false,
    errorMessage: "",
    errorStatus: null as number | null,
    hasMore: false,
    loadMore: () => {},
    total: null as number | null,
    retry: () => {},
  },
}));

vi.mock("../../../features/order-tracking", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../features/order-tracking")>()),
  useOrderTracking: () => tracking.state,
}));

const event = (id: string, created_at: string, action: string, actor: string) => ({
  id,
  order_id: "1",
  action,
  created_at,
  changed_by_role: "superadmin",
  actor: { name: actor, role: "superadmin" },
  old_value: null,
  new_value: null,
});

const asAdmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;

const setViewport = (mobile: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: mobile && query.includes("max-width: 767px"),
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
        event("3", "2026-10-07T10:00:00Z", "sold", "Uchinchi"),
        event("2", "2026-10-06T10:00:00Z", "received", "Ikkinchi"),
        event("1", "2026-10-05T10:00:00Z", "created", "Birinchi"),
      ],
    };
  });

  afterEach(() => vi.unstubAllGlobals());

  it("shows the NEWEST event on top (hook order kept), with the record count", () => {
    setViewport(false);
    renderWithProviders(<OrderTracking orderId="1" />, { preloadedState: asAdmin });

    const items = screen.getAllByTestId("tracking-event");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Uchinchi");
    expect(items[2]).toHaveTextContent("Birinchi");
    expect(screen.getByText("3 ta yozuv — eng yangisi tepada")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Buyurtma tarixi" })).toBeInTheDocument();
  });

  it("hali yuklanmagan sahifa bo'lsa — backend `total` soni va «Ko'proq yuklash»", async () => {
    setViewport(false);
    const user = userEvent.setup();
    const loadMore = vi.fn();
    tracking.state = { ...tracking.state, hasMore: true, total: 27, loadMore };
    renderWithProviders(<OrderTracking orderId="1" />, { preloadedState: asAdmin });

    expect(screen.getByText("27 ta yozuv — eng yangisi tepada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ko'proq yuklash" }));
    expect(loadMore).toHaveBeenCalled();
    tracking.state = { ...tracking.state, hasMore: false, total: null, loadMore: () => {} };
  });

  it("is a vertical list — no horizontal scroller that stretches the phone page", () => {
    setViewport(false);
    const { container } = renderWithProviders(<OrderTracking orderId="1" />, { preloadedState: asAdmin });
    expect(container.querySelector(".overflow-x-auto")).toBeNull();
    expect(container.querySelector(".min-w-max")).toBeNull();
  });

  it("on a phone (<768px) the block starts COLLAPSED and opens on tap", async () => {
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

  it("on desktop the block is open and can be collapsed («Tarixni yig'ish»)", async () => {
    setViewport(false);
    const user = userEvent.setup();
    renderWithProviders(<OrderTracking orderId="1" />, { preloadedState: asAdmin });
    expect(screen.getByTestId("tracking-body")).not.toHaveClass("hidden");

    await user.click(screen.getByRole("button", { name: "Tarixni yig'ish" }));
    expect(screen.getByTestId("tracking-body")).toHaveClass("hidden");
  });

  it("kuryer telefonda: butun enli qator-tugma, «Tarixni ko'rsatish» bosilganda ochiladi", async () => {
    setViewport(true);
    const user = userEvent.setup();
    renderWithProviders(<OrderTracking orderId="1" variant="courier" />, { preloadedState: asAdmin });

    const toggles = screen.getAllByRole("button", { name: /Tarixni ko'rsatish/ });
    // Desktop sarlavhasidagi ikonka-tugma va telefon qatori (CSS bilan almashadi).
    expect(toggles).toHaveLength(2);
    const row = toggles.find((button) => button.textContent?.includes("Buyurtma tarixi"))!;
    expect(row).toHaveTextContent("3 ta yozuv — eng yangisi tepada");
    await user.click(row);
    expect(screen.getByTestId("tracking-body")).not.toHaveClass("hidden");
  });

  it("an error stays inside the block (the page keeps working) — «Qayta urinish» qayta so'raydi", async () => {
    setViewport(false);
    const user = userEvent.setup();
    const retry = vi.fn();
    tracking.state = { ...tracking.state, events: [], isError: true, errorMessage: "Tarixni yuklab bo'lmadi", retry };
    renderWithProviders(<OrderTracking orderId="1" />, { preloadedState: asAdmin });
    expect(screen.getByText("Tarixni yuklab bo'lmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(retry).toHaveBeenCalled();
    tracking.state = { ...tracking.state, retry: () => {} };
  });

  it("403 (boshqa market buyurtmasi) — backend matni, «Qayta urinish» yo'q", () => {
    setViewport(false);
    tracking.state = {
      ...tracking.state,
      events: [],
      isError: true,
      errorStatus: 403,
      errorMessage: "Bu buyurtma tarixini ko'rishga ruxsatingiz yo'q",
    };
    renderWithProviders(<OrderTracking orderId="1" />, { preloadedState: asAdmin });
    expect(screen.getByText("Bu buyurtma tarixini ko'rishga ruxsatingiz yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qayta urinish" })).not.toBeInTheDocument();
    tracking.state = { ...tracking.state, errorStatus: null };
  });

  it("TC7: tarix bo'sh — blok o'rnida tushunarli o'zbekcha matn (bo'sh oq joy emas)", () => {
    setViewport(false);
    tracking.state = { ...tracking.state, events: [], isError: false };
    renderWithProviders(<OrderTracking orderId="1" />, { preloadedState: asAdmin });
    expect(screen.getByText("Bu buyurtma bo'yicha hali tarix yozuvlari yo'q")).toBeInTheDocument();
    expect(screen.queryByText(/Tracking/)).toBeNull();
  });

  it("tarmoq xatosi (backend matni yo'q) — umumiy tarjima qilingan matn", () => {
    setViewport(false);
    tracking.state = { ...tracking.state, events: [], isError: true, errorMessage: "" };
    renderWithProviders(<OrderTracking orderId="1" />, { preloadedState: asAdmin });
    expect(screen.getByText("Ma'lumotlarni yuklashda xatolik yuz berdi")).toBeInTheDocument();
  });

  it("TC9: market roli o'z buyurtmasi tarixini ko'radi (blok chiqadi)", () => {
    setViewport(false);
    renderWithProviders(<OrderTracking orderId="1" />, {
      preloadedState: { role: { id: "37", role: "market", region: null, name: "Market" } } as never,
    });
    expect(screen.getByText("Buyurtma tarixi")).toBeInTheDocument();
    expect(screen.getAllByTestId("tracking-event")).toHaveLength(3);
  });
});

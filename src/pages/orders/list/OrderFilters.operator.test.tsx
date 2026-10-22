import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import OrderFilters from "./OrderFilters";

/**
 * MO-3 — market operatori «Buyurtmalar» filtrlarida (maket yo'q — eng yaqini `market-orders-list`): market bilan bir
 * xil asboblar qatori, panelda faqat «Yetkazish turi» va «Holat». Viloyat filtri yo'q — `GET /region` operatorga 403
 * (N11); market, kuryer va viloyat ro'yxatlari umuman so'ralmaydi (global 403 xabari chiqmasin).
 */

type Enabled = (enabled?: boolean) => { data: unknown; isLoading: boolean };
const hooks = vi.hoisted(() => ({
  regions: vi.fn<Enabled>(() => ({ data: { data: [{ id: "r1", name: "Toshkent sh." }] }, isLoading: false })),
  couriers: vi.fn<Enabled>(() => ({ data: { data: { items: [] } }, isLoading: false })),
  markets: vi.fn<Enabled>(() => ({ data: { data: { items: [] } }, isLoading: false })),
  branches: vi.fn<Enabled>(() => ({ data: { data: [] }, isLoading: false })),
}));

vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    useGetRegions: (enabled?: boolean) => hooks.regions(enabled),
    useGetCouriers: (_params?: unknown, enabled?: boolean) => hooks.couriers(enabled),
    useGetMyProfile: () => ({ data: { data: { id: "42", market_id: "7" } } }),
  }),
}));

vi.mock("../../../entities/logistics/api/logisticsApi", () => ({
  useLogistics: () => ({ useGetDistricts: () => ({ data: [], isLoading: false }) }),
}));

vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({ useGetMarkets: (_params?: unknown, enabled?: boolean) => hooks.markets(enabled) }),
}));

vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  useBranches: (_params?: unknown, enabled?: boolean) => hooks.branches(enabled),
}));

vi.mock("../../../entities/order/api/orderApi", () => ({
  useOrders: () => ({
    useGetOrders: () => ({ data: { data: [], total: 3 }, isPlaceholderData: false, isError: false }),
  }),
}));

const operatorState = { role: { id: "42", role: "market_operator", region: null, name: "Dilnoza" } } as never;

const panel = () => screen.getByRole("group", { name: "Qo'shimcha filtrlar" });
const fieldLabels = () =>
  Array.from(panel().querySelectorAll("[data-field] > span, [data-field] > div > span")).map((el) => el.textContent);

const PHONE_QUERY = "(max-width: 767px)";

beforeEach(() => {
  for (const hook of Object.values(hooks)) hook.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OrderFilters — market operatori (MO-3)", () => {
  it("desktop: panelda faqat «Yetkazish turi» va «Holat»; market, kuryer, viloyat ro'yxatlari so'ralmaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderFilters />, { route: "/orders", preloadedState: operatorState });

    // Asboblar qatori — market bilan bir xil (qidiruv izohi qisqa).
    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Shu ro'yxatdan qidirish");
    await user.click(screen.getByRole("button", { name: "Filtrlar" }));
    expect(fieldLabels()).toEqual(["Yetkazish turi", "Holat"]);

    for (const hook of [hooks.regions, hooks.couriers, hooks.markets, hooks.branches]) {
      expect(hook).toHaveBeenCalled();
      expect(hook.mock.calls.every(([enabled]) => enabled === false)).toBe(true);
    }
  });

  it("URL'da qolgan viloyat — chip yo'q va «Filtrlar» soniga kirmaydi", () => {
    renderWithProviders(<OrderFilters />, {
      route: "/orders?orderRegionId=r1&orderMarketId=m1&orderCourierId=c1&where_deliver=address",
      preloadedState: operatorState,
    });

    expect(screen.getByRole("button", { name: "Filtrlar 1" })).toBeInTheDocument();
    expect(screen.queryByText(/^Viloyat:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Market:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Kuryer:/)).not.toBeInTheDocument();
  });

  it("telefon: sana qatorda (market kabi), varaqada viloyat/market/kuryer tanlovi yo'q", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === PHONE_QUERY,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const user = userEvent.setup();
    renderWithProviders(<OrderFilters />, { route: "/orders", preloadedState: operatorState });

    expect(screen.getByRole("button", { name: /Sana oralig'i/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtrlar" }));
    const sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    for (const name of ["Viloyat", "Market", "Kuryer", "Filial"]) {
      expect(within(sheet).queryByRole("combobox", { name })).not.toBeInTheDocument();
    }
    expect(within(sheet).getByRole("radio", { name: "Uygacha" })).toBeInTheDocument();
  });
});

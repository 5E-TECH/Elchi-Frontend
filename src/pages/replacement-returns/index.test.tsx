import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import ReplacementReturnsPage from "./index";

/**
 * lQjt6sKP — «Almashtirish qaytarmalari» (`/replacement-returns`): `GET orders/replacement/returns` ro'yxati
 * (eski buyurtma, yangi buyurtma, mijoz, mahsulot, holat, sana), filtrlar (holat; superadmin/admin — market),
 * bo'sh/xato holatlari va telefon kartalari.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../shared/api/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../shared/api/api")>();
  return { ...original, api: { ...original.api, get: mocks.get } };
});

const RETURNS_URL = "orders/replacement/returns";

const ROWS = [
  {
    id: "81",
    status: "sold",
    market_id: "7",
    customer_id: "801",
    customer: { id: "801", name: "Ali Valiyev", phone_number: "+998901234567" },
    total_price: 250000,
    sold_at: "1761900000000",
    createdAt: "2026-10-30T10:00:00.000Z",
    items: [{ product_id: "5", product_name: "Samsung A15", quantity: 1 }],
    replacement_state: "awaiting_old_pickup",
    old_item_collected_at: null,
    replacement_order_id: "90",
    replacement_order_status: "waiting",
  },
  {
    id: "82",
    status: "paid",
    market_id: "9",
    customer_id: "802",
    customer: { id: "802", name: null, phone_number: null },
    total_price: 120000,
    sold_at: null,
    createdAt: "2026-10-31T10:00:00.000Z",
    items: [{ product_id: "6", product_name: "Quloqchin", quantity: 2 }],
    replacement_state: "old_collected",
    old_item_collected_at: "2026-11-03T09:15:00.000Z",
    replacement_order_id: null,
    replacement_order_status: null,
  },
];

const page = (items: unknown[], total = items.length) => ({
  data: { statusCode: 200, message: "ok", data: { items, total, page: 1, limit: 20 } },
});
const MARKETS = { data: { statusCode: 200, data: { items: [{ id: 7, name: "Baraka Shop" }] } } };

const stateOf = (role: string) => ({ role: { id: "1", role, region: null, name: "Test" } }) as never;
const returnsCalls = () =>
  mocks.get.mock.calls.filter(([url]) => url === RETURNS_URL).map(([, options]) => options.params);

const mockApi = (returns: () => Promise<unknown> = () => Promise.resolve(page(ROWS))) =>
  mocks.get.mockImplementation((url: string) => {
    if (url === RETURNS_URL) return returns();
    if (url === "markets") return Promise.resolve(MARKETS);
    return Promise.resolve({ data: {} });
  });

const mockPhone = (phone: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: phone && query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );

describe("«Almashtirish qaytarmalari» sahifasi (lQjt6sKP)", () => {
  beforeEach(() => mocks.get.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("⭐ superadmin: eski va yangi buyurtma havolalari, mijoz, mahsulot, holat, market nomi; birinchi so'rov filtrsiz", async () => {
    mockApi();
    renderWithProviders(<ReplacementReturnsPage />, { preloadedState: stateOf("superadmin") });

    const table = await screen.findByRole("table", { name: "Almashtirish qaytarmalari ro'yxati" });
    const [first, second] = within(table).getAllByRole("row").slice(1);

    expect(within(first).getByRole("link", { name: "Eski buyurtma №EL-100081 ni ochish" })).toHaveAttribute(
      "href",
      "/orders/edit/81",
    );
    expect(within(first).getByRole("link", { name: "Yangi buyurtma №EL-100090 ni ochish" })).toHaveAttribute(
      "href",
      "/orders/edit/90",
    );
    expect(first).toHaveTextContent("Ali Valiyev");
    expect(first).toHaveTextContent("+998 90 123 45 67");
    expect(first).toHaveTextContent("Samsung A15 × 1");
    expect(first).toHaveTextContent("Kutilmoqda — kuryer olishi kerak");
    expect(first).toHaveTextContent("Baraka Shop");

    // Yangi buyurtma o'chirilgan, mijoz ismi yo'q, market ro'yxatda yo'q — zaxira matnlar.
    expect(second).toHaveTextContent("Yangi buyurtma o'chirilgan");
    expect(second).toHaveTextContent("Mijoz ko'rsatilmagan");
    expect(second).toHaveTextContent("Olingan — marketga ketmoqda");
    expect(second).toHaveTextContent(/Olingan: /);
    expect(second).toHaveTextContent("Market #9");

    expect(screen.getByText(/jami 2 ta/)).toBeInTheDocument();
    expect(returnsCalls()[0]).toEqual({ page: 1, limit: 20 });
  });

  it("⭐ «Holat» filtri — `state` ketadi va URL'ga yoziladi", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<ReplacementReturnsPage />, { preloadedState: stateOf("admin") });

    await screen.findByRole("table", { name: "Almashtirish qaytarmalari ro'yxati" });
    await user.click(screen.getByRole("combobox", { name: "Holat" }));
    await user.click(await screen.findByRole("option", { name: "Olingan" }));

    await waitFor(() => expect(returnsCalls().at(-1)).toEqual({ page: 1, limit: 20, state: "old_collected" }));
  });

  it("⭐ admin market tanlasa — `market_id` ketadi", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<ReplacementReturnsPage />, { preloadedState: stateOf("admin") });

    await screen.findByRole("table", { name: "Almashtirish qaytarmalari ro'yxati" });
    await user.click(screen.getByRole("combobox", { name: "Market" }));
    await user.click(await screen.findByRole("option", { name: "Baraka Shop" }));

    await waitFor(() => expect(returnsCalls().at(-1)).toMatchObject({ market_id: "7", page: 1 }));
  });

  it("⭐ market: o'z ro'yxati — market filtri yo'q, marketlar so'ralmaydi, URL'dagi `market` yuborilmaydi", async () => {
    mockApi();
    renderWithProviders(<ReplacementReturnsPage />, {
      preloadedState: stateOf("market"),
      route: "/replacement-returns?market=9&state=awaiting_old_pickup",
    });

    await screen.findByRole("table", { name: "Almashtirish qaytarmalari ro'yxati" });
    expect(screen.queryByRole("combobox", { name: "Market" })).toBeNull();
    expect(screen.getByText(/Almashtirilgan buyurtmalaringiz/)).toBeInTheDocument();
    expect(returnsCalls()[0]).toEqual({ page: 1, limit: 20, state: "awaiting_old_pickup" });
    expect(mocks.get.mock.calls.every(([url]) => url === RETURNS_URL)).toBe(true);
    // Market rolida market nomi qatorda chiqmaydi (o'zining buyurtmalari).
    expect(screen.queryByText("Market #7")).toBeNull();
  });

  it("bo'sh ro'yxat (filtrsiz) — tushuntirishli bo'sh holat", async () => {
    mockApi(() => Promise.resolve(page([])));
    renderWithProviders(<ReplacementReturnsPage />, { preloadedState: stateOf("superadmin") });

    expect(await screen.findByText("Almashtirish qaytarmasi yo'q")).toBeInTheDocument();
    expect(screen.getByText(/«Almashtirish» bilan eski buyurtma tanlansa/)).toBeInTheDocument();
  });

  it("«Qaytarildi» bo'sh — sababi aytiladi, «Filtrni tozalash» filtrni olib tashlaydi", async () => {
    const user = userEvent.setup();
    mockApi(() => Promise.resolve(page([])));
    renderWithProviders(<ReplacementReturnsPage />, {
      preloadedState: stateOf("superadmin"),
      route: "/replacement-returns?state=old_returned",
    });

    expect(await screen.findByText("Bu filtr bo'yicha almashtirish yo'q")).toBeInTheDocument();
    expect(screen.getByText(/marketga topshirish hozircha tizimda belgilanmaydi/)).toBeInTheDocument();
    expect(returnsCalls()[0]).toMatchObject({ state: "old_returned" });

    await user.click(screen.getByRole("button", { name: "Filtrni tozalash" }));
    await waitFor(() => expect(returnsCalls().at(-1)).toEqual({ page: 1, limit: 20 }));
  });

  it("xato — «Qayta urinish» so'rovni takrorlaydi", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi(() => (fail ? Promise.reject(new Error("boom")) : Promise.resolve(page(ROWS))));
    renderWithProviders(<ReplacementReturnsPage />, { preloadedState: stateOf("superadmin") });

    expect(await screen.findByText("Almashtirish qaytarmalarini yuklab bo'lmadi", undefined, { timeout: 5000 })).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByRole("table", { name: "Almashtirish qaytarmalari ro'yxati" })).toBeInTheDocument();
  });

  it("telefon: kartalar — eski va yangi buyurtma havola-tugmalari, holat va mahsulot", async () => {
    mockPhone(true);
    mockApi();
    renderWithProviders(<ReplacementReturnsPage />, { preloadedState: stateOf("superadmin") });

    const list = await screen.findByRole("list", { name: "Almashtirish qaytarmalari" });
    const [first, second] = within(list).getAllByRole("listitem");

    expect(within(first).getByRole("link", { name: "Eski buyurtma №EL-100081 ni ochish" })).toHaveTextContent(
      "Eski №EL-100081",
    );
    expect(within(first).getByRole("link", { name: "Yangi buyurtma №EL-100090 ni ochish" })).toHaveAttribute(
      "href",
      "/orders/edit/90",
    );
    expect(first).toHaveTextContent("Samsung A15 × 1");
    expect(first).toHaveTextContent("Kutilmoqda — kuryer olishi kerak");
    expect(second).toHaveTextContent("Yangi buyurtma o'chirilgan");
    expect(screen.queryByRole("table")).toBeNull();
  });
});

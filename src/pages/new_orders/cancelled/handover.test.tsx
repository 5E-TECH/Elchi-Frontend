import { screen, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CancelledHandoverBatch from "./handover";

/**
 * «Topshirilgan» kartasi bosilganda — `/new-orders/cancelled/handovers/:batchId`: bitta «Marketga jo'natish»
 * buyurtmalari (faqat ko'rish). Sarlavha — market, izoh — vaqt · son · jami, usul va xodim; № → buyurtma sahifasi.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const BATCH_ID = "201_1762771320123456_520";

const DETAIL = {
  batch: {
    id: BATCH_ID,
    market_id: "201",
    market: { id: "201", name: "Baraka Shop", phone_number: "+998903152241" },
    handed_at: "2026-11-10T11:42:00.123Z",
    day: "2026-11-10",
    handed_by: { id: "520", name: "Aziz Karimov" },
    method: "pin",
    manual_count: 1,
    orders_count: 2,
    total_price_sum: 340000,
  },
  data: [
    {
      id: "9",
      status: "returned_to_market",
      total_price: 240000,
      createdAt: "2026-11-01T08:00:00.000Z",
      customer: { id: "c1", name: "Malika Yusupova", phone_number: "+998901112233" },
      items: [{ id: "i1", quantity: 1, product: { id: "p1", name: "Ayollar sumkasi" } }],
    },
    {
      id: "12",
      status: "returned_to_market",
      total_price: 100000,
      createdAt: "2026-11-03T08:00:00.000Z",
      customer: { id: "c2", name: "Kamron Islomov", phone_number: "+998973334455" },
      items: [],
    },
  ],
  total: 2,
};

const adminState = { role: { id: "admin-1", role: "admin", region: null, name: "Admin" } } as never;

const renderBatch = (route: string | { pathname: string; state?: unknown } = `/new-orders/cancelled/handovers/${BATCH_ID}`) =>
  renderWithProviders(
    <Routes>
      <Route path="/new-orders/cancelled/handovers/:batchId" element={<CancelledHandoverBatch />} />
    </Routes>,
    { route, preloadedState: adminState },
  );

describe("Topshirish partiyasi sahifasi", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.get.mockImplementation((url: string) =>
      url === `orders/markets/cancelled/handovers/${BATCH_ID}`
        ? Promise.resolve({ data: DETAIL })
        : Promise.reject({ response: { status: 404 } }),
    );
  });

  it("sarlavha, izoh (vaqt · son · jami), usul, xodim va buyurtmalar jadvali", async () => {
    renderBatch();
    expect(await screen.findByRole("heading", { level: 1, name: "Baraka Shop" })).toBeInTheDocument();
    // Toshkent vaqti: 11:42 UTC → 16:42.
    expect(screen.getByText("10.11.2026 16:42")).toBeInTheDocument();
    expect(screen.getByText(/ta buyurtma/).closest("p")).toHaveTextContent(/2 ta buyurtma · jami/);
    expect(screen.getByText("Parol orqali")).toBeInTheDocument();
    expect(screen.getByText("1 ta qo'lda")).toBeInTheDocument();
    expect(screen.getByText("Topshirdi: Aziz Karimov")).toBeInTheDocument();

    const back = screen.getByRole("link", { name: /Topshirilgan/ });
    expect(back).toHaveAttribute("href", "/new-orders/cancelled?tab=handed");

    const table = await screen.findByRole("table", { name: "Topshirilgan buyurtmalar" });
    const rows = within(table).getAllByRole("row").slice(1);
    // Sukut — yangi buyurtma tepada.
    expect(within(rows[0]).getByRole("link", { name: "№12" })).toHaveAttribute("href", "/orders/edit/12");
    expect(within(rows[1]).getByRole("link", { name: "№9" })).toHaveAttribute("href", "/orders/edit/9");
    expect(within(rows[1]).getByText("Malika Yusupova")).toBeInTheDocument();
  });

  it("ro'yxatdagi filtrlar bilan qaytadi (router state)", async () => {
    renderBatch({
      pathname: `/new-orders/cancelled/handovers/${BATCH_ID}`,
      state: { fromSearch: "?tab=handed&q=Bar&page=2" },
    });
    await screen.findByRole("heading", { level: 1, name: "Baraka Shop" });
    expect(screen.getByRole("link", { name: /Topshirilgan/ })).toHaveAttribute(
      "href",
      "/new-orders/cancelled?tab=handed&q=Bar&page=2",
    );
  });

  it("topilmasa (404) — «Topshirish topilmadi» va ro'yxatga qaytish", async () => {
    renderBatch("/new-orders/cancelled/handovers/1_2_3");
    expect(await screen.findByText("Topshirish topilmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Topshirilganlarga qaytish" })).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith("orders/markets/cancelled/handovers/1_2_3");
  });
});

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeWarehouse } from "../../../../entities/warehouse";
import { renderWithProviders } from "../../../../test/test-utils";
import { rawProduct, rawWarehouse } from "../../../../test/warehouseFixtures";
import { InventoryDialog } from "./InventoryDialog";
import { StockInDialog } from "./StockInDialog";

/**
 * Kirim (maket `superadmin-warehouse-stock-in-dialog`) va inventarizatsiya: skaner oqimi (maydon + Enter, USB skaner
 * klaviatura sifatida, nom qidiruvi), lookup natijalari (topildi / qayta skan / bog'lanmagan zavod kodi / topilmadi /
 * bir nechta marketda), «Mahsulotga bog'lash», `Idempotency-Key` (qayta urinishda AYNI, tarkib o'zgarsa yangi).
 */

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("../../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const WAREHOUSE = normalizeWarehouse(rawWarehouse())!;
const QUVVAT = rawProduct({ id: "202", name: "Quvvatlagich 20 W", barcode: "4780123450017", code: { value: "4780123450017", kind: "barcode", format: "EAN-13" } });
const lookupOf = (code: string) => {
  switch (code) {
    case "4780123450017":
      return { matched_by: "barcode", data: [{ product: QUVVAT, market: { id: "121", name: "Baraka Shop" }, stock: { on_hand: 9, reserved: 2, available: 7, threshold: 10, level: "low" } }] };
    case "ELC-P-000142":
      return { matched_by: "sku_code", data: [{ product: rawProduct(), market: { id: "121", name: "Baraka Shop" }, stock: { on_hand: 0, reserved: 0, available: 0, threshold: 10, level: "out" } }] };
    case "4780000000007":
      return {
        matched_by: "barcode",
        data: [
          { product: rawProduct({ id: "301", name: "Pepsi 0.5", market_id: "121" }), market: { id: "121", name: "Baraka Shop" }, stock: null },
          { product: rawProduct({ id: "302", name: "Pepsi 0.5", market_id: "122" }), market: { id: "122", name: "Nur Elektronika" }, stock: null },
        ],
      };
    default:
      return { matched_by: null, data: [] };
  }
};
let linked = false;

beforeEach(() => {
  linked = false;
  mocks.get.mockReset().mockImplementation((url: string, config?: { params?: Record<string, string> }) => {
    if (url === "warehouses") return Promise.resolve({ data: { data: [rawWarehouse()], total: 1 } });
    if (url === "markets") return Promise.resolve({ data: { data: { items: [{ id: "121", name: "Baraka Shop" }] } } });
    if (url === "warehouses/3/lookup") {
      const code = config?.params?.code ?? "";
      if (code === "4780012345677" && linked) {
        return Promise.resolve({ data: { matched_by: "barcode", data: [{ product: rawProduct({ id: "7", name: "Pepsi 1 l" }), market: { id: "121", name: "Baraka Shop" }, stock: null }] } });
      }
      return Promise.resolve({ data: { code, ...lookupOf(code) } });
    }
    if (url === "product") {
      return Promise.resolve({ data: { data: { items: [{ id: "7", name: "Pepsi 1 l", market: { name: "Baraka Shop" }, sku_code: "ELC-P-000007", barcode: null }] } } });
    }
    return Promise.reject(new Error(`kutilmagan: ${url}`));
  });
  mocks.post.mockReset().mockResolvedValue({
    data: { warehouse_id: "3", warehouse_name: "Samarqand filiali ombori", replayed: false, positions: 1, total_qty: 2, lines: [] },
  });
  mocks.patch.mockReset().mockImplementation(() => {
    linked = true;
    return Promise.resolve({ data: { data: { id: 7 } } });
  });
});

const openStockIn = () =>
  renderWithProviders(<StockInDialog open warehouse={WAREHOUSE} onClose={vi.fn()} />, {
    preloadedState: { role: { id: "1", role: "superadmin", region: null, name: "superadmin" } } as never,
  });

const scanField = () => screen.getByRole("combobox", { name: /Mahsulot/ });

const scanIntoField = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
  await user.clear(scanField());
  await user.type(scanField(), `${code}{Enter}`);
};

/** USB skaner: tugmalar ketma-ket (klaviatura kabi), oxirida Enter — fokus matn maydonida emas. */
const usbScan = (code: string) => {
  const target = document.body;
  for (const char of code) {
    const keyCode = /[A-Z]/i.test(char) ? `Key${char.toUpperCase()}` : /\d/.test(char) ? `Digit${char}` : char === "-" ? "Minus" : "";
    fireEvent.keyDown(target, { key: char, code: keyCode });
  }
  fireEvent.keyDown(target, { key: "Enter", code: "Enter" });
};

const stockInCalls = () => mocks.post.mock.calls.filter(([url]) => url === "warehouses/3/stock-in");

describe("Kirim oynasi — skaner oqimi", () => {
  it("kod + Enter → lookup → qator («Hozirgi qoldiq 7 dona»); qayta skan — 2 dona va «+1 · qayta skan»", async () => {
    const user = userEvent.setup();
    openStockIn();
    await scanIntoField(user, "4780123450017");
    const list = await screen.findByRole("list", { name: "Skanerlangan mahsulotlar" });
    expect(await within(list).findByText("Quvvatlagich 20 W")).toBeInTheDocument();
    expect(within(list).getByText("7 dona")).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith("warehouses/3/lookup", { params: { code: "4780123450017" } });
    await scanIntoField(user, "4780123450017");
    expect(await within(list).findByText("+1 · qayta skan")).toBeInTheDocument();
    expect(within(list).getByRole("textbox", { name: "Quvvatlagich 20 W, qo'shiladigan dona" })).toHaveValue("2");
    expect(screen.getByRole("button", { name: "Qoldiqqa qo'shish — 2 dona" })).toBeInTheDocument();
  });

  it("USB skaner (fokus maydonda emas) ham qator qo'shadi; tugagan qoldiq — «0 · tugagan»", async () => {
    openStockIn();
    await screen.findByRole("dialog", { name: "Omborga mahsulot qo'shish" });
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    usbScan("ELC-P-000142");
    expect(await screen.findByText("Simsiz quloqchin")).toBeInTheDocument();
    expect(screen.getByText("0 · tugagan")).toBeInTheDocument();
  });

  it("topilmagan Elchi kodi — «mahsulot topilmadi», yuborilmaydi", async () => {
    const user = userEvent.setup();
    openStockIn();
    await scanIntoField(user, "ELC-P-000999");
    expect(await screen.findByText("— mahsulot topilmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qoldiqqa qo'shish" })).toBeDisabled();
  });

  it("bir nechta marketda — market tanlanadi, qator qo'shiladi", async () => {
    const user = userEvent.setup();
    openStockIn();
    await scanIntoField(user, "4780000000007");
    expect(await screen.findByText("— bir nechta marketda topildi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nur Elektronika" }));
    expect(await screen.findByText("Pepsi 0.5")).toBeInTheDocument();
    expect(screen.queryByText("— bir nechta marketda topildi")).not.toBeInTheDocument();
  });

  it("bog'lanmagan zavod kodi → «Mahsulotga bog'lash» → PATCH product/:id {barcode} → «Kod bog'landi»", async () => {
    const user = userEvent.setup();
    openStockIn();
    await scanIntoField(user, "4780012345677");
    expect(await screen.findByText("— hech qaysi mahsulotga bog'lanmagan")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mahsulotga bog'lash" }));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotga bog'lash" });
    await user.type(within(dialog).getByRole("searchbox"), "Pepsi");
    await user.click(await within(dialog).findByRole("radio", { name: /Pepsi 1 l/ }));
    await user.click(within(dialog).getByRole("button", { name: "Kodni bog'lash" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith("product/7", expect.any(FormData), expect.anything()));
    expect((mocks.patch.mock.calls[0][1] as FormData).get("barcode")).toBe("4780012345677");
    const list = screen.getByRole("list", { name: "Skanerlangan mahsulotlar" });
    expect(await within(list).findByText("Kod bog'landi")).toBeInTheDocument();
    expect(within(list).getByText("Pepsi 1 l")).toBeInTheDocument();
    expect(screen.queryByText("— hech qaysi mahsulotga bog'lanmagan")).not.toBeInTheDocument();
  });

  it("nom bo'yicha qidiruv — ro'yxatdan tanlansa, Elchi kodi bilan lookup", async () => {
    const user = userEvent.setup();
    openStockIn();
    await user.type(scanField(), "Peps");
    await user.click(await screen.findByRole("option", { name: /Pepsi 1 l/ }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("warehouses/3/lookup", { params: { code: "ELC-P-000007" } }));
  });
});

describe("Kirim oynasi — yuborish va Idempotency-Key", () => {
  it("POST stock-in: qatorlar, izoh, `Idempotency-Key`; muvaffaqiyat xabari", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<StockInDialog open warehouse={WAREHOUSE} onClose={onClose} />);
    await scanIntoField(user, "4780123450017");
    await screen.findByText("Quvvatlagich 20 W");
    await user.type(screen.getByRole("textbox", { name: /Izoh/ }), "3 quti");
    await user.click(screen.getByRole("button", { name: "Qoldiqqa qo'shish — 1 dona" }));
    await waitFor(() => expect(stockInCalls()).toHaveLength(1));
    const [, body, config] = stockInCalls()[0];
    expect(body).toEqual({ lines: [{ product_id: "202", qty: 1 }], note: "3 quti" });
    expect(config.headers["Idempotency-Key"]).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
    expect(await screen.findByText("Qoldiqqa qo'shildi")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it("javobsiz xato (504) — oyna ochiq, qayta yuborish AYNI kalit; tarkib o'zgarsa — yangi kalit", async () => {
    mocks.post
      .mockRejectedValueOnce(Object.assign(new Error("timeout"), { response: { status: 504 } }))
      .mockRejectedValueOnce(Object.assign(new Error("timeout"), { response: { status: 504 } }));
    const user = userEvent.setup();
    openStockIn();
    await scanIntoField(user, "4780123450017");
    await screen.findByText("Quvvatlagich 20 W");
    await user.click(screen.getByRole("button", { name: "Qoldiqqa qo'shish — 1 dona" }));
    expect(await screen.findByText(/Javob kelmadi — kirim saqlangan bo'lishi mumkin/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qoldiqqa qo'shish — 1 dona" }));
    await waitFor(() => expect(stockInCalls()).toHaveLength(2));
    const key = (index: number) => stockInCalls()[index][2].headers["Idempotency-Key"];
    expect(key(1)).toBe(key(0));

    await user.click(screen.getByRole("button", { name: "Quvvatlagich 20 W miqdorini oshirish" }));
    await user.click(screen.getByRole("button", { name: "Qoldiqqa qo'shish — 2 dona" }));
    await waitFor(() => expect(stockInCalls()).toHaveLength(3));
    expect(key(2)).not.toBe(key(0));
    expect(stockInCalls()[2][1]).toEqual({ lines: [{ product_id: "202", qty: 2 }] });
  });

  it("takroriy javob (`replayed`) — «avval saqlangan» xabari", async () => {
    mocks.post.mockResolvedValueOnce({ data: { replayed: true, positions: 1, total_qty: 1, lines: [] } });
    const user = userEvent.setup();
    openStockIn();
    await scanIntoField(user, "4780123450017");
    await screen.findByText("Quvvatlagich 20 W");
    await user.click(screen.getByRole("button", { name: "Qoldiqqa qo'shish — 1 dona" }));
    expect(await screen.findByText("Bu kirim avval saqlangan — qoldiq qayta o'zgarmadi")).toBeInTheDocument();
  });
});

describe("Inventarizatsiya", () => {
  it("sabab majburiy; POST inventory { lines: [{ product_id, counted }], reason } + Idempotency-Key", async () => {
    mocks.post.mockResolvedValueOnce({ data: { replayed: false, reason: "Oylik", changed: 1, unchanged: 0, lines: [] } });
    const user = userEvent.setup();
    renderWithProviders(<InventoryDialog open warehouse={WAREHOUSE} onClose={vi.fn()} />);
    await scanIntoField(user, "4780123450017");
    expect(await screen.findByText("Hisobda")).toBeInTheDocument();
    expect(screen.getByText("9 dona")).toBeInTheDocument();
    expect(screen.getByText("−8")).toBeInTheDocument();
    const counted = screen.getByRole("textbox", { name: "Quvvatlagich 20 W, sanalgan dona" });
    await user.clear(counted);
    await user.type(counted, "6");
    await user.click(screen.getByRole("button", { name: /Tuzatishni saqlash/ }));
    expect(await screen.findByText("Sababni yozing (kamida 3 belgi)")).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
    await user.type(screen.getByRole("textbox", { name: /Sabab/ }), "Oylik");
    await user.click(screen.getByRole("button", { name: /Tuzatishni saqlash/ }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "warehouses/3/inventory",
        { lines: [{ product_id: "202", counted: 6 }], reason: "Oylik" },
        { headers: { "Idempotency-Key": expect.stringMatching(/^[A-Za-z0-9._:-]{8,128}$/) } },
      ),
    );
    expect(await screen.findByText("Inventarizatsiya saqlandi")).toBeInTheDocument();
  });
});

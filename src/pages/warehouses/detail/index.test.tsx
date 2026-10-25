import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { rawProduct, rawWarehouse } from "../../../test/warehouseFixtures";
import WarehouseDetailPage from "./index";

/**
 * Ombor tafsiloti — `/warehouses/:id` (yXC91RRx; maketlar `superadmin-warehouse-detail`, `manager-warehouse-detail`):
 * superadmin/admin — amallar (Excel, kirim, ⋯ inventarizatsiya / to'xtatish, chegara); menejer — faqat ko'rish.
 */

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), saveBlob: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

vi.mock("../../../shared/lib/exportFile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/exportFile")>()),
  saveBlob: mocks.saveBlob,
}));

const STOCK = {
  warehouse: { id: "3", name: "Samarqand filiali ombori", status: "ACTIVE" },
  data: [
    { stock_id: "55", product: rawProduct(), market: { id: "121", name: "Baraka Shop" }, on_hand: 0, reserved: 0, available: 0, low_stock_threshold: null, threshold: 10, level: "out", last_movement_at: null },
    {
      stock_id: "56",
      product: rawProduct({ id: "201", name: "Kir yuvish mashinasi 7 kg", barcode: "8806095501239", code: { value: "8806095501239", kind: "barcode", format: "EAN-13" }, chargeable_weight_kg: 38.4, chargeable_basis: "volumetric" }),
      market: { id: "122", name: "Nur Elektronika" },
      on_hand: 4,
      reserved: 1,
      available: 3,
      low_stock_threshold: null,
      threshold: 2,
      level: "ok",
      last_movement_at: null,
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
  facets: { levels: { all: 2, ok: 1, low: 0, out: 1 }, markets: [{ id: "121", name: "Baraka Shop", positions: 1 }] },
};
const MOVEMENTS = {
  data: [
    { id: "901", type: "IN", qty: 40, on_hand_after: 9, reserved_after: 2, ref_type: "stock_in", ref_id: "k", note: null, created_at: "2026-10-24T09:40:00Z", product: { id: "202", name: "Quvvatlagich 20 W" }, market: { id: "121", name: "Baraka Shop" }, actor: { id: "2", name: "Nilufar Rashidova", role: "admin" } },
    { id: "897", type: "ADJUST", qty: -2, on_hand_after: 6, reserved_after: 1, ref_type: "inventory", ref_id: "k2", note: "Oylik", created_at: "2026-10-23T13:04:00Z", product: { id: "131", name: "Ayollar sumkasi" }, market: { id: "123", name: "Ipak Yo'li Savdo" }, actor: { id: "2", name: "Nilufar Rashidova", role: "admin" } },
  ],
  total: 86,
  page: 1,
  limit: 5,
};

let detail: unknown = rawWarehouse({ movements_count: 86 });

beforeEach(() => {
  detail = rawWarehouse({ movements_count: 86 });
  mocks.get.mockReset().mockImplementation((url: string) => {
    if (url === "warehouses/3") return Promise.resolve({ data: detail });
    if (url === "warehouses/3/stock") return Promise.resolve({ data: STOCK });
    if (url === "warehouses/3/movements") return Promise.resolve({ data: MOVEMENTS });
    if (url === "warehouses/3/export") return Promise.resolve({ data: new Blob(["x"]), headers: {} });
    return Promise.reject(new Error(`kutilmagan: ${url}`));
  });
  mocks.post.mockReset().mockResolvedValue({ data: rawWarehouse({ status: "PAUSED" }) });
  mocks.patch.mockReset().mockResolvedValue({ data: { warehouse_id: "3", product_id: "142", low_stock_threshold: 7, effective_threshold: 7 } });
  mocks.saveBlob.mockReset();
});

const renderAs = (role: string, userId = "1", branchType?: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/warehouses/:id" element={<WarehouseDetailPage />} />
    </Routes>,
    {
      route: "/warehouses/3",
      preloadedState: {
        role: { id: userId, role, region: null, name: role },
        user: {
          user: { id: userId, role, ...(branchType ? { branch: { id: "11", type: branchType } } : {}) },
          isAuthenticated: true,
          accessToken: null,
          loading: false,
          isAppInitializing: false,
          error: null,
        },
      } as never,
    },
  );

describe("Ombor tafsiloti — superadmin, admin", () => {
  it("sarlavha, KPI, qoldiq jadvali va «Oxirgi harakatlar»", async () => {
    renderAs("superadmin");
    expect(await screen.findByRole("heading", { level: 1, name: "Samarqand filiali ombori" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Omborlar/ })).toHaveAttribute("href", "/warehouses");
    expect(screen.getByText("Mas'ul: Dilshod Usmonov, filial menejeri")).toBeInTheDocument();
    expect(screen.getByText("Ochilgan: 14.09.2026")).toBeInTheDocument();
    expect(screen.getByText("sotish uchun mavjud 448 dona")).toBeInTheDocument();
    expect(screen.getByText("14 ta faol buyurtmada")).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: "Ombordagi mahsulotlar" });
    expect(within(table).getByText("Simsiz quloqchin")).toBeInTheDocument();
    expect(within(table).getAllByText("ELC-P-000142").length).toBeGreaterThan(0);
    expect(within(table).getByText("Tugagan")).toBeInTheDocument();
    expect(within(table).getByText("38,4 kg")).toBeInTheDocument();
    expect(within(table).getByText("hajm bo'yicha")).toBeInTheDocument();
    const recent = await screen.findByRole("list", { name: "Oxirgi harakatlar" });
    expect(within(recent).getByText("Admin mahsulot qo'shdi")).toBeInTheDocument();
    expect(within(recent).getByText("+40 dona")).toBeInTheDocument();
    expect(within(recent).getByText("Inventarizatsiya: 8 → 6")).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith("warehouses/3/movements", { params: { page: 1, limit: 5 } });
    expect(screen.getByRole("button", { name: "Mahsulot qo'shish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ombor amallari/ })).toBeInTheDocument();
  });

  it("«Holat» filtri — `level`; «Excelga yuklash» joriy filtrlar bilan", async () => {
    const user = userEvent.setup();
    renderAs("admin");
    await screen.findByRole("table", { name: "Ombordagi mahsulotlar" });
    await user.click(screen.getByRole("combobox", { name: /Holat/ }));
    await user.click(await screen.findByRole("option", { name: /Tugagan/ }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("warehouses/3/stock", { params: { page: 1, limit: 20, level: "out" } }),
    );
    await user.click(screen.getByRole("button", { name: "Excelga yuklash" }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("warehouses/3/export", { params: { level: "out" }, responseType: "blob", timeout: 120_000 }),
    );
    expect(mocks.saveBlob).toHaveBeenCalledWith(expect.any(Blob), "ombor-3-qoldiq.xlsx");
  });

  it("⋯ → «Omborni to'xtatish» — tasdiq oynasi, so'ng POST pause", async () => {
    const user = userEvent.setup();
    renderAs("superadmin");
    await user.click(await screen.findByRole("button", { name: /Ombor amallari/ }));
    await user.click(screen.getByRole("menuitem", { name: /Omborni to'xtatish/ }));
    const confirm = await screen.findByRole("alertdialog", { name: "Omborni to'xtatasizmi?" });
    expect(mocks.post).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole("button", { name: "To'xtatish" }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("warehouses/3/pause", {}));
    expect(await screen.findByText("Ombor to'xtatildi")).toBeInTheDocument();
  });

  it("to'xtatilgan omborda — «Qayta yoqish» (POST resume)", async () => {
    detail = rawWarehouse({ status: "PAUSED", paused_at: "2026-10-20T12:30:00Z" });
    const user = userEvent.setup();
    renderAs("superadmin");
    expect(await screen.findByText("To'xtatilgan")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /Ombor amallari/ }));
    await user.click(screen.getByRole("menuitem", { name: /Qayta yoqish/ }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Qayta yoqish" }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("warehouses/3/resume", {}));
  });

  it("XtcEyQjb: to'xtatilgan omborda «Mahsulot qo'shish» o'chiq, sababi izohda", async () => {
    detail = rawWarehouse({ status: "PAUSED", paused_at: "2026-10-20T12:30:00Z" });
    renderAs("admin");
    const add = await screen.findByRole("button", { name: "Mahsulot qo'shish" });
    expect(add).toBeDisabled();
    const hint = screen.getByText("To'xtatilgan omborga kirim qilinmaydi — avval qayta yoqing");
    expect(add).toHaveAttribute("aria-describedby", hint.closest("[role=note]")?.id);
  });

  it("«Chegara» — oyna, PATCH stock/:productId", async () => {
    const user = userEvent.setup();
    renderAs("superadmin");
    await user.click(await screen.findByRole("button", { name: /Simsiz quloqchin — kam qoldiq chegarasini o'zgartirish/ }));
    const dialog = await screen.findByRole("dialog", { name: "Kam qoldiq chegarasi" });
    const input = within(dialog).getByRole("textbox", { name: /Chegara/ });
    await user.clear(input);
    await user.type(input, "7");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith("warehouses/3/stock/142", { low_stock_threshold: 7 }));
  });

  it("«Harakatlar» tabi — to'liq jurnal, «Turi» filtri", async () => {
    const user = userEvent.setup();
    renderAs("superadmin");
    await user.click(await screen.findByRole("tab", { name: /Harakatlar/ }));
    expect(await screen.findByRole("list", { name: "Harakatlar jurnali" })).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith("warehouses/3/movements", { params: { page: 1, limit: 20 } });
    await user.click(screen.getByRole("combobox", { name: /Turi/ }));
    await user.click(await screen.findByRole("option", { name: "Qaytdi" }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("warehouses/3/movements", { params: { page: 1, limit: 20, type: "RETURN,RELEASE" } }),
    );
    expect(screen.queryByRole("heading", { name: "Oxirgi harakatlar" })).not.toBeInTheDocument();
  });

  it("topilmasa (404) — «Ombor topilmadi»", async () => {
    mocks.get.mockImplementation((url: string) =>
      url === "warehouses/3" ? Promise.reject(Object.assign(new Error("nf"), { response: { status: 404 } })) : Promise.resolve({ data: {} }),
    );
    renderAs("superadmin");
    expect(await screen.findAllByText("Ombor topilmadi")).not.toHaveLength(0);
  });
});

describe("Ombor tafsiloti — filial menejeri (faqat ko'rish)", () => {
  it("amallar yo'q, «Qoldiqni admin boshqaradi», «(siz)», chegara bosilmaydi", async () => {
    renderAs("manager", "31");
    expect(await screen.findByRole("heading", { level: 1, name: "Samarqand filiali ombori" })).toBeInTheDocument();
    expect(screen.getByText("Qoldiqni admin boshqaradi")).toBeInTheDocument();
    expect(screen.getByText("Mas'ul: Dilshod Usmonov (siz)")).toBeInTheDocument();
    expect(screen.getByText("Samarqand filiali · Samarqand viloyati")).toBeInTheDocument();
    await screen.findByRole("table", { name: "Ombordagi mahsulotlar" });
    expect(screen.queryByRole("button", { name: "Mahsulot qo'shish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ombor amallari/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excelga yuklash" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /kam qoldiq chegarasini o'zgartirish/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Omborlar/ })).not.toBeInTheDocument();
  });
});

describe("Ombor tafsiloti — registrator (XtcEyQjb, faqat ko'rish)", () => {
  it("«← Omborlar» va «Excelga yuklash» bor; kirim, ⋯ va chegara yo'q; «Faqat ko'rish» izohi", async () => {
    renderAs("registrator");
    expect(await screen.findByRole("heading", { level: 1, name: "Samarqand filiali ombori" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Omborlar/ })).toHaveAttribute("href", "/warehouses");
    expect(screen.getByText("Faqat ko'rish")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excelga yuklash" })).toBeInTheDocument();
    await screen.findByRole("table", { name: "Ombordagi mahsulotlar" });
    expect(screen.queryByRole("button", { name: "Mahsulot qo'shish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ombor amallari/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /kam qoldiq chegarasini o'zgartirish/ })).not.toBeInTheDocument();
    // Menejer kartasi registratorda yo'q.
    expect(screen.queryByRole("heading", { name: "Ombordan ketadigan buyurtmalar" })).not.toBeInTheDocument();
  });
});

describe("Ombor tafsiloti — «Ombordan ketadigan buyurtmalar» (6kHnNH9j, menejer)", () => {
  const order = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
    id,
    status,
    fulfillment_source: "WAREHOUSE",
    warehouse: { id: "3", name: "Samarqand filiali ombori", branch_id: "11" },
    createdAt: "2026-10-24T09:05:00Z",
    customer: { id: "c" + id, name: `Mijoz ${id}`, phone_number: "+998901234567" },
    market: { id: "121", name: "Baraka Shop" },
    district: { id: "45", name: "Urgut tumani" },
    items: [{ id: "i" + id, product_id: "142", quantity: 1, product: { id: "142", name: "Simsiz quloqchin" } }],
    ...extra,
  });
  const PENDING = [order("10244", "received"), order("10243", "received")];
  const COURIER = [order("10237", "waiting", { courier: { id: "77", name: "Jasur Tursunov" } })];

  beforeEach(() => {
    const base = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
      if (url !== "orders") return base(url, config);
      const status = config?.params?.status as string[];
      const rows = status.length === 2 ? [...PENDING, ...COURIER] : status[0] === "received" ? PENDING : COURIER;
      return Promise.resolve({ data: { data: rows, total: rows.length, page: 1, limit: 10 } });
    });
  });

  const ordersCalls = () =>
    mocks.get.mock.calls.filter(([url]) => url === "orders").map(([, config]) => (config as { params: Record<string, unknown> }).params);

  it("fulfillment_source=WAREHOUSE bilan so'raladi; chip sonlari, holat belgilari, kuryer va pastki xulosa", async () => {
    renderAs("manager", "31", "REGIONAL");
    const card = (await screen.findByRole("heading", { name: "Ombordan ketadigan buyurtmalar" })).closest("section") as HTMLElement;
    const table = await within(card).findByRole("table", { name: "Ombordan ketadigan buyurtmalar" });
    expect(ordersCalls()).toContainEqual({ fulfillment_source: "WAREHOUSE", status: ["received", "waiting"], page: 1, limit: 10 });
    expect(within(table).getByRole("link", { name: "№10244" })).toHaveAttribute("href", "/orders/edit/10244");
    expect(within(table).getAllByText("Kuryerga berilmagan")).toHaveLength(2);
    expect(within(table).getByText("Jasur Tursunov")).toBeInTheDocument();
    expect(within(table).getAllByText("Simsiz quloqchin × 1").length).toBe(3);
    expect(await within(card).findByRole("button", { name: /Barchasi\s*3/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(card).getByRole("button", { name: /Kuryerda\s*1/ })).toBeInTheDocument();
    expect(within(card).getByText("3 ta buyurtma · 2 tasi kuryerga berilmagan")).toBeInTheDocument();
    // REGIONAL menejer — «Kuryerga biriktirish» (`/dispatch`).
    expect(within(card).getByRole("link", { name: "Kuryerga biriktirish" })).toHaveAttribute("href", "/dispatch");
  });

  it("«Kuryerda» chipi — status=waiting; qidiruv `search` bilan", async () => {
    const user = userEvent.setup();
    renderAs("manager", "31", "REGIONAL");
    const card = (await screen.findByRole("heading", { name: "Ombordan ketadigan buyurtmalar" })).closest("section") as HTMLElement;
    await user.click(await within(card).findByRole("button", { name: /Kuryerda/ }));
    await waitFor(() =>
      expect(ordersCalls()).toContainEqual({ fulfillment_source: "WAREHOUSE", status: ["waiting"], page: 1, limit: 10 }),
    );
    await user.type(within(card).getByRole("searchbox", { name: "Ombordan ketadigan buyurtmalarni qidirish" }), "№10237{Enter}");
    await waitFor(() =>
      expect(ordersCalls()).toContainEqual({ fulfillment_source: "WAREHOUSE", search: "10237", status: ["waiting"], page: 1, limit: 10 }),
    );
  });

  it("bo'sh — «Ombordan ketadigan buyurtma yo'q»; dispatch qobiliyatisiz filialda «Kuryerga biriktirish» yo'q", async () => {
    const base = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation((url: string, config?: unknown) =>
      url === "orders" ? Promise.resolve({ data: { data: [], total: 0 } }) : base(url, config),
    );
    renderAs("manager", "31");
    expect(await screen.findByText("Ombordan ketadigan buyurtma yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Kuryerga biriktirish" })).not.toBeInTheDocument();
  });
});

describe("Ombor tafsiloti — Markaziy ombor (Pa1KaXmj; maket yo'q — eng yaqini superadmin-warehouse-detail)", () => {
  const hqDetail = () =>
    rawWarehouse({
      name: "Markaziy ombor",
      kind: "HQ",
      branch_id: "1",
      branch: { id: "1", name: "Toshkent HQ", type: "HQ", status: "active", address: null },
      region: null,
      manager_user_id: null,
      manager: null,
      movements_count: 86,
    });

  it("«Markaziy» belgisi, «Markaziy ombor · HQ», «Mas'ul: belgilanmagan», vaqtinchalik izoh; kirim ishlaydi", async () => {
    detail = hqDetail();
    renderAs("superadmin");
    const heading = await screen.findByRole("heading", { level: 1, name: "Markaziy ombor" });
    const header = heading.closest("header")!;
    expect(within(header).getByText("Markaziy")).toBeInTheDocument();
    expect(within(header).getByText("Faol")).toBeInTheDocument();
    expect(within(header).getByText("Markaziy ombor · HQ")).toBeInTheDocument();
    expect(within(header).getByText("Mas'ul: belgilanmagan")).toBeInTheDocument();
    expect(within(header).queryByText(/filial menejeri/)).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Markaziy ombor qoldig'i buyurtmalarga keyingi bosqichda ulanadi");
    // Kirim, inventarizatsiya, to'xtatish — o'zgarishsiz (SA/ADMIN).
    expect(screen.getByRole("button", { name: "Mahsulot qo'shish" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Ombor amallari/ })).toBeInTheDocument();
  });

  it("registratorda ham belgi va izoh (faqat ko'rish)", async () => {
    detail = hqDetail();
    renderAs("registrator");
    expect(await screen.findByRole("heading", { level: 1, name: "Markaziy ombor" })).toBeInTheDocument();
    expect(screen.getByText("Markaziy ombor · HQ")).toBeInTheDocument();
    expect(screen.getByText(/Markaziy ombor qoldig'i buyurtmalarga keyingi bosqichda ulanadi/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mahsulot qo'shish" })).not.toBeInTheDocument();
  });

  it("viloyat omborida «Markaziy» belgisi va izoh yo'q", async () => {
    renderAs("admin");
    const heading = await screen.findByRole("heading", { level: 1, name: "Samarqand filiali ombori" });
    expect(within(heading.closest("header")!).queryByText("Markaziy")).not.toBeInTheDocument();
    expect(screen.queryByText(/keyingi bosqichda ulanadi/)).not.toBeInTheDocument();
    expect(screen.queryByText("Mas'ul: belgilanmagan")).not.toBeInTheDocument();
  });
});

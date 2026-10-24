import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import { rawWarehouse } from "../../test/warehouseFixtures";
import WarehousesPage from "./index";

/**
 * «Omborlar» — `/warehouses` (yXC91RRx; maketlar `superadmin-warehouse-list`, `superadmin-warehouse-create-dialog`):
 * haqiqiy UI orqali, API — `shared/api/api` mock'i. Menejer — o'z omboriga yo'naltiriladi.
 */

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const PAUSED = rawWarehouse({
  id: "6",
  name: "Urgut filiali ombori",
  status: "PAUSED",
  paused_at: "2026-10-20T12:30:00Z",
  branch_id: "16",
  branch: { id: "16", name: "Urgut filiali", type: "REGIONAL" },
  summary: { positions: 5, markets: 2, on_hand: 96, reserved: 0, available: 96, reserved_orders: 0, low_count: 0, out_count: 0 },
});
const LIST = {
  data: [rawWarehouse(), PAUSED],
  total: 2,
  page: 1,
  limit: 20,
  counts: { all: 2, active: 1, paused: 1 },
  summary: { warehouses: 2, active: 1, paused: 1, positions: 17, on_hand: 582, reserved: 38, available: 544, reserved_orders: 14, low_count: 2, out_count: 1 },
};
const DESTINATIONS = {
  statusCode: 200,
  data: [
    { id: "20", name: "Qarshi filiali", type: "REGIONAL", status: "active", region: { id: "9", name: "Qashqadaryo viloyati" }, manager: { id: "40", name: "Javlon Hamroyev" } },
    // Ombori bor filial — ro'yxatda chiqmaydi.
    { id: "11", name: "Samarqand filiali", type: "REGIONAL", status: "active", region: { id: "7", name: "Samarqand viloyati" } },
  ],
};

/** `GET /branches/:id/users` (branch.user.find_by_branch): mas'ul tanlovida faqat MANAGER rolidagilar. */
const BRANCH_USERS = {
  statusCode: 200,
  data: [
    { id: "500", user_id: "40", role: "MANAGER", user: { id: "40", name: "Javlon Hamroyev", phone_number: "+998915071244" } },
    { id: "501", user_id: "41", role: "MANAGER", user: { id: "41", name: "Sardor Nazarov", phone_number: "+998935071255" } },
    { id: "502", user_id: "52", role: "COURIER", user: { id: "52", name: "Kuryer Ali", phone_number: "+998905550011" } },
  ],
};

let list: unknown = LIST;

beforeEach(() => {
  list = LIST;
  mocks.get.mockReset().mockImplementation((url: string) => {
    if (url === "warehouses") return Promise.resolve({ data: list });
    if (url === "region") return Promise.resolve({ data: { data: [{ id: "7", name: "Samarqand viloyati" }] } });
    if (url === "branches/dispatch-destinations") return Promise.resolve({ data: DESTINATIONS });
    if (url === "branches/20/users") return Promise.resolve({ data: BRANCH_USERS });
    return Promise.reject(new Error(`kutilmagan: ${url}`));
  });
  mocks.post.mockReset().mockResolvedValue({ data: rawWarehouse({ id: "9", name: "Qarshi filiali ombori" }) });
});

const renderAs = (role: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/warehouses" element={<WarehousesPage />} />
      <Route path="/warehouses/:id" element={<p>Tafsilot sahifasi</p>} />
    </Routes>,
    { route: "/warehouses", preloadedState: { role: { id: "1", role, region: null, name: role } } as never },
  );

const lastListParams = () =>
  (mocks.get.mock.calls.filter(([url]) => url === "warehouses").at(-1)?.[1] as { params: Record<string, unknown> }).params;

describe("Omborlar ro'yxati (superadmin, admin)", () => {
  it("KPI, holat chiplari sonlari, jadval qatorlari va pastki xulosa", async () => {
    renderAs("superadmin");
    expect(await screen.findByRole("heading", { level: 1, name: "Omborlar" })).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: "Omborlar" });
    expect(within(table).getByRole("link", { name: "Samarqand filiali ombori" })).toHaveAttribute("href", "/warehouses/3");
    expect(within(table).getAllByText("Dilshod Usmonov").length).toBeGreaterThan(0);
    expect(within(table).getByText("1 tasi tugagan")).toBeInTheDocument();
    expect(within(table).getByText("Ombor to'xtatildi")).toBeInTheDocument();
    expect(within(table).getByText("To'xtatilgan")).toBeInTheDocument();
    expect(screen.getByText("582")).toBeInTheDocument();
    expect(screen.getByText("1 ta faol · 1 ta to'xtatilgan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Faol\s*1/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("2 ta ombor · 1 ta faol · 1 ta to'xtatilgan")).toBeInTheDocument();
  });

  it("holat chipi va qidiruv so'rovga yoziladi (sahifa 1)", async () => {
    const user = userEvent.setup();
    renderAs("admin");
    await screen.findByRole("table", { name: "Omborlar" });
    await user.click(screen.getByRole("button", { name: /To'xtatilgan\s*1/ }));
    await waitFor(() => expect(lastListParams()).toMatchObject({ status: "PAUSED", page: 1 }));
    await user.type(screen.getByRole("searchbox", { name: /Omborlarni nomi/ }), "Urgut{Enter}");
    await waitFor(() => expect(lastListParams()).toMatchObject({ status: "PAUSED", search: "Urgut" }));
  });

  it("ombor yo'q — bo'sh holat ichida «Ombor ochish»", async () => {
    list = { ...LIST, data: [], total: 0, counts: { all: 0, active: 0, paused: 0 }, summary: { ...LIST.summary, warehouses: 0 } };
    renderAs("superadmin");
    expect(await screen.findByText("Hali ombor yo'q")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Ombor ochish" })).toHaveLength(1);
  });

  it("xato — «Omborlarni yuklab bo'lmadi» + «Qayta urinish»", async () => {
    mocks.get.mockImplementation((url: string) =>
      url === "warehouses" ? Promise.reject(Object.assign(new Error("x"), { response: { status: 500 } })) : Promise.resolve({ data: { data: [] } }),
    );
    renderAs("superadmin");
    expect(await screen.findByText("Omborlarni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
  });
});

describe("«Ombor ochish» oynasi", () => {
  it("faqat ombori yo'q filiallar; nom taklifi; mas'ul tanlanmasa — yuborilmaydi (avtomatik); POST va tafsilotga o'tish", async () => {
    const user = userEvent.setup();
    renderAs("superadmin");
    await screen.findByRole("table", { name: "Omborlar" });
    await user.click(screen.getByRole("button", { name: "Ombor ochish" }));
    const dialog = await screen.findByRole("dialog", { name: "Ombor ochish" });
    await user.click(within(dialog).getByRole("combobox", { name: /Filial/ }));
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Qarshi filiali · Qashqadaryo viloyati"]);
    await user.click(options[0]);
    expect(within(dialog).getByRole("textbox", { name: /Ombor nomi/ })).toHaveValue("Qarshi filiali ombori");
    // XtcEyQjb: «Mas'ul xodim» ixtiyoriy — izoh «Tanlanmasa — filial menejeri avtomatik», namunada avtomatik menejer.
    const manager = within(dialog).getByRole("combobox", { name: /Mas'ul xodim/ });
    expect(manager).toHaveTextContent("Avtomatik — Javlon Hamroyev");
    expect(within(dialog).getByText("Tanlanmasa — filial menejeri avtomatik")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Ombor ochish" }));

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("warehouses", {
        branch_id: "20",
        name: "Qarshi filiali ombori",
        low_stock_default: 5,
      }),
    );
    expect(await screen.findByText("Tafsilot sahifasi")).toBeInTheDocument();
    expect(await screen.findByText("Ombor ochildi")).toBeInTheDocument();
  });

  it("XtcEyQjb: mas'ul — faqat filial menejerlari; tanlangani manager_user_id bilan ketadi", async () => {
    const user = userEvent.setup();
    renderAs("admin");
    await screen.findByRole("table", { name: "Omborlar" });
    await user.click(screen.getByRole("button", { name: "Ombor ochish" }));
    const dialog = await screen.findByRole("dialog", { name: "Ombor ochish" });
    await user.click(within(dialog).getByRole("combobox", { name: /Filial/ }));
    await user.click(await screen.findByRole("option", { name: /Qarshi filiali/ }));
    await user.click(within(dialog).getByRole("combobox", { name: /Mas'ul xodim/ }));
    const managers = await screen.findAllByRole("option");
    expect(managers.map((option) => option.textContent)).toEqual(["Javlon Hamroyev", "Sardor Nazarov"]);
    await user.click(screen.getByRole("option", { name: "Sardor Nazarov" }));
    await user.click(within(dialog).getByRole("button", { name: "Ombor ochish" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("warehouses", expect.objectContaining({ branch_id: "20", manager_user_id: "41" })),
    );
  });

  it("filialsiz yuborilmaydi; 409 — «Bu filialda ombor allaqachon bor»", async () => {
    mocks.post.mockRejectedValueOnce(Object.assign(new Error("Conflict"), { response: { status: 409, data: {} } }));
    const user = userEvent.setup();
    renderAs("admin");
    await screen.findByRole("table", { name: "Omborlar" });
    await user.click(screen.getByRole("button", { name: "Ombor ochish" }));
    const dialog = await screen.findByRole("dialog", { name: "Ombor ochish" });
    await user.click(within(dialog).getByRole("button", { name: "Ombor ochish" }));
    expect(await within(dialog).findByText("Filialni tanlang")).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("combobox", { name: /Filial/ }));
    await user.click(await screen.findByRole("option", { name: /Qarshi filiali/ }));
    await user.click(within(dialog).getByRole("button", { name: "Ombor ochish" }));
    expect(await within(dialog).findByText("Bu filialda ombor allaqachon bor")).toBeInTheDocument();
  });
});

describe("registrator — faqat ko'rish (XtcEyQjb)", () => {
  it("hamma omborlar ro'yxati, «Ombor ochish» yo'q", async () => {
    renderAs("registrator");
    const table = await screen.findByRole("table", { name: "Omborlar" });
    expect(within(table).getByRole("link", { name: "Samarqand filiali ombori" })).toHaveAttribute("href", "/warehouses/3");
    expect(screen.queryByRole("button", { name: "Ombor ochish" })).not.toBeInTheDocument();
    // Menejer yo'naltiruvi emas — ro'yxat so'rovi sahifalash bilan.
    expect(lastListParams()).toMatchObject({ page: 1, limit: 20 });
  });

  it("ombor yo'q — bo'sh holatda ham «Ombor ochish» yo'q", async () => {
    list = { ...LIST, data: [], total: 0, counts: { all: 0, active: 0, paused: 0 }, summary: { ...LIST.summary, warehouses: 0 } };
    renderAs("registrator");
    expect(await screen.findByText("Hali ombor yo'q")).toBeInTheDocument();
    expect(screen.getByText(/admin tomonidan ochiladi/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ombor ochish" })).not.toBeInTheDocument();
  });
});

describe("filial menejeri", () => {
  it("o'z filiali omboriga yo'naltiriladi", async () => {
    list = { ...LIST, data: [PAUSED], total: 1 };
    renderAs("manager");
    expect(await screen.findByText("Tafsilot sahifasi")).toBeInTheDocument();
    expect((mocks.get.mock.calls.find(([url]) => url === "warehouses")?.[1] as { params: object }).params).toEqual({ limit: 1 });
  });

  it("filialda ombor yo'q — «Filialingizda ombor yo'q»", async () => {
    list = { ...LIST, data: [], total: 0 };
    renderAs("manager");
    expect(await screen.findByText("Filialingizda ombor yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ombor ochish" })).not.toBeInTheDocument();
  });
});

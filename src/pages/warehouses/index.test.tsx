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

describe("Markaziy ombor (Pa1KaXmj; maket yo'q — eng yaqini superadmin-warehouse-list / -create-dialog)", () => {
  /** `GET /branches/hq` — gateway o'rami bilan (oyna o'ramsizini ham o'qiydi — `branchApi.test.ts`). */
  const HQ_BRANCH = {
    statusCode: 200,
    data: { id: "1", name: "Toshkent HQ", code: "HQ", type: "HQ", status: "active", address: "Toshkent sh., Chilonzor", region_id: null, region: null },
  };
  const HQ_WAREHOUSE = rawWarehouse({
    id: "12",
    name: "Markaziy ombor",
    kind: "HQ",
    branch_id: "1",
    branch: { id: "1", name: "Toshkent HQ", type: "HQ", status: "active", address: null },
    region: null,
    manager_user_id: null,
    manager: null,
    last_movement: null,
  });

  let hqResponse: () => Promise<unknown>;

  beforeEach(() => {
    hqResponse = () => Promise.resolve({ data: HQ_BRANCH });
    const base = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation((url: string, config?: unknown) =>
      url === "branches/hq" ? hqResponse() : base(url, config),
    );
  });

  const openDialog = async () => {
    const user = userEvent.setup();
    renderAs("superadmin");
    await screen.findByRole("table", { name: "Omborlar" });
    await user.click(screen.getByRole("button", { name: "Ombor ochish" }));
    const dialog = await screen.findByRole("dialog", { name: "Ombor ochish" });
    await user.click(within(dialog).getByRole("combobox", { name: /Filial/ }));
    return { user, dialog };
  };

  it("oynada HQ birinchi — «Markaziy ombor · Toshkent HQ», so'ng viloyat filiallari", async () => {
    const { dialog } = await openDialog();
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Markaziy ombor · Toshkent HQ",
      "Qarshi filiali · Qashqadaryo viloyati",
    ]);
    expect(within(dialog).getByText("Ro'yxatda faqat ombori yo'q filiallar: HQ (markaziy ombor) va viloyat filiallari")).toBeInTheDocument();
  });

  it("HQ tanlansa: nom «Markaziy ombor», mas'ul — «Belgilanmaydi» + izoh; POST'da manager_user_id yo'q", async () => {
    const { user, dialog } = await openDialog();
    await user.click(await screen.findByRole("option", { name: "Markaziy ombor · Toshkent HQ" }));
    expect(within(dialog).getByRole("textbox", { name: /Ombor nomi/ })).toHaveValue("Markaziy ombor");
    // Mas'ul — tanlov emas, faqat o'qiladigan maydon (maketdagi qulf); menejerlar so'ralmaydi.
    expect(within(dialog).queryByRole("combobox", { name: /Mas'ul xodim/ })).not.toBeInTheDocument();
    const manager = within(dialog).getByRole("textbox", { name: /Mas'ul xodim/ });
    expect(manager).toHaveValue("Belgilanmaydi");
    expect(manager).toHaveAttribute("readonly");
    expect(within(dialog).getByText("Markaziy omborda menejer yo'q — mas'ul belgilanmaydi")).toBeInTheDocument();
    expect(within(dialog).getByText(/Markaziy ombor qoldig'i buyurtmalarga keyingi bosqichda ulanadi/)).toBeInTheDocument();
    expect(mocks.get.mock.calls.some(([url]) => String(url).startsWith("branches/1/"))).toBe(false);

    await user.click(within(dialog).getByRole("button", { name: "Ombor ochish" }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect(mocks.post).toHaveBeenCalledWith("warehouses", { branch_id: "1", name: "Markaziy ombor", low_stock_default: 5 });
    expect(await screen.findByText("Tafsilot sahifasi")).toBeInTheDocument();
  });

  it("viloyat filialiga qaytsa — mas'ul tanlovi va «<filial> ombori» taklifi qaytadi", async () => {
    const { user, dialog } = await openDialog();
    await user.click(await screen.findByRole("option", { name: "Markaziy ombor · Toshkent HQ" }));
    await user.click(within(dialog).getByRole("combobox", { name: /Filial/ }));
    await user.click(await screen.findByRole("option", { name: /Qarshi filiali/ }));
    expect(within(dialog).getByRole("textbox", { name: /Ombor nomi/ })).toHaveValue("Qarshi filiali ombori");
    expect(within(dialog).getByRole("combobox", { name: /Mas'ul xodim/ })).toHaveTextContent("Avtomatik — Javlon Hamroyev");
    expect(within(dialog).queryByText("Markaziy omborda menejer yo'q — mas'ul belgilanmaydi")).not.toBeInTheDocument();
  });

  it("Markaziy ombor allaqachon ochilgan — HQ ro'yxatda yo'q", async () => {
    list = { ...LIST, data: [rawWarehouse(), PAUSED, HQ_WAREHOUSE], total: 3 };
    await openDialog();
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Qarshi filiali · Qashqadaryo viloyati"]);
  });

  it("`GET /branches/hq` 404 (yoki xato) — oyna avvalgidek, faqat viloyat filiallari", async () => {
    hqResponse = () => Promise.reject(Object.assign(new Error("Not Found"), { response: { status: 404, data: {} } }));
    const { user, dialog } = await openDialog();
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Qarshi filiali · Qashqadaryo viloyati"]);
    await user.click(options[0]);
    await user.click(within(dialog).getByRole("button", { name: "Ombor ochish" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("warehouses", { branch_id: "20", name: "Qarshi filiali ombori", low_stock_default: 5 }),
    );
  });

  it("jadvalda Markaziy ombor qatori tepada, «Markaziy» belgisi, viloyati «—»", async () => {
    list = { ...LIST, data: [rawWarehouse(), PAUSED, HQ_WAREHOUSE], total: 3 };
    renderAs("admin");
    const table = await screen.findByRole("table", { name: "Omborlar" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByRole("link", { name: "Markaziy ombor" })).toHaveAttribute("href", "/warehouses/12");
    expect(within(rows[0]).getByText("Markaziy")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Markaziy ombor — viloyatga bog'lanmagan")).toBeInTheDocument();
    expect(within(rows[0]).queryByText(/Samarqand viloyati/)).not.toBeInTheDocument();
    // Viloyat omborlari — backend tartibida, belgisiz.
    expect(within(rows[1]).getByRole("link", { name: "Samarqand filiali ombori" })).toBeInTheDocument();
    expect(within(rows[1]).queryByText("Markaziy")).not.toBeInTheDocument();
    expect(within(rows[2]).getByRole("link", { name: "Urgut filiali ombori" })).toBeInTheDocument();
  });
});

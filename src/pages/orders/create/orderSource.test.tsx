import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { aiApiGet } from "../../../test/aiOrderFixtures";

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { post: mocks.post, get: mocks.get, patch: vi.fn(), delete: vi.fn() },
}));

import OrderCreate from "./index";

/**
 * 6kHnNH9j — «Qayerdan yuboriladi» (maket `superadmin-neworders-create-manual-source`): `POST /warehouses/resolve-source`
 * bilan oldindan ko'rish, «Omborda: N», yetmasa — sababi, to'xtatilgan ombor, HQ'ni majburan tanlash → `fulfillment`.
 * Rollar: superadmin, admin, registrator; market — `can_order_from_warehouse` bilan; menejer — yo'q.
 */

const MARKETS = [{ id: 3, name: "Baraka Shop", phone_number: "+998903152241", status: "active" }];
const WAREHOUSE = {
  id: "3",
  name: "Samarqand filiali ombori",
  status: "ACTIVE",
  branch_id: "11",
  branch_name: "Samarqand filiali",
  region_id: "12",
  region_name: "Samarqand viloyati",
};
const OK = {
  source: "WAREHOUSE",
  reason: "OK",
  region_id: "12",
  warehouse: WAREHOUSE,
  items: [{ product_id: "501", name: "Telefon ushlagich", required: 1, available: 30, enough: true }],
  shortages: [],
};
const SHORT = {
  source: "HQ",
  reason: "INSUFFICIENT_STOCK",
  region_id: "12",
  warehouse: WAREHOUSE,
  items: [{ product_id: "501", name: "Telefon ushlagich", required: 1, available: 0, enough: false }],
  shortages: [{ product_id: "501", name: "Telefon ushlagich", required: 1, available: 0 }],
};
const PAUSED = {
  source: "HQ",
  reason: "WAREHOUSE_PAUSED",
  region_id: "12",
  warehouse: { ...WAREHOUSE, name: "Urgut filiali ombori", status: "PAUSED", branch_name: "Urgut filiali" },
  items: [],
  shortages: [],
};

let resolveReply: unknown = OK;

const AVAILABILITY = { region_id: "12", warehouse: WAREHOUSE, items: [{ product_id: "501", on_hand: 31, reserved: 1, available: 30 }] };

const staffGet = (url: string) =>
  url === "markets"
    ? Promise.resolve({ data: { statusCode: 200, message: "ok", data: MARKETS } })
    : url === "warehouses/availability"
      ? Promise.resolve({ data: AVAILABILITY })
      : aiApiGet(url);

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  resolveReply = OK;
  mocks.get.mockReset().mockImplementation(staffGet);
  mocks.post.mockReset().mockImplementation((url: string) =>
    url === "warehouses/resolve-source"
      ? Promise.resolve({ data: resolveReply })
      : Promise.resolve({ data: { statusCode: 201, data: { id: "o1" } } }),
  );
});

const stateOf = (role: string, user: Record<string, unknown> = {}) =>
  ({
    role: { id: "1", role, region: null, name: role === "market" ? "Baraka Shop" : "Xodim" },
    user: {
      user: { id: "1", role, name: role, ...user },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const pickOption = async (user: ReturnType<typeof userEvent.setup>, comboboxId: string, option: string) => {
  const combobox = document.getElementById(comboboxId) as HTMLElement;
  await waitFor(() => expect(combobox).toBeEnabled());
  await user.click(combobox);
  await user.click(await screen.findByRole("option", { name: option }));
};

/** Xodim: market tanlanadi va 2-qadamga o'tiladi. */
const toStep2 = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /^Market/ }));
  const dialog = await screen.findByRole("dialog", { name: "Market tanlash" });
  await user.click(await within(dialog).findByRole("option", { name: /Baraka Shop/ }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Market tanlash" })).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Keyingi" }));
};

const fillAreaAndProduct = async (user: ReturnType<typeof userEvent.setup>) => {
  await pickOption(user, "customer.region_id", "Samarqand viloyati • 1718");
  await pickOption(user, "customer.district_id", "Urgut • 1718236");
  await user.click(await screen.findByRole("button", { name: /Telefon ushlagich/ }));
};

const sourceCard = () => screen.getByRole("heading", { name: "Qayerdan yuboriladi" }).closest("section") as HTMLElement;
const resolveCalls = () => mocks.post.mock.calls.filter(([url]) => url === "warehouses/resolve-source");

describe("«Qayerdan yuboriladi» — superadmin", () => {
  it("oldindan ko'rish: so'rov tanasi, ombor «Avtomatik tanlandi», «Omborda: 30», xulosada «Qayerdan»; HQ tanlansa fulfillment=hq", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: stateOf("superadmin") });
    await toStep2(user);
    expect(within(sourceCard()).getByText(/Tuman va mahsulot tanlangach/)).toBeInTheDocument();
    await fillAreaAndProduct(user);

    expect(await within(sourceCard()).findByText("Samarqand filiali ombori")).toBeInTheDocument();
    expect(resolveCalls().at(-1)?.[1]).toEqual({
      district_id: "201",
      region_id: "12",
      market_id: "3",
      items: [{ product_id: "501", quantity: 1 }],
    });
    expect(within(sourceCard()).getByText("Urgut · Samarqand filiali hududi")).toBeInTheDocument();
    expect(within(sourceCard()).getByText("Avtomatik tanlandi")).toBeInTheDocument();
    const warehouseRadio = within(sourceCard()).getByRole("radio", { name: /Samarqand filiali ombori/ });
    expect(warehouseRadio).toBeChecked();
    expect(within(sourceCard()).getByText(/Yaratilganda 1 dona omborda band qilinadi/)).toBeInTheDocument();
    const stock = screen.getByTestId("item-warehouse-stock");
    expect(stock).toHaveTextContent("Omborda: 30");
    expect(stock).toHaveAttribute("title", "Mavjud dona — Samarqand filiali ombori");
    expect(screen.getByTestId("summary-source")).toHaveTextContent("Samarqand filiali ombori");

    await user.click(within(sourceCard()).getByRole("radio", { name: /Toshkent HQ/ }));
    expect(within(sourceCard()).getByRole("radio", { name: /Toshkent HQ/ })).toBeChecked();
    expect(screen.getByTestId("summary-source")).toHaveTextContent("Toshkent HQ");
    expect(within(sourceCard()).getByText(/Omborda band qilinmaydi/)).toBeInTheDocument();

    await user.type(screen.getByRole("combobox", { name: /^Telefon/ }), "901234567");
    await user.type(screen.getByLabelText(/^Mijoz ismi/), "Aliyev Vali");
    await user.click(screen.getByRole("button", { name: "Buyurtma yaratish" }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("orders", expect.objectContaining({ fulfillment: "hq" })));
  });

  it("katalogda «Omborda: 30» / «Omborda yo'q» — GET /warehouses/availability (tuman, market)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: stateOf("superadmin") });
    await toStep2(user);
    await pickOption(user, "customer.region_id", "Samarqand viloyati • 1718");
    await pickOption(user, "customer.district_id", "Urgut • 1718236");
    const catalog = await screen.findByRole("list", { name: /katalogi/ });
    await waitFor(() => expect(within(catalog).getAllByTestId("catalog-warehouse-stock")).toHaveLength(2));
    expect(within(catalog).getByRole("button", { name: /Telefon ushlagich/ })).toHaveTextContent("Omborda: 30");
    expect(within(catalog).getByRole("button", { name: /Avto changyutgich/ })).toHaveTextContent("Omborda yo'q");
    const call = mocks.get.mock.calls.find(([url]) => url === "warehouses/availability");
    expect(call?.[1]).toEqual({ params: { district_id: "201", region_id: "12", market_id: "3" } });
  });

  it("yaratilganda tanlov o'zgarmasa — fulfillment=auto", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: stateOf("admin") });
    await toStep2(user);
    await fillAreaAndProduct(user);
    await within(sourceCard()).findByText("Samarqand filiali ombori");
    await user.type(screen.getByRole("combobox", { name: /^Telefon/ }), "901234567");
    await user.type(screen.getByLabelText(/^Mijoz ismi/), "Aliyev Vali");
    await user.click(screen.getByRole("button", { name: "Buyurtma yaratish" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("orders", expect.objectContaining({ fulfillment: "auto", market_id: "3" })),
    );
  });

  it("yetmaydi — kartalar o'rnida «Omborda yetmaydi — butun buyurtma HQ'dan ketadi» va sababi; «Omborda: 0» ogohlantirish tonida", async () => {
    resolveReply = SHORT;
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: stateOf("registrator", { branch: { id: "1", type: "HQ" } }) });
    await toStep2(user);
    await fillAreaAndProduct(user);
    expect(await within(sourceCard()).findByText("Omborda yetmaydi — butun buyurtma HQ'dan ketadi")).toBeInTheDocument();
    expect(within(sourceCard()).getByText(/Telefon ushlagich: kerak 1, bor 0/)).toBeInTheDocument();
    expect(within(sourceCard()).queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByTestId("item-warehouse-stock")).toHaveTextContent("Omborda: 0");
    expect(screen.getByTestId("summary-source")).toHaveTextContent("Toshkent HQ");
  });

  it("tuman ombori to'xtatilgan — o'chiq karta «To'xtatilgan», HQ tanlangan", async () => {
    resolveReply = PAUSED;
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: stateOf("superadmin") });
    await toStep2(user);
    await fillAreaAndProduct(user);
    const paused = await within(sourceCard()).findByRole("radio", { name: /Urgut filiali ombori/ });
    expect(paused).toBeDisabled();
    expect(within(sourceCard()).getByText("To'xtatilgan")).toBeInTheDocument();
    expect(within(sourceCard()).getByText("Yangi buyurtma tushmaydi — buyurtma HQ'dan ketadi")).toBeInTheDocument();
    expect(within(sourceCard()).getByRole("radio", { name: /Toshkent HQ/ })).toBeChecked();
  });

  it("katalogda yo'q mahsulot — so'rovsiz «butun buyurtma HQ'dan ketadi»", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: stateOf("superadmin") });
    await toStep2(user);
    expect(screen.getByText("Omborda yo'q mahsulot qo'shilsa, butun buyurtma HQ'dan ketadi")).toBeInTheDocument();
    await pickOption(user, "customer.region_id", "Samarqand viloyati • 1718");
    await pickOption(user, "customer.district_id", "Urgut • 1718236");
    await user.type(screen.getByPlaceholderText("Mahsulot nomi"), "Qo'lda mahsulot{Enter}");
    expect(await within(sourceCard()).findByText("Katalogda yo'q mahsulot bor — butun buyurtma HQ'dan ketadi")).toBeInTheDocument();
    expect(resolveCalls()).toHaveLength(0);
  });

  it("so'rov yiqilsa — «Manbani aniqlab bo'lmadi …» + «Qayta urinish»", async () => {
    mocks.post.mockImplementation((url: string) =>
      url === "warehouses/resolve-source"
        ? Promise.reject(Object.assign(new Error("boom"), { response: { status: 500 } }))
        : Promise.resolve({ data: {} }),
    );
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: stateOf("superadmin") });
    await toStep2(user);
    await fillAreaAndProduct(user);
    expect(await within(sourceCard()).findByText(/Manbani aniqlab bo'lmadi/)).toBeInTheDocument();
    const before = resolveCalls().length;
    await user.click(within(sourceCard()).getByRole("button", { name: "Qayta urinish" }));
    await waitFor(() => expect(resolveCalls().length).toBeGreaterThan(before));
  });
});

describe("«Qayerdan yuboriladi» — rollar", () => {
  it("market: kalit o'chiq — blok, «Omborda» va so'rov yo'q; payloadda fulfillment yo'q", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: stateOf("market") });
    await fillAreaAndProduct(user);
    expect(screen.queryByRole("heading", { name: "Qayerdan yuboriladi" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("summary-source")).not.toBeInTheDocument();
    await new Promise((done) => setTimeout(done, 450));
    expect(resolveCalls()).toHaveLength(0);
    expect(mocks.get.mock.calls.some(([url]) => url === "warehouses/availability")).toBe(false);
    expect(screen.queryByTestId("catalog-warehouse-stock")).not.toBeInTheDocument();
  });

  it("market: «Ombordan buyurtma yaratish» yoqilgan — blok bor, so'rovda market_id yo'q (token)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: stateOf("market", { can_order_from_warehouse: true }) });
    await fillAreaAndProduct(user);
    expect(await within(sourceCard()).findByText("Samarqand filiali ombori")).toBeInTheDocument();
    expect(resolveCalls().at(-1)?.[1]).not.toHaveProperty("market_id");
  });

  it("menejer — blok yo'q", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, {
      preloadedState: stateOf("manager", { branch: { id: "1", type: "HYBRID" } }),
    });
    await toStep2(user);
    expect(screen.queryByRole("heading", { name: "Qayerdan yuboriladi" })).not.toBeInTheDocument();
  });
});

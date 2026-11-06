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
import { buildReplaceableParams, formatReplacementDate, REPLACEABLE_LIMIT } from "./ui/ReplacementPicker";

/**
 * lQjt6sKP — «Almashtirish (ixtiyoriy)» (BeePost `create-order/ReplacementPicker`): xulosa kartasida Operator dan
 * keyin, «Buyurtma yaratish» dan oldin; «Almashtirish uchun — eski buyurtmani tanlash» oynasi `GET orders/replaceable`
 * (mijozning / marketning yetkazilgan buyurtmalari, telefon yoki raqam bo'yicha market bo'ylab qidiruv); tanlov —
 * chip va «Bekor qilish»; `POST /orders` → `replaced_order_id`; backend 400 — maydon ostida; market almashsa tozalanadi.
 */

const marketState = { role: { id: "7", role: "market", region: null, name: "Test market" } } as never;
const adminState = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;
const operatorState = {
  role: { id: "42", role: "market_operator", region: null, name: "Dilnoza Karimova" },
  user: {
    user: { id: "42", role: "market_operator", name: "Dilnoza Karimova", market: { id: "37", name: "Baraka Shop", add_order: true } },
    isAuthenticated: true,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
} as never;

const MARKETS = [
  { id: 3, name: "Baraka Shop", phone_number: "+998903152241", status: "active" },
  { id: 4, name: "Nur Elektronika", phone_number: "+998936041872", status: "active" },
];

const SOLD_AT = String(new Date(2026, 9, 6, 12, 30).getTime());
const ROWS = [
  {
    id: "120",
    status: "sold",
    market_id: "3",
    customer_id: "801",
    customer: { id: "801", name: "Ali Valiyev", phone_number: "+998901234567" },
    total_price: 185000,
    where_deliver: "center",
    comment: "Qora rangli, quti bilan",
    sold_at: SOLD_AT,
    createdAt: "2026-10-01T09:00:00.000Z",
    items: [{ product_id: "501", product_name: "Telefon ushlagich", quantity: 2 }],
  },
  {
    id: "98",
    status: "paid",
    market_id: "3",
    customer_id: "802",
    customer: { id: "802", name: "Dilnoza Karimova", phone_number: "+998903456705" },
    total_price: 120000,
    where_deliver: "address",
    comment: null,
    sold_at: null,
    createdAt: "2026-09-30T09:00:00",
    items: [{ product_id: null, product_name: "Avto changyutgich", quantity: 1 }],
  },
];

const SUGGESTION = {
  id: "55",
  name: "Shahnoza Abdullayeva",
  phone_number: "+998903456721",
  extra_number: null,
  address: null,
  region_id: "11",
  district_id: "101",
  orders_count: 4,
  new_orders_count: 0,
  has_new_orders: false,
  new_order_ids: [],
  last_order_at: null,
};

const REPLACEABLE = "orders/replaceable";
const ok = (data: unknown) => Promise.resolve({ data: { statusCode: 200, message: "ok", data } });

/** `q` bo'yicha soxta javob: «zzz» — bo'sh, qolgani — ikkala qator (jami 41 — «aniqroq qidiring»). */
const apiGet = (url: string, config?: { params?: Record<string, unknown> }) => {
  if (url === "markets") return ok(MARKETS);
  if (url === REPLACEABLE) {
    if (config?.params?.q === "zzz") return ok({ items: [], total: 0, page: 1, limit: 30 });
    return ok({ items: ROWS, total: 41, page: 1, limit: 30 });
  }
  if (url === "customers/suggest") return ok([SUGGESTION]);
  if (url === "district/101") return ok({ id: 101, name: "Chilonzor", region_id: 11 });
  return aiApiGet(url);
};

const replaceableCalls = () => mocks.get.mock.calls.filter(([url]) => url === REPLACEABLE);
const lastReplaceableParams = () => replaceableCalls().at(-1)?.[1]?.params as Record<string, unknown> | undefined;
const orderPosts = () => mocks.post.mock.calls.filter(([url]) => url === "orders");
const lastPayload = () => orderPosts().at(-1)?.[1] as Record<string, unknown>;

const aside = () => screen.getByRole("complementary", { name: "Buyurtma xulosasi" });
const trigger = () => within(aside()).findByRole("button", { name: /Almashtirish uchun — eski buyurtmani tanlash/ });
const pickerDialog = () => screen.findByRole("dialog", { name: "Eski buyurtmani tanlash" });
const searchBox = () => screen.getByRole("combobox", { name: "Eski buyurtmani qidirish" });

/** v2 `Select`: ochiladi va portaldagi ro'yxatdan variant tanlanadi. */
const pickOption = async (user: ReturnType<typeof userEvent.setup>, comboboxId: string, option: string) => {
  const combobox = document.getElementById(comboboxId) as HTMLElement;
  await waitFor(() => expect(combobox).toBeEnabled());
  await user.click(combobox);
  await user.click(await screen.findByRole("option", { name: option }));
};

/** Admin: 1-qadamda tanlash oynasidan market, keyin «Keyingi». */
const chooseMarket = async (user: ReturnType<typeof userEvent.setup>, name = "Baraka Shop") => {
  await user.click(screen.getByRole("button", { name: /^Market/ }));
  const dialog = await screen.findByRole("dialog", { name: "Market tanlash" });
  await user.click(await within(dialog).findByRole("option", { name: new RegExp(name) }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Market tanlash" })).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Keyingi" }));
};

/** Yuborishga tayyor buyurtma (summa mahsulot narxidan avtomatik). */
const fillOrder = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole("combobox", { name: /^Telefon/ }), "901234567");
  await user.type(screen.getByLabelText(/^Mijoz ismi/), "Aliyev Vali");
  await pickOption(user, "customer.region_id", "Toshkent shahri • 1726");
  await pickOption(user, "customer.district_id", "Chilonzor • 1726269");
  await user.click(await screen.findByRole("button", { name: /Telefon ushlagich/ }));
  await waitFor(() => expect(within(aside()).getByRole("status")).toHaveTextContent("Buyurtma yuborishga tayyor"));
};

/** Oynani ochib №EL-100120 ni tanlaydi. */
const pickOldOrder = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await trigger());
  const dialog = await pickerDialog();
  await user.click(await within(dialog).findByRole("option", { name: /№EL-100120/ }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Eski buyurtmani tanlash" })).not.toBeInTheDocument());
};

const submit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(within(aside()).getByRole("button", { name: "Buyurtma yaratish" }));
  await waitFor(() => expect(orderPosts()).toHaveLength(1));
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  mocks.get.mockReset();
  mocks.get.mockImplementation(apiGet);
  mocks.post.mockReset();
  mocks.post.mockResolvedValue({ data: { statusCode: 201, data: { id: "o1" } } });
});

describe("buildReplaceableParams", () => {
  const base = { marketId: "3", search: "", customerId: null, phoneDigits: "" };

  it("mijoz yo'q — marketning so'nggilari; `market_id` faqat berilganda", () => {
    expect(buildReplaceableParams(base)).toEqual({ mode: "recent", params: { market_id: "3", limit: REPLACEABLE_LIMIT } });
    expect(buildReplaceableParams({ ...base, marketId: null })).toEqual({ mode: "recent", params: { limit: 30 } });
  });

  it("mavjud mijoz — `customer_id`; to'liq telefon — `q = +998…`; chala telefon — so'nggilar", () => {
    expect(buildReplaceableParams({ ...base, customerId: "55", phoneDigits: "903456721" }).params).toEqual({
      market_id: "3",
      customer_id: "55",
      limit: 30,
    });
    expect(buildReplaceableParams({ ...base, phoneDigits: "901234567" })).toEqual({
      mode: "customer",
      params: { market_id: "3", q: "+998901234567", limit: 30 },
    });
    expect(buildReplaceableParams({ ...base, phoneDigits: "90123" }).mode).toBe("recent");
  });

  it("qidiruv (≥ 2 belgi) mijozdan ustun — market bo'ylab; «EL-…» ichki id; 1 belgi — qidiruv emas", () => {
    expect(buildReplaceableParams({ ...base, customerId: "55", search: " EL-100120 " })).toEqual({
      mode: "search",
      params: { market_id: "3", q: "120", limit: 30 },
    });
    expect(buildReplaceableParams({ ...base, search: "7" }).mode).toBe("recent");
  });

  it("formatReplacementDate: epoch ms matni va ISO → KK.OO.YYYY, bo'sh — «—»", () => {
    expect(formatReplacementDate(SOLD_AT)).toBe("06.10.2026");
    expect(formatReplacementDate("2026-09-30T09:00:00")).toBe("30.09.2026");
    expect(formatReplacementDate(null)).toBe("—");
  });
});

describe("OrderCreate — «Almashtirish (ixtiyoriy)»", () => {
  it("admin: Operator dan keyin, «Buyurtma yaratish» dan oldin; ochilganda shu market buyurtmalari (`market_id`, 30 ta)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);

    const button = await trigger();
    expect(within(aside()).getByText("Almashtirish")).toBeInTheDocument();
    expect(aside()).toHaveTextContent("Almashtirish (ixtiyoriy)");
    expect(aside()).toHaveTextContent(
      "Bu buyurtma avval yetkazilgan buyurtma o'rniga bo'lsa, eskisini tanlang — kuryer yangisini topshirib eskisini qaytarib oladi.",
    );
    const operator = within(aside()).getByLabelText("Operator");
    const create = within(aside()).getByRole("button", { name: "Buyurtma yaratish" });
    expect(operator.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-expanded", "false");
    // Oyna ochilmaguncha so'rov yo'q.
    expect(replaceableCalls()).toHaveLength(0);

    await user.click(button);
    const dialog = await pickerDialog();
    await waitFor(() => expect(lastReplaceableParams()).toEqual({ market_id: "3", limit: 30 }));
    expect(within(dialog).getByTestId("replacement-mode-hint")).toHaveTextContent(
      "Marketning so'nggi yetkazilgan buyurtmalari",
    );
    expect(searchBox()).toHaveAttribute("placeholder", "Telefon yoki buyurtma raqami bo'yicha qidirish...");

    const first = await within(dialog).findByRole("option", { name: /№EL-100120/ });
    expect(first).toHaveTextContent("06.10.2026");
    expect(first).toHaveTextContent("Sotilgan");
    expect(first).toHaveTextContent("Ali Valiyev");
    expect(first).toHaveTextContent("+998 90 123 45 67");
    expect(first).toHaveTextContent("Telefon ushlagich ×2");
    expect(first).toHaveTextContent("185 000 so'm");
    expect(first).toHaveTextContent("Qora rangli, quti bilan");

    const second = within(dialog).getByRole("option", { name: /№EL-100098/ });
    expect(second).toHaveTextContent("To'langan");
    // `sold_at` yo'q — yaratilgan sana.
    expect(second).toHaveTextContent("30.09.2026");
    expect(second).toHaveTextContent("Avto changyutgich ×1");
    expect(within(dialog).getByText("41 tadan 2 tasi ko'rsatildi — aniqroq qidiring")).toBeInTheDocument();
  });

  it("to'liq telefon — shu mijoz (`q = +998…`); qidiruv — market bo'ylab, «EL-…» ichki id; topilmasa — izoh", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);
    await user.type(screen.getByRole("combobox", { name: /^Telefon/ }), "901234567");
    await user.keyboard("{Escape}");

    await user.click(await trigger());
    const dialog = await pickerDialog();
    await waitFor(() => expect(lastReplaceableParams()).toEqual({ market_id: "3", q: "+998901234567", limit: 30 }));
    expect(within(dialog).getByTestId("replacement-mode-hint")).toHaveTextContent("Shu mijozning oldingi buyurtmalari");

    await user.type(searchBox(), "EL-100120");
    await waitFor(() => expect(lastReplaceableParams()).toEqual({ market_id: "3", q: "120", limit: 30 }));
    expect(within(dialog).getByTestId("replacement-mode-hint")).toHaveTextContent("Market bo'ylab qidiruv natijalari");

    await user.clear(searchBox());
    await user.type(searchBox(), "zzz");
    expect(await within(dialog).findByText("Qidiruv bo'yicha yetkazilgan buyurtma topilmadi.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("option")).not.toBeInTheDocument();
  });

  it("tanlansa — chip va xulosa qatori; POST /orders: `replaced_order_id`; muvaffaqiyatdan keyin tozalanadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);
    await fillOrder(user);
    await pickOldOrder(user);

    const chip = within(aside()).getByTestId("replacement-selected");
    expect(chip).toHaveTextContent("Eski №EL-100120 (06.10.2026) — Ali Valiyev almashtirilmoqda");
    expect(within(aside()).getByTestId("summary-replacement")).toHaveTextContent("№EL-100120");
    expect(within(aside()).queryByRole("button", { name: /eski buyurtmani tanlash/ })).not.toBeInTheDocument();

    await submit(user);
    expect(lastPayload()).toMatchObject({ market_id: "3", replaced_order_id: "120" });
    expect(lastPayload()).not.toHaveProperty("replacement");

    // Forma tozalandi — keyingi buyurtma oddiy.
    await waitFor(() => expect(within(aside()).queryByTestId("replacement-selected")).not.toBeInTheDocument());
    expect(await trigger()).toBeInTheDocument();
  });

  it("«Bekor qilish» — tanlov olib tashlanadi, `replaced_order_id` yuborilmaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);
    await fillOrder(user);
    await pickOldOrder(user);

    await user.click(within(aside()).getByRole("button", { name: /Almashtirishni bekor qilish: eski №EL-100120/ }));
    expect(within(aside()).queryByTestId("replacement-selected")).not.toBeInTheDocument();
    expect(within(aside()).queryByTestId("summary-replacement")).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: /eski buyurtmani tanlash/ })));

    await submit(user);
    expect(lastPayload()).not.toHaveProperty("replaced_order_id");
  });

  it("backend 400 (allaqachon almashtirilgan) — matn maydon ostida, tanlash ro'yxati yangilanadi", async () => {
    const message = "Bu buyurtma (#120) allaqachon almashtirishga belgilangan — almashtirish buyurtmasi #130";
    mocks.post.mockRejectedValue({ response: { status: 400, data: { statusCode: 400, message } } });
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);
    await fillOrder(user);
    await pickOldOrder(user);
    const callsBefore = replaceableCalls().length;

    await submit(user);
    expect(lastPayload()).toMatchObject({ replaced_order_id: "120" });
    await waitFor(() => expect(document.getElementById("replacement-error")).toHaveTextContent(message));
    expect(within(aside()).getByTestId("replacement-selected")).toHaveAttribute(
      "aria-describedby",
      "replacement-error",
    );

    // Tanlov bekor qilinsa xato ham yo'qoladi; qayta ochilganda ro'yxat yangidan so'raladi (invalidatsiya).
    await user.click(within(aside()).getByRole("button", { name: /Almashtirishni bekor qilish/ }));
    expect(document.getElementById("replacement-error")).toBeNull();
    await user.click(await trigger());
    await pickerDialog();
    await waitFor(() => expect(replaceableCalls().length).toBeGreaterThan(callsBefore));
  });

  it("market almashsa (Oldingi → boshqa market) — tanlov tozalanadi, ro'yxat yangi market bo'yicha", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);
    await pickOldOrder(user);
    expect(within(aside()).getByTestId("replacement-selected")).toBeInTheDocument();

    await user.click(within(aside()).getByRole("button", { name: "Oldingi" }));
    await chooseMarket(user, "Nur Elektronika");

    expect(await trigger()).toBeInTheDocument();
    expect(within(aside()).queryByTestId("replacement-selected")).not.toBeInTheDocument();
    await user.click(await trigger());
    await pickerDialog();
    await waitFor(() => expect(lastReplaceableParams()).toEqual({ market_id: "4", limit: 30 }));
  });

  it("market roli: `market_id` siz; taklifdan tanlangan mavjud mijoz — `customer_id`", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(screen.getByRole("combobox", { name: /^Telefon/ }), "9034567");
    const list = await screen.findByRole("listbox", { name: "Mijoz takliflari" });
    await user.click(await within(list).findByRole("option", { name: /Shahnoza Abdullayeva/ }));
    await waitFor(() => expect(screen.getByLabelText(/^Mijoz ismi/)).toHaveValue("Shahnoza Abdullayeva"));

    await user.click(await trigger());
    await pickerDialog();
    await waitFor(() => expect(lastReplaceableParams()).toEqual({ customer_id: "55", limit: 30 }));
  });

  it("market operatori: blok bor, so'rov `market_id` siz (server operator marketini o'zi aniqlaydi)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: operatorState });

    await user.click(await trigger());
    await pickerDialog();
    await waitFor(() => expect(lastReplaceableParams()).toEqual({ limit: 30 }));
  });
});

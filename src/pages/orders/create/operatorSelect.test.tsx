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
 * «Operator» tanlovi (ega: «Chekda operator ismi chiqmiyabdi, operatorni tanlash imkoni yo'q»; BeePost `operator_id`):
 * `GET /market-operators/selectable` — xodim tanlagan market (`market_id`) yoki market rolida o'z marketi. Tanlansa
 * `POST /orders` ga `operator_id` + `operator` (ismi); «Tanlanmagan», bo'sh ro'yxat yoki xatoda — faqat erkin matn.
 * Market operatori — o'zgarmagan (o'z ismi, faqat o'qish uchun).
 */

const marketState = {
  role: { id: "7", role: "market", region: null, name: "Test market" },
} as never;
const adminState = {
  role: { id: "1", role: "superadmin", region: null, name: "Admin" },
} as never;
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

const SELECTABLE = "market-operators/selectable";
const ok = (data: unknown) => Promise.resolve({ data: { statusCode: 200, message: "ok", data } });

/** Market → operatorlar (`own` — market roli, `market_id` siz). Test o'rtasida o'zgartirilishi mumkin. */
let operatorsByMarket: Record<string, Array<{ id: number | string; name: string }>>;

const apiGet = (url: string, config?: { params?: { market_id?: string } }) => {
  if (url === "markets") return ok(MARKETS);
  if (url === SELECTABLE) return ok({ items: operatorsByMarket[config?.params?.market_id ?? "own"] ?? [] });
  return aiApiGet(url);
};

const selectableCalls = () => mocks.get.mock.calls.filter(([url]) => url === SELECTABLE);
const orderPosts = () => mocks.post.mock.calls.filter(([url]) => url === "orders");
const lastPayload = () => orderPosts().at(-1)?.[1] as Record<string, unknown>;

const aside = () => screen.getByRole("complementary", { name: "Buyurtma xulosasi" });
const operatorSelect = () => screen.findByRole("combobox", { name: "Operator" });
const freeText = () => screen.queryByLabelText("Ro'yxatda yo'q operator");

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

/** Yuborishga tayyor buyurtma (summa mahsulot narxidan avtomatik — 45 000). */
const fillOrder = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole("combobox", { name: /^Telefon/ }), "901234567");
  await user.type(screen.getByLabelText(/^Mijoz ismi/), "Aliyev Vali");
  await pickOption(user, "customer.region_id", "Toshkent shahri • 1726");
  await pickOption(user, "customer.district_id", "Chilonzor • 1726269");
  await user.click(await screen.findByRole("button", { name: /Telefon ushlagich/ }));
  await waitFor(() => expect(within(aside()).getByRole("status")).toHaveTextContent("Buyurtma yuborishga tayyor"));
};

const submit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(within(aside()).getByRole("button", { name: "Buyurtma yaratish" }));
  await waitFor(() => expect(orderPosts()).toHaveLength(1));
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  operatorsByMarket = {
    "3": [
      { id: 11, name: "Dilnoza Karimova" },
      { id: 12, name: "Bekzod Aliyev" },
    ],
    "4": [{ id: 21, name: "Sardor Nurmatov" }],
    own: [{ id: "31", name: "Kamola Yusupova" }],
  };
  mocks.get.mockReset();
  mocks.get.mockImplementation(apiGet);
  mocks.post.mockReset();
  mocks.post.mockResolvedValue({ data: { statusCode: 201, data: { id: "o1" } } });
});

describe("OrderCreate — «Operator» tanlovi", () => {
  it("admin: tanlangan market operatorlari (`market_id` bilan) — «Tanlanmagan» sukut, ostida «Ro'yxatda yo'q operator»", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);

    const select = await operatorSelect();
    expect(select).toHaveTextContent("Tanlanmagan");
    expect(selectableCalls()).toEqual([[SELECTABLE, { params: { market_id: "3" } }]]);
    expect(freeText()).toHaveAttribute("id", "details.operator");
    expect(freeText()).toHaveAttribute("placeholder", "Operator ismi");

    await user.click(select);
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Tanlanmagan",
      "Dilnoza Karimova",
      "Bekzod Aliyev",
    ]);
  });

  it("operator tanlansa — erkin matn yo'qoladi, izoh chiqadi; POST /orders: `operator_id` + `operator` (ismi)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);
    await operatorSelect();
    await fillOrder(user);

    await pickOption(user, "details.operator_id", "Dilnoza Karimova");

    expect(await operatorSelect()).toHaveTextContent("Dilnoza Karimova");
    expect(freeText()).not.toBeInTheDocument();
    expect(within(aside()).getByText("Buyurtma va komissiya shu operatorga yoziladi")).toBeInTheDocument();

    await submit(user);
    expect(lastPayload()).toMatchObject({ market_id: "3", operator_id: "11", operator: "Dilnoza Karimova" });
  });

  it("market roli: o'z ro'yxati (`market_id` siz); tanlov «Tanlanmagan» ga qaytsa ism tozalanadi, qo'lda yozilgani ketadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await operatorSelect();
    expect(selectableCalls()).toEqual([[SELECTABLE, { params: undefined }]]);
    await fillOrder(user);

    await pickOption(user, "details.operator_id", "Kamola Yusupova");
    expect(freeText()).not.toBeInTheDocument();
    await pickOption(user, "details.operator_id", "Tanlanmagan");
    expect(freeText()).toHaveValue("");

    await user.type(freeText() as HTMLElement, "Shahzoda");
    await submit(user);
    expect(lastPayload()).toMatchObject({ operator: "Shahzoda" });
    expect(lastPayload()).not.toHaveProperty("operator_id");
    expect(lastPayload()).not.toHaveProperty("market_id");
  });

  it("market almashsa operator tanlovi va undan olingan ism tozalanadi — yangi market ro'yxati so'raladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);
    await pickOption(user, "details.operator_id", "Dilnoza Karimova");

    await user.click(within(aside()).getByRole("button", { name: "Oldingi" }));
    await chooseMarket(user, "Nur Elektronika");

    const select = await operatorSelect();
    expect(select).toHaveTextContent("Tanlanmagan");
    expect(freeText()).toHaveValue("");
    expect(selectableCalls().at(-1)).toEqual([SELECTABLE, { params: { market_id: "4" } }]);
    await user.click(select);
    expect(
      within(await screen.findByRole("listbox")).getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Tanlanmagan", "Sardor Nurmatov"]);
    await user.keyboard("{Escape}");

    await fillOrder(user);
    await submit(user);
    expect(lastPayload()).toMatchObject({ market_id: "4" });
    expect(lastPayload()).not.toHaveProperty("operator_id");
    expect(lastPayload()).not.toHaveProperty("operator");
  });

  it("ro'yxat yuklanmasa — avvalgi «Operator» matn maydoni izoh bilan, faqat matn yuboriladi", async () => {
    mocks.get.mockImplementation((url: string, config?: { params?: { market_id?: string } }) =>
      url === SELECTABLE ? Promise.reject({ response: { status: 500, data: { message: "Xato" } } }) : apiGet(url, config),
    );
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    expect(await within(aside()).findByText("Operatorlar ro'yxati yuklanmadi — ismini qo'lda yozing")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Operator" })).not.toBeInTheDocument();
    const input = screen.getByLabelText("Operator");
    expect(input).toHaveAttribute("id", "details.operator");

    await fillOrder(user);
    await user.type(input, "Kamola");
    await submit(user);
    expect(lastPayload()).toMatchObject({ operator: "Kamola" });
    expect(lastPayload()).not.toHaveProperty("operator_id");
  });

  it("marketda operator yo'q (bo'sh ro'yxat) — tanlov chiqmaydi, «Operator» erkin matn avvalgidek (izohsiz)", async () => {
    operatorsByMarket.own = [];
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await waitFor(() => expect(selectableCalls()).toHaveLength(1));
    const input = screen.getByLabelText("Operator");
    expect(input).toHaveAttribute("id", "details.operator");
    expect(input).not.toHaveAccessibleDescription();
    expect(screen.queryByRole("combobox", { name: "Operator" })).not.toBeInTheDocument();
  });

  it("backend 400 «Tanlangan operator …» — maydon xato bilan, ro'yxat yangilanadi va eskirgan tanlov tozalanadi", async () => {
    mocks.post.mockRejectedValue({
      response: {
        status: 400,
        data: { statusCode: 400, message: "Tanlangan operator bu marketga tegishli emas yoki faol emas" },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState });
    await chooseMarket(user);
    await operatorSelect();
    await fillOrder(user);
    await pickOption(user, "details.operator_id", "Dilnoza Karimova");
    // Shu orada operator o'chirildi — yangilangan ro'yxatda yo'q.
    operatorsByMarket["3"] = [{ id: 12, name: "Bekzod Aliyev" }];

    await submit(user);

    const alert = await within(screen.getByTestId("manual-mode-panel")).findByRole("alert");
    expect(alert).toHaveTextContent("Tanlangan operator bu marketga tegishli emas yoki faol emas");
    await waitFor(() => expect(selectableCalls().length).toBeGreaterThan(1));
    await waitFor(() => expect(document.getElementById("details.operator_id")).toHaveTextContent("Tanlanmagan"));
    expect(document.getElementById("details.operator_id")).toHaveAttribute("aria-invalid", "true");
    expect(freeText()).toHaveValue("");
  });

  it("market operatori — o'zgarmagan: o'z ismi faqat o'qish uchun, ro'yxat so'ralmaydi", async () => {
    renderWithProviders(<OrderCreate />, { preloadedState: operatorState });

    const input = within(aside()).getByLabelText("Operator");
    expect(input).toHaveValue("Dilnoza Karimova");
    expect(input).toHaveAttribute("readonly");
    expect(within(aside()).getByText("Siz — avtomatik yoziladi")).toBeInTheDocument();
    await waitFor(() => expect(mocks.get.mock.calls.map(([url]) => url)).toContain("region"));
    expect(selectableCalls()).toHaveLength(0);
    expect(screen.queryByRole("combobox", { name: "Operator" })).not.toBeInTheDocument();
  });
});

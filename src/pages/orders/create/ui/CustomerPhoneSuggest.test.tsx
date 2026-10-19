import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { aiApiGet } from "../../../../test/aiOrderFixtures";

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

vi.mock("../../../../shared/api/api", () => ({
  api: { post: mocks.post, get: mocks.get, patch: vi.fn(), delete: vi.fn() },
}));

import OrderCreate from "../index";

/**
 * CS-A — 2-qadam: telefon bo'yicha mijoz taklifi va mavjud mijoz (hiqRNhkI). Maketlar
 * `*-create-manual-step2-customer-suggest`, `*-create-manual-step2-existing-customer`,
 * `market-new-orders-create-manual-{customer-suggest,existing-customer}`.
 */

const marketState = { role: { id: "7", role: "market", region: null, name: "Test market" } } as never;
const adminState = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;
const managerState = { role: { id: "2", role: "manager", region: null, name: "Menejer" } } as never;
const selectedMarketRoute = {
  pathname: "/new-orders/create",
  state: { selectedMarket: { id: 3, name: "Baraka Shop", status: "active" } },
};

const ok = (data: unknown) => Promise.resolve({ data: { statusCode: 200, message: "ok", data } });

const SHAHNOZA = {
  id: "55",
  name: "Shahnoza Abdullayeva",
  phone_number: "+998903456721",
  extra_number: "99-871-22-64",
  address: "Chilonzor 9-kvartal, 14-uy",
  region_id: null,
  district_id: "101",
  orders_count: 4,
  new_orders_count: 1,
  has_new_orders: true,
  new_order_ids: ["10260"],
  last_order_at: null,
};
const DILNOZA = {
  id: "56",
  name: "Dilnoza Karimova",
  phone_number: "+998903456705",
  extra_number: null,
  address: null,
  region_id: "11",
  district_id: "102",
  orders_count: 1,
  new_orders_count: 0,
  has_new_orders: false,
  new_order_ids: [],
  last_order_at: null,
};

const DISTRICTS: Record<string, { id: number; name: string; region_id: number }> = {
  "101": { id: 101, name: "Chilonzor", region_id: 11 },
  "102": { id: 102, name: "Yunusobod", region_id: 11 },
};

const apiGet = (suggestions: unknown[] = [SHAHNOZA, DILNOZA]) => (url: string) => {
  if (url === "customers/suggest") return ok(suggestions);
  const district = url.match(/^district\/(\d+)$/);
  if (district) return ok(DISTRICTS[district[1]]);
  return aiApiGet(url);
};

const suggestCalls = () => mocks.get.mock.calls.filter(([url]) => url === "customers/suggest");
const phoneInput = () => screen.getByRole("combobox", { name: /^Telefon/ });
const createdPayload = () => mocks.post.mock.calls.find(([url]) => url === "orders")?.[1] as Record<string, unknown>;

/** Mahsulot va summa — buyurtma yuborishga tayyor bo'lishi uchun. */
const completeOrder = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: /Telefon ushlagich/ }));
  await user.type(screen.getByLabelText(/^Umumiy summa/), "150000");
};

const setPhoneViewport = (phone: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: phone && query.includes("max-width: 767px"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
};

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  mocks.get.mockReset();
  mocks.get.mockImplementation(apiGet());
  mocks.post.mockReset();
  mocks.post.mockResolvedValue({ data: { statusCode: 201, data: { id: "o1" } } });
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("CS-A — telefon bo'yicha mijoz taklifi (desktop)", () => {
  it("7 raqamdan kam — so'rov yo'q; 7 raqamdan keyin 300 ms kutib `customers/suggest` (market rolida market_id siz)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(phoneInput(), "903456");
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(suggestCalls()).toHaveLength(0);
    expect(screen.queryByRole("listbox", { name: "Mijoz takliflari" })).not.toBeInTheDocument();

    await user.type(phoneInput(), "7");
    const list = await screen.findByRole("listbox", { name: "Mijoz takliflari" });
    expect(phoneInput()).toHaveAttribute("aria-expanded", "true");
    expect(phoneInput()).toHaveAttribute("aria-controls", list.id);
    await waitFor(() => expect(suggestCalls()).toHaveLength(1));
    expect(suggestCalls()[0][1]).toEqual({ params: { phone: "9034567" } });

    expect(list).toHaveTextContent("Sizning mijozlaringiz · buyurtmalar soni faqat sizda");
    expect(list).not.toHaveTextContent("Barcha mijozlar");
    const row = await within(list).findByRole("option", { name: /Shahnoza Abdullayeva/ });
    expect(row).toHaveTextContent("+998 90 345 67 21");
    await waitFor(() => expect(row).toHaveTextContent("+998 90 345 67 21 · Chilonzor"));
    expect(row).toHaveTextContent("4 ta buyurtma");
    expect(row).toHaveTextContent("1 ta yangi");
    expect(within(list).getByRole("option", { name: /Dilnoza Karimova/ })).not.toHaveTextContent("ta yangi");
    expect(within(list).getByRole("option", { name: "Yangi mijoz sifatida davom etish" })).toBeInTheDocument();
  });

  it("qidirilmoqda va «Mijoz topilmadi — yangi mijoz» holatlari", async () => {
    let resolveSuggest: (value: unknown) => void = () => undefined;
    mocks.get.mockImplementation((url: string) =>
      url === "customers/suggest"
        ? new Promise((resolve) => {
            resolveSuggest = resolve;
          })
        : aiApiGet(url),
    );
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(phoneInput(), "972201805");
    const list = await screen.findByRole("listbox", { name: "Mijoz takliflari" });
    expect(within(list).getByRole("status")).toHaveTextContent("Mijoz qidirilmoqda...");
    expect(list).toHaveAttribute("aria-busy", "true");

    await waitFor(() => expect(suggestCalls()).toHaveLength(1));
    resolveSuggest({ data: { statusCode: 200, data: [] } });
    expect(await within(list).findByText("Mijoz topilmadi")).toBeInTheDocument();
    expect(list).toHaveTextContent("Yangi mijoz sifatida saqlanadi — ismini kiriting");
  });

  it("admin: `market_id` yuboriladi, sarlavha «Barcha mijozlar · buyurtmalar soni <market> bo'yicha»", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: adminState, route: selectedMarketRoute });

    await user.type(phoneInput(), "9034567");
    const list = await screen.findByRole("listbox", { name: "Mijoz takliflari" });
    await waitFor(() => expect(suggestCalls()[0]?.[1]).toEqual({ params: { phone: "9034567", market_id: "3" } }));
    expect(list).toHaveTextContent("Barcha mijozlar · buyurtmalar soni Baraka Shop bo'yicha");
  });

  it("menejer: faqat shu market mijozlari — «Barcha mijozlar» yozilmaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: managerState, route: selectedMarketRoute });

    await user.type(phoneInput(), "9034567");
    const list = await screen.findByRole("listbox", { name: "Mijoz takliflari" });
    await within(list).findByRole("option", { name: /Shahnoza/ });
    expect(list).toHaveTextContent("Baraka Shop mijozlari · buyurtmalar soni shu market bo'yicha");
    expect(list).not.toHaveTextContent("Barcha mijozlar");
    await waitFor(() => expect(suggestCalls()[0]?.[1]).toEqual({ params: { phone: "9034567", market_id: "3" } }));
  });

  it("taklif tanlansa maydonlar to'ladi (viloyat `district/:id` dan), «Mavjud mijoz» bloki va yangi buyurtma ogohlantirishi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(phoneInput(), "9034567");
    await user.click(await screen.findByRole("option", { name: /Shahnoza Abdullayeva/ }));

    await waitFor(() => expect(screen.getByLabelText(/^Mijoz ismi/)).toHaveValue("Shahnoza Abdullayeva"));
    expect(phoneInput()).toHaveValue("90 345 67 21");
    expect(screen.getByLabelText(/^Qo'shimcha raqam/)).toHaveValue("99 871 22 64");
    expect(screen.getByLabelText(/^Manzil/)).toHaveValue("Chilonzor 9-kvartal, 14-uy");
    expect(mocks.get).toHaveBeenCalledWith("district/101");
    await waitFor(() => expect(screen.getByRole("combobox", { name: /^Viloyat/ })).toHaveValue("Toshkent shahri • 1726"));
    await waitFor(() => expect(screen.getByRole("combobox", { name: /^Tuman/ })).toHaveValue("Chilonzor • 1726269"));
    expect(screen.queryByRole("listbox", { name: "Mijoz takliflari" })).not.toBeInTheDocument();

    const notice = await screen.findByText("Mavjud mijoz");
    const block = notice.closest("[role=status]") as HTMLElement;
    expect(block).toHaveTextContent("Ism, manzil va qo'shimcha raqam mijoz kartasidan to'ldirildi · sizda 4 ta buyurtma");
    expect(block).not.toHaveTextContent("Mijoz kartasi ham yangilansinmi");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Bu mijozda yangi buyurtma bor");
    expect(alert).toHaveTextContent(
      "Shahnoza Abdullayeva uchun sizda yangi holatdagi 1 ta buyurtma bor. Takroriy buyurtma yaratmayotganingizni tekshiring.",
    );
    const link = within(alert).getByRole("link", { name: "Buyurtma №10260 ni yangi oynada ochish" });
    expect(link).toHaveAttribute("href", "/new-orders/7/edit/10260");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveTextContent("№10260 ni yangi oynada ochish");
  });

  it("⭐ P0: o'zgarmagan mavjud mijoz — POST /orders da `customer_id` (obyekt ham qoladi)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(phoneInput(), "9034567");
    await user.click(await screen.findByRole("option", { name: /Shahnoza Abdullayeva/ }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: /^Tuman/ })).toHaveValue("Chilonzor • 1726269"));
    await completeOrder(user);
    await user.click(screen.getByRole("button", { name: "Buyurtma yaratish" }));

    await waitFor(() => expect(createdPayload()).toBeDefined());
    expect(createdPayload()).toMatchObject({
      customer_id: "55",
      customer: {
        name: "Shahnoza Abdullayeva",
        phone_number: "+998903456721",
        district_id: "101",
        extra_number: "99-871-22-64",
        address: "Chilonzor 9-kvartal, 14-uy",
      },
      district_id: "101",
      region_id: "11",
    });
    // Yaratilgach forma tozalanadi — bog'lanish ham.
    await waitFor(() => expect(screen.queryByText("Mavjud mijoz")).not.toBeInTheDocument());
  });

  it("maydon o'zgartirilsa — `customer_id` yuborilmaydi (avvalgi yo'l)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(phoneInput(), "9034567");
    await user.click(await screen.findByRole("option", { name: /Shahnoza Abdullayeva/ }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: /^Tuman/ })).toHaveValue("Chilonzor • 1726269"));
    await user.type(screen.getByLabelText(/^Mijoz ismi/), " Olimovna");
    await completeOrder(user);
    await user.click(screen.getByRole("button", { name: "Buyurtma yaratish" }));

    await waitFor(() => expect(createdPayload()).toBeDefined());
    expect(createdPayload()).not.toHaveProperty("customer_id");
    expect(createdPayload()).toMatchObject({ customer: { name: "Shahnoza Abdullayeva Olimovna" } });
  });

  it("telefon o'zgarsa bog'lanish uziladi, maydonlar qoladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(phoneInput(), "9034567");
    await user.click(await screen.findByRole("option", { name: /Shahnoza Abdullayeva/ }));
    expect(await screen.findByText("Mavjud mijoz")).toBeInTheDocument();

    await user.type(phoneInput(), "{Backspace}");

    expect(screen.queryByText("Mavjud mijoz")).not.toBeInTheDocument();
    expect(screen.queryByText("Bu mijozda yangi buyurtma bor")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Mijoz ismi/)).toHaveValue("Shahnoza Abdullayeva");
  });

  it("«Bekor qilish» — tanlashdan oldingi qiymatlar qaytadi, blok yo'qoladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(screen.getByLabelText(/^Mijoz ismi/), "Vali");
    await user.type(phoneInput(), "9034567");
    await user.click(await screen.findByRole("option", { name: /Shahnoza Abdullayeva/ }));
    await waitFor(() => expect(screen.getByLabelText(/^Mijoz ismi/)).toHaveValue("Shahnoza Abdullayeva"));
    await screen.findByText("Mavjud mijoz");

    await user.click(screen.getByRole("button", { name: "Mavjud mijozni bekor qilish" }));

    expect(screen.queryByText("Mavjud mijoz")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Mijoz ismi/)).toHaveValue("Vali");
    expect(screen.getByLabelText(/^Manzil/)).toHaveValue("");
    expect(screen.queryByRole("listbox", { name: "Mijoz takliflari" })).not.toBeInTheDocument();
  });

  it("klaviatura: ↓ ↓ Enter ikkinchi mijozni tanlaydi (forma yuborilmaydi); Esc ro'yxatni yopadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(phoneInput(), "9034567");
    await screen.findByRole("option", { name: /Dilnoza Karimova/ });
    await user.keyboard("{ArrowDown}");
    expect(phoneInput()).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: /Shahnoza/ }).id);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox", { name: "Mijoz takliflari" })).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    await screen.findByRole("option", { name: /Dilnoza Karimova/ });
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    await waitFor(() => expect(screen.getByLabelText(/^Mijoz ismi/)).toHaveValue("Dilnoza Karimova"));
    expect(mocks.post).not.toHaveBeenCalled();
    // Yangi buyurtmasi yo'q — ogohlantirish chiqmaydi.
    await screen.findByText("Mavjud mijoz");
    expect(screen.queryByText("Bu mijozda yangi buyurtma bor")).not.toBeInTheDocument();
  });

  it("«Yangi mijoz sifatida davom etish» ro'yxatni yopadi, hech narsa to'ldirilmaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(phoneInput(), "9034567");
    await user.click(await screen.findByRole("option", { name: "Yangi mijoz sifatida davom etish" }));

    expect(screen.queryByRole("listbox", { name: "Mijoz takliflari" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Mijoz ismi/)).toHaveValue("");
    expect(screen.queryByText("Mavjud mijoz")).not.toBeInTheDocument();
  });

  it("taklif so'rovi yiqilsa — jim (ro'yxat yo'q, xom xato matni chiqmaydi), forma ishlayveradi", async () => {
    mocks.get.mockImplementation((url: string) =>
      url === "customers/suggest"
        ? Promise.reject({ response: { status: 400, data: { message: "market_id majburiy" } } })
        : aiApiGet(url),
    );
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(phoneInput(), "9034567");
    await waitFor(() => expect(suggestCalls()).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("listbox", { name: "Mijoz takliflari" })).not.toBeInTheDocument());
    expect(screen.queryByText(/market_id majburiy/)).not.toBeInTheDocument();
  });
});

describe("CS-A — telefonda pastki varaqa", () => {
  it("natija bo'lsa «Mijozni tanlang» varaqasi; tanlansa maydonlar to'ladi", async () => {
    setPhoneViewport(true);
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(phoneInput(), "9034567");
    const sheet = await screen.findByRole("dialog", { name: "Mijozni tanlang" });
    expect(sheet).toHaveTextContent("+998 90 345 67 · 2 ta mos keldi");
    expect(sheet).toHaveTextContent("Sizning mijozlaringiz · buyurtmalar soni faqat sizda");
    // Desktop ro'yxati chizilmaydi — faqat varaqa ichidagi ro'yxat.
    expect(screen.getAllByRole("listbox", { name: "Mijoz takliflari" })).toEqual([
      within(sheet).getByRole("listbox", { name: "Mijoz takliflari" }),
    ]);
    expect(within(sheet).getByRole("button", { name: "Yangi mijoz sifatida davom etish" })).toBeInTheDocument();

    await user.click(within(sheet).getByRole("option", { name: /Shahnoza Abdullayeva/ }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Mijozni tanlang" })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText(/^Mijoz ismi/)).toHaveValue("Shahnoza Abdullayeva"));
    expect(await screen.findByText("Mavjud mijoz")).toBeInTheDocument();
  });

  it("natija yo'q — varaqa ochilmaydi, maydon ostida «Mijoz topilmadi»", async () => {
    setPhoneViewport(true);
    mocks.get.mockImplementation(apiGet([]));
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(phoneInput(), "972201805");
    expect(await screen.findByText("Mijoz topilmadi")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Mijozni tanlang" })).not.toBeInTheDocument();
  });

  it("«Yangi mijoz sifatida davom etish» varaqani yopadi", async () => {
    setPhoneViewport(true);
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });

    await user.type(phoneInput(), "9034567");
    const sheet = await screen.findByRole("dialog", { name: "Mijozni tanlang" });
    await user.click(within(sheet).getByRole("button", { name: "Yangi mijoz sifatida davom etish" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Mijozni tanlang" })).not.toBeInTheDocument());
    expect(screen.getByLabelText(/^Mijoz ismi/)).toHaveValue("");
  });
});

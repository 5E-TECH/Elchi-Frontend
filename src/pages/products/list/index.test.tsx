import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ProductTable from "./index";
import { renderWithProviders } from "../../../test/test-utils";
import { useResetInputsOnPathChange } from "../../../shared/lib/useResetInputsOnPathChange";

/**
 * Mahsulotlar — `/products` (dizayn v2, maketlar `superadmin-products-list`, `market-products-list`,
 * `market_operator-products-unassigned` va oynalar): haqiqiy UI (`Dialog`, `useConfirm`, `notify`) orqali; API —
 * `shared/api/api` mock'i. Qidiruv va market filtri URL bilan sinxron (sahifa 1 ga qaytadi); market va market
 * operatori — `product/my-products`, faqat ko'rish (MH-1: yaratish, tahrirlash, o'chirish yo'q); tahrir — xodim
 * `PATCH product/:id` («Narx» bilan), o'chirish — tasdiq oynasi orqali `DELETE product/:id`. O'lchov (6FLyjO6j):
 * «Og'irlik», «O'lcham, sm», «Hisob vazni» ustunlari, oynada yaratish sahifasi bilan AYNI maydonlar.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), delete: vi.fn(), post: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: mocks.delete },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

type Params = Record<string, unknown>;

const OLMA = {
  id: 1,
  name: "Olma",
  image_url: "/uploads/olma.png",
  price: 189000,
  weight_kg: "1.200",
  length_cm: 30,
  width_cm: 22,
  height_cm: 15,
  volumetric_enabled: true,
  market: { id: 1, name: "Fresh" },
};
/** O'lchovsiz eski mahsulot (backend `null`) — «Kiritilmagan». */
const NOK = { id: 2, name: "Nok", price: null, weight_kg: null, length_cm: null, width_cm: null, height_cm: null, market: { id: 2, name: "Bozor" } };
/** Kalit o'chiq — «hajm hisobga olinmaydi». */
const KURTKA = {
  id: 3,
  name: "Kurtka",
  price: 320000,
  weight_kg: 0.9,
  length_cm: 40,
  width_cm: 30,
  height_cm: 15,
  volumetric_enabled: false,
  market: { id: 1, name: "Fresh" },
};

const QUOTES = {
  data: {
    quotes: {
      city: { tariffId: "city", base: 35000, perExtraKg: 4000, billableKg: 2, extraKg: 1, total: 39000 },
      center: { tariffId: "center", base: 40000, perExtraKg: 4000, billableKg: 2, extraKg: 1, total: 44000 },
      address: null,
    },
  },
};

let productRows: unknown[] = [OLMA];

const respond = () => {
  mocks.get.mockImplementation((url: string, config?: { params?: Params }) => {
    if (url === "product" || url === "product/my-products") {
      return Promise.resolve({
        data: { data: productRows, total: productRows.length, page: config?.params?.page ?? 1, limit: 10 },
      });
    }
    if (url === "markets") {
      return Promise.resolve({
        data: {
          data: {
            items: [
              { id: 1, name: "Fresh", phone_number: "+998901234567", status: "active" },
              { id: 2, name: "Bozor", phone_number: "+998935550011", status: "active" },
              { id: 3, name: "Yopiq", phone_number: "+998930000000", status: "inactive" },
            ],
          },
        },
      });
    }
    if (url === "product/1") return Promise.resolve({ data: { data: OLMA } });
    if (url === "product/2") return Promise.resolve({ data: { data: NOK } });
    if (url === "delivery/pricing-settings") return Promise.resolve({ data: { data: { first_kg_included: 1, round_to: 500 } } });
    return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
  });
  mocks.post.mockImplementation((url: string) =>
    url === "delivery/quote/by-tariff" ? Promise.resolve({ data: QUOTES }) : Promise.reject(new Error(`kutilmagan: ${url}`)),
  );
  mocks.patch.mockResolvedValue({ data: { data: OLMA } });
  mocks.delete.mockResolvedValue({ data: {} });
};

const listCalls = (url = "product") => mocks.get.mock.calls.filter(([called]) => called === url);
const lastListParams = (url = "product") => (listCalls(url).at(-1)?.[1] as { params: Params } | undefined)?.params;

const roleState = (role: string, id = `${role}-1`) => ({ role: { id, role, region: null, name: role } });

/** `MemoryRouter` brauzer manzilini o'zgartirmaydi — URL holati router'ning o'zidan (`useLocation`) o'qiladi. */
const LocationProbe = () => {
  const { pathname, search } = useLocation();
  return (
    <>
      <span data-testid="path">{pathname}</span>
      <span data-testid="search">{search}</span>
    </>
  );
};

const renderPage = (route = "/products", role = "admin", id?: string) =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/products" element={<ProductTable />} />
        <Route path="/products/create-product/:id" element={<div>create-page</div>} />
      </Routes>
      <LocationProbe />
    </>,
    { route, preloadedState: roleState(role, id) as never },
  );

const originalScrollIntoView = Element.prototype.scrollIntoView;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeAll(() => {
  // jsdom `scrollIntoView` va `URL.createObjectURL` ni bilmaydi (ro'yxatda faol qator, rasmni oldindan ko'rish).
  Element.prototype.scrollIntoView = vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:olma");
  URL.revokeObjectURL = vi.fn();
});

afterAll(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

beforeEach(() => {
  productRows = [OLMA];
  respond();
});

describe("ProductTable — ro'yxat", () => {
  it("sarlavha, jami son, mahsulot va market ko'rinadi", async () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Mahsulotlar" })).toBeInTheDocument();
    expect(await screen.findByText("Olma")).toBeInTheDocument();
    expect(screen.getByText("Jami 1 ta mahsulot")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Market" })).toBeInTheDocument();
    expect(screen.getAllByText("Fresh").length).toBeGreaterThan(0);
    expect(screen.getByText("1–1 / 1 ta mahsulot")).toBeInTheDocument();
    expect(lastListParams()).toEqual({ page: 1, limit: 10 });
  });

  it("«Narx» ustuni: narx so'mda, narxsiz — «—»; planshetda «Market» ustuni yashirin, nom ostida market", async () => {
    productRows = [OLMA, NOK];
    renderPage();
    await screen.findByText("Nok");

    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent);
    expect(headers).toEqual(["#", "Mahsulot nomi", "Market", "Narx", "Og'irlik", "O'lcham, sm", "Hisob vazni", "Amallar"]);
    expect(screen.getByRole("columnheader", { name: "Market" })).toHaveClass("max-lg:hidden");
    const [, olmaRow, nokRow] = screen.getAllByRole("row");
    expect(within(olmaRow).getAllByRole("cell")[3]).toHaveTextContent(/^189\s000 so'm$/);
    expect(within(nokRow).getAllByRole("cell")[3]).toHaveTextContent("—");
    expect(within(within(nokRow).getAllByRole("cell")[3]).getByText("Narx kiritilmagan")).toHaveClass("sr-only");
    // Nom katagi ichidagi market nomi — faqat < 1024 da ko'rinadi (`max-lg:inline-flex`).
    const tabletMarket = within(within(olmaRow).getAllByRole("cell")[1]).getByText("Fresh");
    expect(tabletMarket.parentElement).toHaveClass("hidden", "max-lg:inline-flex");
  });

  it("nom bo'yicha saralash joriy sahifa ichida (so'rov qayta ketmaydi)", async () => {
    productRows = [OLMA, NOK];
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Nok");
    const before = listCalls().length;
    const names = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        // Nom katagida planshet uchun market nomi ham bor — faqat mahsulot nomi olinadi.
        .map((row) => within(row).getAllByRole("cell")[1].querySelector("span.font-semibold")?.textContent);
    const sortButton = screen.getByRole("button", { name: "Mahsulot nomi" });

    await user.click(sortButton);
    expect(names()).toEqual(["Nok", "Olma"]);
    await user.click(sortButton);
    expect(names()).toEqual(["Olma", "Nok"]);
    // Tartib raqami qatorning serverdagi o'rni bo'yicha qoladi.
    expect(within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0]).toHaveTextContent("1");
    expect(listCalls().length).toBe(before);
  });

  it("bo'sh ro'yxat — «Hali mahsulot yo'q», filtr bilan — «Mahsulot topilmadi» + tozalash", async () => {
    productRows = [];
    const user = userEvent.setup();
    renderPage("/products?product_search=xyz&market_id=2&page=2");

    expect(await screen.findByText("Mahsulot topilmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));

    await waitFor(() => expect(screen.getByTestId("search").textContent).toBe(""));
    expect(await screen.findByText("Hali mahsulot yo'q")).toBeInTheDocument();
  });

  it("sahifa endi yo'q bo'lsa (oxirgi mahsulot o'chirildi) — mavjud oxirgi sahifaga o'tadi", async () => {
    mocks.get.mockImplementation((url: string, config?: { params?: Params }) => {
      if (url !== "product") return Promise.resolve({ data: { data: { items: [] } } });
      const page = Number(config?.params?.page ?? 1);
      return Promise.resolve({ data: { data: page > 2 ? [] : [OLMA], total: 12, page, limit: 10 } });
    });
    renderPage("/products?page=3");

    await waitFor(() => expect(screen.getByTestId("search").textContent).toBe("?page=2"));
    expect(await screen.findByText("Olma")).toBeInTheDocument();
  });

  it("xato — «Mahsulotlarni yuklab bo'lmadi» va «Qayta urinish»", async () => {
    mocks.get.mockImplementation((url: string) =>
      url === "product" ? Promise.reject(new Error("server")) : Promise.resolve({ data: { data: { items: [] } } }),
    );
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Mahsulotlarni yuklab bo'lmadi")).toBeInTheDocument();
    respond();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByText("Olma")).toBeInTheDocument();
  });
});

describe("ProductTable — yaratish", () => {
  it("xodim: «Marketni tanlang» oynasi (faqat faol marketlar), tanlangach create sahifasiga o'tadi", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Mahsulot yaratish" }));
    const dialog = await screen.findByRole("dialog", { name: "Marketni tanlang" });
    expect(within(dialog).getByText("Faqat faol marketlar ko'rsatiladi")).toBeInTheDocument();
    expect(await within(dialog).findByRole("option", { name: /Fresh/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("option", { name: /Yopiq/ })).not.toBeInTheDocument();

    const confirm = within(dialog).getByRole("button", { name: "Tanlash" });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByRole("combobox", { name: "Market qidirish" }), "bozor");
    expect(within(dialog).queryByRole("option", { name: /Fresh/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("option", { name: /Bozor/ }));
    await user.click(confirm);

    await waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/products/create-product/2"));
  });

  it("tanlash oynasi klaviatura bilan: ↓ ↓ — ikkinchi market, Enter — «Tanlash»", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Mahsulot yaratish" }));
    const dialog = await screen.findByRole("dialog", { name: "Marketni tanlang" });
    await within(dialog).findByRole("option", { name: /Fresh/ });
    const search = within(dialog).getByRole("combobox", { name: "Market qidirish" });
    await user.click(search);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(within(dialog).getByRole("option", { name: /Bozor/ })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/products/create-product/2"));
  });

  it("qidiruv tanlangan marketni yashirsa — «Tanlash» o'chadi, Enter ko'rinmagan marketni tasdiqlamaydi", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Mahsulot yaratish" }));
    const dialog = await screen.findByRole("dialog", { name: "Marketni tanlang" });
    await user.click(await within(dialog).findByRole("option", { name: /Fresh/ }));
    const confirm = within(dialog).getByRole("button", { name: "Tanlash" });
    expect(confirm).toBeEnabled();

    const search = within(dialog).getByRole("combobox", { name: "Market qidirish" });
    await user.type(search, "bozor");
    expect(within(dialog).queryByRole("option", { name: /Fresh/ })).not.toBeInTheDocument();
    expect(confirm).toBeDisabled();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("path").textContent).toBe("/products");

    await user.clear(search);
    expect(within(dialog).getByRole("option", { name: /Fresh/ })).toHaveAttribute("aria-selected", "true");
    expect(confirm).toBeEnabled();
  });

  it("registrator ham ro'yxatni ko'radi va yarata oladi (POST /product registrator+menejerga ochiq)", async () => {
    renderPage("/products", "registrator");

    expect(await screen.findByText("Olma")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mahsulot yaratish" })).toBeInTheDocument();
  });
});

describe("ProductTable — tahrirlash va o'chirish", () => {
  it("o'chirish tasdiq oynasi orqali: DELETE product/1 va xabar", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Olma — o'chirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "O'chirishni tasdiqlang" });
    expect(
      within(dialog).getByText("Quyidagi mahsulotni rostdan o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Olma")).toBeInTheDocument();
    expect(within(dialog).getByText("Fresh")).toBeInTheDocument();
    expect(mocks.delete).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith("product/1"));
    expect(await screen.findByText("Mahsulot muvaffaqiyatli o'chirildi")).toBeInTheDocument();
  });

  it("«Bekor qilish» — o'chirilmaydi", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Olma — o'chirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "O'chirishni tasdiqlang" });
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("xato bo'lsa oyna ochiq qoladi va i18n xato matni oynada (xom backend matni emas)", async () => {
    mocks.delete.mockRejectedValue(
      Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: { status: 400, data: { message: "Mahsulot buyurtmada ishlatilgan" } },
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Olma — o'chirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "O'chirishni tasdiqlang" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    expect(
      await within(dialog).findByText(
        "Mahsulotni o'chirib bo'lmadi. Ma'lumotlarni tekshirib, qayta urinib ko'ring.",
      ),
    ).toBeInTheDocument();
    // Xom backend matni foydalanuvchiga ko'rsatilmaydi.
    expect(screen.queryByText(/Mahsulot buyurtmada ishlatilgan/)).not.toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "O'chirishni tasdiqlang" })).toBeInTheDocument();
  });

  it("xodim tahrirlaydi: oynada market nomi va joriy nom, PATCH product/1 FormData bilan", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Olma — tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" });
    expect(within(dialog).getByText("Fresh")).toBeInTheDocument();
    expect(within(dialog).getByText("Mahsulot rasmi")).toBeInTheDocument();
    expect((within(dialog).getByRole("textbox", { name: "Narx" }) as HTMLInputElement).value).toMatch(/^189\s000$/);
    const input = within(dialog).getByRole("textbox", { name: /Mahsulot nomi/ });
    expect(input).toHaveValue("Olma");
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("product/1"));

    await user.clear(input);
    await user.type(input, "  Qizil olma ");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    const [url, body] = mocks.patch.mock.calls[0] as [string, FormData];
    expect(url).toBe("product/1");
    expect(body.get("name")).toBe("Qizil olma");
    // Narx o'zgarmagan — yuborilmaydi (kasrli eski narx yaxlitlanib qolmasin).
    expect(body.has("price")).toBe(false);
    expect(body.has("image")).toBe(false);
    // Saqlangan o'lchov o'zgarmagan — yuborilmaydi va o'chib ketmaydi.
    for (const key of ["weight_kg", "length_cm", "width_cm", "height_cm", "volumetric_enabled"]) {
      expect(body.has(key)).toBe(false);
    }
    expect(await screen.findByText("Mahsulot muvaffaqiyatli yangilandi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("bo'sh nom yuborilmaydi — maydon ostida xato", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Olma — tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" });
    await user.clear(within(dialog).getByRole("textbox", { name: /Mahsulot nomi/ }));
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    expect(await within(dialog).findByText("Mahsulot nomini kiriting")).toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("tanlangan rasm FormData'ga qo'shiladi", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Olma — tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" });
    const file = new File(["png"], "olma.png", { type: "image/png" });
    await user.upload(within(dialog).getByLabelText("Mahsulot rasmi"), file);
    expect(within(dialog).getByRole("img", { name: "Mahsulot rasmi" })).toHaveAttribute("src", "blob:olma");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    const [, body] = mocks.patch.mock.calls[0] as [string, FormData];
    expect(body.get("image")).toBe(file);
  });

  it("narx o'zgartiriladi va tozalanadi: FormData `price` (bo'sh — narx olib tashlanadi)", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Olma — tahrirlash" }));
    let dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" });
    const price = within(dialog).getByRole("textbox", { name: "Narx" });
    await user.clear(price);
    await user.type(price, "250000");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect((mocks.patch.mock.calls[0][1] as FormData).get("price")).toBe("250000");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Olma — tahrirlash" }));
    dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" });
    await user.clear(within(dialog).getByRole("textbox", { name: "Narx" }));
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(2));
    expect((mocks.patch.mock.calls[1][1] as FormData).get("price")).toBe("");
  });

  it("xato maydonlar — tepada «Saqlab bo'lmadi» va N ta maydon soni, so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Olma — tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" });
    expect(within(dialog).queryByText("Saqlab bo'lmadi")).not.toBeInTheDocument();
    await user.clear(within(dialog).getByRole("textbox", { name: /Mahsulot nomi/ }));
    const price = within(dialog).getByRole("textbox", { name: "Narx" });
    await user.clear(price);
    await user.type(price, "1234567890123");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    const summary = await within(dialog).findByRole("alert");
    expect(summary).toHaveTextContent("Saqlab bo'lmadi");
    expect(summary).toHaveTextContent("2 ta maydonda xato bor — qizil bilan belgilanganlarni to'g'rilang.");
    expect(within(dialog).getByText("Narx juda katta — ko'pi bilan 12 xonali son")).toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("409 (shu nomli mahsulot bor) — oyna ochiq, «Mahsulot nomi» ostida aniq sabab, xom matn yo'q", async () => {
    mocks.patch.mockRejectedValue(
      Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: { status: 409, data: { message: "Bu marketda Nok nomli mahsulot allaqachon mavjud" } },
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Olma — tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" });
    const input = within(dialog).getByRole("textbox", { name: /Mahsulot nomi/ });
    await user.clear(input);
    await user.type(input, "Nok");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    expect(
      await within(dialog).findByText("Bu marketda shu nomli mahsulot allaqachon bor — boshqa nom kiriting."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("1 ta maydonda xato bor");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/allaqachon mavjud/)).not.toBeInTheDocument();
    expect(screen.queryByText("Birozdan keyin qayta urinib ko'ring.")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Mahsulotni tahrirlash" })).toBeInTheDocument();
  });

  it("saqlanayotganda takroriy yuborish (Enter) ikkinchi PATCH yubormaydi", async () => {
    mocks.patch.mockImplementation(() => new Promise(() => undefined));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Olma — tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" });
    const form = dialog.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: /Saqlanmoqda/ })).toBeInTheDocument());

    fireEvent.submit(form);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mocks.patch).toHaveBeenCalledTimes(1);
  });

  it("saqlash xatosi — i18n izoh, xom backend matni ko'rsatilmaydi", async () => {
    mocks.patch.mockRejectedValue(
      Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: { status: 400, data: { message: "price — 0 dan katta yoki teng" } },
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Olma — tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" });
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    expect(await screen.findByText("Mahsulotni yangilashda xatolik yuz berdi")).toBeInTheDocument();
    expect(screen.getByText("Ma'lumotlarni tekshirib, qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.queryByText(/price — 0 dan/)).not.toBeInTheDocument();
  });
});

describe("ProductTable — market roli", () => {
  it("o'z mahsulotlari `product/my-products` dan (page/limit/search), market filtri va marketlar so'rovi yo'q", async () => {
    renderPage("/products?product_search=ol&page=2", "market");

    expect(await screen.findByText("Olma")).toBeInTheDocument();
    expect(lastListParams("product/my-products")).toEqual({ page: 2, limit: 10, search: "ol" });
    expect(listCalls("product")).toHaveLength(0);
    expect(listCalls("markets")).toHaveLength(0);
    expect(screen.queryByRole("columnheader", { name: "Market" })).not.toBeInTheDocument();
    expect(document.getElementById("market_id")).toBeNull();
    expect(screen.getByRole("searchbox", { name: "Mahsulotlarni nomi bo'yicha qidirish" })).toBeInTheDocument();
  });

  it("faqat ko'rish (MH-1): «Mahsulot yaratish», amallar va tahrirlash/o'chirish yo'q; izoh va «Narx» bor", async () => {
    renderPage("/products", "market", "77");

    expect(await screen.findByText("Olma")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mahsulot yaratish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Olma — tahrirlash" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Olma — o'chirish" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "#",
      "Mahsulot nomi",
      "Narx",
      "Og'irlik",
      "O'lcham, sm",
      "Hisob vazni",
    ]);
    expect(
      screen.getByText("Faqat ko'rish. Mahsulotni Elchi xodimlari qo'shadi va o'zgartiradi."),
    ).toBeInTheDocument();
    expect(screen.getByText("Jami 1 ta mahsulot · Fresh")).toBeInTheDocument();
    expect(listCalls("markets")).toHaveLength(0);
  });

  it("bo'sh ro'yxat — «Hali mahsulot yo'q», «Mahsulot yaratish» haqidagi izohsiz", async () => {
    productRows = [];
    renderPage("/products", "market", "77");

    expect(await screen.findByText("Hali mahsulot yo'q")).toBeInTheDocument();
    expect(screen.queryByText(/«Mahsulot yaratish» tugmasini bosing/)).not.toBeInTheDocument();
  });
});

describe("ProductTable — market operatori (MH-1)", () => {
  it("biriktirilgan marketi mahsulotlari `my-products` dan, faqat ko'rish, sarlavhada market nomi", async () => {
    renderPage("/products", "market_operator", "31");

    expect(await screen.findByText("Olma")).toBeInTheDocument();
    expect(lastListParams("product/my-products")).toEqual({ page: 1, limit: 10 });
    expect(listCalls("product")).toHaveLength(0);
    expect(screen.getByText("Jami 1 ta mahsulot · Fresh")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mahsulot yaratish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Olma — tahrirlash" })).not.toBeInTheDocument();
    expect(screen.getByText(/^Faqat ko'rish\./)).toBeInTheDocument();
  });

  it("marketga biriktirilmagan (400) — «Siz hali marketga biriktirilmagansiz», «Qayta tekshirish» qayta so'raydi", async () => {
    let assigned = false;
    mocks.get.mockImplementation((url: string) => {
      if (url !== "product/my-products") return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
      if (assigned) return Promise.resolve({ data: { data: [OLMA], total: 1, page: 1, limit: 10 } });
      return Promise.reject(
        Object.assign(new Error("Request failed"), {
          isAxiosError: true,
          response: { status: 400, data: { message: "Operator hech qaysi marketga biriktirilmagan" } },
        }),
      );
    });
    const user = userEvent.setup();
    renderPage("/products", "market_operator", "31");

    expect(await screen.findByText("Siz hali marketga biriktirilmagansiz")).toBeInTheDocument();
    expect(screen.getByText("Market biriktirilmagan")).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/Operator hech qaysi/)).not.toBeInTheDocument();

    assigned = true;
    await user.click(screen.getByRole("button", { name: "Qayta tekshirish" }));
    expect(await screen.findByText("Olma")).toBeInTheDocument();
    expect(screen.queryByText("Siz hali marketga biriktirilmagansiz")).not.toBeInTheDocument();
  });

  it("boshqa xato (500) — oddiy «Mahsulotlarni yuklab bo'lmadi»", async () => {
    mocks.get.mockImplementation(() =>
      Promise.reject(Object.assign(new Error("server"), { isAxiosError: true, response: { status: 500, data: {} } })),
    );
    renderPage("/products", "market_operator", "31");

    expect(await screen.findByText("Mahsulotlarni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByText("Siz hali marketga biriktirilmagansiz")).not.toBeInTheDocument();
  });
});

describe("ProductTable — URL filtrlari", () => {
  it("qidiruv URL'dan tiklanadi (yangilangandan keyin ham filtrlangan ro'yxat)", async () => {
    renderPage("/products?product_search=test");

    await waitFor(() => expect(lastListParams()).toEqual(expect.objectContaining({ search: "test" })));
    expect(screen.getByRole("searchbox", { name: "Mahsulotlarni qidirish" })).toHaveValue("test");
  });

  it("market filtri URL'dan tiklanadi", async () => {
    renderPage("/products?market_id=1");

    await waitFor(() => expect(lastListParams()).toEqual(expect.objectContaining({ market_id: "1" })));
  });

  it("URL'dan tiklashda sahifa 1 ga qaytarilmaydi", async () => {
    renderPage("/products?product_search=test&page=3");

    await waitFor(() => expect(lastListParams()).toEqual(expect.objectContaining({ search: "test", page: 3 })));
  });

  it("har harf saqlanadi, so'ng qidiruv URL'ga va so'rovga 1-sahifa bilan birga yoziladi", async () => {
    const user = userEvent.setup();
    renderPage("/products?page=3");
    const input = screen.getByRole("searchbox", { name: "Mahsulotlarni qidirish" });

    await user.type(input, "test");

    expect(input).toHaveValue("test");
    await waitFor(() => expect(screen.getByTestId("search").textContent).toBe("?product_search=test"), {
      timeout: 2500,
    });
    expect(input).toHaveValue("test");
    await waitFor(() => expect(lastListParams()).toEqual(expect.objectContaining({ search: "test", page: 1 })));
    // So'rov har harfga emas, yozish to'xtagach bir marta ketadi.
    expect(listCalls().some(([, config]) => (config as { params: Params }).params.search === "tes")).toBe(false);
  });

  it("havoladan ochilganda ham qidiruv tiklanadi (ilova yo'l o'zgarganda qidiruvlarni tozalasa ham)", async () => {
    const user = userEvent.setup();
    const AppShell = () => {
      useResetInputsOnPathChange();
      return (
        <Routes>
          <Route path="/" element={<Link to="/products?product_search=olma">products</Link>} />
          <Route path="/products" element={<ProductTable />} />
        </Routes>
      );
    };
    renderWithProviders(<AppShell />, { route: "/", preloadedState: roleState("admin") as never });

    await user.click(screen.getByRole("link", { name: "products" }));

    expect(await screen.findByRole("searchbox", { name: "Mahsulotlarni qidirish" })).toHaveValue("olma");
    await waitFor(() => expect(lastListParams()).toEqual(expect.objectContaining({ search: "olma" })));
  });

  it("market tanlansa URL darhol yoziladi va sahifa 1 — eski sahifa uchun ortiqcha so'rovsiz", async () => {
    const user = userEvent.setup();
    renderPage("/products?page=3");
    await screen.findByText("Olma");

    await user.click(document.getElementById("market_id")!);
    const option = await screen.findByRole("option", { name: "Fresh" });
    mocks.get.mockClear();
    await user.click(option);

    await waitFor(() => expect(screen.getByTestId("search").textContent).toBe("?market_id=1"));
    await waitFor(() => expect(lastListParams()).toEqual(expect.objectContaining({ market_id: "1", page: 1 })));
    expect(
      listCalls().some(([, config]) => {
        const params = (config as { params: Params }).params;
        return params.market_id === "1" && params.page === 3;
      }),
    ).toBe(false);
  });

  it("market filtri × bilan «Barchasi» ga qaytadi", async () => {
    const user = userEvent.setup();
    renderPage("/products?market_id=1");
    await screen.findByText("Olma");

    await user.click(await screen.findByRole("button", { name: "Tozalash" }));

    await waitFor(() => expect(screen.getByTestId("search").textContent).toBe(""));
  });
});

describe("ProductTable — market o'z mahsulotlarida sahifa va qidiruv (3qDsJpfW)", () => {
  it("⭐ TC1: 2-sahifa — `my-products` so'roviga `page: 2` (va `limit`) uzatiladi; admin ro'yxati so'ralmaydi", async () => {
    productRows = [NOK];
    renderPage("/products?page=2", "market", "7");

    await waitFor(() =>
      expect(lastListParams("product/my-products")).toEqual(expect.objectContaining({ page: 2, limit: 10 })),
    );
    expect(listCalls("product")).toHaveLength(0);
    expect(await screen.findByText("Nok")).toBeInTheDocument();
  });

  it("⭐ TC2: qidiruv — `search` serverga ketadi, sahifa 1 ga qaytadi; `market_id` market uchun yuborilmaydi", async () => {
    renderPage("/products?product_search=Nok&market_id=99", "market", "7");

    await waitFor(() =>
      expect(lastListParams("product/my-products")).toEqual(expect.objectContaining({ search: "Nok", page: 1 })),
    );
    expect(lastListParams("product/my-products")).not.toHaveProperty("market_id");
  });
});

describe("ProductTable — og'irlik va o'lcham (6FLyjO6j)", () => {
  it("jadval: «Og'irlik», «O'lcham, sm» (planshetda yashirin), «Hisob vazni» + asos; o'lchovsiz — «Kiritilmagan»", async () => {
    productRows = [OLMA, NOK, KURTKA];
    renderPage();
    await screen.findByText("Kurtka");

    expect(screen.getByRole("columnheader", { name: "Og'irlik" })).toHaveClass("max-lg:hidden");
    expect(screen.getByRole("columnheader", { name: "O'lcham, sm" })).toHaveClass("max-lg:hidden");
    expect(screen.getByRole("columnheader", { name: "Hisob vazni" })).not.toHaveClass("max-lg:hidden");
    const [, olma, nok, kurtka] = screen.getAllByRole("row");
    const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells(olma).slice(4, 7)).toEqual(["1,2 kg", "30 × 22 × 15", "2,0 kghajm bo'yicha"]);
    expect(cells(kurtka).slice(4, 7)).toEqual(["0,9 kg", "40 × 30 × 15", "0,9 kghajm hisobga olinmaydi"]);
    expect(within(nok).getAllByRole("cell")[6]).toHaveTextContent("Kiritilmagan");
    expect(within(within(nok).getAllByRole("cell")[4]).getByText("Kiritilmagan")).toHaveClass("sr-only");
  });

  it("market (faqat ko'rish) ham o'lchov ustunlarini ko'radi", async () => {
    productRows = [OLMA];
    renderPage("/products", "market", "77");
    await screen.findByText("Olma");
    expect(screen.getByText("2,0 kg")).toBeInTheDocument();
    expect(screen.getByText("hajm bo'yicha")).toBeInTheDocument();
  });

  it("tahrirlash oynasi: o'lchov to'ldirilgan, kalit, jonli hisob vazni, uchta tarif katagi", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Olma — tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" });
    expect(within(dialog).getByRole("textbox", { name: "Og'irlik" })).toHaveValue("1,2");
    expect(within(dialog).getByRole("textbox", { name: "Uzunlik" })).toHaveValue("30");
    expect(within(dialog).getByRole("switch", { name: "Hajmga qarab hisoblash" })).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).getByText("1,98 kg")).toBeInTheDocument();
    expect(within(dialog).getByText("2,0 kg")).toBeInTheDocument();

    const tiles = await within(dialog).findByRole("group", { name: "Taxminiy yetkazish narxi" });
    await waitFor(() => expect(within(tiles).getByText(/^44\s000 so'm$/)).toBeInTheDocument());
    expect(within(tiles).getByText("Markazgacha")).toBeInTheDocument();
    // Faol tarifi yo'q yo'nalish — «—» (ekran o'quvchiga «faol tarif yo'q»).
    expect(within(tiles).getByText("faol tarif yo'q")).toHaveClass("sr-only");
  });

  it("og'irlik o'zgartirilsa — faqat `weight_kg`; kalit o'chirilsa — `volumetric_enabled: false`", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Olma — tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" });
    const weight = within(dialog).getByRole("textbox", { name: "Og'irlik" });
    await user.clear(weight);
    await user.type(weight, "1,5");
    await user.click(within(dialog).getByRole("switch", { name: "Hajmga qarab hisoblash" }));
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    const body = mocks.patch.mock.calls[0][1] as FormData;
    expect(body.get("weight_kg")).toBe("1.5");
    expect(body.get("volumetric_enabled")).toBe("false");
    expect(body.has("length_cm")).toBe(false);
  });

  it("o'lchovsiz eski mahsulot: o'lchovni kiritmasdan saqlab bo'lmaydi (forma xatosi, PATCH yo'q); kiritilsa — to'rttalasi", async () => {
    productRows = [NOK];
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Nok — tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" });
    expect(within(dialog).getByRole("textbox", { name: "Og'irlik" })).toHaveValue("");
    expect(within(dialog).getByText("Hisoblab bo'lmadi")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    expect(await within(dialog).findByText("Og'irlikni kiriting — kamida 0,1 kg")).toBeInTheDocument();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("4 ta maydonda xato bor");
    expect(mocks.patch).not.toHaveBeenCalled();

    for (const [name, value] of [
      ["Og'irlik", "0,4"],
      ["Uzunlik", "18"],
      ["Kenglik", "10"],
      ["Balandlik", "6"],
    ] as const) {
      await user.type(within(dialog).getByRole("textbox", { name }), value);
    }
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    const [url, body] = mocks.patch.mock.calls[0] as [string, FormData];
    expect(url).toBe("product/2");
    expect([body.get("weight_kg"), body.get("length_cm"), body.get("width_cm"), body.get("height_cm")]).toEqual([
      "0.4",
      "18",
      "10",
      "6",
    ]);
  });
});

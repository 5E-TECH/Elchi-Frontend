import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import CreateProductPage from "./index";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * Mahsulot yaratish — `/products/create-product/:id` (dizayn v2, maketlar `superadmin-products-create`,
 * `admin-products-create`, `*-products-create-errors`): haqiqiy UI orqali; API — `shared/api/api` mock'i. FormData
 * `name` + `market_id` (+ «Narx», rasm), tahrir rejimi (qalam → forma), xato xulosasi, nofaol market bloki,
 * o'chirish tasdig'i. Sahifa faqat xodimga (MH-1: market yaratmaydi — guard `canCreateProducts`).
 * O'lchov (6FLyjO6j): og'irlik + U × K × B majburiy, «Hajmga qarab hisoblash», jonli hisob vazni, taxminiy narx
 * (`POST delivery/quote/by-tariff`), forma darajasidagi tekshiruv.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), delete: vi.fn(), post: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: mocks.delete },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

type Params = Record<string, unknown>;

const ROWS = [
  {
    id: 5,
    name: "Simsiz quloqchin",
    price: "189000.00",
    weight_kg: "0.200",
    length_cm: 15,
    width_cm: 10,
    height_cm: 6,
    volumetric_enabled: true,
    market: { id: 1, name: "Baraka Shop" },
  },
  // O'lchovsiz eski mahsulot (backend `null`) — ro'yxatda «Kiritilmagan».
  { id: 6, name: "Telefon g'ilofi", price: null, weight_kg: null, length_cm: null, width_cm: null, height_cm: null, market: { id: 1, name: "Baraka Shop" } },
];

/** `POST delivery/quote/by-tariff` javobi (hisob vazni 2,0 kg, 1 kg qo'shimcha). */
const QUOTES = {
  data: {
    quotes: {
      city: { tariffId: "city", base: 35000, perExtraKg: 4000, billableKg: 2, extraKg: 1, volumetricKg: 1.98, total: 39000 },
      center: { tariffId: "center", base: 40000, perExtraKg: 4000, billableKg: 2, extraKg: 1, volumetricKg: 1.98, total: 44000 },
      address: { tariffId: "address", base: 60000, perExtraKg: 5000, billableKg: 2, extraKg: 1, volumetricKg: 1.98, total: 65000 },
    },
  },
};

let marketStatus = "active";

const respond = () => {
  mocks.get.mockImplementation((url: string) => {
    if (url === "product/market/1") {
      return Promise.resolve({ data: { data: ROWS, total: ROWS.length, page: 1, limit: 500 } });
    }
    if (url === "users/1") return Promise.resolve({ data: { data: { id: 1, name: "Baraka Shop", status: marketStatus } } });
    if (url === "delivery/pricing-settings") {
      return Promise.resolve({ data: { data: { id: "1", first_kg_included: 1, round_to: 500, volumetric_divisor: 5000 } } });
    }
    return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
  });
  mocks.post.mockImplementation((url: string) =>
    url === "delivery/quote/by-tariff" ? Promise.resolve({ data: QUOTES }) : Promise.resolve({ data: { data: { id: 9 } } }),
  );
  mocks.patch.mockResolvedValue({ data: { data: ROWS[0] } });
  mocks.delete.mockResolvedValue({ data: {} });
};

const stateFor = (role: string, id: string, user: Record<string, unknown> = {}) =>
  ({
    role: { id, role, region: null, name: role },
    user: {
      user: { id, role, ...user },
      isAuthenticated: true,
      accessToken: null,
      loading: false,
      isAppInitializing: false,
      error: null,
    },
  }) as never;

const renderPage = (role = "admin", id = "admin-1", user: Record<string, unknown> = {}, marketId = "1") =>
  renderWithProviders(
    <Routes>
      <Route path="/products/create-product/:id" element={<CreateProductPage />} />
    </Routes>,
    { route: `/products/create-product/${marketId}`, preloadedState: stateFor(role, id, user) },
  );

const callsTo = (url: string) => mocks.get.mock.calls.filter(([called]) => called === url);
/** Mahsulot yaratish so'rovlari (`POST product`; narx hisobi — alohida `POST delivery/quote/by-tariff`). */
const productPosts = () => mocks.post.mock.calls.filter(([called]) => called === "product") as [string, FormData][];
const quotePosts = () => mocks.post.mock.calls.filter(([called]) => called === "delivery/quote/by-tariff");

/** `POST product` xato bilan tugaydi, narx hisobi — odatdagidek. */
const failCreate = (error: unknown) =>
  mocks.post.mockImplementation((url: string) =>
    url === "delivery/quote/by-tariff" ? Promise.resolve({ data: QUOTES }) : Promise.reject(error),
  );

type UserLike = ReturnType<typeof userEvent.setup>;

/** O'lchov maydonlari (sukut — landing namunasi: 1,2 kg, 30 × 22 × 15). */
const fillMeasure = async (
  user: UserLike,
  { weight = "1,2", length = "30", width = "22", height = "15" }: Partial<Record<"weight" | "length" | "width" | "height", string>> = {},
) => {
  for (const [name, value] of [
    ["Og'irlik", weight],
    ["Uzunlik", length],
    ["Kenglik", width],
    ["Balandlik", height],
  ] as const) {
    const input = screen.getByRole("textbox", { name });
    await user.clear(input);
    if (value) await user.type(input, value);
  }
};

const duplicateNameError = () =>
  Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: { status: 409, data: { message: "Bu marketda Simsiz quloqchin nomli mahsulot allaqachon mavjud" } },
  });

/** Telefon kengligi (`useIsPhone` — `matchMedia("(max-width: 767px)")`). */
const asPhone = () => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("max-width: 767px"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
};

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

beforeEach(() => {
  marketStatus = "active";
  respond();
});

describe("CreateProductPage — xodim", () => {
  it("sarlavha, market nomi va market mahsulotlari (barchasi bitta so'rovda)", async () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Yangi mahsulot" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mahsulotlar" })).toBeInTheDocument();
    expect(await screen.findByText("Simsiz quloqchin")).toBeInTheDocument();
    expect(await screen.findByText("Baraka Shop")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mahsulot ma'lumotlari" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Market mahsulotlari" })).toBeInTheDocument();
    expect(screen.getByText("2 ta")).toBeInTheDocument();
    expect((callsTo("product/market/1").at(-1)?.[1] as { params: Params }).params).toEqual({ limit: 500 });
    expect(callsTo("product/my-products")).toHaveLength(0);
  });

  it("ro'yxatda «Narx» ustuni: narx so'mda, narxsiz — «—»; formada ixtiyoriy «Narx» maydoni", async () => {
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "#",
      "Mahsulot nomi · hisob vazni",
      "Narx",
      "Amallar",
    ]);
    const [, first, second] = screen.getAllByRole("row");
    expect(within(first).getAllByRole("cell")[2]).toHaveTextContent(/^189\s000 so'm$/);
    expect(within(second).getAllByRole("cell")[2]).toHaveTextContent("—");
    // «—» ekran o'quvchiga o'qilmaydi — o'rniga «Narx kiritilmagan».
    expect(within(within(second).getAllByRole("cell")[2]).getByText("—")).toHaveAttribute("aria-hidden", "true");
    expect(within(within(second).getAllByRole("cell")[2]).getByText("Narx kiritilmagan")).toHaveClass("sr-only");
    expect(screen.getByRole("textbox", { name: "Narx" })).toHaveValue("");
    expect(screen.getByText("Ixtiyoriy · buyurtma summasiga taklif sifatida chiqadi")).toBeInTheDocument();
  });

  it("yaratish: FormData name + market_id, xabar va forma tozalanadi", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");
    const input = screen.getByRole("textbox", { name: /Mahsulot nomi/ });

    await user.type(input, "  Simsiz sichqoncha ");
    await fillMeasure(user);
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(productPosts()).toHaveLength(1));
    const [url, body] = productPosts()[0];
    expect(url).toBe("product");
    expect(body.get("name")).toBe("Simsiz sichqoncha");
    expect(body.get("market_id")).toBe("1");
    // O'lchov MAJBURIY (backend MH-3): og'irlik nuqta bilan, o'lchamlar butun, kalit sukut yoqiq.
    expect(body.get("weight_kg")).toBe("1.2");
    expect(body.get("length_cm")).toBe("30");
    expect(body.get("width_cm")).toBe("22");
    expect(body.get("height_cm")).toBe("15");
    expect(body.get("volumetric_enabled")).toBe("true");
    // Narx kiritilmagan — yuborilmaydi (backend `null`).
    expect(body.has("price")).toBe(false);
    expect(body.has("image")).toBe(false);
    expect(await screen.findByText("Mahsulot muvaffaqiyatli yaratildi")).toBeInTheDocument();
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("rasm tanlansa FormData'ga qo'shiladi, × bilan olib tashlanadi", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");
    const file = new File(["png"], "sichqoncha.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("Mahsulot rasmi"), file);
    expect(screen.getByRole("img", { name: "Mahsulot rasmi" })).toHaveAttribute("src", "blob:preview");
    await user.click(screen.getByRole("button", { name: "Tanlangan rasmni olib tashlash" }));
    expect(screen.queryByRole("img", { name: "Mahsulot rasmi" })).not.toBeInTheDocument();

    await user.upload(screen.getByLabelText("Mahsulot rasmi"), file);
    await user.type(screen.getByRole("textbox", { name: /Mahsulot nomi/ }), "Sichqoncha");
    await fillMeasure(user);
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(productPosts()).toHaveLength(1));
    expect(productPosts()[0][1].get("image")).toBe(file);
  });

  it("narx bilan yaratish: FormData `price` raqamlar satri, forma tozalanadi", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    await user.type(screen.getByRole("textbox", { name: /Mahsulot nomi/ }), "Yostiq");
    const price = screen.getByRole("textbox", { name: "Narx" });
    await user.type(price, "145000");
    expect((price as HTMLInputElement).value).toMatch(/^145\s000$/);
    await fillMeasure(user);
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(productPosts()).toHaveLength(1));
    expect(productPosts()[0][1].get("price")).toBe("145000");
    await waitFor(() => expect(price).toHaveValue(""));
  });

  it("xato maydonlar — forma tepasida «Saqlab bo'lmadi» va N ta maydon; tuzatilgach yo'qoladi", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    await user.type(screen.getByRole("textbox", { name: "Narx" }), "9999999999999");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    // Maket `*-products-create-errors`: nom, narx va to'rttala o'lchov — 6 ta maydon.
    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent("Saqlab bo'lmadi");
    expect(summary).toHaveTextContent("6 ta maydonda xato bor — qizil bilan belgilanganlarni to'g'rilang.");
    expect(screen.getByText("Narx juda katta — ko'pi bilan 12 xonali son")).toBeInTheDocument();
    expect(productPosts()).toHaveLength(0);

    await user.type(screen.getByRole("textbox", { name: /Mahsulot nomi/ }), "Yostiq");
    await fillMeasure(user);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("1 ta maydonda xato bor"),
    );
    await user.clear(screen.getByRole("textbox", { name: "Narx" }));
    await waitFor(() => expect(screen.queryByText("Saqlab bo'lmadi")).not.toBeInTheDocument());
  });

  it("yaratish xatosi — i18n izoh, xom backend matni ko'rsatilmaydi", async () => {
    failCreate(
      Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: { status: 400, data: { message: "Faqat PNG/JPEG/WebP rasm yuklash mumkin" } },
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    await user.type(screen.getByRole("textbox", { name: /Mahsulot nomi/ }), "Yostiq");
    await fillMeasure(user);
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(await screen.findByText("Mahsulot yaratishda xatolik yuz berdi")).toBeInTheDocument();
    expect(screen.getByText("Ma'lumotlarni tekshirib, qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.queryByText(/PNG\/JPEG/)).not.toBeInTheDocument();
  });

  it("409 (shu nomli mahsulot bor) — «Mahsulot nomi» ostida aniq sabab, xulosa 1 ta maydon, xom matn yo'q", async () => {
    failCreate(duplicateNameError());
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");
    const input = screen.getByRole("textbox", { name: /Mahsulot nomi/ });

    await user.type(input, "Simsiz quloqchin");
    await fillMeasure(user);
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(
      await screen.findByText("Bu marketda shu nomli mahsulot allaqachon bor — boshqa nom kiriting."),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("1 ta maydonda xato bor");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/allaqachon mavjud/)).not.toBeInTheDocument();
    expect(screen.queryByText("Birozdan keyin qayta urinib ko'ring.")).not.toBeInTheDocument();

    // Nom o'zgartirilsa xato yo'qoladi.
    await user.type(input, " 2");
    await waitFor(() => expect(screen.queryByText("Saqlab bo'lmadi")).not.toBeInTheDocument());
  });

  it("tahrirda 409 (PATCH product/:id) — nom maydonida «shu nomli mahsulot bor»", async () => {
    mocks.patch.mockRejectedValue(duplicateNameError());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Simsiz quloqchin — tahrirlash" }));
    const input = screen.getByRole("textbox", { name: /Mahsulot nomi/ });
    await user.clear(input);
    await user.type(input, "Telefon g'ilofi");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("Bu marketda shu nomli mahsulot allaqachon bor — boshqa nom kiriting."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mahsulotni tahrirlash" })).toBeInTheDocument();
    expect(screen.queryByText("Mahsulotni yangilashda xatolik yuz berdi")).not.toBeInTheDocument();
  });

  it("tiyinli narx yaxlitlanmaydi: 1250000.50 → «1 250 000,5 so'm» (mavjud bo'lmagan summa chiqmaydi)", async () => {
    mocks.get.mockImplementation((url: string) => {
      if (url === "product/market/1") {
        return Promise.resolve({
          data: { data: [{ id: 7, name: "Kofe mashinasi", price: "1250000.50" }], total: 1, page: 1, limit: 500 },
        });
      }
      if (url === "users/1") return Promise.resolve({ data: { data: { id: 1, name: "Baraka Shop", status: "active" } } });
      return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
    });
    renderPage();
    await screen.findByText("Kofe mashinasi");

    const [, row] = screen.getAllByRole("row");
    expect(within(row).getAllByRole("cell")[2]).toHaveTextContent(/^1\s250\s000,5 so'm$/);
  });

  it("telefon kartasi: rasm tepaga tekislangan (uzun nom bilan o'rtada suzmaydi), narx nom ostida", async () => {
    const restore = asPhone();
    try {
      renderPage();
      const name = await screen.findByText("Simsiz quloqchin");
      expect(screen.queryByRole("columnheader")).not.toBeInTheDocument();
      const card = name.closest("div");
      const thumb = card?.querySelector("span.size-9");
      expect(thumb?.parentElement).toBe(card);
      expect(card).toHaveClass("items-start");
      expect(card).toHaveTextContent(/189\s000 so'm/);
    } finally {
      restore();
    }
  });

  it("bo'sh nom yuborilmaydi", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    // Maket `*-products-create-errors`: «Mahsulot nomini kiriting».
    expect(await screen.findByText("Mahsulot nomini kiriting")).toBeInTheDocument();
    expect(productPosts()).toHaveLength(0);
  });

  it("qalam — forma tahrir rejimida: PATCH product/:id (market_id siz), «Bekor qilish» tahrirdan chiqadi", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Simsiz quloqchin — tahrirlash" }));
    expect(screen.getByRole("heading", { name: "Mahsulotni tahrirlash" })).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: /Mahsulot nomi/ });
    expect(input).toHaveValue("Simsiz quloqchin");
    expect((screen.getByRole("textbox", { name: "Narx" }) as HTMLInputElement).value).toMatch(/^189\s000$/);
    expect(screen.getByText("Tahrirlanmoqda")).toBeInTheDocument();
    // O'lchov ham formaga tushadi (uz — vergul bilan).
    expect(screen.getByRole("textbox", { name: "Og'irlik" })).toHaveValue("0,2");
    expect(screen.getByRole("textbox", { name: "Uzunlik" })).toHaveValue("15");
    expect(screen.getByRole("textbox", { name: "Kenglik" })).toHaveValue("10");
    expect(screen.getByRole("textbox", { name: "Balandlik" })).toHaveValue("6");

    await user.clear(input);
    await user.type(input, "Quloqchin Pro");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    const [url, body] = mocks.patch.mock.calls[0] as [string, FormData];
    expect(url).toBe("product/5");
    expect(body.get("name")).toBe("Quloqchin Pro");
    expect(body.has("market_id")).toBe(false);
    expect(body.has("price")).toBe(false);
    // O'zgarmagan o'lchov yuborilmaydi (backend: bo'sh / null — 400; saqlangani o'chmaydi).
    for (const key of ["weight_kg", "length_cm", "width_cm", "height_cm", "volumetric_enabled"]) {
      expect(body.has(key)).toBe(false);
    }
    expect(await screen.findByText("Mahsulot muvaffaqiyatli yangilandi")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Mahsulot ma'lumotlari" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Telefon g'ilofi — tahrirlash" }));
    await user.click(screen.getByRole("button", { name: "Bekor qilish" }));
    expect(screen.getByRole("heading", { name: "Mahsulot ma'lumotlari" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Mahsulot nomi/ })).toHaveValue("");
  });

  it("o'chirish tasdig'i: DELETE product/:id, ro'yxat qayta so'raladi", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");
    const before = callsTo("product/market/1").length;

    await user.click(screen.getByRole("button", { name: "Telefon g'ilofi — o'chirish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "O'chirishni tasdiqlang" });
    expect(within(dialog).getByText("Telefon g'ilofi")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith("product/6"));
    expect(await screen.findByText("Mahsulot muvaffaqiyatli o'chirildi")).toBeInTheDocument();
    await waitFor(() => expect(callsTo("product/market/1").length).toBeGreaterThan(before));
  });

  it("nofaol market: ogohlantirish, maydon va «Saqlash» o'chiq, so'rov ketmaydi", async () => {
    marketStatus = "inactive";
    renderPage();

    expect(
      await screen.findByText("Bu market faol emas. Faol emas market uchun yangi mahsulot yaratib bo'lmaydi."),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Mahsulot nomi/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saqlash" })).toBeDisabled();
    expect(productPosts()).toHaveLength(0);
  });
});

describe("CreateProductPage — og'irlik va o'lcham (6FLyjO6j)", () => {
  afterEach(async () => {
    await i18n.changeLanguage("uz");
  });

  it("ro'yxatda nom ostida hisob vazni; o'lchovsiz eski mahsulot — «Kiritilmagan»", async () => {
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    const [, first, second] = screen.getAllByRole("row");
    expect(within(first).getAllByRole("cell")[1]).toHaveTextContent(/0,2 kg · og'irlik bo'yicha/);
    expect(within(second).getAllByRole("cell")[1]).toHaveTextContent("Kiritilmagan");
  });

  it("o'lchovsiz saqlashga urinish — forma xatosi, `POST product` ketmaydi (backend 400 ga tushmaydi)", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    await user.type(screen.getByRole("textbox", { name: /Mahsulot nomi/ }), "Yostiq");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(await screen.findByText("Og'irlikni kiriting — kamida 0,1 kg")).toBeInTheDocument();
    expect(screen.getByText("Uzunlikni kiriting")).toBeInTheDocument();
    expect(screen.getByText("Kenglikni kiriting")).toBeInTheDocument();
    expect(screen.getByText("Balandlikni kiriting")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("4 ta maydonda xato bor");
    expect(screen.getByRole("textbox", { name: "Og'irlik" })).toHaveAttribute("aria-invalid", "true");
    expect(productPosts()).toHaveLength(0);
  });

  it("harf yoki manfiy son — forma xatosi (maket: «Faqat raqam kiriting», «Musbat butun son kiriting»)", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    await user.type(screen.getByRole("textbox", { name: /Mahsulot nomi/ }), "Yostiq");
    await fillMeasure(user, { weight: "-1", length: "30,5", width: "o'n", height: "-20" });
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(await screen.findByText("Og'irlik kamida 0,1 kg bo'lishi kerak")).toBeInTheDocument();
    expect(screen.getByText("Faqat raqam kiriting")).toBeInTheDocument();
    expect(screen.getAllByText("Musbat butun son kiriting")).toHaveLength(2);
    expect(productPosts()).toHaveLength(0);

    await fillMeasure(user, { weight: "abc", length: "1001", width: "22", height: "15" });
    expect(await screen.findByText("Faqat raqam kiriting")).toBeInTheDocument();
    expect(screen.getByText("Ko'pi bilan 1 000 sm")).toBeInTheDocument();
    await fillMeasure(user, { weight: "0,1255", length: "30", width: "22", height: "15" });
    expect(await screen.findByText("Ko'pi bilan 3 ta kasr xona (masalan, 0,125)")).toBeInTheDocument();
    expect(productPosts()).toHaveLength(0);
  });

  it("«Hajmga qarab hisoblash» sukut yoqiq; o'chirilsa — «faqat real og'irlik» izohi, maydonlar bloklanmaydi, FormData `false`", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    const toggle = screen.getByRole("switch", { name: "Hajmga qarab hisoblash" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByText("Yetkazish narxi real og'irlik va hajmli vaznning kattasidan hisoblanadi"),
    ).toBeInTheDocument();
    expect(screen.getByText("Qadoqlangan holatda, santimetrda, butun son")).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByText("Yetkazish narxi faqat real og'irlikdan hisoblanadi. O'lchamlar baribir kiritiladi va saqlanadi."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Majburiy, hajm hisobi o'chiq bo'lsa ham · qadoqlangan holatda, santimetrda, butun son"),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Uzunlik" })).toBeEnabled();

    await user.type(screen.getByRole("textbox", { name: /Mahsulot nomi/ }), "Kurtka");
    await fillMeasure(user);
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(productPosts()).toHaveLength(1));
    expect(productPosts()[0][1].get("volumetric_enabled")).toBe("false");
    expect(productPosts()[0][1].get("length_cm")).toBe("30");
  });

  it("jonli ko'rsatkich: 30 × 22 × 15, 1,2 kg → «1,98 kg» / «2,0 kg» (landing bilan AYNI), o'zgarsa darhol yangilanadi", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    expect(screen.getByText("Hisoblab bo'lmadi")).toBeInTheDocument();
    await fillMeasure(user);
    expect(screen.getByText("1,98 kg")).toBeInTheDocument();
    expect(screen.getByText("2,0 kg")).toBeInTheDocument();
    expect(screen.getByText("30 × 22 × 15 / 5000")).toBeInTheDocument();
    expect(screen.getByText("kattasi olinadi: hajm bo'yicha")).toBeInTheDocument();

    await fillMeasure(user, { height: "5" });
    expect(screen.getByText("0,66 kg")).toBeInTheDocument();
    expect(screen.getByText("1,2 kg")).toBeInTheDocument();
    expect(screen.getByText("kattasi olinadi: og'irlik bo'yicha")).toBeInTheDocument();

    await fillMeasure(user, { height: "15" });
    await user.click(screen.getByRole("switch", { name: "Hajmga qarab hisoblash" }));
    expect(screen.getByText("1,98 kg")).toHaveClass("line-through");
    expect(screen.getByText("1,2 kg")).toBeInTheDocument();
    expect(screen.getByText("hajm hisobga olinmaydi — faqat og'irlik")).toBeInTheDocument();
  });

  it("«Taxminiy yetkazish narxi»: o'lchov to'g'ri bo'lgach `POST delivery/quote/by-tariff` (kutib, bitta so'rov), uchala tarif", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");
    expect(screen.queryByText("Taxminiy yetkazish narxi")).not.toBeInTheDocument();

    await fillMeasure(user);
    const list = await screen.findByRole("list", { name: "Taxminiy yetkazish narxi" });
    await waitFor(() => expect(within(list).getByText(/^44\s000 so'm$/)).toBeInTheDocument());
    expect(quotePosts()).toHaveLength(1);
    expect(quotePosts()[0][1]).toEqual({
      items: [{ weight_kg: 1.2, length_cm: 30, width_cm: 22, height_cm: 15, volumetric_enabled: true }],
    });
    expect(within(list).getByText("Shahar ichida")).toBeInTheDocument();
    expect(within(list).getByText(/^39\s000 so'm$/)).toBeInTheDocument();
    expect(within(list).getByText(/^65\s000 so'm$/)).toBeInTheDocument();
    expect(within(list).getAllByRole("listitem")[1]).toHaveTextContent(/Viloyat filialigacha · 40\s000 \+ 1 kg × 4\s000/);
    // Admin — chegara va yaxlitlash sozlamadan; tariflar sahifasiga yo'l.
    expect(
      screen.getByText(
        /Hisob vazni 2,0 kg: birinchi 1 kg asosiy narxga kiradi, qolgan 1 kg uchun qo'shimcha haq\. Narx 500 so'mga yaxlitlanadi; yakuniy narx buyurtma sotilganda qotiriladi\. Tariflar — Hududlar → Yetkazish tariflari\./,
      ),
    ).toBeInTheDocument();
  });

  it("menejer — sozlama so'ralmaydi (403 bo'lardi), izoh qisqa", async () => {
    const user = userEvent.setup();
    renderPage("manager", "manager-1");
    await screen.findByText("Simsiz quloqchin");

    await fillMeasure(user);
    expect(
      await screen.findByText("Hisob vazni 2,0 kg: 1 kg uchun qo'shimcha haq. Yakuniy narx buyurtma sotilganda qotiriladi."),
    ).toBeInTheDocument();
    expect(callsTo("delivery/pricing-settings")).toHaveLength(0);
  });

  it("narx API xatosi (hali deploy qilinmagan) — «Narxni hisoblab bo'lmadi», forma saqlashda davom etadi", async () => {
    mocks.post.mockImplementation((url: string) =>
      url === "delivery/quote/by-tariff"
        ? Promise.reject(Object.assign(new Error("Not Found"), { isAxiosError: true, response: { status: 404 } }))
        : Promise.resolve({ data: { data: { id: 9 } } }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    await user.type(screen.getByRole("textbox", { name: /Mahsulot nomi/ }), "Yostiq");
    await fillMeasure(user);
    expect(await screen.findByText("Narxni hisoblab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(productPosts()).toHaveLength(1));
    expect(productPosts()[0][1].get("weight_kg")).toBe("1.2");
    expect(await screen.findByText("Mahsulot muvaffaqiyatli yaratildi")).toBeInTheDocument();
  });

  it("tahrir: faqat o'zgargan o'lchov yuboriladi; bitta o'lcham o'zgarsa — uchalasi birga", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Simsiz quloqchin — tahrirlash" }));
    await fillMeasure(user, { weight: "0,3", length: "15", width: "10", height: "6" });
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    let body = mocks.patch.mock.calls[0][1] as FormData;
    expect(body.get("weight_kg")).toBe("0.3");
    expect(body.has("length_cm")).toBe(false);
    expect(body.has("volumetric_enabled")).toBe(false);

    await user.click(await screen.findByRole("button", { name: "Simsiz quloqchin — tahrirlash" }));
    await fillMeasure(user, { weight: "0,2", length: "16", width: "10", height: "6" });
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(2));
    body = mocks.patch.mock.calls[1][1] as FormData;
    expect(body.has("weight_kg")).toBe(false);
    expect([body.get("length_cm"), body.get("width_cm"), body.get("height_cm")]).toEqual(["16", "10", "6"]);
  });

  it("xato matni til almashsa yangi tilda (i18n modul yuklanishida muzlatilmagan)", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(await screen.findByText("Og'irlikni kiriting — kamida 0,1 kg")).toBeInTheDocument();

    await i18n.changeLanguage("ru");
    expect(await screen.findByText("Введите вес — не менее 0,1 кг")).toBeInTheDocument();
    expect(screen.getByText("Введите длину")).toBeInTheDocument();
    expect(screen.queryByText("Og'irlikni kiriting — kamida 0,1 kg")).not.toBeInTheDocument();
  });
});

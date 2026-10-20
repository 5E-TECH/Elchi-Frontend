import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import CreateProductPage from "./index";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * Mahsulot yaratish — `/products/create-product/:id` (dizayn v2, maketlar `superadmin-products-create`,
 * `admin-products-create`, `*-products-create-errors`): haqiqiy UI orqali; API — `shared/api/api` mock'i. FormData
 * `name` + `market_id` (+ «Narx», rasm), tahrir rejimi (qalam → forma), xato xulosasi, nofaol market bloki,
 * o'chirish tasdig'i. Sahifa faqat xodimga (MH-1: market yaratmaydi — guard `canCreateProducts`).
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), delete: vi.fn(), post: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: mocks.delete },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

type Params = Record<string, unknown>;

const ROWS = [
  { id: 5, name: "Simsiz quloqchin", price: "189000.00", market: { id: 1, name: "Baraka Shop" } },
  { id: 6, name: "Telefon g'ilofi", price: null, market: { id: 1, name: "Baraka Shop" } },
];

let marketStatus = "active";

const respond = () => {
  mocks.get.mockImplementation((url: string) => {
    if (url === "product/market/1") {
      return Promise.resolve({ data: { data: ROWS, total: ROWS.length, page: 1, limit: 500 } });
    }
    if (url === "users/1") return Promise.resolve({ data: { data: { id: 1, name: "Baraka Shop", status: marketStatus } } });
    return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
  });
  mocks.post.mockResolvedValue({ data: { data: { id: 9 } } });
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
      "Mahsulot nomi",
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
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    const [url, body] = mocks.post.mock.calls[0] as [string, FormData];
    expect(url).toBe("product");
    expect(body.get("name")).toBe("Simsiz sichqoncha");
    expect(body.get("market_id")).toBe("1");
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
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect((mocks.post.mock.calls[0][1] as FormData).get("image")).toBe(file);
  });

  it("narx bilan yaratish: FormData `price` raqamlar satri, forma tozalanadi", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    await user.type(screen.getByRole("textbox", { name: /Mahsulot nomi/ }), "Yostiq");
    const price = screen.getByRole("textbox", { name: "Narx" });
    await user.type(price, "145000");
    expect((price as HTMLInputElement).value).toMatch(/^145\s000$/);
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect((mocks.post.mock.calls[0][1] as FormData).get("price")).toBe("145000");
    await waitFor(() => expect(price).toHaveValue(""));
  });

  it("xato maydonlar — forma tepasida «Saqlab bo'lmadi» va N ta maydon; tuzatilgach yo'qoladi", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    await user.type(screen.getByRole("textbox", { name: "Narx" }), "9999999999999");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent("Saqlab bo'lmadi");
    expect(summary).toHaveTextContent("2 ta maydonda xato bor — qizil bilan belgilanganlarni to'g'rilang.");
    expect(screen.getByText("Narx juda katta — ko'pi bilan 12 xonali son")).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox", { name: /Mahsulot nomi/ }), "Yostiq");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("1 ta maydonda xato bor"),
    );
    await user.clear(screen.getByRole("textbox", { name: "Narx" }));
    await waitFor(() => expect(screen.queryByText("Saqlab bo'lmadi")).not.toBeInTheDocument());
  });

  it("yaratish xatosi — i18n izoh, xom backend matni ko'rsatilmaydi", async () => {
    mocks.post.mockRejectedValue(
      Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: { status: 400, data: { message: "Faqat PNG/JPEG/WebP rasm yuklash mumkin" } },
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    await user.type(screen.getByRole("textbox", { name: /Mahsulot nomi/ }), "Yostiq");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(await screen.findByText("Mahsulot yaratishda xatolik yuz berdi")).toBeInTheDocument();
    expect(screen.getByText("Ma'lumotlarni tekshirib, qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.queryByText(/PNG\/JPEG/)).not.toBeInTheDocument();
  });

  it("409 (shu nomli mahsulot bor) — «Mahsulot nomi» ostida aniq sabab, xulosa 1 ta maydon, xom matn yo'q", async () => {
    mocks.post.mockRejectedValue(duplicateNameError());
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");
    const input = screen.getByRole("textbox", { name: /Mahsulot nomi/ });

    await user.type(input, "Simsiz quloqchin");
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

    await user.click(await screen.findByRole("button", { name: "Telefon g'ilofi — tahrirlash" }));
    const input = screen.getByRole("textbox", { name: /Mahsulot nomi/ });
    await user.clear(input);
    await user.type(input, "Simsiz quloqchin");
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
    expect(mocks.post).not.toHaveBeenCalled();
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

    await user.clear(input);
    await user.type(input, "Quloqchin Pro");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    const [url, body] = mocks.patch.mock.calls[0] as [string, FormData];
    expect(url).toBe("product/5");
    expect(body.get("name")).toBe("Quloqchin Pro");
    expect(body.has("market_id")).toBe(false);
    expect(body.has("price")).toBe(false);
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
    expect(mocks.post).not.toHaveBeenCalled();
  });
});

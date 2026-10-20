import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import CreateProductPage from "./index";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * Mahsulot yaratish — `/products/create-product/:id` (dizayn v2, maketlar `superadmin-products-create`,
 * `admin-products-create`): haqiqiy UI orqali; API — `shared/api/api` mock'i. FormData `name` + xodimda
 * `market_id` (+ rasm), tahrir rejimi (qalam → forma), nofaol market bloki, o'chirish tasdig'i.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), delete: vi.fn(), post: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: mocks.delete },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

type Params = Record<string, unknown>;

const ROWS = [
  { id: 5, name: "Simsiz quloqchin", market: { id: 1, name: "Baraka Shop" } },
  { id: 6, name: "Telefon g'ilofi", market: { id: 1, name: "Baraka Shop" } },
];

let marketStatus = "active";

const respond = () => {
  mocks.get.mockImplementation((url: string) => {
    if (url === "product/market/1" || url === "product/my-products") {
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

  it("bo'sh nom yuborilmaydi", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Simsiz quloqchin");

    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    expect(await screen.findByText("Mahsulot nomi kiritilishi shart")).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("qalam — forma tahrir rejimida: PATCH product/:id (market_id siz), «Bekor qilish» tahrirdan chiqadi", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Simsiz quloqchin — tahrirlash" }));
    expect(screen.getByRole("heading", { name: "Mahsulotni tahrirlash" })).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: /Mahsulot nomi/ });
    expect(input).toHaveValue("Simsiz quloqchin");
    expect(screen.getByText("Tahrirlanmoqda")).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "Quloqchin Pro");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    const [url, body] = mocks.patch.mock.calls[0] as [string, FormData];
    expect(url).toBe("product/5");
    expect(body.get("name")).toBe("Quloqchin Pro");
    expect(body.has("market_id")).toBe(false);
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

describe("CreateProductPage — market", () => {
  it("o'z mahsulotlari, «Tanlangan market», yaratishda market_id yo'q, tahrir — PATCH product/my/:id", async () => {
    const user = userEvent.setup();
    renderPage("market", "1", { name: "Baraka Shop", status: "active" });

    expect(screen.getByRole("heading", { level: 1, name: "Mahsulot yaratish" })).toBeInTheDocument();
    expect(screen.getByText("Tanlangan market:")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Yangi mahsulot" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mavjud mahsulotlar" })).toBeInTheDocument();
    expect(screen.getByText("Qalamni bossangiz, mahsulot formada tahrirlanadi")).toBeInTheDocument();
    expect(await screen.findByText("Jami 2 ta")).toBeInTheDocument();
    expect(callsTo("product/market/1")).toHaveLength(0);
    expect(callsTo("users/1")).toHaveLength(0);
    expect((callsTo("product/my-products").at(-1)?.[1] as { params: Params }).params).toEqual({ limit: 500 });

    await user.type(screen.getByRole("textbox", { name: /Mahsulot nomi/ }), "Termos");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect((mocks.post.mock.calls[0][1] as FormData).has("market_id")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Simsiz quloqchin — tahrirlash" }));
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect(mocks.patch.mock.calls[0][0]).toBe("product/my/5");
  });

  it("nofaol market profili — yaratish bloklanadi", async () => {
    renderPage("market", "1", { name: "Baraka Shop", status: "inactive" });

    expect(
      await screen.findByText("Bu market faol emas. Faol emas market uchun yangi mahsulot yaratib bo'lmaydi."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saqlash" })).toBeDisabled();
  });
});

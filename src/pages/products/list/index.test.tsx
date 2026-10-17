import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ProductTable from "./index";
import { renderWithProviders } from "../../../test/test-utils";
import { useResetInputsOnPathChange } from "../../../shared/lib/useResetInputsOnPathChange";

/**
 * Mahsulotlar — `/products` (dizayn v2, maketlar `superadmin-products-list`, `market-products-list` va oynalar):
 * haqiqiy UI (`Dialog`, `useConfirm`, `notify`) orqali; API — `shared/api/api` mock'i. Qidiruv va market filtri
 * URL bilan sinxron (sahifa 1 ga qaytadi), market rolida `product/my-products` (market filtri yo'q), tahrir —
 * xodim `PATCH product/:id`, market `PATCH product/my/:id`, o'chirish — tasdiq oynasi orqali `DELETE product/:id`.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), delete: vi.fn(), post: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: mocks.delete },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

type Params = Record<string, unknown>;

const OLMA = { id: 1, name: "Olma", image_url: "/uploads/olma.png", market: { id: 1, name: "Fresh" } };
const NOK = { id: 2, name: "Nok", market: { id: 2, name: "Bozor" } };

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
    return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
  });
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

  it("nom bo'yicha saralash joriy sahifa ichida (so'rov qayta ketmaydi)", async () => {
    productRows = [OLMA, NOK];
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Nok");
    const before = listCalls().length;
    const names = () =>
      screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[1].textContent);
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

  it("market: tugma o'z id'si bilan to'g'ridan-to'g'ri create sahifasini ochadi", async () => {
    const user = userEvent.setup();
    renderPage("/products", "market", "77");

    await user.click(screen.getByRole("button", { name: "Mahsulot yaratish" }));

    await waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/products/create-product/77"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

  it("xato bo'lsa oyna ochiq qoladi va backend matni oynada", async () => {
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

    expect(await within(dialog).findByText("Mahsulot buyurtmada ishlatilgan")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "O'chirishni tasdiqlang" })).toBeInTheDocument();
  });

  it("xodim tahrirlaydi: oynada market nomi va joriy nom, PATCH product/1 FormData bilan", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Olma — tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" });
    expect(within(dialog).getByText("Fresh")).toBeInTheDocument();
    expect(within(dialog).getByText("Rasm")).toBeInTheDocument();
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
    expect(body.has("image")).toBe(false);
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

    expect(await within(dialog).findByText("Mahsulot nomi kiritilishi shart")).toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("tanlangan rasm FormData'ga qo'shiladi", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Olma — tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" });
    const file = new File(["png"], "olma.png", { type: "image/png" });
    await user.upload(within(dialog).getByLabelText("Rasm"), file);
    expect(within(dialog).getByRole("img", { name: "Mahsulot rasmi" })).toHaveAttribute("src", "blob:olma");
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    const [, body] = mocks.patch.mock.calls[0] as [string, FormData];
    expect(body.get("image")).toBe(file);
  });

  it("market tahrirlaydi: PATCH product/my/1 (backend PATCH product/:id ga marketni qo'ymaydi), izohda market yo'q", async () => {
    const user = userEvent.setup();
    renderPage("/products", "market");

    await user.click(await screen.findByRole("button", { name: "Olma — tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" });
    expect(within(dialog).queryByText("Fresh")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Mahsulot rasmi")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect(mocks.patch.mock.calls[0][0]).toBe("product/my/1");
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

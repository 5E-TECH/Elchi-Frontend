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
 * qNwXfqLL — buyurtma yaratish katalogi: qidiruv serverda (`?search=…&limit=500`, 300 ms kechikish), mijozdagi
 * filtr emas. Soxta server to'liq katalogda 10 ta mahsulot beradi, 11-si («Eski choynak») faqat server qidiruvida
 * keladi — u ro'yxatda chiqsa, qidiruv serverga borgan.
 */

const marketState = { role: { id: "7", role: "market", region: null, name: "Test market" } } as never;
const adminState = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;

const MARKETS = [{ id: 3, name: "Baraka Shop", phone_number: "+998903152241", status: "active" }];
const FIRST_TEN = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, name: `Mahsulot ${index + 1}`, price: 10_000 }));
const ELEVENTH = { id: 11, name: "Eski choynak", price: 55_000 };

type Params = { search?: string; limit?: number } | undefined;

/** Server: `search` bo'lsa — butun katalogdan (11 ta) nom bo'yicha; bo'lmasa — 10 ta (yuklangan qism). */
const serverCatalog = (url: string, config?: { params?: Params }) => {
  if (url === "markets") return Promise.resolve({ data: { statusCode: 200, message: "ok", data: MARKETS } });
  if (url === "product/my-products" || url === "product/market/3") {
    const search = config?.params?.search?.toLowerCase();
    const data = search ? [...FIRST_TEN, ELEVENTH].filter((product) => product.name.toLowerCase().includes(search)) : FIRST_TEN;
    return Promise.resolve({ data: { data, total: data.length, page: 1, limit: config?.params?.limit ?? 10 } });
  }
  return aiApiGet(url);
};

const productCalls = (path: string) =>
  mocks.get.mock.calls.filter(([url]) => url === path).map(([, config]) => (config as { params?: Params })?.params);

const searchBox = () => screen.getByRole("searchbox", { name: "Mahsulot qo'shish" });

const openAdminCatalog = async (user: ReturnType<typeof userEvent.setup>) => {
  renderWithProviders(<OrderCreate />, { preloadedState: adminState });
  await user.click(screen.getByRole("button", { name: /^Market/ }));
  const dialog = await screen.findByRole("dialog", { name: "Market tanlash" });
  await user.click(await within(dialog).findByRole("option", { name: /Baraka Shop/ }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Market tanlash" })).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Keyingi" }));
  return screen.findByRole("list", { name: "Baraka Shop katalogi" });
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  mocks.get.mockReset();
  mocks.get.mockImplementation(serverCatalog);
  mocks.post.mockReset();
});

describe("OrderCreate — katalog qidiruvi serverda (qNwXfqLL)", () => {
  it("⭐ market roli: qidiruv `my-products?search=…&limit=500` bilan, 11-mahsulot serverdan topiladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });
    const catalog = await screen.findByRole("list", { name: "Test market katalogi" });
    await within(catalog).findByRole("button", { name: /Mahsulot 10/ });
    expect(within(catalog).queryByRole("button", { name: /Eski choynak/ })).not.toBeInTheDocument();

    await user.type(searchBox(), "choynak");

    expect(await within(catalog).findByRole("button", { name: /Eski choynak/ })).toBeInTheDocument();
    expect(within(catalog).getAllByRole("button")).toHaveLength(1);
    // Kechikish: har harf uchun emas, yozib bo'lingach bitta so'rov.
    expect(productCalls("product/my-products")).toEqual([{ limit: 500 }, { search: "choynak", limit: 500 }]);
  });

  it("⭐ superadmin: tanlangan market katalogi — `product/market/3?search=…&limit=500`", async () => {
    const user = userEvent.setup();
    const catalog = await openAdminCatalog(user);
    await within(catalog).findByRole("button", { name: /Mahsulot 1\b/ });

    await user.type(searchBox(), "eski");

    expect(await within(catalog).findByRole("button", { name: /Eski choynak/ })).toBeInTheDocument();
    expect(productCalls("product/market/3")).toContainEqual({ search: "eski", limit: 500 });
    expect(productCalls("product/my-products")).toEqual([]);
  });

  it("⭐ server hech narsa topmasa — «Topilmadi»; tozalansa darhol to'liq katalog, yangi so'rovsiz", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });
    const catalog = await screen.findByRole("list", { name: "Test market katalogi" });
    await within(catalog).findByRole("button", { name: /Mahsulot 10/ });

    await user.type(searchBox(), "yo'q narsa");
    expect(await within(catalog).findByText("Topilmadi")).toBeInTheDocument();
    expect(productCalls("product/my-products").at(-1)).toEqual({ search: "yo'q narsa", limit: 500 });

    const calls = mocks.get.mock.calls.length;
    await user.clear(searchBox());
    expect(within(catalog).getAllByRole("button")).toHaveLength(10);
    expect(mocks.get.mock.calls.length).toBe(calls);
  });

  it("server qidiruvi yiqilsa — yuklangan katalog ichida qidiriladi (ro'yxat bo'sh qolmaydi)", async () => {
    mocks.get.mockImplementation((url: string, config?: { params?: Params }) =>
      config?.params?.search ? Promise.reject(new Error("network")) : serverCatalog(url, config),
    );
    const user = userEvent.setup();
    renderWithProviders(<OrderCreate />, { preloadedState: marketState });
    const catalog = await screen.findByRole("list", { name: "Test market katalogi" });
    await within(catalog).findByRole("button", { name: /Mahsulot 10/ });

    await user.type(searchBox(), "mahsulot 1");

    await waitFor(() => expect(productCalls("product/my-products")).toContainEqual({ search: "mahsulot 1", limit: 500 }));
    await waitFor(() => expect(within(catalog).getAllByRole("button")).toHaveLength(2));
    expect(within(catalog).getByRole("button", { name: /Mahsulot 10/ })).toBeInTheDocument();
  });
});

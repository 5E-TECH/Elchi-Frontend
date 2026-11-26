import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { AddOrderItemPicker } from "./AddOrderItemPicker";

/**
 * Qidiruv limitlari (2026-11-27): «Mahsulot qo'shish» ilgari yuklangan katalog (≤ 500) ichida qidirardi — 501-mahsulot
 * topilmasdi. Endi qidiruv serverda (`?search=`, nomi / SKU / shtrix-kod), bo'sh qidiruv — to'liq katalog.
 */
const state = vi.hoisted(() => ({
  calls: [] as Array<{ id?: string; enabled?: boolean; params?: Record<string, unknown> }>,
}));

const CATALOG = { data: [{ id: "1", name: "Choynak" }, { id: "2", name: "Piyola" }] };
const FOUND = { data: [{ id: "777", name: "Eski termos" }] };

vi.mock("../../../../entities/product", () => ({
  PRODUCT_LIST_MAX_LIMIT: 500,
  useProducts: () => ({
    useGetByMarketId: (id?: string, enabled?: boolean, params?: Record<string, unknown>) => {
      state.calls.push({ id, enabled, params });
      if (!enabled) return { data: undefined, isLoading: false, isError: false, isSuccess: false };
      return { data: params?.search ? FOUND : CATALOG, isLoading: false, isError: false, isSuccess: true };
    },
    useGetMyProducts: () => ({ data: undefined, isLoading: false, isError: false, isSuccess: false }),
  }),
}));

const superadmin = { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never;

beforeEach(() => {
  state.calls = [];
});

describe("AddOrderItemPicker — server qidiruvi", () => {
  it("⭐ katalogda yo'q (500 dan keyingi) mahsulot qidiruvda serverdan topiladi va qo'shiladi", async () => {
    const onAdd = vi.fn();
    renderWithProviders(<AddOrderItemPicker marketId="15" usedProductIds={new Set()} onAdd={onAdd} />, {
      preloadedState: superadmin,
    });
    const user = userEvent.setup();
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    expect(await screen.findByRole("option", { name: "Choynak" })).toBeInTheDocument();

    await user.type(combobox, "termos");
    const found = await screen.findByRole("option", { name: "Eski termos" });
    expect(state.calls.some((call) => call.enabled && call.params?.search === "termos" && call.params?.limit === 500)).toBe(
      true,
    );
    expect(state.calls.every((call) => call.id === "15")).toBe(true);

    await user.click(found);
    expect(onAdd).toHaveBeenCalledWith({ id: "777", name: "Eski termos" });
  });

  it("ro'yxatdagi mahsulot variantlarda chiqmaydi", async () => {
    renderWithProviders(<AddOrderItemPicker marketId="15" usedProductIds={new Set(["1"])} onAdd={vi.fn()} />, {
      preloadedState: superadmin,
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByRole("option", { name: "Piyola" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Choynak" })).not.toBeInTheDocument();
  });
});

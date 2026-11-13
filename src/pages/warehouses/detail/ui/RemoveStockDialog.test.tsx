import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeWarehouseStock, type WarehouseStockRow } from "../../../../entities/warehouse";
import { renderWithProviders } from "../../../../test/test-utils";
import { rawProduct } from "../../../../test/warehouseFixtures";
import { RemoveStockDialog } from "./RemoveStockDialog";

/**
 * 2026-11-13 «Ombordagi qaysidir mahsulotni o'chirish imkoni bo'lishi kerak qoldiq 0 bo'lishi shart emas»:
 * qoldiq bor qator ham o'chiriladi (DELETE + ixtiyoriy sabab); band dona bo'lsa — ogohlantirish, tugma o'chiq;
 * server 409 `WAREHOUSE_STOCK_RESERVED` qaytarsa — tushunarli matn.
 */

const mocks = vi.hoisted(() => ({ delete: vi.fn() }));

vi.mock("../../../../shared/api/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: mocks.delete },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const rowOf = (onHand: number, reserved: number): WarehouseStockRow =>
  normalizeWarehouseStock({
    data: [
      {
        stock_id: "55",
        product: rawProduct({ id: "142", name: "Sumka" }),
        market: { id: "121", name: "Baraka Shop" },
        on_hand: onHand,
        reserved,
        available: onHand - reserved,
        threshold: 5,
        level: onHand - reserved > 5 ? "ok" : onHand - reserved > 0 ? "low" : "out",
      },
    ],
  }).items[0];

const open = (row: WarehouseStockRow, onClose = vi.fn()) => {
  renderWithProviders(<RemoveStockDialog warehouseId="3" row={row} onClose={onClose} />, {
    preloadedState: { role: { id: "1", role: "superadmin", region: null, name: "superadmin" } } as never,
  });
  return onClose;
};

beforeEach(() => {
  mocks.delete.mockReset();
});

describe("RemoveStockDialog — mahsulotni ombordan o'chirish", () => {
  it("⭐ qoldiq 7 bo'lsa ham o'chiriladi: chiqim ogohlantirishi, sabab bilan DELETE, oyna yopiladi", async () => {
    mocks.delete.mockResolvedValueOnce({ data: { data: { product_id: "142", written_off: 7, removed: true } } });
    const onClose = open(rowOf(7, 0));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotni ombordan o'chirish" });
    expect(dialog).toHaveTextContent("«Sumka» ombor ro'yxatidan o'chiriladi. Qoldiq 0 bo'lishi shart emas.");
    expect(dialog).toHaveTextContent("Qoldiqdagi 7 dona ombordan chiqariladi");

    await userEvent.type(screen.getByRole("textbox", { name: "Sabab" }), "Market olib ketdi");
    await userEvent.click(screen.getByRole("button", { name: "O'chirish" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.delete).toHaveBeenCalledWith("warehouses/3/stock/142", { data: { reason: "Market olib ketdi" } });
  });

  it("qoldiq 0 — «faqat ro'yxatdan olinadi», sababsiz ham yuboriladi", async () => {
    mocks.delete.mockResolvedValueOnce({ data: { product_id: "142", written_off: 0 } });
    const onClose = open(rowOf(0, 0));
    expect(await screen.findByText("Qoldiq yo'q — mahsulot faqat ro'yxatdan olinadi.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "O'chirish" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.delete).toHaveBeenCalledWith("warehouses/3/stock/142", { data: {} });
  });

  it("⭐ band dona bo'lsa — ogohlantirish, «O'chirish» o'chiq, so'rov ketmaydi", async () => {
    open(rowOf(5, 2));
    const dialog = await screen.findByRole("dialog", { name: "Mahsulotni ombordan o'chirish" });
    expect(dialog).toHaveTextContent("O'chirib bo'lmaydi");
    expect(dialog).toHaveTextContent("2 dona faol buyurtmalarda band");
    expect(screen.getByRole("button", { name: "O'chirish" })).toBeDisabled();
    expect(screen.queryByRole("textbox", { name: "Sabab" })).not.toBeInTheDocument();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("server 409 WAREHOUSE_STOCK_RESERVED (orada band qilingan) — tushunarli xato, oyna ochiq qoladi", async () => {
    mocks.delete.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 409, data: { statusCode: 409, code: "WAREHOUSE_STOCK_RESERVED", message: "band" } },
    });
    const onClose = open(rowOf(4, 0));
    await userEvent.click(await screen.findByRole("button", { name: "O'chirish" }));
    expect(
      await screen.findByText("Mahsulot faol buyurtmalarda band — avval ular bekor qilinsin yoki kuryerga berilsin."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

import { expect, test } from "@playwright/test";
import { mockCourierCancelApi, openSellDialog } from "./support/courierCancel";

/** Kuryer → «Sotish» — 1440px. «Marketga to'langan summa» maydoni olib tashlangan (ega 2026-11-07). */

test.describe("Kuryer sotish oynasi — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ «Marketga to'langan summa» maydoni yo'q; sotuvda `paidAmount` yuborilmaydi", async ({ page }) => {
    const { sells, leaked } = await mockCourierCancelApi(page);
    const dialog = await openSellDialog(page);

    await expect(dialog).toContainText("№10234 · Ipak Yo'li Savdo · Uygacha");
    await expect(dialog.getByLabel("Marketga to'langan summa")).toHaveCount(0);
    await expect(dialog.getByText(/so'mdan oshmasin/)).toHaveCount(0);
    await dialog.getByRole("button", { name: "Sotish", exact: true }).click();

    await expect(dialog).toHaveCount(0);
    expect(sells).toEqual([{ id: "10234", body: { comment: "", extraCost: 0 }, status: 200 }]);
    expect(leaked).toEqual([]);
  });

  // Ega 2026-11-07 (BeePost'dagidek): mijoz 500 000 lik mahsulotni 350 000 ga oladi, kuryer market bilan
  // kelishdi — bitta mahsulotli buyurtma sonini o'zgartirmasdan narxini tushirib «qisman» sotiladi.
  test("⭐ bitta mahsulotli buyurtma narxini tushirib qisman sotiladi; teng summa — sababi ko'rinadi", async ({ page }) => {
    const { state, partlySells, leaked } = await mockCourierCancelApi(page);
    state.orders[0] = {
      ...state.orders[0],
      total_price: 500000,
      items: [{ id: "501", quantity: 1, product_id: "24", product_name: "Smart soat" }],
    };
    const dialog = await openSellDialog(page);

    const partial = dialog.getByRole("switch", { name: /Qisman sotish/ });
    await expect(partial).toBeEnabled();
    await partial.click();
    await expect(dialog.getByRole("button", { name: "Smart soat sonini kamaytirish" })).toBeDisabled();
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(dialog.getByText(/Soni o'zgarmasa, faqat narx tushadi — 500\D000 so'm dan kam kiriting/)).toBeVisible();

    const amount = dialog.getByLabel(/To'lov summasi/);
    const submit = dialog.getByRole("button", { name: "Sotish", exact: true });
    await amount.fill("500000");
    await expect(submit).toBeDisabled();
    await expect(
      dialog.getByText("Mahsulot sonini kamaytiring yoki summani buyurtma summasidan kam kiriting"),
    ).toBeVisible();

    await amount.fill("350000");
    await expect(amount).toHaveValue("350 000");
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(dialog).toHaveCount(0);
    expect(partlySells).toEqual([
      {
        id: "10234",
        body: {
          order_item_info: [{ order_item_id: "501", product_id: "24", quantity: 1 }],
          totalPrice: 350000,
          extraCost: 0,
          comment: "",
        },
        status: 200,
      },
    ]);
    expect(leaked).toEqual([]);
  });
});

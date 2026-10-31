import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { toReceiptOrderModel } from "../../../../features/print-receipts/lib/printReceiptModel";
import { OrderPrintMenu } from "./OrderPrintMenu";
import { normalizeOrderDetail, type OrderDetail } from "./orderDetailModel";

const mocks = vi.hoisted(() => ({
  print: vi.fn(async () => ({ orders: 1, pages: 1, jobs: 1, withoutQr: 0, delivery: [] })),
}));

vi.mock("../../../../features/print-receipts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../features/print-receipts")>()),
  printOrderReceipts: mocks.print,
  preloadReceiptPrinting: vi.fn(async () => undefined),
}));

const ORDER = {
  id: "95",
  qr_code_token: "5c0c4c27af78467d451a027e",
  items: [{ quantity: 2, product: null, product_name: "Kabel USB-C" }],
} as unknown as OrderDetail;

const choose = async (name: string, order = ORDER) => {
  const user = userEvent.setup();
  renderWithProviders(<OrderPrintMenu order={order} />);
  await user.click(screen.getByRole("button", { name: "Chop etish" }));
  await user.click(await screen.findByRole("menuitem", { name: new RegExp(name) }));
};

beforeEach(() => mocks.print.mockClear());

describe("OrderPrintMenu (TzfF0bmQ)", () => {
  it("ikki usul: brauzer va PDF 100×60", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderPrintMenu order={ORDER} />);
    await user.click(screen.getByRole("button", { name: "Chop etish" }));
    expect(await screen.findAllByRole("menuitem")).toHaveLength(2);
    expect(screen.getByRole("menuitem", { name: /Brauzer orqali chop etish/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /PDF yorliq \(100×60 mm\)/ })).toBeInTheDocument();
  });

  it("«Brauzer» — shu buyurtma, termal varaq, brauzer chiqishi", async () => {
    await choose("Brauzer orqali chop etish");
    expect(mocks.print).toHaveBeenCalledWith([ORDER], { sheet: "thermal", output: "browser" });
  });

  it("«PDF yorliq» — shu buyurtma, termal varaq, PDF", async () => {
    await choose("PDF yorliq");
    expect(mocks.print).toHaveBeenCalledWith([ORDER], { sheet: "thermal", output: "pdf" });
  });

  it("tashqi buyurtma: tafsilotdan kelgan `product_name` yorliqqa yetadi", () => {
    const detail = normalizeOrderDetail({
      data: {
        id: "95",
        status: "waiting",
        customer: { name: "Aliyev Vali", phone_number: "+998901234567" },
        items: [{ id: "i1", quantity: 2, product: null, product_name: "Kabel USB-C" }],
      },
    });
    expect(toReceiptOrderModel(detail as OrderDetail).products).toEqual(["Kabel USB-C ×2"]);
  });

  it("tokensiz buyurtma — chop etiladi, oldin «QR yo'q» ogohlantirishi", async () => {
    await choose("PDF yorliq", { ...ORDER, qr_code_token: null } as OrderDetail);
    expect(await screen.findByText(/buyurtmada QR yo'q/)).toBeInTheDocument();
    expect(mocks.print).toHaveBeenCalledTimes(1);
  });
});

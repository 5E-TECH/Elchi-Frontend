import { afterEach, describe, expect, it, vi } from "vitest";
import type { MailDetailPost, PostOrder } from "../../../../entities/mails";

const mocks = vi.hoisted(() => ({
  printOrderReceipts: vi.fn(),
  printPackageReceipt: vi.fn(),
}));

vi.mock("../../../../features/print-receipts", () => ({
  printOrderReceipts: mocks.printOrderReceipts,
  printPackageReceipt: mocks.printPackageReceipt,
}));

const { postTotalsFromOrders, printOrders, printPostReceipt, toPostReceiptSource } = await import("./printMode");

const order = (patch: Partial<PostOrder> = {}) =>
  ({
    id: "o1",
    customer_id: "c1",
    customer: { id: "c1", name: "Dilnoza", phone_number: "+998901112233" },
    market: { id: "m1", name: "Baraka Shop", phone_number: "+998712001122" },
    where_deliver: "address",
    total_price: 185_000,
    region: { id: "8", name: "Samarqand viloyati" },
    ...patch,
  }) as unknown as PostOrder;

const post = (patch: Partial<MailDetailPost> = {}): MailDetailPost => ({
  id: "2493",
  status: "sent",
  qr_code_token: "POST-1a2b3c4d5e6f7a8b9c",
  createdAt: "2026-10-23T11:40:00.000Z",
  region: { id: "8", name: "Samarqand viloyati" },
  courier: { id: "7", name: "Jasur Tursunov", phone_number: "+998905554433" },
  ...patch,
});

describe("pochta chop etish usullari → features/print-receipts (HJ5sLHiz, TZ F10)", () => {
  afterEach(() => vi.clearAllMocks());

  it("browser / PDF — termal 100×60, A4 — 12 tadan; PostOrder modelga to'g'ridan-to'g'ri beriladi", () => {
    const orders = [order()];
    void printOrders("browser", orders);
    void printOrders("pdf_100x60", orders);
    void printOrders("a4", orders);
    expect(mocks.printOrderReceipts.mock.calls).toEqual([
      [orders, { sheet: "thermal", output: "browser" }],
      [orders, { sheet: "thermal", output: "pdf" }],
      [orders, { sheet: "a4", output: "browser" }],
    ]);
  });

  it("«Pochta cheki»: №, vaqt, qayerga, qatorlar soni, jami (uy + markaz), kuryer, POST- token; BE-2 kelsa «Qayerdan»", () => {
    const orders = [order(), order({ id: "o2" })];
    const source = toPostReceiptSource({
      postId: "2493",
      post: post({ branch: { id: "1", name: "Toshkent HQ" } }),
      orders,
      totals: {
        homeOrders: { homeOrdersTotalPrice: 7_000_000 },
        centerOrders: { centerOrdersTotalPrice: 420_000 },
      },
    });
    expect(source).toEqual({
      kind: "post",
      id: "2493",
      token: "POST-1a2b3c4d5e6f7a8b9c",
      createdAt: "2026-10-23T11:40:00.000Z",
      from: "Toshkent HQ",
      to: "Samarqand viloyati",
      ordersCount: 2,
      totalPrice: 7_420_000,
      courier: { id: "7", name: "Jasur Tursunov", phone_number: "+998905554433" },
    });
    void printPostReceipt(source);
    expect(mocks.printPackageReceipt).toHaveBeenCalledWith(source, {
      sheet: "thermal",
      output: "browser",
    });
  });

  it("eski backend (post meta'si va jamlar yo'q): ro'yxat qatoridagi zaxiralar, «Jami summa» va «Qayerdan» chiqmaydi", () => {
    const source = toPostReceiptSource({
      postId: "90",
      post: null,
      orders: [order()],
      regionName: "Andijon",
      createdAt: "2026-10-07T12:55:00.000Z",
      courier: { name: "Jasur Tursunov" },
    });
    expect(source).toMatchObject({
      id: "90",
      token: null,
      from: null,
      to: "Andijon",
      createdAt: "2026-10-07T12:55:00.000Z",
      totalPrice: null,
      courier: { name: "Jasur Tursunov" },
    });
  });

  it("eski pochtani qayta chop etish (ega qarori 2026-11-15, BeePost kabi): faqat pochta cheki, buyurtma cheklarisiz", () => {
    const orders = [order()];
    const source = toPostReceiptSource({ postId: "90", post: post(), orders });
    void printPostReceipt(source);
    expect(mocks.printPackageReceipt).toHaveBeenCalledWith(source, { sheet: "thermal", output: "browser" });
    expect(mocks.printOrderReceipts).not.toHaveBeenCalled();
  });

  it("sZxxo98G: filial o'tkazmasi — qabul qiluvchi filial (raqami, bo'sh bo'lsa faol menejer raqami)", () => {
    const transfer = post({
      id: "74",
      courier_id: "0",
      courier: null,
      branch_id: "12",
      recipient_branch: {
        id: "12",
        name: "Shahriyor Xorazm",
        phone_number: "+998912222222",
        manager: { id: "522", name: "Ali", phone_number: "+998935550101" },
      },
    });
    const source = toPostReceiptSource({ postId: "74", post: transfer, orders: [order()] });
    expect(source.courier).toBeNull();
    expect(source.recipientBranch).toEqual({ name: "Shahriyor Xorazm", phone_number: "+998912222222" });
    const noOwnPhone = toPostReceiptSource({
      postId: "74",
      post: post({
        courier: null,
        recipient_branch: {
          id: "12",
          name: "Shahriyor Xorazm",
          phone_number: " ",
          manager: { id: "522", name: "Ali", phone_number: "+998935550101" },
        },
      }),
      orders: [order()],
    });
    expect(noOwnPhone.recipientBranch).toEqual({ name: "Shahriyor Xorazm", phone_number: "+998935550101" });
    const nothing = toPostReceiptSource({
      postId: "74",
      post: post({ courier: null, recipient_branch: { id: "12", name: null, phone_number: null, manager: null } }),
      orders: [order()],
    });
    expect(nothing.recipientBranch).toEqual({ name: null, phone_number: null });
    // Kuryer pochtasi / eski backend (`recipient_branch` yo'q) — manba avvalgidek.
    expect(toPostReceiptSource({ postId: "2493", post: post(), orders: [order()] }).recipientBranch).toBeUndefined();
    expect(
      toPostReceiptSource({ postId: "2493", post: post({ recipient_branch: null }), orders: [order()] }).recipientBranch,
    ).toBeUndefined();
  });

  it("qatorlardan jamlar (vaICniE4): uy — `address`, qolgani — markaz (backend hisobi); bo'sh ro'yxat — 0", () => {
    const totals = postTotalsFromOrders([
      order({ total_price: 185_000 }),
      order({ id: "o2", where_deliver: "center", total_price: 240_000 }),
      order({ id: "o3", total_price: undefined as unknown as number }),
    ]);
    expect(totals).toEqual({
      homeOrders: { homeOrdersTotalPrice: 185_000 },
      centerOrders: { centerOrdersTotalPrice: 240_000 },
    });
    expect(toPostReceiptSource({ postId: "1", orders: [], totals: postTotalsFromOrders([]) }).totalPrice).toBe(0);
  });
});

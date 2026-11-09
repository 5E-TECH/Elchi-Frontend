import { describe, expect, it } from "vitest";
import { resolveReceiveAccess, type ReceiveAccessInput } from "./receiveAccess";

/** anKpzwxk (Elchi-Backend #620/#621): HQ → filial o'tkazmasini faqat manzil filial menejeri qabul qiladi. */
const transfer = (branchId: string | null, status = "sent") => ({ courier_id: "0", branch_id: branchId, status });
const access = (overrides: Partial<ReceiveAccessInput>) =>
  resolveReceiveAccess({
    role: "manager",
    branchType: "REGIONAL",
    myBranchId: "16",
    viewerId: "42",
    post: transfer("16"),
    ...overrides,
  });

describe("resolveReceiveAccess", () => {
  it.each(["REGIONAL", "HYBRID"] as const)("manzil filial menejeri (%s) — qabul qiladi", (branchType) => {
    expect(access({ branchType })).toEqual({
      isTransferPost: true,
      isDestinationManager: true,
      isPostReceiver: true,
      canReceive: true,
      isReadOnlyForeignTransfer: false,
    });
  });

  it("filial id raqam bo'lsa ham satr sifatida solishtiriladi", () => {
    expect(access({ post: { courier_id: 0, branch_id: 16, status: "sent" } }).isDestinationManager).toBe(true);
    expect(access({ post: { courier_id: "", branch_id: "16", status: "sent" } }).isDestinationManager).toBe(true);
  });

  it("HQ menejeri — o'z filialiga jo'natilgan bo'lsa ham qabul yo'q, faqat o'qish", () => {
    const result = access({ branchType: "HQ", myBranchId: "1", post: transfer("1") });
    expect(result).toMatchObject({ isDestinationManager: false, canReceive: false, isReadOnlyForeignTransfer: true });
  });

  it("boshqa filial menejeri — qabul yo'q, faqat o'qish", () => {
    expect(access({ post: transfer("7") })).toMatchObject({
      isDestinationManager: false,
      isPostReceiver: false,
      canReceive: false,
      isReadOnlyForeignTransfer: true,
    });
  });

  it("PICKUP menejeri — manzil emas", () => {
    expect(access({ branchType: "PICKUP" })).toMatchObject({ isDestinationManager: false, canReceive: false });
  });

  it("pochtada branch_id yo'q yoki menejer filiali noma'lum — qabul yo'q", () => {
    expect(access({ post: transfer(null) }).canReceive).toBe(false);
    expect(access({ myBranchId: "" }).canReceive).toBe(false);
    expect(access({ branchType: null }).canReceive).toBe(false);
  });

  it("qabul qilingan (received) begona o'tkazma — bu yerda faqat o'qish emas (sahifa `isForeignReceivedPost` qiladi)", () => {
    const result = access({ post: transfer("7", "received") });
    expect(result.isReadOnlyForeignTransfer).toBe(false);
    expect(result.isPostReceiver).toBe(false);
  });

  it("registrator, superadmin, admin — qabul yo'q (o'zgarmagan), faqat o'qish bayrog'i ham yo'q", () => {
    for (const role of ["registrator", "superadmin", "admin"]) {
      expect(access({ role, branchType: "HQ" })).toMatchObject({
        isDestinationManager: false,
        canReceive: false,
        isReadOnlyForeignTransfer: false,
      });
    }
  });

  it("kuryer: o'z pochtasi — qabul qiluvchi; begona — emas; qabul rejimi avvalgidek", () => {
    const own = access({ role: "courier", branchType: null, post: { courier_id: "42", branch_id: "16", status: "sent" } });
    expect(own).toMatchObject({ isTransferPost: false, isPostReceiver: true, canReceive: true });
    const foreign = access({ role: "courier", branchType: null, post: { courier_id: "9", status: "sent" } });
    expect(foreign).toMatchObject({ isPostReceiver: false, canReceive: true, isReadOnlyForeignTransfer: false });
  });

  it("menejer, kuryer pochtasi (haqiqiy courier_id) — o'zgarmagan: qabul rejimi bor, qabul qiluvchi emas", () => {
    const result = access({ branchType: "HQ", post: { courier_id: "209", branch_id: "1", status: "sent" } });
    expect(result).toMatchObject({ isTransferPost: false, isPostReceiver: false, canReceive: true, isReadOnlyForeignTransfer: false });
  });

  it("pochta hali yuklanmagan — menejerda qabul rejimi ochilmaydi, faqat o'qish ham emas", () => {
    expect(access({ post: null })).toEqual({
      isTransferPost: false,
      isDestinationManager: false,
      isPostReceiver: false,
      canReceive: false,
      isReadOnlyForeignTransfer: false,
    });
  });
});

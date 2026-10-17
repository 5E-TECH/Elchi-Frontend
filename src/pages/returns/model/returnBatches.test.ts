import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETURN_SORT,
  buildReturnBatchesParams,
  normalizeReturnBatch,
  readUserBranchName,
  sortReturnBatches,
  toReturnBatchesResponse,
  type ReturnBatch,
} from "./returnBatches";

describe("returnBatches — so'rov paramlari", () => {
  it("holat API qiymatiga o'tadi (PENDING/SENT/RECEIVED/CANCELLED), filial — joriy foydalanuvchiniki", () => {
    expect(buildReturnBatchesParams({ page: 2, limit: 20, branchId: "7", status: "new" })).toEqual({
      page: 2,
      limit: 20,
      direction: "RETURN",
      source_branch_id: "7",
      status: "PENDING",
    });
    expect(buildReturnBatchesParams({ page: 1, limit: 10, status: "on_the_way" }).status).toBe("SENT");
    expect(buildReturnBatchesParams({ page: 1, limit: 10, status: "received" }).status).toBe("RECEIVED");
    expect(buildReturnBatchesParams({ page: 1, limit: 10, status: "cancelled" }).status).toBe("CANCELLED");
  });

  it("holat va filial bo'lmasa — paramda yo'q (sana paramlari yuborilmaydi, D14)", () => {
    expect(buildReturnBatchesParams({ page: 1, limit: 10, branchId: "", status: "" })).toEqual({
      page: 1,
      limit: 10,
      direction: "RETURN",
    });
  });
});

describe("returnBatches — javobni normallashtirish (v1 dagidek)", () => {
  it("backend yozuvi → qator: holat, nomlar, son va summa", () => {
    expect(
      normalizeReturnBatch({
        id: 171,
        qr_code_token: "BTB-171",
        source_branch: { name: "Urgut filiali" },
        destination_branch_name: "Toshkent HQ",
        order_count: "4",
        total_price: "1160000",
        status: "PENDING",
        createdAt: "2026-10-17T10:20:00.000Z",
      }),
    ).toEqual({
      id: "171",
      token: "BTB-171",
      fromBranch: "Urgut filiali",
      toBranch: "Toshkent HQ",
      ordersCount: 4,
      totalPrice: 1160000,
      status: "new",
      createdAt: "2026-10-17T10:20:00.000Z",
    });
    expect(normalizeReturnBatch({ id: "1", status: "SENT" }).status).toBe("on_the_way");
    expect(normalizeReturnBatch({ id: "1", status: "RECEIVED" }).status).toBe("received");
    expect(normalizeReturnBatch({ id: "1", status: "CANCELLED" }).status).toBe("cancelled");
    expect(normalizeReturnBatch({ id: "1" }).fromBranch).toBe("—");
  });

  it("ro'yxat va meta turli o'ramlardan; id'siz yozuv tashlanadi", () => {
    const response = toReturnBatchesResponse(
      { data: { items: [{ id: "5" }, { name: "id'siz" }], meta: { page: 2, limit: 10, total: 13, totalPages: 2 } } },
      { page: 2, limit: 10 },
    );
    expect(response.data.map((row) => row.id)).toEqual(["5"]);
    expect(response.meta).toEqual({ page: 2, limit: 10, total: 13, totalPages: 2 });

    const flat = toReturnBatchesResponse([{ id: "1" }, { id: "2" }], { page: 1, limit: 10 });
    expect(flat.meta.total).toBe(2);
  });
});

describe("returnBatches — joriy sahifa ichida saralash", () => {
  const row = (id: string, extra: Partial<ReturnBatch>): ReturnBatch => ({
    id,
    token: id,
    fromBranch: "—",
    toBranch: "—",
    ordersCount: 0,
    totalPrice: 0,
    status: "new",
    createdAt: "",
    ...extra,
  });
  const rows = [
    row("170", { createdAt: "2026-10-17T07:05:00Z", fromBranch: "Andijon filiali", totalPrice: 385000, ordersCount: 2, status: "received" }),
    row("171", { createdAt: "2026-10-17T10:20:00Z", fromBranch: "Urgut filiali", totalPrice: 1160000, ordersCount: 4, status: "new" }),
    row("168", { createdAt: "2026-10-16T05:42:00Z", fromBranch: "Farg'ona filiali", totalPrice: 2140000, ordersCount: 6, status: "on_the_way" }),
  ];

  it("sukut — paket (sana) bo'yicha, yangisi tepada", () => {
    expect(DEFAULT_RETURN_SORT).toEqual({ key: "batch", direction: "desc" });
    expect(sortReturnBatches(rows, DEFAULT_RETURN_SORT).map((r) => r.id)).toEqual(["171", "170", "168"]);
  });

  it("filial, holat, son va summa bo'yicha; null — kelgan tartib", () => {
    expect(sortReturnBatches(rows, { key: "from", direction: "asc" }).map((r) => r.id)).toEqual(["170", "168", "171"]);
    expect(sortReturnBatches(rows, { key: "status", direction: "asc" }).map((r) => r.id)).toEqual(["171", "168", "170"]);
    expect(sortReturnBatches(rows, { key: "orders", direction: "desc" }).map((r) => r.id)).toEqual(["168", "171", "170"]);
    expect(sortReturnBatches(rows, { key: "amount", direction: "asc" }).map((r) => r.id)).toEqual(["170", "171", "168"]);
    expect(sortReturnBatches(rows, null).map((r) => r.id)).toEqual(["170", "171", "168"]);
  });
});

describe("returnBatches — menejer filiali", () => {
  it("profil shakllaridan filial nomi", () => {
    expect(readUserBranchName({ branch: { branch: { name: "Urgut filiali" } } })).toBe("Urgut filiali");
    expect(readUserBranchName({ branch: { name: " Toshkent HQ " } })).toBe("Toshkent HQ");
    expect(readUserBranchName({ branch: { branch_name: "Samarqand" } })).toBe("Samarqand");
    expect(readUserBranchName({ id: "1" })).toBeNull();
    expect(readUserBranchName(null)).toBeNull();
  });
});

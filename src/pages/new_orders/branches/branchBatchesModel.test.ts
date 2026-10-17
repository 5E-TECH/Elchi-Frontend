import { describe, expect, it } from "vitest";
import type { Batch } from "../../../entities/batch";
import {
  BATCH_STATUS_TONE,
  matchesBatchSearch,
  readBatchOrderDate,
  readBatchOrderStatus,
  readBatchRegion,
  readBranchId,
  readBranchName,
  sumBatchOrdersTotal,
  sumBatchesTotal,
  toBranchSourceRows,
  toDeliveryKind,
  toScannableBatches,
} from "./branchBatchesModel";

const batch = (overrides: Partial<Batch> = {}): Batch => ({
  id: "148",
  token: "BTB-ABC123XY",
  from_branch: { id: "7", name: "—" },
  to_branch: { id: "1", name: "—", region: "Samarqand" },
  direction: "forward",
  orders_count: 18,
  total_price: 4260000,
  status: "on_the_way",
  created_at: "2026-10-17T08:48:00.000Z",
  ...overrides,
});

describe("toBranchSourceRows — filiallar ro'yxati", () => {
  it("paketlar soni `orders_count` ga, id siz qator tashlanadi, satr sonlar Number bo'ladi", () => {
    const rows = toBranchSourceRows([
      { branch_id: "7", name: "Chilonzor", phone_number: "+998712001452", batches_count: 6, total_price_sum: 15155500 },
      { branch_id: "", name: "Id siz", phone_number: "—", batches_count: 1, total_price_sum: 1 },
      { branch_id: "9", name: "Urgut", phone_number: "—", batches_count: "1" as unknown as number, total_price_sum: "540000" as unknown as number },
    ]);
    expect(rows).toEqual([
      { id: "7", name: "Chilonzor", phone_number: "+998712001452", orders_count: 6, total_price_sum: 15155500 },
      { id: "9", name: "Urgut", phone_number: "—", orders_count: 1, total_price_sum: 540000 },
    ]);
    expect(toBranchSourceRows(undefined)).toEqual([]);
  });
});

describe("paket holati va viloyat", () => {
  it("holat → ton (maketdagidek, F1): yangi — info, yo'lda — warning, qabul — success, bekor — danger", () => {
    expect(BATCH_STATUS_TONE).toEqual({ new: "info", on_the_way: "warning", received: "success", cancelled: "danger" });
  });

  it("viloyat: `to_branch.region`, bo'lmasa filial nomi; «—» — noma'lum", () => {
    expect(readBatchRegion(batch())).toBe("Samarqand");
    expect(readBatchRegion(batch({ to_branch: { id: "1", name: "Toshkent HQ" } }))).toBe("Toshkent HQ");
    expect(readBatchRegion(batch({ to_branch: { id: "1", name: "—" } }))).toBeNull();
  });

  it("filial nomi va id: normalizatorning «—» fallbacki noma'lum deb o'qiladi", () => {
    expect(readBranchName({ name: "—" })).toBeNull();
    expect(readBranchName({ name: " Toshkent HQ " })).toBe("Toshkent HQ");
    expect(readBranchName(undefined)).toBeNull();
    expect(readBranchId({ id: "—" })).toBeUndefined();
    expect(readBranchId({ id: "1" })).toBe("1");
  });
});

describe("matchesBatchSearch — v1 dagidek: id, token, viloyat, manzil filial nomi", () => {
  const row = batch({ to_branch: { id: "1", name: "Toshkent HQ", region: "Samarqand" } });

  it("katta-kichik harfsiz; «B-148» va «148» ikkalasi ham topadi", () => {
    expect(matchesBatchSearch(row, "")).toBe(true);
    expect(matchesBatchSearch(row, "samar")).toBe(true);
    expect(matchesBatchSearch(row, "148")).toBe(true);
    expect(matchesBatchSearch(row, "b-148")).toBe(true);
    expect(matchesBatchSearch(row, "abc123")).toBe(true);
    expect(matchesBatchSearch(row, "toshkent")).toBe(true);
    expect(matchesBatchSearch(row, "Namangan")).toBe(false);
  });
});

describe("yig'indilar, skaner va buyurtma maydonlari", () => {
  it("summalar (satr son ham)", () => {
    expect(sumBatchesTotal([batch(), batch({ total_price: "2875000" as unknown as number })])).toBe(7135000);
    expect(sumBatchOrdersTotal([{ price: 185000 }, { price: 132000 }])).toBe(317000);
  });

  it("skaner indeksi: paket tokeni `qr_code_token` sifatida (bo'sh token — null)", () => {
    expect(toScannableBatches([batch(), batch({ id: "147", token: "" })]).map((row) => row.qr_code_token)).toEqual([
      "BTB-ABC123XY",
      null,
    ]);
  });

  it("buyurtma sanasi: o'zining, bo'lmasa paket sanasi; holat «—» — yo'q", () => {
    expect(readBatchOrderDate({ created_at: "2026-10-11T06:20:00Z" }, "2026-10-12T00:00:00Z")).toBe("2026-10-11T06:20:00Z");
    expect(readBatchOrderDate({}, "2026-10-12T00:00:00Z")).toBe("2026-10-12T00:00:00Z");
    expect(readBatchOrderDate({}, undefined)).toBeNull();
    expect(readBatchOrderStatus({ status: "—" })).toBeNull();
    expect(readBatchOrderStatus({ status: "on the road" })).toBe("on the road");
  });

  it("yetkazish: `home` — eshikkacha (`address` yorlig'i)", () => {
    expect(toDeliveryKind("home")).toBe("address");
    expect(toDeliveryKind("center")).toBe("center");
    expect(toDeliveryKind(undefined)).toBeUndefined();
  });
});

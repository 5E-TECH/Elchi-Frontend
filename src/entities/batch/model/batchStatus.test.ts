import { describe, expect, it } from "vitest";
import enNewOrders from "../../../locales/en/newOrders.json";
import ruNewOrders from "../../../locales/ru/newOrders.json";
import uzNewOrders from "../../../locales/uz/newOrders.json";
import { BATCH_STATUS_TONE } from "./batchStatus";
import type { BatchStatus } from "./types";

/**
 * Paket holati badge'i maketdagidek (ega qarori 2026-10-17 F1): «Yangi» info, «Yo'lda» warning (buyurtmadagi
 * «Yo'lda» bilan bir xil), «Qabul qilingan» success, «Bekor qilingan» danger.
 */

const STATUSES: readonly BatchStatus[] = ["new", "on_the_way", "received", "cancelled"];

describe("BATCH_STATUS_TONE — paket holati → ton", () => {
  it("maketdagi tonlar: yangi — info, yo'lda — warning, qabul — success, bekor — danger", () => {
    expect(BATCH_STATUS_TONE).toEqual({ new: "info", on_the_way: "warning", received: "success", cancelled: "danger" });
  });
});

describe("newOrders:batchStatus — yorliqlar", () => {
  it("uz/ru/en da 4 holatning hammasi bor", () => {
    for (const locale of [uzNewOrders, ruNewOrders, enNewOrders]) {
      for (const status of STATUSES) {
        expect(typeof locale.batchStatus[status]).toBe("string");
        expect(locale.batchStatus[status].trim()).not.toBe("");
      }
    }
  });

  it("uz — maketdagi matnlar (sifatdosh: «Qabul qilingan», «Bekor qilingan»)", () => {
    expect(uzNewOrders.batchStatus).toEqual({
      new: "Yangi",
      on_the_way: "Yo'lda",
      received: "Qabul qilingan",
      cancelled: "Bekor qilingan",
    });
  });
});

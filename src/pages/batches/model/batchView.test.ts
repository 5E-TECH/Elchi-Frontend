import { describe, expect, it } from "vitest";
import {
  BATCH_TAB_PARAMS,
  batchTabOf,
  isPlaceholderBranchName,
  knownText,
  parseBatchTab,
  readBatchDetailState,
  readBatchHistoryKind,
  readBatchRegion,
  resolveBatchBack,
  summarizeDelivery,
  sumOrdersTotal,
} from "./batchView";

describe("batchView — /batches tablari", () => {
  it("tab paramlari v1 dagidek: yangi — new+forward, eski — received+forward, qaytarilgan — faqat return", () => {
    expect(BATCH_TAB_PARAMS).toEqual({
      new: { status: "new", direction: "forward" },
      old: { status: "received", direction: "forward" },
      return: { status: "", direction: "return" },
    });
  });

  it("?tab noma'lum yoki yo'q bo'lsa — «Yangi»", () => {
    expect(parseBatchTab("old")).toBe("old");
    expect(parseBatchTab("return")).toBe("return");
    expect(parseBatchTab("new")).toBe("new");
    expect(parseBatchTab("boshqa")).toBe("new");
    expect(parseBatchTab(null)).toBe("new");
  });

  it("paket tabi: qaytarish → return, qabul qilingan → old, qolgani → new", () => {
    expect(batchTabOf({ direction: "return", status: "received" })).toBe("return");
    expect(batchTabOf({ direction: "forward", status: "received" })).toBe("old");
    expect(batchTabOf({ direction: "forward", status: "new" })).toBe("new");
    expect(batchTabOf({ direction: "forward", status: "on_the_way" })).toBe("new");
  });
});

describe("batchView — nomlar", () => {
  it("«—» va bo'sh matn — noma'lum", () => {
    expect(knownText(" Toshkent HQ ")).toBe("Toshkent HQ");
    expect(knownText("—")).toBeNull();
    expect(knownText("  ")).toBeNull();
    expect(knownText(undefined)).toBeNull();
  });

  it("«—» va «Filial #12» — haqiqiy nom emas (GET branches dan qidiriladi)", () => {
    expect(isPlaceholderBranchName("—")).toBe(true);
    expect(isPlaceholderBranchName("Filial #12")).toBe(true);
    expect(isPlaceholderBranchName("filial #abc")).toBe(true);
    expect(isPlaceholderBranchName("Urgut filiali")).toBe(false);
  });

  it("viloyat — faqat `to_branch.region`", () => {
    expect(readBatchRegion({ to_branch: { id: "1", name: "Toshkent HQ", region: "Samarqand" } })).toBe("Samarqand");
    expect(readBatchRegion({ to_branch: { id: "1", name: "Toshkent HQ" } })).toBeNull();
  });
});

describe("batchView — tafsilotdan orqaga (D20)", () => {
  it("`location.state` dan faqat ma'lum maydonlar olinadi", () => {
    expect(readBatchDetailState({ from: "returns", fromSearch: "?page=2", extra: 1 })).toEqual({
      from: "returns",
      fromSearch: "?page=2",
    });
    expect(readBatchDetailState({ from: "boshqa" })).toEqual({});
    expect(readBatchDetailState(null)).toEqual({});
    expect(readBatchDetailState("returns")).toEqual({});
  });

  it("qaytarishlardan — «Qaytarishlar», eski pochtalardan — filtrlar bilan «Eski pochtalar»", () => {
    expect(resolveBatchBack({ from: "returns" })).toEqual({ to: "/returns", label: "returns" });
    expect(resolveBatchBack({ from: "mails-old", fromSearch: "?batch_mode=all&page=2" })).toEqual({
      to: "/mails/old?batch_mode=all&page=2",
      label: "mailsOld",
    });
    expect(resolveBatchBack({ from: "mails-old", fromSearch: "batch_mode=all" }).to).toBe("/mails/old?batch_mode=all");
  });

  it("paketlardan — kelgan tab va sahifaga; to'g'ridan-to'g'ri ochilsa — paket holatiga mos tabga", () => {
    expect(resolveBatchBack({ from: "batches", fromSearch: "?tab=old&page=3" })).toEqual({
      to: "/batches?tab=old&page=3",
      label: "batches",
    });
    expect(resolveBatchBack({}, { direction: "forward", status: "received" })).toEqual({
      to: "/batches?tab=old",
      label: "batches",
    });
    expect(resolveBatchBack({ from: "batches", fromSearch: "" }, { direction: "return", status: "new" }).to).toBe(
      "/batches?tab=return",
    );
    expect(resolveBatchBack({})).toEqual({ to: "/batches", label: "batches" });
  });
});

describe("batchView — yetkazish va tarix", () => {
  it("«Markazgacha» — faqat center, qolgani «Uygacha» (D13)", () => {
    expect(
      summarizeDelivery([
        { where_deliver: "address", total_price: 265000 },
        { where_deliver: "center", total_price: 189000 },
        { where_deliver: "address", total_price: 410000 },
        { where_deliver: null, total_price: 100 },
      ]),
    ).toEqual({ home: { count: 3, sum: 675100 }, center: { count: 1, sum: 189000 } });
    expect(summarizeDelivery([])).toEqual({ home: { count: 0, sum: 0 }, center: { count: 0, sum: 0 } });
  });

  it("buyurtmalar summasi", () => {
    expect(sumOrdersTotal([{ total_price: 1000 }, { total_price: null }, { total_price: 2500 }])).toBe(3500);
  });

  it("tarix harakati: backend enum'i (katta-kichik harfsiz), noma'lumi — null", () => {
    expect(readBatchHistoryKind("CREATED")).toBe("created");
    expect(readBatchHistoryKind("sent")).toBe("sent");
    expect(readBatchHistoryKind("RECEIVED")).toBe("received");
    expect(readBatchHistoryKind("CANCELED")).toBe("cancelled");
    expect(readBatchHistoryKind("Paket yaratildi")).toBeNull();
    expect(readBatchHistoryKind(undefined)).toBeNull();
  });
});

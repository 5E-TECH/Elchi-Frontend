import { describe, expect, it } from "vitest";
import type { StatusCatalogEntry } from "../../entities/integrations/statusCatalog";
import { extraKeys, extraText, matchedCount, rowText, setExtra, setRow } from "./statusMap";

/**
 * STATUS XARITASI (JnHK6bgV): har xarita backend o'qiydigan formatda qoladi,
 * eski qiymatlar yo'qolmaydi.
 */

const entries: StatusCatalogEntry[] = [
  { code: "sold", key: "sold", meaning_uz: "Yetkazildi, pul olindi" },
  { code: "on the road", key: "on_the_road", meaning_uz: "Yo'lda" },
  { code: "cancelled (sent)", key: "cancelled_sent", meaning_uz: "Qaytarishga" },
];

describe("outbound — status_mapping { bizning: 'ularning' }", () => {
  it("eski xarita qiymatlari to'g'ri kataklarga tushadi (probelli kod ham)", () => {
    const saved = { sold: "7", "on the road": "ST-07", sell: "DONE" };
    expect(rowText("outbound", saved, "sold")).toBe("7");
    expect(rowText("outbound", saved, "on the road")).toBe("ST-07");
    expect(matchedCount("outbound", saved, entries)).toBe(2);
  });

  it("katalogda yo'q kalit (amal nomi) qo'shimcha bo'limda — o'chmaydi", () => {
    const saved = { sold: "7", sell: "DONE" };
    expect(extraKeys("outbound", saved, entries)).toEqual(["sell"]);
    expect(extraText("outbound", saved, "sell")).toBe("DONE");
    expect(setRow("outbound", saved, "on the road", "в пути")).toEqual({ sold: "7", sell: "DONE", "on the road": "в пути" });
  });

  it("payload formati avvalgidek kalit→qiymat (satr); bo'sh — kalit olinadi", () => {
    const next = setRow("outbound", { sold: "7" }, "sold", "  ");
    expect(next).toEqual({});
    expect(setRow("outbound", {}, "sold", " доставлено ")).toEqual({ sold: "доставлено" });
  });
});

describe("payment — payment_config.status_map { bizning: ['2','PAID'] }", () => {
  it("vergul bilan kiritilgan qiymatlar MASSIV bo'lib saqlanadi (backend massiv kutadi)", () => {
    expect(setRow("payment", {}, "succeeded", "2, PAID ,оплачено")).toEqual({ succeeded: ["2", "PAID", "оплачено"] });
    expect(rowText("payment", { succeeded: ["2", "PAID"] }, "succeeded")).toBe("2, PAID");
  });

  it("eski noto'g'ri saqlangan SATR qiymat ham ko'rinadi va tahrirda massivga aylanadi", () => {
    expect(rowText("payment", { succeeded: "PAID" }, "succeeded")).toBe("PAID");
    expect(setRow("payment", { succeeded: "PAID" }, "succeeded", "PAID")).toEqual({ succeeded: ["PAID"] });
  });
});

describe("inbound — inbound_status_mapping { ULARNING: { status, action } }", () => {
  const saved = {
    DELIVERED: { status: "sold", action: "sell" },
    DONE: { status: "sold" },
    TRANSIT: { status: "on the road" },
    LEGACY: { status: "eski_status" },
  };

  it("bitta holatga bir nechta hamkor kodi — qatorda vergul bilan", () => {
    expect(rowText("inbound", saved, "sold")).toBe("DELIVERED, DONE");
    expect(matchedCount("inbound", saved, entries)).toBe(2);
  });

  it("mavjud kodning `action` i saqlanadi; yangi kodga sukut amali beriladi", () => {
    const next = setRow("inbound", saved, "sold", "DELIVERED, 7", "sell");
    expect(next.DELIVERED).toEqual({ status: "sold", action: "sell" });
    expect(next["7"]).toEqual({ status: "sold", action: "sell" });
    expect(next).not.toHaveProperty("DONE");
    expect(next.TRANSIT).toEqual({ status: "on the road" });
  });

  it("sukut amali bo'lmagan oraliq holatda action yozilmaydi", () => {
    expect(setRow("inbound", {}, "on the road", "в-пути")).toEqual({ "в-пути": { status: "on the road" } });
  });

  it("katalogda yo'q holatga ishora qiluvchi eski yozuv qo'shimcha bo'limda, action bilan saqlanadi", () => {
    expect(extraKeys("inbound", saved, entries)).toEqual(["LEGACY"]);
    expect(setExtra("inbound", { X: { status: "a", action: "cancel" } }, "X", "cancelled (sent)")).toEqual({
      X: { status: "cancelled (sent)", action: "cancel" },
    });
    expect(setExtra("inbound", saved, "LEGACY", "")).not.toHaveProperty("LEGACY");
  });
});

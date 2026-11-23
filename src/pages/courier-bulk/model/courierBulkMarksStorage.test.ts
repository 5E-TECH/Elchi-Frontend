import { beforeEach, describe, expect, it } from "vitest";
import {
  courierBulkMarksDay,
  msUntilNextCourierBulkDay,
  readCourierBulkMarks,
  writeCourierBulkMarks,
} from "./courierBulkMarksStorage";

/** Skan auditi #58, #76: belgilar Toshkent kuniga bog'langan — har yozuvda suriladigan 24 soatlik muddat emas. */

const KEY = "courier:7";
// 2026-11-23 10:00 Toshkent (05:00 UTC).
const TODAY_10 = Date.UTC(2026, 10, 23, 5, 0);
const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  localStorage.clear();
});

describe("courierBulkMarksStorage", () => {
  it("kun — Toshkent sanasi (UTC+5): UTC bo'yicha kechagi 19:30 Toshkentda ertasi kun", () => {
    expect(courierBulkMarksDay(Date.UTC(2026, 10, 22, 18, 59))).toBe("2026-11-22");
    expect(courierBulkMarksDay(Date.UTC(2026, 10, 22, 19, 30))).toBe("2026-11-23");
  });

  it("bugun yozilgan belgilar bugun o'qiladi", () => {
    writeCourierBulkMarks(KEY, { actions: { "10": "tomorrow" }, scanMode: "tomorrow" }, TODAY_10);
    expect(readCourierBulkMarks(KEY, TODAY_10 + 5 * HOUR)).toEqual({ actions: { "10": "tomorrow" }, scanMode: "tomorrow" });
  });

  it("⭐ kechagi belgi ertasi kuni tashlanadi — sahifa kecha kechqurun qayta yozilgan bo'lsa ham (muddat surilmaydi)", () => {
    writeCourierBulkMarks(KEY, { actions: { "10": "tomorrow" }, scanMode: "cancel" }, TODAY_10);
    // Kechqurun (23:30) sahifa yana ochildi va yozdi — avval 24 soatlik muddat shu yerdan qayta boshlanardi.
    writeCourierBulkMarks(KEY, { actions: { "10": "tomorrow" }, scanMode: "cancel" }, TODAY_10 + 13.5 * HOUR);
    // Ertasi kuni 08:00 — 24 soat o'tmagan, lekin kun boshqa.
    expect(readCourierBulkMarks(KEY, TODAY_10 + 22 * HOUR)).toBeNull();
    expect(localStorage.getItem(`courier-bulk-marks:v1:${KEY}`)).toBeNull();
  });

  it("kunsiz (eski shakl, `savedAt`) yozuv tashlanadi", () => {
    localStorage.setItem(
      `courier-bulk-marks:v1:${KEY}`,
      JSON.stringify({ actions: { "10": "cancel" }, scanMode: "cancel", savedAt: TODAY_10 }),
    );
    expect(readCourierBulkMarks(KEY, TODAY_10)).toBeNull();
  });

  it("keyingi Toshkent yarim tunigacha qolgan vaqt", () => {
    expect(msUntilNextCourierBulkDay(TODAY_10)).toBe(14 * HOUR);
    // 23:59:59 Toshkent — 1 s qoldi.
    expect(msUntilNextCourierBulkDay(Date.UTC(2026, 10, 23, 18, 59, 59))).toBe(1000);
  });
});

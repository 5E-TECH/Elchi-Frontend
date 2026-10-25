import { describe, expect, it } from "vitest";
import { defaultScanRegion, scanRegionFromFinder } from "./scanRegion";

/** Skan hududi = ekrandagi ramka (Sozlamalar → Skaner → «Ramka o'lchami»), `object-cover` hisobi bilan. */
describe("scanRegionFromFinder", () => {
  it("telefon: 390 × 844 element, 720 × 1280 tasvir, 248 px ramka markazda — kvadrat hudud, ±10 % zaxira", () => {
    const region = scanRegionFromFinder({
      videoWidth: 720,
      videoHeight: 1280,
      videoRect: { left: 0, top: 0, width: 390, height: 844 },
      finderRect: { left: 71, top: 298, width: 248, height: 248 },
    });
    // masshtab = max(390/720, 844/1280) = 0.659…; chap kesilgan chet = (390 − 720·0.659)/2 ≈ −42.4 px.
    const scale = 844 / 1280;
    const side = (248 * 1.2) / scale;
    expect(region.width).toBeCloseTo(side, -1);
    expect(region.height).toBeCloseTo(side, -1);
    expect(region.x + region.width / 2).toBeCloseTo(360, -1);
    expect(region.y + region.height / 2).toBeCloseTo((298 + 124) / scale, -1);
    expect(region.downScaledWidth).toBeLessThanOrEqual(400);
    expect(region.downScaledWidth / region.downScaledHeight).toBeCloseTo(region.width / region.height, 1);
  });

  it("kichik ramka kichik hudud, katta ramka — katta", () => {
    const base = {
      videoWidth: 1280,
      videoHeight: 720,
      videoRect: { left: 100, top: 50, width: 720, height: 680 },
    };
    const at = (size: number) =>
      scanRegionFromFinder({
        ...base,
        finderRect: { left: 100 + 360 - size / 2, top: 50 + 340 - size / 2, width: size, height: size },
      });
    expect(at(232).width).toBeLessThan(at(280).width);
    expect(at(280).width).toBeLessThan(at(320).width);
  });

  it("hudud tasvir chegarasidan chiqmaydi", () => {
    const region = scanRegionFromFinder({
      videoWidth: 640,
      videoHeight: 480,
      videoRect: { left: 0, top: 0, width: 320, height: 240 },
      finderRect: { left: -20, top: -20, width: 360, height: 280 },
    });
    expect(region.x).toBe(0);
    expect(region.y).toBe(0);
    expect(region.width).toBeLessThanOrEqual(640);
    expect(region.height).toBeLessThanOrEqual(480);
  });

  it("old kamera (ko'zgu): chap tomondagi ramka tasvirning o'ng tomoniga to'g'ri keladi", () => {
    const input = {
      videoWidth: 1000,
      videoHeight: 1000,
      videoRect: { left: 0, top: 0, width: 1000, height: 1000 },
      finderRect: { left: 100, top: 400, width: 200, height: 200 },
    };
    const plain = scanRegionFromFinder(input);
    const mirrored = scanRegionFromFinder({ ...input, mirrored: true });
    expect(plain.x).toBe(80);
    expect(mirrored.x).toBe(1000 - 80 - plain.width);
  });

  it("ramka yoki o'lcham noma'lum — kutubxona sukuti (kichik tomonning 2/3 qismi)", () => {
    const fallback = scanRegionFromFinder({
      videoWidth: 1280,
      videoHeight: 720,
      videoRect: { left: 0, top: 0, width: 720, height: 680 },
      finderRect: null,
    });
    expect(fallback).toEqual(defaultScanRegion(1280, 720));
    expect(fallback).toMatchObject({ width: 480, height: 480, x: 400, y: 120, downScaledWidth: 400 });
    expect(
      scanRegionFromFinder({
        videoWidth: 0,
        videoHeight: 0,
        videoRect: { left: 0, top: 0, width: 0, height: 0 },
        finderRect: { left: 0, top: 0, width: 248, height: 248 },
      }),
    ).toEqual(defaultScanRegion(0, 0));
  });

  it("shtrix kod rejimi (`wide`, CO66kcoB): telefonda 312 × 168 ramka — keng hudud, tahlil kadri uzun tomoni 640", () => {
    const region = scanRegionFromFinder({
      videoWidth: 720,
      videoHeight: 1280,
      videoRect: { left: 0, top: 0, width: 390, height: 844 },
      finderRect: { left: 39, top: 338, width: 312, height: 168 },
      shape: "wide",
    });
    expect(region.width).toBeGreaterThan(region.height * 1.4);
    expect(region.x + region.width / 2).toBeCloseTo(360, -1);
    // 312 px ramka ≈ 568 tasvir pikseli (zaxira bilan) — kichraytirilmaydi; QR rejimida 400 ga tushardi.
    expect(region.downScaledWidth).toBe(region.width);
    expect(region.downScaledWidth).toBeLessThanOrEqual(640);
    const square = scanRegionFromFinder({
      videoWidth: 1920,
      videoHeight: 1080,
      videoRect: { left: 0, top: 0, width: 1920, height: 1080 },
      finderRect: { left: 760, top: 340, width: 400, height: 216 },
    });
    const wide = scanRegionFromFinder({
      videoWidth: 1920,
      videoHeight: 1080,
      videoRect: { left: 0, top: 0, width: 1920, height: 1080 },
      finderRect: { left: 760, top: 340, width: 400, height: 216 },
      shape: "wide",
    });
    expect(square.downScaledWidth).toBe(400);
    expect(wide.downScaledWidth).toBe(480);
  });

  it("shtrix kod rejimi sukuti: kadr enining 80 % i, bo'yi enining 55 % i, markazda", () => {
    expect(defaultScanRegion(1280, 720, "wide")).toMatchObject({
      x: 128,
      width: 1024,
      height: 563,
      downScaledWidth: 640,
      downScaledHeight: 352,
    });
  });
});

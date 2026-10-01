import { describe, expect, it } from "vitest";
import {
  areCourierTariffsRequired,
  buildCourierTariffs,
  getMissingCourierTariffs,
} from "./courierTariffs";

/**
 * fix3 FE-USR-11 (+ fix3b docs) — backend `CreateCourierRequestDto` ikkala
 * tarifni majburiy qiladi. Bo'sh tariflar 0 bo'ladi FAQAT maoshli kuryerda
 * (`salary_only` — ulushi 0); maoshsiz kuryerda ikkala tarif majburiy.
 */
describe("buildCourierTariffs", () => {
  it("maoshli kuryerda bo'sh tariflar 0 / 0 (avval umuman yuborilmasdi → 400)", () => {
    expect(buildCourierTariffs({ homeRate: "", centerRate: "", salary: "3 000 000" })).toEqual({
      tariff_home: 0,
      tariff_center: 0,
    });
    expect(buildCourierTariffs({ homeRate: "   ", centerRate: "", salary: "1" })).toEqual({
      tariff_home: 0,
      tariff_center: 0,
    });
  });

  it("maoshsiz kuryerda bo'sh tariflar 0 ga TUSHMAYDI — null (forma to'xtatadi)", () => {
    expect(buildCourierTariffs({ homeRate: "", centerRate: "", salary: "" })).toBeNull();
    expect(buildCourierTariffs({ homeRate: "", centerRate: "", salary: "   " })).toBeNull();
    // 0 so'm maosh — maosh emas: tariflar baribir majburiy.
    expect(buildCourierTariffs({ homeRate: "", centerRate: "", salary: "0" })).toBeNull();
  });

  it("faqat bittasi to'ldirilsa — null (ikkalasi yoki hech biri)", () => {
    expect(buildCourierTariffs({ homeRate: "10 000", centerRate: "", salary: "" })).toBeNull();
    expect(buildCourierTariffs({ homeRate: "", centerRate: "8 000", salary: "2 000 000" })).toBeNull();
  });

  it("to'ldirilgan tariflar bo'shliqsiz son bo'ladi (maosh bor-yo'qligidan qat'i nazar)", () => {
    expect(buildCourierTariffs({ homeRate: "10 000", centerRate: "8 000", salary: "" })).toEqual({
      tariff_home: 10000,
      tariff_center: 8000,
    });
    expect(buildCourierTariffs({ homeRate: "0", centerRate: "0", salary: "" })).toEqual({
      tariff_home: 0,
      tariff_center: 0,
    });
  });
});

describe("getMissingCourierTariffs", () => {
  it("maoshsiz kuryerda bo'sh tarif maydonlarini ko'rsatadi", () => {
    expect(getMissingCourierTariffs({ homeRate: "", centerRate: "", salary: "" })).toEqual({
      home: true,
      center: true,
    });
    expect(getMissingCourierTariffs({ homeRate: "10 000", centerRate: "", salary: "" })).toEqual({
      home: false,
      center: true,
    });
  });

  it("maosh kiritilsa tariflar majburiy emas", () => {
    expect(areCourierTariffsRequired({ salary: "5 000 000" })).toBe(false);
    expect(areCourierTariffsRequired({ salary: "0" })).toBe(true);
    expect(areCourierTariffsRequired({ salary: "" })).toBe(true);
    expect(getMissingCourierTariffs({ homeRate: "", centerRate: "", salary: "5 000 000" })).toEqual({
      home: false,
      center: false,
    });
  });
});

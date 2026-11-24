import { describe, expect, it } from "vitest";
import type { AiAccessList } from "../../../entities/ai-advisor";
import {
  applyAccessUpdate,
  buildAccessRows,
  diffAccessRows,
  parseAccessLimit,
  validateAccessRows,
  type AccessRow,
} from "./accessForm";

const list: AiAccessList = {
  featureEnabled: true,
  defaultDailyLimit: 100,
  items: [
    { userId: "2", enabled: true, dailyLimit: 50, effectiveDailyLimit: 50, updatedAt: null },
    { userId: "3", enabled: false, dailyLimit: null, effectiveDailyLimit: 100, updatedAt: null },
  ],
};
const admins = [
  { id: "3", name: "Dilnoza Karimova", phone: "+998 93 512 08 46" },
  { id: "2", name: "Aziz Rahimov", phone: "+998 91 330 27 74" },
  { id: "4", name: "Bekzod Aliyev", phone: "+998 97 701 33 41" },
];

describe("«Kirish huquqi» formasi (F7PWp6cK)", () => {
  it("limit: bo'sh — sukut (null), 0..10 000 butun son, boshqasi xato", () => {
    expect(parseAccessLimit("")).toEqual({ ok: true, value: null });
    expect(parseAccessLimit("  ")).toEqual({ ok: true, value: null });
    expect(parseAccessLimit("0")).toEqual({ ok: true, value: 0 });
    expect(parseAccessLimit("10 000")).toEqual({ ok: true, value: 10_000 });
    expect(parseAccessLimit("10001")).toEqual({ ok: false, error: "invalid" });
    expect(parseAccessLimit("5.5")).toEqual({ ok: false, error: "invalid" });
    expect(parseAccessLimit("-1")).toEqual({ ok: false, error: "invalid" });
  });

  it("qatorlar ism bo'yicha; ruxsat yozuvi yo'q admin — o'chiq, sukut limit", () => {
    expect(buildAccessRows(admins, list)).toEqual([
      { userId: "2", name: "Aziz Rahimov", phone: "+998 91 330 27 74", enabled: true, limit: "50" },
      { userId: "4", name: "Bekzod Aliyev", phone: "+998 97 701 33 41", enabled: false, limit: "" },
      { userId: "3", name: "Dilnoza Karimova", phone: "+998 93 512 08 46", enabled: false, limit: "" },
    ]);
  });

  it("faqat yoqilgan qatorning limiti tekshiriladi", () => {
    const rows: AccessRow[] = [
      { userId: "2", name: "A", phone: "", enabled: true, limit: "20000" },
      { userId: "3", name: "B", phone: "", enabled: false, limit: "20000" },
    ];
    expect(validateAccessRows(rows)).toEqual({ "2": "invalid" });
  });

  it("o'zgarish: kalit yoki yoqilgan qatorning limiti; o'chirilganda saqlangan limit yuboriladi", () => {
    const base = buildAccessRows(admins, list);
    const rows = base.map((row) => {
      if (row.userId === "2") return { ...row, enabled: false, limit: "77" };
      if (row.userId === "4") return { ...row, enabled: true, limit: "" };
      return row;
    });
    expect(diffAccessRows(base, rows)).toEqual([
      { userId: "2", enabled: false, dailyLimit: 50 },
      { userId: "4", enabled: true, dailyLimit: null },
    ]);
    // Limit bo'shatildi — sukutga qaytadi.
    const cleared = base.map((row) => (row.userId === "2" ? { ...row, limit: "" } : row));
    expect(diffAccessRows(base, cleared)).toEqual([{ userId: "2", enabled: true, dailyLimit: null }]);
    expect(diffAccessRows(base, base)).toEqual([]);
  });

  it("saqlangan qator yangi asos bo'ladi — keyingi urinish faqat qolganini yuboradi", () => {
    const base = buildAccessRows(admins, list);
    const rows = base.map((row) => (row.userId === "4" || row.userId === "3" ? { ...row, enabled: true } : row));
    const [first] = diffAccessRows(base, rows);
    const next = applyAccessUpdate(base, first);
    expect(diffAccessRows(next, rows)).toEqual([{ userId: "3", enabled: true, dailyLimit: null }]);
  });
});

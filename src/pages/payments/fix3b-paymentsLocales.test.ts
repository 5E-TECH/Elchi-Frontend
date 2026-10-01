import { describe, expect, it } from "vitest";
import uz from "../../locales/uz/payments.json";
import ru from "../../locales/ru/payments.json";
import en from "../../locales/en/payments.json";

type Dict = Record<string, string>;
const DICTS = { uz: uz as Dict, ru: ru as Dict, en: en as Dict };

/** FIX3B / FE-PAY-06 — smena ochish kalitlari. */
const FIX3B_KEYS = ["openShiftTitle", "openShiftSuccess", "openShiftError"];

describe("payments locales — FIX3B shift keys", () => {
  it("translates every new key in uz, ru (Cyrillic) and en", () => {
    FIX3B_KEYS.forEach((key) => {
      expect(DICTS.uz[key]?.trim(), `uz.${key}`).toBeTruthy();
      expect(DICTS.en[key]?.trim(), `en.${key}`).toBeTruthy();
      expect(DICTS.ru[key], `ru.${key}`).toMatch(/[А-Яа-яЁё]/);
    });
  });

  it("keeps the agreed Uzbek button labels", () => {
    expect(DICTS.uz.openShiftTitle).toBe("Smenani ochish");
    expect(DICTS.uz.closeShiftTitle).toBe("Smenani yopish");
  });

  it("keeps the open and close messages distinct in every language", () => {
    Object.values(DICTS).forEach((dict) => {
      expect(dict.openShiftTitle).not.toBe(dict.closeShiftTitle);
      expect(dict.openShiftSuccess).not.toBe(dict.closeShiftSuccess);
      expect(dict.openShiftError).not.toBe(dict.closeShiftError);
    });
  });
});

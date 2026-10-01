import { describe, expect, it } from "vitest";
import uz from "../../locales/uz/payments.json";
import ru from "../../locales/ru/payments.json";
import en from "../../locales/en/payments.json";

type Dict = Record<string, string>;
const DICTS = { uz: uz as Dict, ru: ru as Dict, en: en as Dict };

/** FIX3 da qo'shilgan kalitlar (FE-PAY-03, FE-PAY-16, CODE-27). */
const FIX3_KEYS = ["paymentOutcomeUnknown", "excelExportError", "branchWithoutManager"];

describe("payments locales — FIX3 keys", () => {
  it("translates every new key in uz, ru (Cyrillic) and en", () => {
    FIX3_KEYS.forEach((key) => {
      expect(DICTS.uz[key]?.trim(), `uz.${key}`).toBeTruthy();
      expect(DICTS.en[key]?.trim(), `en.${key}`).toBeTruthy();
      expect(DICTS.ru[key], `ru.${key}`).toMatch(/[А-Яа-яЁё]/);
    });
  });

  it("keeps the 'outcome unknown' and 'already recorded' payment warnings distinct", () => {
    Object.values(DICTS).forEach((dict) => {
      expect(dict.paymentOutcomeUnknown).not.toBe(dict.paymentAlreadyRecorded);
    });
  });
});

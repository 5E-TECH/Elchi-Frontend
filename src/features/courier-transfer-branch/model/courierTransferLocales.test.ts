import { describe, expect, it } from "vitest";
import uz from "../../../locales/uz/branches.json";
import ru from "../../../locales/ru/branches.json";
import en from "../../../locales/en/branches.json";

/**
 * KURYERNI O'TKAZISH TARJIMALARI. Yangi kalit faqat `uz` ga qo'shilsa,
 * i18next fallback tufayli rus/ingliz tilida jim o'zbekcha matn chiqadi —
 * shu bois `courierTransfer` kalitlari uchala tilda bir xil bo'lishi qulflanadi.
 */
type Dict = Record<string, string>;
const UZ = uz.courierTransfer as Dict;
const RU = ru.courierTransfer as Dict;
const EN = en.courierTransfer as Dict;

/** Shartnoma §3 dagi kalitlar ro'yxati. */
const CONTRACT_KEYS = [
  "title",
  "description",
  "openButton",
  "rowButton",
  "currentBranch",
  "noBranch",
  "targetBranch",
  "selectTarget",
  "noManager",
  "balance",
  "ordersInHand",
  "ok",
  "blocked",
  "payHint",
  "branchPayHint",
  "action",
  "success",
  "checkFailed",
  "retry",
];

describe("branches.courierTransfer locales", () => {
  it("has exactly the contract keys, the same set in uz, ru and en", () => {
    expect(Object.keys(UZ).sort()).toEqual([...CONTRACT_KEYS].sort());
    expect(Object.keys(RU).sort()).toEqual(Object.keys(UZ).sort());
    expect(Object.keys(EN).sort()).toEqual(Object.keys(UZ).sort());
  });

  it("translates every key (no empty values, Cyrillic in ru)", () => {
    CONTRACT_KEYS.forEach((key) => {
      expect(UZ[key]?.trim(), `uz.${key}`).toBeTruthy();
      expect(EN[key]?.trim(), `en.${key}`).toBeTruthy();
      expect(RU[key], `ru.${key}`).toMatch(/[А-Яа-яЁё]/);
    });
  });

  it("keeps the agreed Uzbek wording", () => {
    expect(UZ.title).toBe("Kuryerni boshqa filialga o'tkazish");
    expect(UZ.blocked).toBe("Hozircha o'tkazib bo'lmaydi");
    expect(UZ.ok).toBe("Kuryerda pul va buyurtma yo'q — o'tkazish mumkin");
    expect(UZ.branchPayHint).toBe("Pulni '{{branch}}' filiali menejeri qabul qilishi kerak");
    expect(UZ.openButton).toBe("Filialni o'zgartirish");
    expect(UZ.rowButton).toBe("Boshqa filialga o'tkazish");
  });

  it("interpolates the same placeholders in every language", () => {
    [UZ, RU, EN].forEach((dict) => {
      expect(dict.branchPayHint).toContain("{{branch}}");
      expect(dict.success).toContain("{{name}}");
      expect(dict.success).toContain("{{branch}}");
    });
  });
});

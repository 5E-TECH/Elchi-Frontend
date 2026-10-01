import { describe, expect, it } from "vitest";
import uz from "../../locales/uz/payments.json";
import ru from "../../locales/ru/payments.json";
import en from "../../locales/en/payments.json";

/**
 * TO'LOVLAR TARJIMALARI. Yangi kalit faqat `uz` ga qo'shilsa, i18next
 * fallback tufayli rus/ingliz tilida jim o'zbekcha matn chiqadi — shu bois
 * kalitlar to'plami uchala tilda bir xil bo'lishi qulflanadi.
 */
type Dict = Record<string, string>;
const UZ = uz as Dict;
const RU = ru as Dict;
const EN = en as Dict;

/** HQ kuryerlaridan pul qabul qilish (superadmin/admin) uchun qo'shilgan kalitlar. */
const HQ_COURIER_RECEIVE_KEYS = [
  "selectReceiveSourceDescription",
  "hqCourierLabel",
  "branchCourierNotReceivable",
  "receiveShort",
  "receiveFromBranchOrHqCourier",
  "amountExceedsBalance",
  "paymentAlreadyRecorded",
  "receiveCheckFailed",
  "hqCourierHasBranchSales",
];

describe("payments locales", () => {
  it("has the same key set in uz, ru and en", () => {
    const uzKeys = Object.keys(UZ).sort();

    expect(Object.keys(RU).sort()).toEqual(uzKeys);
    expect(Object.keys(EN).sort()).toEqual(uzKeys);
  });

  it("translates every HQ courier receive key (Cyrillic in ru, no empty values)", () => {
    HQ_COURIER_RECEIVE_KEYS.forEach((key) => {
      expect(UZ[key]?.trim()).toBeTruthy();
      expect(EN[key]?.trim()).toBeTruthy();
      expect(RU[key]).toMatch(/[А-Яа-яЁё]/);
    });
  });

  it("keeps the agreed Uzbek wording", () => {
    expect(UZ.selectReceiveSourceDescription).toBe("Filial menejeri yoki HQ kuryerini tanlang");
    expect(UZ.hqCourierLabel).toBe("HQ kuryeri");
    expect(UZ.branchCourierNotReceivable).toBe(
      "Bu kuryer filialga tegishli — pulni filial menejeri qabul qiladi",
    );
    expect(UZ.receiveShort).toBe("Qabul qilish");
    expect(UZ.paymentAlreadyRecorded).toBe(
      "Bu to'lov allaqachon yozilgan — kassa yangilandi, summani tekshiring",
    );
    expect(UZ.receiveCheckFailed).toBe(
      "Tekshiruv xizmati javob bermadi — to'lov yuborilsa server qayta tekshiradi",
    );
    expect(UZ.hqCourierHasBranchSales).toBe(
      "Kuryerda filialga tegishli topshirilmagan savdo bor — ularni filial menejeri qabul qiladi",
    );
  });

  it("keeps the three courier-receive states distinct in every language", () => {
    [UZ, RU, EN].forEach((dict) => {
      const messages = [
        dict.branchCourierNotReceivable,
        dict.hqCourierHasBranchSales,
        dict.receiveCheckFailed,
        dict.paymentAlreadyRecorded,
      ];
      expect(new Set(messages).size).toBe(messages.length);
    });
  });

  it("interpolates the amount in the over-balance error in every language", () => {
    [UZ, RU, EN].forEach((dict) => {
      expect(dict.amountExceedsBalance).toContain("{{amount}}");
    });
  });
});

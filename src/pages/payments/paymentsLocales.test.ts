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
const UZ = uz as unknown as Dict;
const RU = ru as unknown as Dict;
const EN = en as unknown as Dict;

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

  it("has the same NESTED key set (v2 objects) in uz, ru and en, with no empty values", () => {
    // Yuqori darajadagi tekshiruv ichki obyektlar (`v2Common.*` …) farqini ko'rmaydi — chuqur solishtirish.
    const flatten = (value: unknown, prefix = ""): string[] =>
      Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        child && typeof child === "object" ? flatten(child, `${prefix}${key}.`) : [`${prefix}${key}`],
      );
    const leaves = (value: unknown, prefix = ""): Array<[string, unknown]> =>
      Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        child && typeof child === "object" ? leaves(child, `${prefix}${key}.`) : [[`${prefix}${key}`, child]],
      );
    const uzKeys = flatten(uz).sort();

    expect(flatten(ru).sort()).toEqual(uzKeys);
    expect(flatten(en).sort()).toEqual(uzKeys);
    [uz, ru, en].forEach((dict) => {
      leaves(dict)
        .filter(([key]) => key.startsWith("v2Common.") || key.startsWith("v2Overview.") || key.startsWith("v2Picker.") || key.startsWith("v2HistoryDetail."))
        .forEach(([key, text]) => expect(String(text).trim(), key).toBeTruthy());
    });
  });

  it("keeps the mockup Uzbek wording of the v2 /payments texts", () => {
    const v2 = uz as unknown as {
      v2Common: { sourceType: Record<string, string>; inactive: string; paginationOperations: string };
      v2HistoryDetail: Record<string, string>;
      v2Picker: { receive: Record<string, string>; give: Record<string, string>; courier: Record<string, string> };
      v2Overview: { couriers: Record<string, string> } & Record<string, unknown>;
    };
    expect(v2.v2Common.sourceType.courierPayment).toBe("Kuryer to'lovi");
    expect(v2.v2Common.sourceType.branchToMain).toBe("Filialdan HQ'ga o'tkazma");
    expect(v2.v2Common.sourceType.hqToMarket).toBe("HQ'dan marketga o'tkazma");
    expect(v2.v2Common.inactive).toBe("Nofaol");
    expect(v2.v2Common.paginationOperations).toBe("{{from}}–{{to}} / {{total}} ta operatsiya");
    expect(v2.v2HistoryDetail.incomeTitle).toBe("Kirim operatsiyasi");
    expect(v2.v2HistoryDetail.balanceAfter).toBe("Operatsiyadan keyingi balans");
    expect(v2.v2Picker.receive.searchPlaceholder).toBe("Ism, telefon yoki filial");
    expect(v2.v2Picker.give.description).toBe("Pul to'lanadigan marketni tanlang");
    expect(v2.v2Picker.courier.title).toBe("Kuryerni tanlang");
    expect(v2.v2Overview.couriers.title).toBe("Kuryerlardagi pul");
  });

  it("interpolates the amount in the over-balance error in every language", () => {
    [UZ, RU, EN].forEach((dict) => {
      expect(dict.amountExceedsBalance).toContain("{{amount}}");
    });
  });
});

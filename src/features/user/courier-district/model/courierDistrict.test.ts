import { describe, expect, it } from "vitest";
import { courierDistrictErrorKind, toDistrictOptions } from "./courierDistrict";

const httpError = (status: number, message?: unknown) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: message === undefined ? {} : { statusCode: status, message } },
  });

describe("courierDistrictErrorKind (DtKKY0V8)", () => {
  it("400 matnlari — topilmadi / boshqa viloyat / raqamli emas", () => {
    expect(courierDistrictErrorKind(httpError(400, "Tuman topilmadi"), { districtSent: true })).toBe("notFound");
    expect(
      courierDistrictErrorKind(httpError(400, "Tuman foydalanuvchining viloyatiga tegishli emas"), { districtSent: true }),
    ).toBe("wrongRegion");
    expect(
      courierDistrictErrorKind(httpError(400, ["district_id raqamli ID bo'lishi kerak"]), { districtSent: true }),
    ).toBe("invalid");
    // Boshqa 400 (telefon, parol …) — tuman xatosi emas.
    expect(courierDistrictErrorKind(httpError(400, "Telefon raqam noto'g'ri"), { districtSent: true })).toBeNull();
  });

  it("503 — tumanni tekshirib bo'lmadi (matn bo'yicha; matnsiz — faqat tuman yuborilgan bo'lsa)", () => {
    expect(
      courierDistrictErrorKind(httpError(503, "Tumanni tekshirib bo'lmadi — birozdan keyin qayta urinib ko'ring"), {
        districtSent: true,
      }),
    ).toBe("unavailable");
    expect(courierDistrictErrorKind(httpError(503), { districtSent: true })).toBe("unavailable");
    expect(courierDistrictErrorKind(httpError(503), { districtSent: false })).toBeNull();
    expect(courierDistrictErrorKind(httpError(503, "Filial xizmati javob bermadi"), { districtSent: true })).toBeNull();
    expect(courierDistrictErrorKind(new Error("x"), { districtSent: true })).toBeNull();
  });
});

describe("toDistrictOptions", () => {
  it("id'siz qatorlar tashlanadi, nom bo'yicha saralanadi", () => {
    expect(
      toDistrictOptions([
        { id: 41, name: "Urgut tumani" },
        { id: "40", name: "Pastdarg'om tumani" },
        { name: "id'siz" },
        null,
      ]),
    ).toEqual([
      { value: "40", label: "Pastdarg'om tumani" },
      { value: "41", label: "Urgut tumani" },
    ]);
    expect(toDistrictOptions(undefined)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import { describeProductError, isDuplicateNameError } from "./productErrors";

const httpError = (status: number, message = "Bu marketda Olma nomli mahsulot allaqachon mavjud") =>
  Object.assign(new Error("Request failed"), { isAxiosError: true, response: { status, data: { message } } });

describe("describeProductError", () => {
  const t = i18n.getFixedT("uz", "products");

  it("409 — «shu nomli mahsulot bor» (umumiy «qayta urinib ko'ring» emas, xom matn emas)", () => {
    const text = describeProductError(httpError(409), t);
    expect(text).toBe("Bu marketda shu nomli mahsulot allaqachon bor — boshqa nom kiriting.");
    expect(isDuplicateNameError(httpError(409))).toBe(true);
    expect(isDuplicateNameError(httpError(400))).toBe(false);
  });

  it("400 / 404 — i18n izohlar", () => {
    expect(describeProductError(httpError(400), t)).toBe("Ma'lumotlarni tekshirib, qayta urinib ko'ring.");
    expect(describeProductError(httpError(404), t)).toMatch(/^Mahsulot topilmadi/);
  });
});

import { describe, expect, it } from "vitest";
import uz from "../../../locales/uz/auth.json";
import ru from "../../../locales/ru/auth.json";
import en from "../../../locales/en/auth.json";

/**
 * hQqymheT: kirish xatolari matnlari. «Tizim hatoligi» imlo xatosi qaytmasin; 429 / 403 / 5xx izohlari uchala tilda
 * bor (aks holda i18next jim o'zbekcha matnga qaytadi).
 */
const flat = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : value && typeof value === "object"
      ? Object.values(value).flatMap(flat)
      : [];

const LOGIN_ERROR_KEYS = [
  "systemError",
  "serverError",
  "serverErrorHint",
  "tooManyAttempts",
  "tooManyAttemptsHint",
  "accessDenied",
  "accessDeniedHint",
] as const;

describe("auth locales — kirish xatolari", () => {
  it("uz: «hatoligi» imlo xatosi yo'q", () => {
    expect(flat(uz).filter((text) => /hatolig/i.test(text))).toEqual([]);
    expect(uz.systemError).toBe("Tizim xatoligi");
  });

  it("429 / 403 / 5xx matnlari uchala tilda to'ldirilgan (ru — kirillcha)", () => {
    for (const key of LOGIN_ERROR_KEYS) {
      expect(uz[key]?.trim()).toBeTruthy();
      expect(en[key]?.trim()).toBeTruthy();
      expect(ru[key]).toMatch(/[А-Яа-яЁё]/);
    }
    expect(uz.tooManyAttemptsRetryIn_other).toContain("{{count}}");
    expect(ru.tooManyAttemptsRetryIn_many).toContain("{{count}}");
    expect(en.tooManyAttemptsRetryIn_other).toContain("{{count}}");
  });
});

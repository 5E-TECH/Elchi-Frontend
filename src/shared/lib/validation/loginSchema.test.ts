import type { TFunction } from "i18next";
import type { ResolverOptions } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { createLoginResolver, type LoginFormValues } from "./loginSchema";

/** rzzxMItN — `yup` siz resolver avvalgi sxema qoidalari va xabarlari bilan bir xil. */
const t = ((key: string) => key) as unknown as TFunction<"auth">;
const resolve = (values: LoginFormValues) =>
  createLoginResolver(t)(values, undefined, {} as ResolverOptions<LoginFormValues>) as Awaited<
    ReturnType<ReturnType<typeof createLoginResolver>>
  >;
const messages = (values: LoginFormValues) =>
  Object.fromEntries(Object.entries(resolve(values).errors).map(([field, error]) => [field, error?.message]));

describe("kirish formasi tekshiruvi", () => {
  it("faqat «+998» (raqam yozilmagan) va bo'sh parol — majburiy", () => {
    expect(messages({ phone_number: "+998", password: "" })).toEqual({
      phone_number: "phoneRequired",
      password: "passwordRequired",
    });
    expect(messages({ phone_number: "", password: "" }).phone_number).toBe("phoneRequired");
  });

  it("chala raqam — format; 4 belgidan qisqa parol — uzunlik", () => {
    expect(messages({ phone_number: "+99890123", password: "abc" })).toEqual({
      phone_number: "phoneFormat",
      password: "passwordMinLength",
    });
  });

  it("to'g'ri qiymat — xato yo'q, qiymat o'zgarmasdan qaytadi", () => {
    expect(resolve({ phone_number: "+998901234567", password: "abcd" })).toEqual({
      values: { phone_number: "+998901234567", password: "abcd" },
      errors: {},
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  getUzbekistanPhoneDigits,
  formatUzbekistanPhoneLocal,
  formatUzbekistanPhoneFull,
  toUzbekistanPhoneValue,
  isCompleteUzbekistanPhone,
} from "./phone";

describe("phone helpers", () => {
  it("getUzbekistanPhoneDigits strips formatting + 998 prefix and caps at 9", () => {
    expect(getUzbekistanPhoneDigits("+998 90 123 45 67")).toBe("901234567");
    expect(getUzbekistanPhoneDigits("901234567")).toBe("901234567");
    expect(getUzbekistanPhoneDigits("998901234567")).toBe("901234567");
    expect(getUzbekistanPhoneDigits("9012345678901")).toBe("901234567");
    expect(getUzbekistanPhoneDigits("")).toBe("");
  });

  it("formatUzbekistanPhoneLocal groups digits progressively", () => {
    expect(formatUzbekistanPhoneLocal("90")).toBe("90");
    expect(formatUzbekistanPhoneLocal("9012")).toBe("90 12");
    expect(formatUzbekistanPhoneLocal("90123")).toBe("90 123");
    expect(formatUzbekistanPhoneLocal("9012345")).toBe("90 123 45");
    expect(formatUzbekistanPhoneLocal("901234567")).toBe("90 123 45 67");
  });

  it("formatUzbekistanPhoneFull prefixes +998", () => {
    expect(formatUzbekistanPhoneFull("901234567")).toBe("+998 90 123 45 67");
    expect(formatUzbekistanPhoneFull("")).toBe("+998 ");
  });

  it("toUzbekistanPhoneValue builds the canonical +998######### value", () => {
    expect(toUzbekistanPhoneValue("90 123 45 67")).toBe("+998901234567");
  });

  it("isCompleteUzbekistanPhone requires 9 local digits", () => {
    expect(isCompleteUzbekistanPhone("901234567")).toBe(true);
    expect(isCompleteUzbekistanPhone("9012345")).toBe(false);
    expect(isCompleteUzbekistanPhone("")).toBe(false);
  });
});

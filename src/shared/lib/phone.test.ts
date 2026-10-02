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

  it("getUzbekistanPhoneDigits keeps a LOCAL number whose operator part is 99 + 8 (regression)", () => {
    // "99 800 00 00" — operator 99, subscriber starting with 8. The local part
    // "998000000" must NOT be mistaken for the country code and stripped.
    expect(getUzbekistanPhoneDigits("998000000")).toBe("998000000");
    expect(getUzbekistanPhoneDigits("998")).toBe("998"); // mid-typing
    // Full numbers (with the "+998" prefix, or >9 bare digits) still strip once.
    expect(getUzbekistanPhoneDigits("+998998000000")).toBe("998000000");
    expect(getUzbekistanPhoneDigits("998998000000")).toBe("998000000");
  });

  it("formatUzbekistanPhoneLocal groups digits progressively", () => {
    expect(formatUzbekistanPhoneLocal("90")).toBe("90");
    expect(formatUzbekistanPhoneLocal("9012")).toBe("90 12");
    expect(formatUzbekistanPhoneLocal("90123")).toBe("90 123");
    expect(formatUzbekistanPhoneLocal("9012345")).toBe("90 123 45");
    expect(formatUzbekistanPhoneLocal("901234567")).toBe("90 123 45 67");
  });

  it("formatUzbekistanPhoneLocal handles the operator-99 number end to end", () => {
    expect(formatUzbekistanPhoneLocal("998")).toBe("99 8"); // typing 8 after 99
    expect(formatUzbekistanPhoneLocal("998000000")).toBe("99 800 00 00");
    // Re-formatting a stored canonical "+998…" value (market-operators flow).
    expect(formatUzbekistanPhoneLocal("+998998000000")).toBe("99 800 00 00");
    expect(toUzbekistanPhoneValue("99 800 00 00")).toBe("+998998000000");
    expect(isCompleteUzbekistanPhone("998000000")).toBe(true);
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

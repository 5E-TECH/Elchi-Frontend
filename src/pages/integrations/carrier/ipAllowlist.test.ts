import { describe, expect, it } from "vitest";
import { checkIpAllowlist, checkIpRule, ipAllowlistToText } from "./ipAllowlist";

/**
 * Backend `libs/common/src/security/ip-allowlist-rule.spec.ts` bilan bir xil holatlar: frontda o'tgan qoida serverda
 * ham o'tadi (aks holda 400 matni faqat toastda qolardi), frontda rad etilgani serverda ham rad.
 */
describe("checkIpRule — backend canonicalIpAllowlistRule bilan bir xil", () => {
  it.each([
    ["203.0.113.10", "203.0.113.10"],
    [" 203.0.113.10 ", "203.0.113.10"],
    ["203.0.113.0/24", "203.0.113.0/24"],
    ["0.0.0.0/0", "0.0.0.0/0"],
    ["10.0.0.1/32", "10.0.0.1/32"],
    ["2001:0DB8::0001", "2001:db8::1"],
    ["2001:db8::1", "2001:db8::1"],
    ["::ffff:203.0.113.10", "203.0.113.10"],
    ["::ffff:cb00:710a", "203.0.113.10"],
    ["::ffff:203.0.113.0/24", "203.0.113.0/24"],
  ])("%s → %s", (raw, rule) => {
    expect(checkIpRule(raw)).toEqual({ ok: true, rule });
  });

  it("host bitli CIDR — rad, to'g'ri tarmoq manzili taklif qilinadi", () => {
    expect(checkIpRule("203.0.113.7/16")).toEqual({
      ok: false,
      error: "hostBits",
      suggestion: "203.0.0.0/16",
    });
    expect(checkIpRule("203.0.113.10/3")).toEqual({
      ok: false,
      error: "hostBits",
      suggestion: "192.0.0.0/3",
    });
  });

  it("IPv6 diapazon — alohida sabab bilan rad", () => {
    expect(checkIpRule("2001:db8::/48")).toEqual({ ok: false, error: "ipv6Range" });
  });

  it.each([
    "1.2.3.4,5.6.7.8",
    "256.1.1.1",
    "01.2.3.4",
    "1.2.3",
    "abc",
    "1.2.3.4/33",
    "1.2.3.4/x",
    "1.2.3.4/1/2",
    "::203.0.113.10",
    "fe80::1%eth0",
  ])("%s — tushunilmaydi", (raw) => {
    expect(checkIpRule(raw)).toEqual({ ok: false, error: "invalid" });
  });

  it("64 belgidan uzun qoida — rad", () => {
    expect(checkIpRule(`${"1".repeat(65)}`)).toEqual({ ok: false, error: "tooLong" });
  });
});

describe("checkIpAllowlist — textarea qatorlari", () => {
  it("maketdagi holat: 1 to'g'ri, 2 xato, 1 kanonik, 1 takror", () => {
    const check = checkIpAllowlist(
      "203.0.113.10\n203.0.113.7/16\n2001:db8::/48\n2001:0DB8::0001\n203.0.113.10",
    );
    expect(check.lines.map((line) => line.kind)).toEqual([
      "ok",
      "error",
      "error",
      "normalized",
      "duplicate",
    ]);
    expect(check.count).toBe(5);
    expect(check.errorCount).toBe(2);
    expect(check.valid).toBe(false);
    expect(check.rules).toEqual(["203.0.113.10", "2001:db8::1"]);
  });

  it("bo'sh qatorlar o'tkaziladi, qator raqami textarea'dagidek", () => {
    const check = checkIpAllowlist("\n203.0.113.10\n\n198.51.100.0/24\n");
    expect(check.lines.map((line) => line.line)).toEqual([2, 4]);
    expect(check.rules).toEqual(["203.0.113.10", "198.51.100.0/24"]);
    expect(check.valid).toBe(true);
  });

  it("bo'sh matn — cheklov yo'q (qoidasiz, to'g'ri)", () => {
    expect(checkIpAllowlist("   \n")).toMatchObject({ rules: [], count: 0, valid: true });
  });

  it("50 tadan ko'p qator — yuborilmaydi", () => {
    const text = Array.from({ length: 51 }, (_, i) => `10.0.0.${i}`).join("\n");
    const check = checkIpAllowlist(text);
    expect(check.overLimit).toBe(true);
    expect(check.valid).toBe(false);
    expect(checkIpAllowlist(text.split("\n").slice(0, 50).join("\n")).valid).toBe(true);
  });

  it("saqlangan ro'yxat — har qatorga bitta", () => {
    expect(ipAllowlistToText(["203.0.113.10", "2001:db8::1"])).toBe("203.0.113.10\n2001:db8::1");
    expect(ipAllowlistToText(null)).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { isPersonNameRole, normalizePersonName } from "./personName";

describe("normalizePersonName", () => {
  it("har so'zning birinchi harfi katta, qolgani yozilgandek", () => {
    expect(normalizePersonName("ali valiyev")).toBe("Ali Valiyev");
    expect(normalizePersonName("ALI")).toBe("ALI");
    expect(normalizePersonName("mcDonald")).toBe("McDonald");
    expect(normalizePersonName("aLI vALIYEV")).toBe("ALI VALIYEV");
    expect(normalizePersonName("Ali Valiyev")).toBe("Ali Valiyev");
  });

  it("o'zbekcha tutuq belgisi: so'z ichida ajratkich emas", () => {
    expect(normalizePersonName("o'tkir")).toBe("O'tkir");
    expect(normalizePersonName("g'ulom o'g'li")).toBe("G'ulom O'g'li");
    expect(normalizePersonName("o‘tkir")).toBe("O‘tkir");
  });

  it("boshidagi harf bo'lmagan belgilar o'tkazib yuboriladi", () => {
    expect(normalizePersonName("'ali'")).toBe("'Ali'");
    expect(normalizePersonName("«ali» vali")).toBe("«Ali» Vali");
    expect(normalizePersonName("(ali)")).toBe("(Ali)");
  });

  it("chiziqcha ham so'z ajratadi", () => {
    expect(normalizePersonName("abdulla-ugli")).toBe("Abdulla-Ugli");
    expect(normalizePersonName("anna-maria smith")).toBe("Anna-Maria Smith");
    expect(normalizePersonName("ali - vali")).toBe("Ali - Vali");
  });

  it("kirill harflari", () => {
    expect(normalizePersonName("иван петров")).toBe("Иван Петров");
    expect(normalizePersonName("ёқубов ғани")).toBe("Ёқубов Ғани");
  });

  it("qirqish va ketma-ket bo'shliqlar", () => {
    expect(normalizePersonName("  ali   valiyev  ")).toBe("Ali Valiyev");
    expect(normalizePersonName("ali\t\nvali")).toBe("Ali Vali");
    expect(normalizePersonName("   ")).toBe("");
    expect(normalizePersonName("")).toBe("");
    expect(normalizePersonName(null)).toBe("");
    expect(normalizePersonName(undefined)).toBe("");
  });

  it("tilga bog'liq emas: «i» → «I» (turkcha «İ» emas)", () => {
    expect(normalizePersonName("ilhom")).toBe("Ilhom");
  });

  it("idempotent", () => {
    const once = normalizePersonName("  o'tkir   abdulla-ugli  ");
    expect(normalizePersonName(once)).toBe(once);
  });
});

describe("isPersonNameRole", () => {
  it("xodim va mijoz rollari — shaxs ismi", () => {
    for (const role of ["superadmin", "admin", "manager", "registrator", "logist", "courier", "investor", "market_operator", "operator", "customer"]) {
      expect(isPersonNameRole(role), role).toBe(true);
    }
  });

  it("market va filial hisobi — biznes nomi (o'zgartirilmaydi)", () => {
    expect(isPersonNameRole("market")).toBe(false);
    expect(isPersonNameRole("marketing")).toBe(false);
    expect(isPersonNameRole("branch")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { formatPhone, parseUzbekPhone, toTelHref } from "./formatPhone";

/**
 * TELEFON KO'RSATISH — dizayn v2: "+998 90 123 45 67" (DESIGN_SYSTEM §7, maketlardagi
 * har telefon shu ko'rinishda). Eski joylardagi 5 xil `formatPhoneNumber` qabul qilgan
 * har bir O'zbekiston shakli shu yerda ham qabul qilinadi.
 */
describe("formatPhone — O'zbekiston raqamlari", () => {
  it.each([
    ["901234567", "9 ta raqam (mahalliy qism)"],
    ["998901234567", "12 ta raqam, + siz"],
    ["+998901234567", "kanonik qiymat (backend, toUzbekistanPhoneValue)"],
    ["+998 90 123 45 67", "allaqachon formatlangan"],
    ["+998 (90) 123-45-67", "eski yorliq / UserListTable ko'rinishi"],
    ["+998-90-123-45-67", "chiziqchalar"],
    ["998 90 123 45 67", "+ siz, bo'sh joy bilan"],
    ["(90) 123-45-67", "qavsli mahalliy qism"],
    ["90 123 45 67", "maydon niqobi ko'rinishi"],
    ["90.123.45.67", "nuqtalar"],
    ["+998 90 123 45 67", "bo'linmas bo'sh joy"],
    ["+998 90 123 – 45 – 67", "tipografik chiziqcha"],
    ["00998901234567", "xalqaro 00 prefiksi"],
    ["  +998901234567  ", "chetidagi bo'sh joylar"],
  ])("%s (%s) → +998 90 123 45 67", (raw) => {
    expect(formatPhone(raw)).toBe("+998 90 123 45 67");
  });

  it("son sifatida kelgan raqam", () => {
    expect(formatPhone(901234567)).toBe("+998 90 123 45 67");
    expect(formatPhone(998901234567)).toBe("+998 90 123 45 67");
  });

  it("99 operatori + 8 bilan boshlanuvchi mahalliy raqam 998 deb kesilmaydi (phone.ts regressiyasi)", () => {
    expect(formatPhone("998000000")).toBe("+998 99 800 00 00");
    expect(formatPhone("+998998000000")).toBe("+998 99 800 00 00");
    expect(formatPhone("998998000000")).toBe("+998 99 800 00 00");
  });
});

describe("formatPhone — boshqa qiymatlar o'zgarishsiz", () => {
  it.each([
    ["+7 916 123-45-67", "xorijiy raqam"],
    ["+1 (555) 010-0199", "xorijiy raqam, qavsli"],
    ["+901234567", "+ bilan 9 xona — mahalliy qism emas"],
    ["90 123 45", "chala raqam"],
    ["+998 90 123 45 6", "chala (11 xona)"],
    ["9989012345678", "ortiqcha xona — kesib tashlanmaydi"],
    ["1050", "qisqa xizmat raqami"],
    ["90-123-45-67 (uy)", "harfli izoh"],
    ["telefon yo'q", "matn"],
    ["-", "chiziqcha"],
  ])("%s (%s)", (raw) => {
    expect(formatPhone(raw)).toBe(raw);
  });

  it("qirqiladi", () => {
    expect(formatPhone("  +7 916 123-45-67 ")).toBe("+7 916 123-45-67");
  });

  it("bo'sh qiymat → «—»", () => {
    for (const raw of [undefined, null, "", "   ", Number.NaN, {}, [], true]) {
      expect(formatPhone(raw)).toBe("—");
    }
  });

  it("noodatiy son satrga aylanadi", () => {
    expect(formatPhone(12345)).toBe("12345");
    expect(formatPhone(-901234567)).toBe("-901234567");
  });
});

describe("parseUzbekPhone", () => {
  it("9 xonali mahalliy qism yoki null", () => {
    expect(parseUzbekPhone("+998 (90) 123-45-67")).toBe("901234567");
    expect(parseUzbekPhone("901234567")).toBe("901234567");
    expect(parseUzbekPhone("+7 916 123 45 67")).toBeNull();
    expect(parseUzbekPhone("90123")).toBeNull();
    expect(parseUzbekPhone(null)).toBeNull();
    expect(parseUzbekPhone("abc901234567")).toBeNull();
  });
});

describe("toTelHref", () => {
  it("O'zbekiston raqami → tel:+998XXXXXXXXX (maketdagi havola)", () => {
    expect(toTelHref("901234567")).toBe("tel:+998901234567");
    expect(toTelHref("+998 (90) 214-66-31")).toBe("tel:+998902146631");
    expect(toTelHref("90 123 45 67")).toBe("tel:+998901234567");
    expect(toTelHref(998901234567)).toBe("tel:+998901234567");
  });

  it("xorijiy raqam — ajratkichlarsiz, + saqlanadi", () => {
    expect(toTelHref("+7 916 123-45-67")).toBe("tel:+79161234567");
    expect(toTelHref("1050")).toBe("tel:1050");
  });

  it("telefonga o'xshamasa — undefined (havola chizilmaydi)", () => {
    for (const raw of [undefined, null, "", "  ", "telefon yo'q", "90-123 (uy)", "12", "1234567890123456", "-"]) {
      expect(toTelHref(raw)).toBeUndefined();
    }
  });

  it("chala yoki ortiqcha +998 raqami — havola yo'q, matn o'zgarishsiz (noto'g'ri raqamga qo'ng'iroq qilinmasin)", () => {
    for (const raw of ["+998 90 123 45 6", "+998 90 123 45 678", "+998"]) {
      expect(toTelHref(raw)).toBeUndefined();
      expect(formatPhone(raw)).toBe(raw);
    }
    // + siz 998 bilan boshlanuvchi qisqa raqam — O'zbekiston xalqaro shakli emas, havola qoladi.
    expect(toTelHref("99812")).toBe("tel:99812");
  });
});

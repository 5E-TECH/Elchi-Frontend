import { describe, expect, it } from "vitest";
import { applySiteEdit, findSiteDistrict, normalizeSitePhone, siteProblems, toSiteDistricts } from "./siteEdit";
import { DEFAULT_SITE_MAPPING, toSitePreview } from "./siteOrder";

const mapping = DEFAULT_SITE_MAPPING;

const raw = (over: Record<string, unknown> = {}) => ({
  id: 501,
  qr_code: "Q-1",
  full_name: "Rustam",
  phone: "901234567",
  district: 1703211,
  total_price: 99000,
  delivery_price: 30000,
  ...over,
});
const row = (over: Record<string, unknown> = {}) => toSitePreview(raw(over), mapping, "Q-1");

const DISTRICTS = toSiteDistricts({
  data: [
    {
      id: "30",
      name: "Jalaquduq",
      sato_code: "1703211",
      region_id: "3",
      region: { id: "3", name: "Andijon" },
      assignedToRegion: { id: "3", name: "Andijon" },
    },
    {
      id: "44",
      name: "G'ijduvon",
      sato_code: "1706215",
      region_id: "4",
      region: { id: "4", name: "Buxoro" },
      assignedToRegion: { id: "9", name: "Navoiy" },
    },
    { id: "77", name: "Eski", sato_code: null, region_id: "4", region: { id: "4", name: "Buxoro" } },
  ],
});

describe("normalizeSitePhone — backend `normalizeUzPhone` bilan AYNI", () => {
  it.each([
    ["+998 (90) 123-45-67", "+998901234567"],
    ["998901234567", "+998901234567"],
    ["0901234567", "+998901234567"],
    ["8 90 123 45 67", "+998901234567"],
    ["90 123 45 67", "+998901234567"],
    [901234567, "+998901234567"],
  ])("%s → %s", (input, expected) => expect(normalizeSitePhone(input)).toBe(expected));

  it.each(["90123456", "9989012345678", "+7 901 123 45 67", "", "telefon yo'q", null, undefined, -901234567, {}])(
    "⭐ %s — `null` (to'ldirilmaydi, kesilmaydi)",
    (input) => expect(normalizeSitePhone(input)).toBeNull(),
  );
});

describe("tuman", () => {
  it("SOATO, keyin id; xizmat viloyati; noma'lum — `null`", () => {
    expect(findSiteDistrict(DISTRICTS, "1706215")).toMatchObject({ name: "G'ijduvon", regionName: "Navoiy", regionId: "9" });
    expect(findSiteDistrict(DISTRICTS, "77")).toMatchObject({ name: "Eski", regionName: "Buxoro" });
    expect(findSiteDistrict(DISTRICTS, "1799999")).toBeNull();
    expect(findSiteDistrict(DISTRICTS, "")).toBeNull();
  });
});

describe("siteProblems", () => {
  it("to'g'ri buyurtma — muammo yo'q", () => expect(siteProblems(row(), DISTRICTS)).toEqual([]));
  it("⭐ telefon yo'q / xato", () => {
    expect(siteProblems(row({ phone: null }), DISTRICTS)).toEqual(["phone_missing"]);
    expect(siteProblems(row({ phone: "90123456" }), DISTRICTS)).toEqual(["phone_invalid"]);
  });
  it("tuman topilmadi; ro'yxat kelmagan bo'lsa tekshirilmaydi", () => {
    expect(siteProblems(row({ district: "1799999" }), DISTRICTS)).toEqual(["district_unresolved"]);
    expect(siteProblems(row({ district: undefined }), DISTRICTS)).toEqual(["district_unresolved"]);
    expect(siteProblems(row({ district: "1799999" }), null)).toEqual([]);
    expect(siteProblems(row({ district: "1799999" }), [])).toEqual([]);
  });
  it("summa o'qilmadi", () => expect(siteProblems(row({ total_price: "bepul" }), DISTRICTS)).toEqual(["price_invalid"]));
});

describe("applySiteEdit", () => {
  it("⭐ tuzatilgan telefon payload'ga ulanish xaritasidagi maydonga yoziladi; kalit va QR o'zgarmaydi", () => {
    const custom = { ...mapping, phone_field: "customer.tel" };
    const before = toSitePreview(
      { id: 1, qr_code: "Q-1", customer: { tel: "90123456", ism: "A" }, total_price: 5 },
      custom,
      "Q-1",
    );
    const after = applySiteEdit({ ...before, error: "x" }, custom, { phone: "+998901234567" });
    expect(after.payload).toMatchObject({ customer: { tel: "+998901234567", ism: "A" }, total_price: 5 });
    expect(after).toMatchObject({ key: "Q-1", qr: "Q-1", phone: "+998901234567", error: undefined, edited: true });
    // Asl qator o'zgarmaydi.
    expect(before.payload).toMatchObject({ customer: { tel: "90123456" } });
    expect(siteProblems(after, null)).toEqual([]);
  });

  it("tuman — SOATO kodi bilan; tegilmagan maydonlar saytdagidek", () => {
    const after = applySiteEdit(row({ district: "x", address: "Uy 5" }), mapping, { districtCode: "1703211" });
    expect(after.payload).toMatchObject({ district: "1703211", address: "Uy 5", full_name: "Rustam", total_price: 99000 });
    expect(siteProblems(after, DISTRICTS)).toEqual([]);
  });

  it("⭐ summa — jami (yetkazish bilan), ikki marta qo'shilmaydi", () => {
    const after = applySiteEdit(row({ total_price: "bepul" }), mapping, { amount: 129000 });
    expect(after.amount).toBe(129000);
    expect(after.payload).toMatchObject({ total_price: 129000, delivery_price: 0 });
  });
});

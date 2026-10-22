import { describe, expect, it } from "vitest";
import {
  applyInvestorListSearch,
  parseInvestmentsSearch,
  parseProfitsSearch,
  toInvestmentsParams,
  toProfitsParams,
} from "./listSearch";

const params = (query: string) => new URLSearchParams(query);

describe("investor ro'yxatlari — URL holati (IN-2)", () => {
  it("investitsiyalar: sukut — barcha vaqt, 1-sahifa, 10 ta", () => {
    expect(parseInvestmentsSearch(params(""))).toEqual({ from: "", to: "", page: 1, limit: 10 });
  });

  it("investitsiyalar: oraliq, sahifa va hajm o'qiladi; teskari oraliq almashtiriladi", () => {
    expect(parseInvestmentsSearch(params("from=2026-09-01&to=2026-09-30&page=3&limit=25"))).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
      page: 3,
      limit: 25,
    });
    expect(parseInvestmentsSearch(params("from=2026-09-30&to=2026-09-01"))).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("noto'g'ri qiymatlar jim tashlanadi (400 ga olib bormaydi)", () => {
    expect(parseInvestmentsSearch(params("from=2026-02-30&to=abc&page=-2&limit=5000"))).toEqual({
      from: "",
      to: "",
      page: 1,
      limit: 10,
    });
    expect(parseInvestmentsSearch(params("page=1.5&limit=7")).page).toBe(1);
    expect(parseProfitsSearch(params("status=unknown&page=0"))).toEqual({ status: "all", page: 1, limit: 10 });
  });

  it("foyda: holat filtri", () => {
    expect(parseProfitsSearch(params("status=paid&page=2"))).toEqual({ status: "paid", page: 2, limit: 10 });
    expect(parseProfitsSearch(params("status=pending&limit=50"))).toEqual({ status: "pending", page: 1, limit: 50 });
  });

  it("filtr yoki hajm almashsa — 1-sahifa; sukut qiymatlar URL'dan olinadi; boshqa parametrlar saqlanadi", () => {
    const current = params("from=2026-09-01&to=2026-09-30&page=4&tab=x");
    expect(applyInvestorListSearch(current, { from: "", to: "" }).toString()).toBe("tab=x");
    expect(applyInvestorListSearch(current, { limit: 50 }).toString()).toBe("from=2026-09-01&to=2026-09-30&tab=x&limit=50");
    expect(applyInvestorListSearch(current, { limit: 10 }).get("limit")).toBeNull();
    expect(applyInvestorListSearch(current, { page: 2 }).get("page")).toBe("2");
    expect(applyInvestorListSearch(current, { page: 1 }).get("page")).toBeNull();
    expect(applyInvestorListSearch(params("status=paid&page=3"), { status: "all" }).toString()).toBe("");
    expect(applyInvestorListSearch(params("page=3"), { status: "pending" }).toString()).toBe("status=pending");
    // Asl obyekt o'zgarmaydi.
    expect(current.get("page")).toBe("4");
  });

  it("investitsiyalar so'rovi: oraliq Toshkent kuni bo'yicha (kun boshi va oxiri +05:00), filtrsiz — sanasiz", () => {
    expect(toInvestmentsParams({ from: "", to: "", page: 1, limit: 10 })).toEqual({ page: 1, limit: 10 });
    expect(toInvestmentsParams({ from: "2026-09-01", to: "2026-09-30", page: 2, limit: 25 })).toEqual({
      page: 2,
      limit: 25,
      from_date: "2026-09-01T00:00:00+05:00",
      to_date: "2026-09-30T23:59:59.999+05:00",
    });
  });

  it("foyda so'rovi: `is_paid` faqat filtr tanlanganda", () => {
    expect(toProfitsParams({ status: "all", page: 1, limit: 10 })).toEqual({ page: 1, limit: 10 });
    expect(toProfitsParams({ status: "paid", page: 1, limit: 10 })).toEqual({ page: 1, limit: 10, is_paid: true });
    expect(toProfitsParams({ status: "pending", page: 3, limit: 10 })).toEqual({ page: 3, limit: 10, is_paid: false });
  });
});

import { describe, expect, it } from "vitest";
import { extractPaginationMeta } from "./paginationMeta";

describe("extractPaginationMeta", () => {
  it("⭐ backend standarti: data.meta (items + meta)", () => {
    expect(
      extractPaginationMeta({
        statusCode: 200,
        message: "Branches list",
        data: { items: [], meta: { page: 1, limit: 12, total: 13, totalPages: 2 } },
      }),
    ).toEqual({ total: 13, page: 1, limit: 12, totalPages: 2 });
  });

  it("eski shakllar: ildizda, data ichida, meta / pagination", () => {
    expect(extractPaginationMeta({ total: 5, page: 2, limit: 10 })).toMatchObject({ total: 5, page: 2, limit: 10 });
    expect(extractPaginationMeta({ data: { items: [], total: 7 } })).toMatchObject({ total: 7 });
    expect(extractPaginationMeta({ data: [], meta: { total: 9, per_page: 20 } })).toMatchObject({ total: 9, limit: 20 });
    expect(extractPaginationMeta({ data: { pagination: { total: "11", currentPage: "3" } } })).toMatchObject({
      total: 11,
      page: 3,
    });
  });

  it("topilmasa — undefined (taxmin qilinmaydi); 0 haqiqiy qiymat", () => {
    expect(extractPaginationMeta({ data: [] })).toEqual({
      total: undefined,
      page: undefined,
      limit: undefined,
      totalPages: undefined,
    });
    expect(extractPaginationMeta(null).total).toBeUndefined();
    expect(extractPaginationMeta({ data: { items: [], meta: { total: 0 } } }).total).toBe(0);
    expect(extractPaginationMeta({ data: { meta: { total: "abc" } } }).total).toBeUndefined();
  });
});

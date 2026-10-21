import { applySentSearch, countSentFilters, parseSentSearch } from "./sentSearch";

const parse = (search: string) => parseSentSearch(new URLSearchParams(search));

describe("sentSearch (URL state of /notifications/sent)", () => {
  it("reads status, author, page and the open dialog id", () => {
    expect(parse("status=failed&created_by=7&page=3&id=0b7f6f5e-3c1a")).toEqual({
      filters: { status: "failed", author: "7" },
      page: 3,
      openId: "0b7f6f5e-3c1a",
    });
  });

  it("ignores values the backend would reject", () => {
    expect(parse("status=done&created_by=abc&page=-2&id=../../x y")).toEqual({
      filters: { status: "", author: "" },
      page: 1,
      openId: null,
    });
    expect(parse("page=1.5").page).toBe(1);
  });

  it("a filter change resets the page; empty values and page 1 leave the URL", () => {
    const current = new URLSearchParams("status=sent&page=4&id=abc&tab=x");
    expect(applySentSearch(current, { status: "failed" }).toString()).toBe("status=failed&id=abc&tab=x");
    expect(applySentSearch(current, { status: "", author: "" }).toString()).toBe("id=abc&tab=x");
    expect(applySentSearch(current, { page: 1 }).toString()).toBe("status=sent&id=abc&tab=x");
    expect(applySentSearch(current, { page: 2 }).get("page")).toBe("2");
    expect(applySentSearch(current, { openId: null }).has("id")).toBe(false);
    expect(applySentSearch(new URLSearchParams(), { openId: "d1" }).toString()).toBe("id=d1");
    // Asl obyekt o'zgarmaydi.
    expect(current.toString()).toBe("status=sent&page=4&id=abc&tab=x");
  });

  it("re-sending the same filter values keeps the page (phone sheet sends both keys)", () => {
    const current = new URLSearchParams("status=failed&page=3");
    expect(applySentSearch(current, { status: "failed", author: "" }).get("page")).toBe("3");
    expect(applySentSearch(current, { status: "failed", author: "7" }).has("page")).toBe(false);
  });

  it("counts active filters (phone «Filtrlar» pill)", () => {
    expect(countSentFilters({ status: "", author: "" })).toBe(0);
    expect(countSentFilters({ status: "partial", author: "7" })).toBe(2);
  });
});

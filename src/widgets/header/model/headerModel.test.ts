import { afterEach, describe, expect, it, vi } from "vitest";
import type { GlobalSearchItem } from "../../../features/search/api/useGlobalSearch";
import {
  RECENT_SEARCHES_KEY,
  RECENT_SEARCHES_LIMIT,
  clearRecentSearches,
  readRecentSearches,
  rememberSearch,
} from "./recentSearches";
import { groupSearchEntries, splitByQuery, toSearchEntry } from "./searchEntry";
import { getInitials, joinRoleAndBranch, readBranchName, readDisplayName } from "./userIdentity";

const item = (overrides: Partial<GlobalSearchItem>): GlobalSearchItem => ({
  id: "x",
  title: "Natija",
  raw: {},
  ...overrides,
});

describe("userIdentity", () => {
  it.each([
    ["Shodiyor Ergashev", "SE"],
    ["  ravshan   ortiqov  qodirovich ", "RO"],
    ["Baraka", "BA"],
    ["Ёқубжон", "ЁҚ"],
    ["", "?"],
    [null, "?"],
  ])("initials of %j → %s", (name, initials) => {
    expect(getInitials(name)).toBe(initials);
  });

  it("reads the assigned branch name from the profile shapes the backend sends", () => {
    expect(readBranchName({ branch: { branch: { name: "Urgut filiali" } } })).toBe("Urgut filiali");
    expect(readBranchName({ branch: { name: "Toshkent HQ" } })).toBe("Toshkent HQ");
    expect(readBranchName({ branch: { branch_name: " Samarqand " } })).toBe("Samarqand");
    expect(readBranchName({ branch: null })).toBeNull();
    expect(readBranchName(null)).toBeNull();
  });

  it("prefers the full name and falls back to the role slice name", () => {
    expect(readDisplayName({ fullName: "A B", name: "C" })).toBe("A B");
    expect(readDisplayName({ full_name: "D E" })).toBe("D E");
    expect(readDisplayName({ name: "  " }, "zaxira")).toBe("zaxira");
    expect(readDisplayName(null, null)).toBeNull();
  });

  it("joins role and branch with a middle dot", () => {
    expect(joinRoleAndBranch("Menejer", "Urgut filiali")).toBe("Menejer · Urgut filiali");
    expect(joinRoleAndBranch("Superadmin", null)).toBe("Superadmin");
  });
});

describe("recentSearches", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("keeps the newest first, de-duplicates case-insensitively and caps the list", () => {
    rememberSearch("Aziz");
    rememberSearch("№10235");
    rememberSearch("  aziz  ");
    expect(readRecentSearches()).toEqual(["aziz", "№10235"]);
    for (let index = 0; index < 10; index += 1) rememberSearch(`q${index}`);
    expect(readRecentSearches()).toHaveLength(RECENT_SEARCHES_LIMIT);
    expect(readRecentSearches()[0]).toBe("q9");
  });

  it("ignores empty queries and broken storage values", () => {
    rememberSearch("   ");
    expect(readRecentSearches()).toEqual([]);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, "{not json");
    expect(readRecentSearches()).toEqual([]);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([1, "ok", ""]));
    expect(readRecentSearches()).toEqual(["ok"]);
  });

  it("works without storage (private window)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readRecentSearches()).toEqual([]);
    expect(() => rememberSearch("x")).not.toThrow();
    expect(() => clearRecentSearches()).not.toThrow();
  });
});

describe("searchEntry", () => {
  it("routes identity results to the user page with role and phone", () => {
    const entry = toSearchEntry(
      item({ source: "identity", type: "courier", sourceId: "7", title: "Jasur", metadata: { role: "courier", phone_number: "901234567" } }),
    );
    expect(entry).toMatchObject({ kind: "users", href: "/all-users/7", role: "courier", phone: "901234567" });
  });

  it("routes order results to the order page and extracts the number from «Order #…»", () => {
    const entry = toSearchEntry(item({ source: "order", type: "order", sourceId: "uuid-1", title: "Order #10241", metadata: { status: "new" } }));
    expect(entry).toMatchObject({ kind: "orders", href: "/orders/edit/uuid-1", orderId: "10241", status: "new" });
  });

  it("keeps the legacy user types and leaves unknown results without a link", () => {
    expect(toSearchEntry(item({ type: "market", sourceId: "3" })).href).toBe("/all-users/3");
    expect(toSearchEntry(item({ source: "catalog", type: "product", sourceId: "9" }))).toMatchObject({ kind: "other", href: null });
  });

  it("groups in the mockup order and drops empty groups", () => {
    const entries = [
      toSearchEntry(item({ id: "u", source: "identity", type: "admin" })),
      toSearchEntry(item({ id: "p", source: "catalog", type: "product" })),
      toSearchEntry(item({ id: "o", source: "order", type: "order" })),
    ];
    expect(groupSearchEntries(entries).map((group) => group.kind)).toEqual(["orders", "users", "other"]);
    expect(groupSearchEntries(entries.slice(0, 1)).map((group) => group.kind)).toEqual(["users"]);
  });

  it("splits text around the query (case-insensitive, regex-safe)", () => {
    expect(splitByQuery("Dilnoza Karimova", "dil")).toEqual([
      { text: "Dil", match: true },
      { text: "noza Karimova", match: false },
    ]);
    expect(splitByQuery("a+b (c)", "(c)")).toEqual([
      { text: "a+b ", match: false },
      { text: "(c)", match: true },
    ]);
    expect(splitByQuery("abc", " ")).toEqual([{ text: "abc", match: false }]);
  });
});

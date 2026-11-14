import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import type { AdvisorTranslate } from "../../../entities/ai-advisor";
import {
  alertSearchWithId,
  applyAlertSearch,
  cleanAlertSearch,
  countActiveFilters,
  countSheetOnlyFilters,
  filterSummary,
  readAlertId,
  readAlertSearch,
  toAlertCountParams,
  toAlertListParams,
} from "./alertFilters";

/** URL ↔ filtrlar (D4): kalitlar `status`, `severity`, `rule` (API — `rule_key`), `page`, `limit`, oyna — `alert`. */

const params = (search: string) => new URLSearchParams(search);

beforeAll(async () => {
  await i18n.loadLanguages(["ru", "en"]);
  await i18n.loadNamespaces("aiAdvisor");
});

describe("readAlertSearch", () => {
  it("reads valid values and defaults the rest", () => {
    expect(readAlertSearch(params("status=seen&severity=critical&rule=R6&page=3&limit=50"))).toEqual({
      filters: { status: "seen", severity: "critical", rule: "R6" },
      page: 3,
      limit: 50,
    });
    expect(readAlertSearch(params(""))).toEqual({ filters: { status: "", severity: "", rule: "" }, page: 1, limit: 10 });
  });

  it("ignores invalid values", () => {
    expect(readAlertSearch(params("status=open&severity=high&rule=R9&page=0&limit=7"))).toEqual({
      filters: { status: "", severity: "", rule: "" },
      page: 1,
      limit: 10,
    });
    expect(readAlertSearch(params("page=2abc&limit=1e2")).page).toBe(1);
    expect(readAlertSearch(params("page=-1")).page).toBe(1);
    expect(readAlertSearch(params("limit=1")).limit).toBe(10);
  });

  it("reads the dialog id only when it is a bigint string", () => {
    expect(readAlertId(params("alert=1041"))).toBe("1041");
    expect(readAlertId(params("alert=abc"))).toBeNull();
    expect(readAlertId(params("alert=1234567890123456789"))).toBeNull();
    expect(readAlertId(params(""))).toBeNull();
  });
});

describe("applyAlertSearch", () => {
  it("resets the page when a filter or the page size changes, keeps foreign keys", () => {
    const current = params("tab=alerts&conversation=7&status=new&page=3&alert=1041");
    expect(applyAlertSearch(current, { severity: "critical" }).toString()).toBe(
      "tab=alerts&conversation=7&status=new&alert=1041&severity=critical",
    );
    expect(applyAlertSearch(current, { limit: 25 }).toString()).toBe("tab=alerts&conversation=7&status=new&alert=1041&limit=25");
    // Ayni qiymat — sahifa saqlanadi.
    expect(applyAlertSearch(current, { status: "new" }).get("page")).toBe("3");
    expect(applyAlertSearch(current, { status: "" }).has("status")).toBe(false);
  });

  it("writes the page only when it is greater than 1 and the size only when it is not 10", () => {
    expect(applyAlertSearch(params("tab=alerts"), { page: 2 }).toString()).toBe("tab=alerts&page=2");
    expect(applyAlertSearch(params("tab=alerts&page=2"), { page: 1 }).toString()).toBe("tab=alerts");
    expect(applyAlertSearch(params("tab=alerts&limit=50"), { limit: 10 }).toString()).toBe("tab=alerts");
    // Ruxsat etilmagan o'lcham e'tiborga olinmaydi.
    expect(applyAlertSearch(params("tab=alerts&page=2"), { limit: 7 }).toString()).toBe("tab=alerts&page=2");
  });
});

describe("cleanAlertSearch", () => {
  it("removes invalid and default values, returns null when clean", () => {
    expect(cleanAlertSearch(params("tab=alerts&status=foo&page=1&limit=10&rule=R2"))?.toString()).toBe("tab=alerts&rule=R2");
    expect(cleanAlertSearch(params("tab=alerts&status=new&page=2"))).toBeNull();
    expect(cleanAlertSearch(params("tab=chat&conversation=5"))).toBeNull();
  });
});

describe("API params and labels", () => {
  it("maps rule to rule_key and always sends page and limit", () => {
    expect(toAlertListParams(readAlertSearch(params("rule=R1&severity=warning&page=2")))).toEqual({
      severity: "warning",
      rule_key: "R1",
      page: 2,
      limit: 10,
    });
    expect(toAlertCountParams({ status: "dismissed", severity: "", rule: "" })).toEqual({ status: "dismissed" });
  });

  it("counts filters and builds the empty-state summary (severity · type · status)", () => {
    const filters = { status: "new", severity: "critical", rule: "R6" } as const;
    expect(countActiveFilters(filters)).toBe(3);
    expect(countSheetOnlyFilters(filters)).toBe(2);
    expect(countActiveFilters({ status: "", severity: "", rule: "" })).toBe(0);
    const t = (lng: string) => i18n.getFixedT(lng, "aiAdvisor") as unknown as AdvisorTranslate;
    expect(filterSummary(filters, t("uz"))).toBe("Jiddiy · Zarar · Yangi");
    expect(filterSummary(filters, t("ru"))).toBe("Критично · Убыток · Новое");
    expect(filterSummary(filters, t("en"))).toBe("Critical · Loss · New");
    expect(filterSummary({ status: "", severity: "warning", rule: "" }, t("uz"))).toBe("Diqqat");
  });

  it("builds the dialog link keeping the current params", () => {
    expect(alertSearchWithId(params("tab=alerts&status=new"), "1040")).toBe("?tab=alerts&status=new&alert=1040");
    expect(alertSearchWithId(params("tab=alerts&alert=1"), "2")).toBe("?tab=alerts&alert=2");
  });
});

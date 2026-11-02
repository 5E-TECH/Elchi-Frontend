import { describe, expect, it } from "vitest";
import {
  classifyDistrictSatoError,
  isDistrictSatoCode,
  satoPrefixMismatch,
  validateDistrictSatoCode,
} from "./districtSatoCode";

const httpError = (status: number, data?: unknown) =>
  Object.assign(new Error("fail"), {
    isAxiosError: true,
    response: { status, data: { statusCode: status, message: "server matni", ...(data ? { data } : {}) } },
  });

describe("districtSatoCode (ExK28CiS)", () => {
  it("isDistrictSatoCode — aniq 7 raqam (bo'sh joylar kesiladi)", () => {
    expect(isDistrictSatoCode("1727401")).toBe(true);
    expect(isDistrictSatoCode(" 1727401 ")).toBe(true);
    expect(isDistrictSatoCode("172740")).toBe(false);
    expect(isDistrictSatoCode("17274011")).toBe(false);
    expect(isDistrictSatoCode("17274a1")).toBe(false);
    expect(isDistrictSatoCode("")).toBe(false);
  });

  it("satoPrefixMismatch — kutilgan prefiks; viloyatda kod yo'q yoki kod hali 7 raqam emas — tekshirilmaydi", () => {
    expect(satoPrefixMismatch("1727401", "1727")).toBeNull();
    expect(satoPrefixMismatch("1726401", "1727")).toBe("1727");
    expect(satoPrefixMismatch("1726401", " 1727 ")).toBe("1727");
    expect(satoPrefixMismatch("1726401", null)).toBeNull();
    expect(satoPrefixMismatch("1726401", "")).toBeNull();
    expect(satoPrefixMismatch("17264", "1727")).toBeNull();
  });

  it("validateDistrictSatoCode — bo'sh · format · prefiks tartibida", () => {
    expect(validateDistrictSatoCode("  ", "1727")).toEqual({ kind: "required" });
    expect(validateDistrictSatoCode("172640", "1727")).toEqual({ kind: "format" });
    expect(validateDistrictSatoCode("1726401", "1727")).toEqual({ kind: "prefix", expectedPrefix: "1727" });
    expect(validateDistrictSatoCode("1726401", null)).toBeNull();
    expect(validateDistrictSatoCode(" 1727401 ", "1727")).toBeNull();
  });

  it("classifyDistrictSatoError — 400 sababi, 404, 409; server matni o'qilmaydi", () => {
    expect(
      classifyDistrictSatoError(
        httpError(400, { reason: "region_prefix_mismatch", details: { expected_prefix: "1718" } }),
      ),
    ).toEqual({ kind: "prefix", expectedPrefix: "1718" });
    expect(classifyDistrictSatoError(httpError(400, { reason: "region_prefix_mismatch" }))).toEqual({
      kind: "prefix",
      expectedPrefix: null,
    });
    expect(classifyDistrictSatoError(httpError(400, { reason: "sato_code_format" }))).toEqual({ kind: "format" });
    expect(classifyDistrictSatoError(httpError(400, { reason: "sato_code_required" }))).toEqual({ kind: "format" });
    // Gateway validatsiyasi — sababsiz 400.
    expect(classifyDistrictSatoError(httpError(400))).toEqual({ kind: "format" });
    expect(classifyDistrictSatoError(httpError(400, { reason: "boshqa_sabab" }))).toEqual({ kind: "failed" });
    expect(classifyDistrictSatoError(httpError(404))).toEqual({ kind: "regionMissing" });
    expect(classifyDistrictSatoError(httpError(409))).toEqual({ kind: "conflict" });
    expect(classifyDistrictSatoError(httpError(503))).toEqual({ kind: "failed" });
    expect(classifyDistrictSatoError(new Error("tarmoq"))).toEqual({ kind: "failed" });
    expect(
      classifyDistrictSatoError(Object.assign(new Error("timeout"), { isAxiosError: true, code: "ECONNABORTED" })),
    ).toEqual({ kind: "failed" });
  });
});

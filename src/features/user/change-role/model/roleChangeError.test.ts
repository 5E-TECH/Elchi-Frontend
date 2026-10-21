import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyRoleChangeError } from "./roleChangeError";

const http = (status: number) => ({ isAxiosError: true, response: { status, data: { message: "raw" } } });

describe("classifyRoleChangeError (FY-2)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("409 — filialga biriktirilgan", () => {
    expect(classifyRoleChangeError(http(409))).toBe("assigned");
  });

  it.each([503, 500, 502, 504])("%s — qayta urinish", (status) => {
    expect(classifyRoleChangeError(http(status))).toBe("retry");
  });

  it("vaqt chegarasi va tarmoq — qayta urinish", () => {
    expect(classifyRoleChangeError({ isAxiosError: true, code: "ECONNABORTED" })).toBe("retry");
    expect(classifyRoleChangeError({ isAxiosError: true, code: "ERR_NETWORK", request: {} })).toBe("retry");
  });

  it.each([400, 403, 404])("%s — umumiy xato", (status) => {
    expect(classifyRoleChangeError(http(status))).toBe("failed");
  });

  it("noma'lum qiymat — umumiy xato", () => {
    expect(classifyRoleChangeError(new Error("x"))).toBe("failed");
    expect(classifyRoleChangeError(undefined)).toBe("failed");
  });
});

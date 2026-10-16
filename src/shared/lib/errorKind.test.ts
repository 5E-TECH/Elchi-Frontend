import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBackendMessage, getErrorKind, getErrorStatus } from "./errorKind";

/**
 * `getErrorKind` — haqiqiy axios xatolari shaklida (ilovadagi `api` interceptori xatoni o'zgartirmaydi):
 * vaqt chegarasi `ECONNABORTED` (`timeoutErrorMessage` bilan ham), tarmoq `ERR_NETWORK`, bekor qilish
 * `ERR_CANCELED`, javobli 403 / 5xx / 4xx.
 */

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
const request = {};
const response = (status: number, data: unknown = {}): AxiosResponse =>
  ({ status, statusText: "", headers: {}, config, data }) as AxiosResponse;
const withResponse = (status: number, data?: unknown) =>
  new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_RESPONSE, config, request, response(status, data));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getErrorKind", () => {
  it("vaqt chegarasi (20 s) — timeout", () => {
    expect(getErrorKind(new AxiosError("So'rov vaqti tugadi", AxiosError.ECONNABORTED, config, request))).toBe("timeout");
    expect(getErrorKind(new AxiosError("timeout", AxiosError.ETIMEDOUT, config, request))).toBe("timeout");
  });

  it("javob umuman kelmadi — offline; brauzer oflayn bo'lsa har doim offline", () => {
    expect(getErrorKind(new AxiosError("Network Error", AxiosError.ERR_NETWORK, config, request))).toBe("offline");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(getErrorKind(withResponse(500))).toBe("offline");
  });

  it("bekor qilingan so'rov — internet yo'q EMAS (generic)", () => {
    expect(getErrorKind(new AxiosError("canceled", AxiosError.ERR_CANCELED, config, request))).toBe("generic");
  });

  it("403 — forbidden; 5xx — server; boshqa 4xx — generic", () => {
    expect(getErrorKind(withResponse(403))).toBe("forbidden");
    expect(getErrorKind(withResponse(500))).toBe("server");
    expect(getErrorKind(withResponse(503))).toBe("server");
    expect(getErrorKind(withResponse(422))).toBe("generic");
    expect(getErrorKind(withResponse(404))).toBe("generic");
  });

  it("axios'siz shakllar: `{ status }`, oddiy Error, noma'lum qiymat", () => {
    expect(getErrorKind({ status: 502 })).toBe("server");
    expect(getErrorKind(new Error("boom"))).toBe("generic");
    expect(getErrorKind(undefined)).toBe("generic");
    expect(getErrorKind("xato")).toBe("generic");
  });
});

describe("getErrorStatus / getBackendMessage", () => {
  it("holat kodi va backend xabari", () => {
    const error = withResponse(422, { message: "  Telefon raqami noto'g'ri  " });
    expect(getErrorStatus(error)).toBe(422);
    expect(getBackendMessage(error)).toBe("Telefon raqami noto'g'ri");
    expect(getBackendMessage(withResponse(400, { error: "Bad" }))).toBe("Bad");
    expect(getBackendMessage(withResponse(400, { message: ["a"] }))).toBeUndefined();
    expect(getErrorStatus(new Error("x"))).toBeUndefined();
  });
});

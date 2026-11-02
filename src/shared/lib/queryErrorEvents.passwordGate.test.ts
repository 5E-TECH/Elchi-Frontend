import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emitQueryError, QUERY_ERROR_EVENT } from "./queryErrorEvents";

const axiosError = (status: number, data: unknown) =>
  new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

describe("emitQueryError — aidsxJ2H parol darvozasi", () => {
  const listener = vi.fn();
  afterEach(() => {
    window.removeEventListener(QUERY_ERROR_EVENT, listener);
    listener.mockReset();
  });

  it("403 PASSWORD_CHANGE_REQUIRED — global xabar yo'q («Yangi parol o'rnating» oynasi tushuntiradi)", () => {
    window.addEventListener(QUERY_ERROR_EVENT, listener);
    emitQueryError(axiosError(403, { statusCode: 403, code: "PASSWORD_CHANGE_REQUIRED", message: "Avval parolni almashtiring" }));
    expect(listener).not.toHaveBeenCalled();
  });

  it("boshqa 403 — avvalgidek xabar", () => {
    window.addEventListener(QUERY_ERROR_EVENT, listener);
    emitQueryError(axiosError(403, { statusCode: 403, message: "Ruxsat yo'q" }));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

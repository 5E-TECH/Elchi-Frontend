import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { getBackendErrorMessage } from "./backendError";

describe("getBackendErrorMessage", () => {
  it("extracts backend messages regardless of response status", () => {
    expect(getBackendErrorMessage({
      response: { status: 400, data: { message: "Validation failed" } },
    })).toBe("Validation failed");
    expect(getBackendErrorMessage({
      response: { status: 500, data: { message: "Internal error" } },
    })).toBe("Internal error");
  });

  it("supports arrays, nested payloads and client errors", () => {
    expect(getBackendErrorMessage({
      response: { data: { errors: ["First", "Second"] } },
    })).toBe("First, Second");
    expect(getBackendErrorMessage({
      response: { data: { data: { detail: "Nested error" } } },
    })).toBe("Nested error");
    // Oddiy obyekt / `Error` — avvalgidek (dispatch kabi chaqiruvchilar tayanadi).
    expect(getBackendErrorMessage({ message: "Network Error" })).toBe("Network Error");
  });

  it("G6F68ti6 (4-band): axios xatosining kutubxona matni («Network Error», «… status code 413») backend xabari emas", () => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    expect(getBackendErrorMessage(new AxiosError("Network Error", AxiosError.ERR_NETWORK, config, {}))).toBeUndefined();
    const html413 = new AxiosError("Request failed with status code 413", AxiosError.ERR_BAD_REQUEST, config, {}, {
      status: 413,
      statusText: "",
      headers: {},
      config,
      data: "<html>413 Request Entity Too Large</html>",
    } as AxiosResponse);
    expect(getBackendErrorMessage(html413)).toBeUndefined();
    const withBody = new AxiosError("Request failed with status code 409", AxiosError.ERR_BAD_REQUEST, config, {}, {
      status: 409,
      statusText: "",
      headers: {},
      config,
      data: { message: "Bu kod band" },
    } as AxiosResponse);
    expect(getBackendErrorMessage(withBody)).toBe("Bu kod band");
  });
});

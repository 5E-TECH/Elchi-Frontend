import { describe, expect, it, vi } from "vitest";
import { notify } from "../../../shared/lib/notify";
import { runUserRequest } from "./userRequest";

const t = ((key: string) => key) as never;

describe("runUserRequest — tarmoq xatosi (G6F68ti6, 4-band)", () => {
  it("javobsiz xatoda «Xatolik» chiqmaydi (interceptor xabari yetarli), onError chaqiriladi", async () => {
    const error = vi.spyOn(notify, "error");
    const onError = vi.fn();
    const networkError = Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK" });

    const result = await runUserRequest({ request: () => Promise.reject(networkError), successMessage: "ok", onError, t });

    expect(result).toBeUndefined();
    expect(error).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(networkError);
    error.mockRestore();
  });

  it("server javob bergan xato — avvalgidek «Xatolik» + backend matni", async () => {
    const error = vi.spyOn(notify, "error");
    const conflict = Object.assign(new Error("Request failed with status code 409"), {
      isAxiosError: true,
      response: { status: 409, data: { message: "Telefon band" } },
    });

    await runUserRequest({ request: () => Promise.reject(conflict), successMessage: "ok", errorMessage: "Saqlanmadi", t });

    expect(error).toHaveBeenCalledWith("error", { description: "Telefon band" });
    error.mockRestore();
  });
});

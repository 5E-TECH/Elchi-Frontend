import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, CanceledError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("../../auth/authService", () => ({
  refreshAccessToken: vi.fn(),
  logoutAndRedirect: vi.fn(),
}));

import { api } from "../../shared/api/api";
import { AI_REQUEST_TIMEOUT_MS, useAiAvailability, useAiConfirm, useAiParse } from "./api";
import type { AiConfirmRequest } from "./types";

/**
 * AI BUYURTMA — API QATLAMI (bpy3XwyA).
 *
 * Haqiqiy `api` instansi (interceptor'lari bilan) ishlatiladi, faqat tarmoq
 * adapteri almashtiriladi — shunda bekor qilishda global "tarmoq xatosi"
 * hodisasi chiqmasligi ham haqiqiy yo'lda tekshiriladi.
 */

let requests: InternalAxiosRequestConfig[];
let respond: (config: InternalAxiosRequestConfig) => Promise<unknown>;
const originalAdapter = api.defaults.adapter;

beforeEach(() => {
  requests = [];
  respond = () => Promise.resolve({ statusCode: 200, message: "ok", data: {} });
  api.defaults.adapter = async (config) => {
    requests.push(config);
    const data = await respond(config);
    return { data, status: 200, statusText: "OK", headers: {}, config };
  };
});

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

const wrapperFor = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

const newClient = () => new QueryClient({ defaultOptions: { mutations: { retry: false } } });

describe("useAiParse", () => {
  it("multipart so'rov: `timeout: 90000` va `signal` uzatiladi, javob qobig'idan ochiladi", async () => {
    respond = () =>
      Promise.resolve({ statusCode: 200, message: "ok", data: { ok: false, reason: "ai_off" } });
    const controller = new AbortController();
    const { result } = renderHook(() => useAiParse(), { wrapper: wrapperFor(newClient()) });

    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync({
        text: "Aliyev Vali 90 123 45 67",
        market_id: "7",
        images: [{ media_type: "image/jpeg", data_base64: btoa("JPEG"), name: "a.jpg" }],
        signal: controller.signal,
      });
    });

    expect(response).toEqual({ ok: false, reason: "ai_off" });
    const [config] = requests;
    expect(config.url).toBe("orders/ai-parse");
    expect(config.method).toBe("post");
    expect(config.timeout).toBe(AI_REQUEST_TIMEOUT_MS);
    expect(AI_REQUEST_TIMEOUT_MS).toBe(90_000);
    expect(config.signal).toBe(controller.signal);

    const form = config.data as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("text")).toBe("Aliyev Vali 90 123 45 67");
    expect(form.get("market_id")).toBe("7");
    const image = form.get("images") as File;
    expect(image.name).toBe("a.jpg");
    expect(image.type).toBe("image/jpeg");
    const content = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(image);
    });
    expect(content).toBe("JPEG");
  });

  it("AbortController abort qilinsa: `isPending=false`, xato toast (elchi:network-error) chiqmaydi", async () => {
    respond = (config) =>
      new Promise((_, reject) => {
        config.signal?.addEventListener?.("abort", () =>
          reject(new CanceledError(undefined, undefined, config)),
        );
      });
    const networkToast = vi.fn();
    window.addEventListener("elchi:network-error", networkToast);
    const controller = new AbortController();
    const { result } = renderHook(() => useAiParse(), { wrapper: wrapperFor(newClient()) });

    act(() => {
      result.current.mutate({ text: "matn", signal: controller.signal });
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));

    act(() => controller.abort());

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect((result.current.error as AxiosError | null)?.code).toBe("ERR_CANCELED");
    expect(networkToast).not.toHaveBeenCalled();
    window.removeEventListener("elchi:network-error", networkToast);
  });

  it("haqiqiy tarmoq xatosida esa global hodisa chiqadi (farq faqat bekor qilishda)", async () => {
    respond = (config) => Promise.reject(new AxiosError("Network Error", "ERR_NETWORK", config));
    const networkToast = vi.fn();
    window.addEventListener("elchi:network-error", networkToast);
    const { result } = renderHook(() => useAiParse(), { wrapper: wrapperFor(newClient()) });

    await act(async () => {
      await result.current.mutateAsync({ text: "matn" }).catch(() => undefined);
    });

    expect(networkToast).toHaveBeenCalledTimes(1);
    window.removeEventListener("elchi:network-error", networkToast);
  });
});

describe("useAiConfirm", () => {
  it("payloadni yuboradi va muvaffaqiyatda `orders` hamda `dashboard` kalitlarini invalidate qiladi", async () => {
    respond = () =>
      Promise.resolve({ statusCode: 200, message: "ok", data: { results: [{ index: 0, ok: true, order_id: "900" }] } });
    const client = newClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const payload: AiConfirmRequest = {
      orders: [
        {
          customer: { name: "Vali", phone_number: "+998901234567", district_id: "101" },
          items: [{ product_id: "501", quantity: 1 }],
          district_id: "101",
          total_price: 100000,
          where_deliver: "center",
        },
      ],
    };
    const { result } = renderHook(() => useAiConfirm(), { wrapper: wrapperFor(client) });

    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync(payload);
    });

    expect(response).toEqual({ results: [{ index: 0, ok: true, order_id: "900" }] });
    expect(requests[0].url).toBe("orders/ai-confirm");
    expect(JSON.parse(requests[0].data as string)).toEqual(payload);
    expect(requests[0].timeout).toBe(AI_REQUEST_TIMEOUT_MS);
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual(expect.arrayContaining([["orders"], ["dashboard"]]));
  });

  it("xato bo'lsa invalidate qilinmaydi", async () => {
    respond = (config) =>
      Promise.reject(new AxiosError("Bad Request", "ERR_BAD_REQUEST", config, null, {
        status: 400,
        statusText: "Bad Request",
        headers: {},
        config,
        data: { message: "property status should not exist" },
      }));
    const client = newClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useAiConfirm(), { wrapper: wrapperFor(client) });

    await act(async () => {
      await result.current.mutateAsync({ orders: [] }).catch(() => undefined);
    });

    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("useAiAvailability", () => {
  it("GET orders/ai-availability javobini qobig'idan ochadi", async () => {
    respond = () => Promise.resolve({ statusCode: 200, message: "ok", data: { enabled: false, state: "disabled" } });
    const { result } = renderHook(() => useAiAvailability(), { wrapper: wrapperFor(newClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ enabled: false, state: "disabled" });
    expect(requests[0].url).toBe("orders/ai-availability");
    expect(requests[0].method).toBe("get");
  });
});

import type { ReactNode } from "react";
import { QueryCache, QueryClient, QueryClientProvider, type Query } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../../shared/config/queryKeys";
import { shouldRetryQuery } from "../../../shared/lib/queryRetry";
import {
  advisorEnvelope,
  advisorHttpError,
  advisorNetworkError,
  createAdvisorFixtures,
} from "../../../test/aiAdvisorFixtures";
import {
  ADVISOR_AVAILABLE_STALE_MS,
  ADVISOR_OVERVIEW_POLL_MS,
  ADVISOR_TRANSIENT_STALE_MS,
  advisorProbeStaleTime,
  useAdvisorAlert,
  useAdvisorAlertCount,
  useAdvisorAlerts,
  useAdvisorAvailability,
  useAdvisorSettings,
} from "./advisorQueries";
import { classifyProbeError } from "./advisorErrors";
import { AdvisorShapeError } from "./advisorNormalize";

/**
 * Mavjudlik zondi (D2/D3): backend deploy qilinmagan muhitda `/ai-assistant` bugungi suhbat sahifasi bo'lib qoladi —
 * 404/405/501/boshqa shakl va 401/403 bitta so'rovdan keyin sessiya davomida keshlanadi (qayta urinishsiz, xatosiz),
 * vaqtinchalik xato — 5 daqiqa; mavjud bo'lsa — 60 s poll va fokusda yangilanadi; keyingi xato tabni yo'qotmaydi.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const fx = createAdvisorFixtures();
const PROBE_CONFIG = { failFast: true, timeout: 15_000, silentNetworkError: true };

/** Ilovadagidek: sukut `retry` — `shouldRetryQuery` (5xx ni bir marta qayta so'raydi), xatolar `meta` bilan yoziladi. */
const setup = () => {
  const metas: unknown[] = [];
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: (_error, query) => metas.push(query.meta) }),
    defaultOptions: { queries: { retry: shouldRetryQuery, staleTime: 30_000 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper, metas };
};

afterEach(() => vi.clearAllMocks());

/** Kuzatuvchining hal qilingan opsiyasi (funksiya bo'lsa — joriy so'rov bilan). */
const resolved = (client: QueryClient, key: readonly unknown[], option: "refetchInterval" | "refetchOnWindowFocus" | "staleTime") => {
  const query = client.getQueryCache().find({ queryKey: key }) as Query | undefined;
  const value = query?.observers[0]?.options[option];
  return typeof value === "function" ? (value as (q: Query) => unknown)(query!) : value;
};

describe("classifyProbeError", () => {
  it("404/405/501 va shakl xatosi — absent; 401/403 — forbidden; qolgani — transient", () => {
    expect(classifyProbeError(advisorHttpError(404))).toBe("absent");
    expect(classifyProbeError(advisorHttpError(405))).toBe("absent");
    expect(classifyProbeError(advisorHttpError(501))).toBe("absent");
    expect(classifyProbeError(new AdvisorShapeError("overview"))).toBe("absent");
    expect(classifyProbeError(advisorHttpError(401))).toBe("forbidden");
    expect(classifyProbeError(advisorHttpError(403, fx.errors.forbidden))).toBe("forbidden");
    for (const error of [advisorHttpError(500), advisorHttpError(502), advisorHttpError(504), advisorHttpError(429), advisorNetworkError(), new Error("x")]) {
      expect(classifyProbeError(error)).toBe("transient");
    }
  });
});

describe("useAdvisorAvailability — overview zondi", () => {
  it("mavjud: overview, so'rov 15 s / failFast / jim tarmoq xatosi; 60 s poll va fokusda yangilanadi", async () => {
    mocks.get.mockResolvedValue({ data: advisorEnvelope(fx.overview) });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useAdvisorAvailability(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ kind: "available", data: fx.overview });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledWith("ai/advisor/overview", PROBE_CONFIG);
    expect(resolved(client, queryKeys.aiAdvisor.overview, "refetchInterval")).toBe(ADVISOR_OVERVIEW_POLL_MS);
    expect(resolved(client, queryKeys.aiAdvisor.overview, "refetchOnWindowFocus")).toBe(true);
    expect(resolved(client, queryKeys.aiAdvisor.overview, "staleTime")).toBe(ADVISOR_AVAILABLE_STALE_MS);
  });

  it.each([
    ["404 — marshrut yo'q", advisorHttpError(404), "absent"],
    ["405", advisorHttpError(405), "absent"],
    ["501", advisorHttpError(501), "absent"],
    ["403 — admin", advisorHttpError(403, fx.errors.forbidden), "forbidden"],
    ["401 — token yangilangandan keyin ham", advisorHttpError(401), "forbidden"],
    ["500", advisorHttpError(500), "transient"],
    ["504 — RMQ", advisorHttpError(504, fx.errors.timeout), "transient"],
    ["429", advisorHttpError(429), "transient"],
    ["tarmoq", advisorNetworkError(), "transient"],
  ])("%s → unavailable (%s): bitta so'rov, qayta urinishsiz, xato holatisiz, poll'siz", async (_name, error, reason) => {
    mocks.get.mockRejectedValue(error);
    const { client, wrapper, metas } = setup();
    const { result } = renderHook(() => useAdvisorAvailability(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ kind: "unavailable", reason });
    expect(result.current.isError).toBe(false);
    expect(metas).toEqual([]);
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(resolved(client, queryKeys.aiAdvisor.overview, "refetchInterval")).toBe(false);
    expect(resolved(client, queryKeys.aiAdvisor.overview, "refetchOnWindowFocus")).toBe(false);
    expect(resolved(client, queryKeys.aiAdvisor.overview, "staleTime")).toBe(
      reason === "transient" ? ADVISOR_TRANSIENT_STALE_MS : Infinity,
    );
  });

  it("200, lekin boshqa shakl (e2e mock'ining `{items, meta}`) — absent", async () => {
    mocks.get.mockResolvedValue({ data: advisorEnvelope({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } }) });
    const { wrapper } = setup();
    const { result } = renderHook(() => useAdvisorAvailability(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ kind: "unavailable", reason: "absent" });
  });

  it("absent sessiya davomida keshda: sahifa qayta ochilsa ham ikkinchi so'rov yo'q", async () => {
    mocks.get.mockRejectedValue(advisorHttpError(404));
    const { wrapper } = setup();
    const first = renderHook(() => useAdvisorAvailability(), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    const second = renderHook(() => useAdvisorAvailability(), { wrapper });
    expect(second.result.current.data).toEqual({ kind: "unavailable", reason: "absent" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it("avval mavjud edi, keyingi so'rov yiqildi — eski ma'lumot qoladi (tab yo'qolmaydi), xato jim", async () => {
    mocks.get.mockResolvedValueOnce({ data: advisorEnvelope(fx.overview) });
    const { wrapper, metas } = setup();
    const { result } = renderHook(() => useAdvisorAvailability(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    mocks.get.mockRejectedValueOnce(advisorHttpError(500));
    await result.current.refetch();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toEqual({ kind: "available", data: fx.overview });
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(metas).toEqual([{ silentError: true }]);
  });

  it("`enabled: false` — so'rov yo'q", async () => {
    const { wrapper } = setup();
    renderHook(() => useAdvisorAvailability({ enabled: false }), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("yangilik muddati: mavjud — 30 s, vaqtinchalik — 5 daqiqa, yo'q / ruxsatsiz — cheksiz", () => {
    expect(advisorProbeStaleTime(undefined)).toBe(0);
    expect(advisorProbeStaleTime({ kind: "available", data: fx.overview })).toBe(30_000);
    expect(advisorProbeStaleTime({ kind: "unavailable", reason: "transient" })).toBe(300_000);
    expect(advisorProbeStaleTime({ kind: "unavailable", reason: "absent" })).toBe(Infinity);
    expect(advisorProbeStaleTime({ kind: "unavailable", reason: "forbidden" })).toBe(Infinity);
  });
});

describe("useAdvisorSettings — sozlamalar zondi", () => {
  it("mavjud — sozlamalar (#644: R7 jiddiy, Telegram'siz); poll yo'q", async () => {
    mocks.get.mockResolvedValue({ data: advisorEnvelope(fx.settings) });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useAdvisorSettings(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ kind: "available", data: fx.settings });
    expect(mocks.get).toHaveBeenCalledWith("ai/advisor/settings", PROBE_CONFIG);
    expect(resolved(client, queryKeys.aiAdvisor.settings, "refetchInterval")).toBeFalsy();
  });

  it("404 (faqat overview deploy qilinmagan) — absent, bitta so'rov", async () => {
    mocks.get.mockRejectedValue(advisorHttpError(404));
    const { wrapper } = setup();
    const { result } = renderHook(() => useAdvisorSettings(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ kind: "unavailable", reason: "absent" });
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it("`enabled: false` (overview mavjud emas) — so'rov yo'q", async () => {
    const { wrapper } = setup();
    renderHook(() => useAdvisorSettings({ enabled: false }), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.get).not.toHaveBeenCalled();
  });
});

describe("ro'yxat, sanoq, tafsilot", () => {
  it("ro'yxat: faqat berilgan filtrlar, `limit` aniq", async () => {
    mocks.get.mockResolvedValue({ data: advisorEnvelope(fx.list) });
    const { wrapper } = setup();
    const { result } = renderHook(() => useAdvisorAlerts({ status: "new", rule_key: "R2", page: 2, limit: 25 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.get).toHaveBeenCalledWith("ai/advisor/alerts", { params: { page: 2, limit: 25, status: "new", rule_key: "R2" } });
    expect(result.current.data?.items).toHaveLength(8);
  });

  it("sanoq: `limit: 1`, natija — `meta.total`", async () => {
    mocks.get.mockResolvedValue({ data: advisorEnvelope({ ...fx.list, items: fx.items.slice(0, 1), meta: { page: 1, limit: 1, total: 2, totalPages: 2 } }) });
    const { wrapper } = setup();
    const { result } = renderHook(() => useAdvisorAlertCount({ severity: "critical" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(2);
    expect(mocks.get).toHaveBeenCalledWith("ai/advisor/alerts", { params: { page: 1, limit: 1, severity: "critical" } });
  });

  it("tafsilot: ID noto'g'ri — so'ralmaydi (yon ta'sirli GET); `pending` va `pollMs` — poll, boshqasi — yo'q", async () => {
    const { client, wrapper } = setup();
    renderHook(() => useAdvisorAlert("abc"), { wrapper });
    renderHook(() => useAdvisorAlert(null), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.get).not.toHaveBeenCalled();

    mocks.get.mockResolvedValue({ data: advisorEnvelope(fx.detail.r1Pending) });
    const { result } = renderHook(() => useAdvisorAlert("1040", { pollMs: 2_000 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.get).toHaveBeenCalledWith("ai/advisor/alerts/1040");
    expect(resolved(client, queryKeys.aiAdvisor.alert("1040"), "refetchInterval")).toBe(2_000);
    expect(resolved(client, queryKeys.aiAdvisor.alert("1040"), "staleTime")).toBe(0);

    client.setQueryData(queryKeys.aiAdvisor.alert("1040"), fx.detail.r1);
    expect(resolved(client, queryKeys.aiAdvisor.alert("1040"), "refetchInterval")).toBe(false);
  });
});

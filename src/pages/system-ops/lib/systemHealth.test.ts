import { describe, expect, it } from "vitest";
import { capitalize, classifyProblem, HEALTH_SERVICE_KEYS, joinList, readReadiness } from "./systemHealth";

/** api-gateway `HealthController.readiness` javobi (konvertsiz, backend `origin/main`). */
const readiness = (overrides: Record<string, { status: string; latency_ms?: number; error?: string }> = {}) => ({
  status: Object.keys(overrides).length ? "degraded" : "ok",
  timestamp: "2026-10-21T09:15:00.000Z",
  services: HEALTH_SERVICE_KEYS.map((service, index) => ({
    service,
    latency_ms: 10 + index,
    ...(overrides[service] ?? { status: "ok" }),
  })),
});

describe("systemHealth — readiness xulosasi", () => {
  it("hammasi ok — daraja ok, o'rtacha javob vaqti, backend tartibi saqlanadi", () => {
    const summary = readReadiness(readiness());
    expect(summary).not.toBeNull();
    expect(summary?.level).toBe("ok");
    expect(summary?.total).toBe(14);
    expect(summary?.okCount).toBe(14);
    expect(summary?.averageLatencyMs).toBe(17); // (10 + … + 23) / 14 = 16,5 → 17
    expect(summary?.services.map((s) => s.key)).toEqual([...HEALTH_SERVICE_KEYS]);
  });

  it("faqat yordamchi xizmat down — partial; ishlamayotganlar ro'yxat boshida", () => {
    const summary = readReadiness(
      readiness({
        SEARCH: { status: "down", latency_ms: 1502, error: "Timeout has occurred" },
        NOTIFICATION: { status: "down", latency_ms: 212, error: "reported degraded" },
      }),
    );
    expect(summary?.level).toBe("partial");
    expect(summary?.downCount).toBe(2);
    expect(summary?.services.slice(0, 3).map((s) => s.key)).toEqual(["NOTIFICATION", "SEARCH", "IDENTITY"]);
    expect(summary?.services[0].problem).toBe("reported");
    expect(summary?.services[1].problem).toBe("timeout");
    expect(summary?.allTimedOut).toBe(false);
  });

  it("S1: asosiy xizmat (Order) down — critical; AI ulanmagan — unknown, sababi notRegistered", () => {
    const summary = readReadiness(
      readiness({
        ORDER: { status: "down", latency_ms: 38, error: "Internal error: connection refused" },
        AI: { status: "unknown", error: "client not registered" },
      }),
    );
    expect(summary?.level).toBe("critical");
    expect(summary?.coreDown.map((s) => s.key)).toEqual(["ORDER"]);
    expect(summary?.auxDown).toEqual([]);
    expect(summary?.unknown.map((s) => s.key)).toEqual(["AI"]);
    expect(summary?.okCount).toBe(12);
    expect(summary?.services.slice(0, 2).map((s) => [s.key, s.state, s.problem, s.latencyMs])).toEqual([
      ["ORDER", "down", "failed", 38],
      ["AI", "unknown", "notRegistered", null],
    ]);
  });

  it.each(["IDENTITY", "ORDER", "FINANCE", "LOGISTICS"])("%s — asosiy xizmat", (key) => {
    expect(readReadiness(readiness({ [key]: { status: "down", error: "x" } }))?.level).toBe("critical");
  });

  it("hech biri ishlamaydi — down; hammasi vaqt chegarasidan oshgan", () => {
    const all = Object.fromEntries(
      HEALTH_SERVICE_KEYS.map((key) => [key, { status: "down", latency_ms: 1500, error: "Timeout has occurred" }]),
    );
    const summary = readReadiness(readiness(all));
    expect(summary?.level).toBe("down");
    expect(summary?.okCount).toBe(0);
    expect(summary?.allTimedOut).toBe(true);
    expect(summary?.averageLatencyMs).toBeNull();
  });

  it("faqat ulanmagan xizmat — daraja ok (ishlamayotgan yo'q)", () => {
    const summary = readReadiness(readiness({ AI: { status: "unknown", error: "client not registered" } }));
    expect(summary?.level).toBe("ok");
    expect(summary?.unknownCount).toBe(1);
  });

  it("services yo'q, bo'sh yoki noto'g'ri — null (xato holati)", () => {
    expect(readReadiness(undefined)).toBeNull();
    expect(readReadiness({ status: "degraded" })).toBeNull();
    expect(readReadiness({ services: [] })).toBeNull();
    expect(readReadiness({ services: [{ status: "ok" }] })).toBeNull();
    expect(readReadiness("ok")).toBeNull();
  });

  it("ro'yxatda yo'q xizmat ham ko'rsatiladi (known=false); manfiy javob vaqti olinmaydi", () => {
    const summary = readReadiness({ services: [{ service: "billing", status: "ok", latency_ms: -5 }] });
    expect(summary?.services[0]).toMatchObject({ key: "BILLING", known: false, core: false, latencyMs: null });
  });

  it("classifyProblem — xom matndan faqat sabab turi", () => {
    expect(classifyProblem("ok", "anything")).toBeNull();
    expect(classifyProblem("unknown", undefined)).toBe("notRegistered");
    expect(classifyProblem("down", "Timeout has occurred")).toBe("timeout");
    expect(classifyProblem("down", "reported down")).toBe("reported");
    expect(classifyProblem("down", "client not registered")).toBe("notRegistered");
    expect(classifyProblem("down", "ECONNREFUSED")).toBe("failed");
    expect(classifyProblem("down", undefined)).toBe("failed");
  });

  it("joinList va capitalize", () => {
    expect(joinList([], "va")).toBe("");
    expect(joinList(["a"], "va")).toBe("a");
    expect(joinList(["bildirishnomalar", "qidiruv"], "va")).toBe("bildirishnomalar va qidiruv");
    expect(joinList(["a", "b", "c"], "and")).toBe("a, b and c");
    expect(capitalize("bildirishnomalar va qidiruv")).toBe("Bildirishnomalar va qidiruv");
    expect(capitalize("")).toBe("");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * QKCeGZ3N (4-band) — xato chegarasi hisoboti: faqat prod build va kirgan foydalanuvchi, bir kod — sessiyada bir marta,
 * so'rov xatosi jim (foydalanuvchiga hech narsa ko'rsatilmaydi), maydonlar backend chegaralarida.
 */
const post = vi.hoisted(() => vi.fn());
const token = vi.hoisted(() => ({ value: "access" as string | null }));
vi.mock("../api/api", () => ({ api: { post } }));
vi.mock("../../auth/tokenStorage", () => ({ tokenStorage: { getAccessToken: () => token.value } }));

const load = async () => (await import("./clientErrorReport")).reportClientError;
const payload = {
  message: "r.forEach is not a function",
  stack: "TypeError: r.forEach is not a function\n    at Hx (index.js:1:2)",
  componentStack: "\n    at Orders",
  sourcePath: "/orders?status=waiting",
};

describe("reportClientError (QKCeGZ3N)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    window.sessionStorage.clear();
    token.value = "access";
    post.mockReset().mockResolvedValue({ status: 204 });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("⭐ POST /client-errors: kod, xabar, yo'l, stek, scope — jim (silentNetworkError)", async () => {
    const report = await load();
    report(payload, "page");

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe("client-errors");
    expect(body).toEqual({
      code: expect.stringMatching(/^ERR-[0-9A-F]{4}$/),
      message: "r.forEach is not a function",
      path: "/orders?status=waiting",
      stack: payload.stack,
      component_stack: payload.componentStack,
      scope: "page",
    });
    expect(config).toEqual({ silentNetworkError: true });
  });

  it("bir xil xato sessiyada bir marta; boshqa scope — alohida", async () => {
    const report = await load();
    report(payload, "page");
    report(payload, "page");
    report(payload, "section");

    expect(post).toHaveBeenCalledTimes(2);
  });

  it("kirmagan foydalanuvchi (token yo'q) — yuborilmaydi", async () => {
    token.value = null;
    const report = await load();
    report(payload, "app");
    expect(post).not.toHaveBeenCalled();
  });

  it("ishlab chiqishda (DEV) — yuborilmaydi", async () => {
    vi.stubEnv("DEV", true);
    const report = await load();
    report(payload, "page");
    expect(post).not.toHaveBeenCalled();
  });

  it("so'rov xatosi (eski backend 404, tarmoq) — jim, istisno tashlanmaydi", async () => {
    post.mockRejectedValue(Object.assign(new Error("Request failed with status code 404"), { response: { status: 404 } }));
    const report = await load();
    expect(() => report(payload, "page")).not.toThrow();
    await Promise.resolve();
  });

  it("uzun maydonlar backend chegarasiga qisqartiriladi (500 / 300 / 4000)", async () => {
    const report = await load();
    report({ message: "m".repeat(900), sourcePath: `/${"p".repeat(600)}`, stack: "s".repeat(9000) }, "page");

    const body = post.mock.calls[0][1];
    expect(body.message).toHaveLength(500);
    expect(body.path).toHaveLength(300);
    expect(body.stack).toHaveLength(4000);
  });
});

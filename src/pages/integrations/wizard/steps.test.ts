import { describe, expect, it } from "vitest";
import { checkUrlShape, outboundChecks, partnerChecks } from "./steps";
import type { WebhookTestResult } from "../../../entities/partners";

const res = (over: Partial<WebhookTestResult> = {}): WebhookTestResult => ({
  ok: true,
  url: "https://partner.example.uz/hook",
  used_saved_url: true,
  http_status: 200,
  duration_ms: 120,
  response_body: null,
  error: null,
  signature_sent: "abc",
  secret_configured: true,
  event_id: "e1",
  ...over,
});

describe("checkUrlShape", () => {
  it("https — yaxshi", () => {
    expect(checkUrlShape("https://a.example.uz/hook").state).toBe("ok");
  });

  it("bo'sh manzil — xato", () => {
    expect(checkUrlShape("   ").state).toBe("fail");
  });

  it("buzuq manzil — xato", () => {
    expect(checkUrlShape("partner.example.uz/hook").state).toBe("fail");
  });

  it("⭐ http — OGOHLANTIRISH, xato EMAS", () => {
    /**
     * Ichki tarmoqda `http` ishlashi mumkin. Uni xato deb to'sib qo'ysak,
     * haqiqiy ish qilolmaydigan holat yuzaga kelardi — lekin ma'lumot ochiq
     * ketishini AYTISH kerak.
     */
    const c = checkUrlShape("http://10.0.0.5/hook");
    expect(c.state).toBe("warn");
    expect(c.detail).toContain("shifrlanmagan");
  });
});

describe("partnerChecks", () => {
  it("sinov natijasi yo'q — faqat manzil qadami", () => {
    expect(partnerChecks("https://a.example.uz", null)).toHaveLength(1);
  });

  it("hammasi yaxshi — to'rt qadam, hech biri xato emas", () => {
    const checks = partnerChecks("https://a.example.uz", res());
    expect(checks).toHaveLength(4);
    expect(checks.every((c) => c.state === "ok")).toBe(true);
  });

  it("⭐ aloqa yo'q — javob kodi 'skip', 'fail' EMAS", () => {
    /**
     * Aloqa bo'lmasa javob kodi haqida gap yo'q. Uni "fail" deb ko'rsatish
     * IKKI xato bordek ko'rinardi va operator ikkinchisini ham qidirardi.
     */
    const checks = partnerChecks(
      "https://a.example.uz",
      res({ http_status: null, error: "ECONNREFUSED" }),
    );
    expect(checks[1].state).toBe("fail");
    expect(checks[1].detail).toContain("ECONNREFUSED");
    expect(checks[2].state).toBe("skip");
  });

  it("2xx bo'lmasa javob kodi xato", () => {
    const checks = partnerChecks("https://a.example.uz", res({ http_status: 500 }));
    expect(checks[2].state).toBe("fail");
    expect(checks[2].detail).toContain("500");
  });

  it("⭐ sekret yo'q — OGOHLANTIRISH (ulanish ishlaydi, lekin tasdiqlanmaydi)", () => {
    const checks = partnerChecks(
      "https://a.example.uz",
      res({ secret_configured: false }),
    );
    expect(checks[3].state).toBe("warn");
  });
});

describe("outboundChecks", () => {
  it("natija yo'q — faqat manzil qadami", () => {
    expect(outboundChecks("https://api.example.uz", null)).toHaveLength(1);
  });

  it("200 — uch qadam yaxshi", () => {
    const checks = outboundChecks("https://api.example.uz", {
      ok: true,
      status: 200,
      response_time_ms: 90,
    });
    expect(checks).toHaveLength(3);
    expect(checks.every((c) => c.state === "ok")).toBe(true);
  });

  it("⭐ status yo'q, faqat xato matni — aloqa qadamida sabab ko'rinadi", () => {
    /**
     * Backend yiqilganda HTTP xato bermaydi (`errorRes` bilan 200 qaytaradi),
     * shuning uchun sabab alohida uzatiladi.
     */
    const checks = outboundChecks("https://api.example.uz", {}, "getaddrinfo ENOTFOUND");
    expect(checks[1].state).toBe("fail");
    expect(checks[1].detail).toContain("ENOTFOUND");
    expect(checks[2].state).toBe("skip");
  });

  it("4xx — javob keldi, lekin qabul qilinmadi", () => {
    const checks = outboundChecks("https://api.example.uz", {
      ok: false,
      status: 401,
    });
    expect(checks[1].state).toBe("ok");
    expect(checks[2].state).toBe("fail");
  });
});

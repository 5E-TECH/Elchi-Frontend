import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * API manzillari (`VITE_BASE_URL`, `VITE_PUBLIC_API_URL`) — modul yuklanganda hisoblanadi, shuning uchun har holatda
 * `vi.stubEnv` + `vi.resetModules` + qayta `import`. Bir domenli API'da (`.env.staging`: `/api/`) ilova so'rovlari,
 * socket.io va fayllar kabinet origin'iga ketadi; tashqi integratorga ko'rsatiladigan manzil esa API hostining o'zi.
 */
const load = async (env: Record<string, string | undefined>) => {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return {
    ...(await import("./index")),
    ...(await import("../lib/realtime")),
    ...(await import("../lib/assetUrl")),
    ...(await import("../../pages/integrations/carrier/carrierLinks")),
  };
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("bir domenli API (VITE_BASE_URL=/api/)", () => {
  const sameOrigin = { VITE_BASE_URL: "/api/", VITE_PUBLIC_API_URL: "https://test-api.elchipochta.uz/" };

  it("⭐ so'rovlar /api ga (nisbiy), Carrier API havolalari — API hostiga", async () => {
    const { BASE_URL, PUBLIC_API_URL, carrierPublicBaseUrl, carrierDocsUrl } = await load(sameOrigin);
    expect(BASE_URL).toBe("/api");
    expect(PUBLIC_API_URL).toBe("https://test-api.elchipochta.uz");
    expect(carrierPublicBaseUrl()).toBe("https://test-api.elchipochta.uz");
    expect(carrierDocsUrl()).toBe("https://test-api.elchipochta.uz/carrier-docs");
  });

  it("⭐ socket.io — kabinet origin'i + /realtime (yo'l /socket.io/ — Worker proksi qiladi)", async () => {
    const { BASE_URL, realtimeUrl } = await load(sameOrigin);
    expect(realtimeUrl(BASE_URL)).toBe(`${window.location.origin}/realtime`);
  });

  it("fayllar: nisbiy yo'l va ichki MinIO manzili /api orqali, tashqi URL o'zgarmaydi", async () => {
    const { resolveAssetUrl } = await load(sameOrigin);
    expect(resolveAssetUrl("/uploads/a.png")).toBe("/api/uploads/a.png");
    expect(resolveAssetUrl("uploads/a.png")).toBe("/api/uploads/a.png");
    expect(resolveAssetUrl("http://minio:9000/elchi/a.png?x=1")).toBe("/api/elchi/a.png?x=1");
    expect(resolveAssetUrl("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
  });

  it("VITE_PUBLIC_API_URL yo'q bo'lsa — production API (staging build buni rad etadi: scripts/staging-build.mjs)", async () => {
    const { BASE_URL, PUBLIC_API_URL } = await load({ VITE_BASE_URL: "/api/", VITE_PUBLIC_API_URL: undefined });
    expect(BASE_URL).toBe("/api");
    expect(PUBLIC_API_URL).toBe("https://api.elchipochta.uz");
  });
});

describe("to'g'ridan-to'g'ri API (production, orqaga qaytish)", () => {
  it("absolyut VITE_BASE_URL — avvalgidek; ommaviy manzil uning origin'i", async () => {
    const { BASE_URL, PUBLIC_API_URL, realtimeUrl, carrierDocsUrl } = await load({
      VITE_BASE_URL: "https://api.elchipochta.uz/",
      VITE_PUBLIC_API_URL: undefined,
    });
    expect(BASE_URL).toBe("https://api.elchipochta.uz");
    expect(PUBLIC_API_URL).toBe("https://api.elchipochta.uz");
    expect(realtimeUrl(BASE_URL)).toBe("https://api.elchipochta.uz/realtime");
    expect(carrierDocsUrl()).toBe("https://api.elchipochta.uz/carrier-docs");
  });
});

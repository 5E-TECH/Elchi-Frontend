import { expect, type Page, type Route } from "@playwright/test";

/**
 * `/regions/sato-management?tab=sato` e2e (SA-1) uchun soxta backend: `GET region`, `GET district`,
 * `GET district/sato-match/preview` (faqat superadmin), `GET district/sato/:code` (kod egasi) va
 * `PATCH district/sato/:id` (testdagi javob). Hech qanday so'rov serverga ketmaydi; kutilmagan yozuvchi so'rov
 * `leaked` ga tushadi.
 */
/** Dev server manzili (worktree probe'larida boshqa port — `E2E_ORIGIN`). */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const TOSHKENT_SH = { id: "1", name: "Toshkent sh.", sato_code: "1726" };
const TOSHKENT_V = { id: "2", name: "Toshkent viloyati", sato_code: "1727" };
const SAMARQAND = { id: "6", name: "Samarqand", sato_code: "1718" };
const NAMANGAN = { id: "8", name: "Namangan", sato_code: "1714" };

type Region = typeof TOSHKENT_SH;
type District = { id: string; name: string; sato_code: string | null; region_id: string; region: Region };
const district = (id: string, name: string, region: Region, sato_code: string | null = null): District => ({
  id,
  name,
  sato_code,
  region_id: region.id,
  region,
});

/** Maketdagi «Topildi» (12 ta — 2 sahifa), «Topilmadi», «Kodi bor», takroriy va «Bazada yo'q». */
const FOUND: [District, string, string][] = [
  [district("101", "Yangihayot tumani", TOSHKENT_SH), "1726292", "Yangihayot tumani (Toshkent shahri)"],
  [district("102", "Bektemir tumani", TOSHKENT_SH), "1726264", "Bektemir tumani (Toshkent shahri)"],
  [district("103", "Zangiota tumani", TOSHKENT_V), "1727237", "Zangiota tumani (Toshkent viloyati)"],
  [district("104", "Kosonsoy tumani", NAMANGAN), "1714207", "Kosonsoy tumani (Namangan viloyati)"],
  [district("105", "Payariq tumani", SAMARQAND), "1718224", "Payariq tumani (Samarqand viloyati)"],
  [district("106", "Bulung'ur tumani", SAMARQAND), "1718203", "Bulung'ur tumani (Samarqand viloyati)"],
  [district("107", "Ishtixon tumani", SAMARQAND), "1718209", "Ishtixon tumani (Samarqand viloyati)"],
  [district("108", "Jomboy tumani", SAMARQAND), "1718212", "Jomboy tumani (Samarqand viloyati)"],
  [district("109", "Chortoq tumani", NAMANGAN), "1714214", "Chortoq tumani (Namangan viloyati)"],
  [district("110", "Chust tumani", NAMANGAN), "1714216", "Chust tumani (Namangan viloyati)"],
  [district("111", "Bo'stonliq tumani", TOSHKENT_V), "1727224", "Bo'stonliq tumani (Toshkent viloyati)"],
  [district("112", "Chinoz tumani", TOSHKENT_V), "1727228", "Chinoz tumani (Toshkent viloyati)"],
];
const HAS_CODE = [
  district("21", "Uchtepa tumani", TOSHKENT_SH, "1726262"),
  district("22", "Yunusobod tumani", TOSHKENT_SH, "1726266"),
  district("23", "Yashnobod tumani", TOSHKENT_SH, "1726290"),
];
const NOT_FOUND = [
  district("31", "Do'stobod sh.", TOSHKENT_V),
  district("32", "Urgut sh.", SAMARQAND),
  district("33", "Yangi Namangan", NAMANGAN),
];
const DUPLICATES = [district("41", "Bo'ka tumani", TOSHKENT_V, "1727212"), district("42", "Bo'ka tumani", TOSHKENT_V)];

export const DISTRICTS = [...FOUND.map(([d]) => d), ...HAS_CODE, ...NOT_FOUND, ...DUPLICATES];

const PREVIEW = {
  matched: [
    ...FOUND.map(([d, satoCode, satoName]) => ({ dbId: d.id, dbName: `${d.name} (${d.region.name})`, satoCode, satoName })),
    ...HAS_CODE.map((d) => ({ dbId: d.id, dbName: d.name, satoCode: d.sato_code, satoName: "(allaqachon mavjud)" })),
  ],
  unmatched: NOT_FOUND.map((d) => ({ dbId: d.id, dbName: d.name, regionName: d.region.name })),
  duplicates: [{ name: "Bo'ka tumani (Toshkent viloyati)", entries: DUPLICATES.map((d) => ({ id: d.id })) }],
  missingSatoEntries: [
    { satoCode: "1718236", satoName: "Urgut tumani", regionName: "Samarqand viloyati" },
    { satoCode: "1714204", satoName: "Mingbuloq tumani", regionName: "Namangan viloyati" },
  ],
  stats: { totalDb: 20, totalSato: 203, matchedCount: 15, unmatchedCount: 3, duplicatesCount: 2, missingCount: 2 },
};

export type PatchReply = { status: number; body: unknown; delayMs?: number };

export const mockSatoApi = async (
  page: Page,
  {
    role = "superadmin",
    patch = () => ({ status: 200, body: { statusCode: 200, message: "District sato_code updated", data: {} } }),
    theme = "light",
  }: { role?: "superadmin" | "admin"; patch?: () => PatchReply; theme?: "light" | "dark" } = {},
) => {
  const leaked: string[] = [];
  const patches: { path: string; body: unknown }[] = [];
  const counts = { preview: 0, district: 0 };
  const saved = new Map<string, string>();
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, {
        statusCode: 200,
        data: {
          id: "1",
          role,
          name: role === "admin" ? "E2E Admin" : "Bosh admin",
          status: "active",
          settings: { appearance: { theme, themeChosen: true } },
        },
      });
    }
    if (path === "district" && request.method() === "GET") {
      counts.district += 1;
      const data = DISTRICTS.map((d) => (saved.has(d.id) ? { ...d, sato_code: saved.get(d.id)! } : d));
      return reply(route, { statusCode: 200, message: "success", data });
    }
    if (path === "district/sato-match/preview") {
      counts.preview += 1;
      if (role !== "superadmin") return reply(route, { statusCode: 403, message: "Forbidden resource" }, 403);
      return reply(route, { statusCode: 200, message: "SATO matching natijasi", data: PREVIEW });
    }
    const byCode = /^district\/sato\/(\d+)$/.exec(path);
    if (byCode && request.method() === "GET") {
      const owner = DISTRICTS.find((d) => d.sato_code === byCode[1]);
      if (!owner) return reply(route, { statusCode: 404, message: "District not found" }, 404);
      return reply(route, { statusCode: 200, data: owner });
    }
    if (byCode && request.method() === "PATCH") {
      const body = request.postDataJSON() as { sato_code: string };
      patches.push({ path, body });
      const result = patch();
      if (result.delayMs) await new Promise((resolve) => setTimeout(resolve, result.delayMs));
      if (result.status < 400) saved.set(byCode[1], body.sato_code);
      return reply(route, result.body, result.status);
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return { leaked, patches, counts };
};

export const openSatoCodes = async (page: Page) => {
  await page.goto("/regions/sato-management?tab=sato");
  await expect(page.getByRole("heading", { name: "Tumanlar va SATO kodlari", exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("Kosonsoy tumani").first()).toBeVisible({ timeout: 30_000 });
};

/** 409 javobi (backend `conflict`) — matni foydalanuvchiga ko'rsatilmasligi kerak. */
export const CONFLICT: PatchReply = {
  status: 409,
  body: { statusCode: 409, message: "District sato_code already exists", data: null },
};

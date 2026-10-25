import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve, sep } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * KESH (04YKjCOD) — PROD BUILD ustida: xeshli `assets/` fayllari ikkinchi yuklashda qayta tasdiqlatilmaydi.
 *
 * Playwright `route` bilan so'rov ushlansa brauzer keshi o'chadi, `vite preview` esa `_headers` ni qo'llamaydi —
 * shuning uchun `dist` shu yerdagi kichik serverdan Cloudflare Workers assets kabi beriladi: `dist/_headers` qoidalari
 * tartib bilan, qoida bo'lmasa sukut `public, max-age=0, must-revalidate`, ETag va 304. Avvalgi holat (qoidasiz) bilan
 * solishtiriladi: avval har asset 304 edi (jonli o'lchov: 38 tadan 37 tasi).
 */
const DIST = resolve(process.cwd(), "dist");
const CLOUDFLARE_DEFAULT_CACHE = "public, max-age=0, must-revalidate";
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

type Rule = { path: string; set: [string, string][]; unset: string[] };

/** `dist/_headers` — Cloudflare tartibi: qoidalar ketma-ket, `!` — oldingi qo'yganini olib tashlash. */
const parseHeaders = (): Rule[] => {
  const rules: Rule[] = [];
  for (const raw of readFileSync(join(DIST, "_headers"), "utf8").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      rules.push({ path: line.trim(), set: [], unset: [] });
      continue;
    }
    const text = line.trim();
    const rule = rules[rules.length - 1];
    if (text.startsWith("!")) rule.unset.push(text.slice(1).trim().toLowerCase());
    else rule.set.push([text.slice(0, text.indexOf(":")).trim().toLowerCase(), text.slice(text.indexOf(":") + 1).trim()]);
  }
  return rules;
};

const matches = (pattern: string, pathname: string) =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(pathname);

const headersFor = (rules: Rule[], pathname: string) => {
  const headers = new Map<string, string>([["cache-control", CLOUDFLARE_DEFAULT_CACHE]]);
  for (const rule of rules.filter((item) => matches(item.path, pathname))) {
    rule.unset.forEach((name) => headers.delete(name));
    rule.set.forEach(([name, value]) => headers.set(name, value));
  }
  return Object.fromEntries(headers);
};

type Served = { path: string; status: number };

/** `dist` — mavjud fayl yoki SPA (`index.html`); `If-None-Match` mos kelsa — 304. `log` — server bergan javoblar. */
const serveDist = (rules: Rule[]) =>
  new Promise<{ server: Server; origin: string; log: Served[] }>((done) => {
    const log: Served[] = [];
    const server = createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
      let file = join(DIST, pathname);
      if (!file.startsWith(DIST + sep) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, "index.html");
      const body = readFileSync(file);
      const etag = `"${createHash("sha1").update(body).digest("hex")}"`;
      const headers = { "content-type": TYPES[extname(file)] ?? "application/octet-stream", etag, ...headersFor(rules, pathname) };
      const status = request.headers["if-none-match"] === etag ? 304 : 200;
      log.push({ path: pathname, status });
      response.writeHead(status, headers).end(status === 304 ? undefined : body);
    });
    server.listen(0, "127.0.0.1", () =>
      done({ server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, log }),
    );
  });

/** /login ni ikki marta ochadi (ikkinchisi — qayta ochish); ikkinchi yuklashda server bergan javoblar. */
const secondVisit = async (page: Page, { origin, log }: { origin: string; log: Served[] }) => {
  await page.goto(`${origin}/login`);
  await expect(page.getByRole("button", { name: "Kirish" })).toBeVisible({ timeout: 60_000 });
  expect(log.filter((item) => item.path.startsWith("/assets/")).length).toBeGreaterThan(5);
  const firstVisit = log.length;
  await page.goto(`${origin}/login`);
  await expect(page.getByRole("button", { name: "Kirish" })).toBeVisible({ timeout: 60_000 });
  // Kechroq yuklanadigan bo'laklar (tarjimalar, ikonkalar) ham kelib bo'lsin.
  await page.waitForLoadState("networkidle");
  return log.slice(firstVisit);
};

const notModified = (responses: Served[]) => responses.filter((item) => item.status === 304);

test.describe("Kesh: xeshli assets — 1 yil, immutable (04YKjCOD)", () => {
  test("⭐ build: dist/_headers bor, /assets/* — immutable, index.html — har safar tekshiriladi", () => {
    const rules = parseHeaders();
    expect(headersFor(rules, "/assets/index-Ca3mceTy.js")["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(headersFor(rules, "/assets/index-Bq3x.css")["cache-control"]).toBe("public, max-age=31536000, immutable");
    for (const path of ["/", "/index.html", "/login", "/orders", "/manifest.webmanifest"]) {
      expect(headersFor(rules, path)["cache-control"], path).toBe(CLOUDFLARE_DEFAULT_CACHE);
    }
    expect(headersFor(rules, "/sw.js")["cache-control"]).toBe("no-cache");
  });

  test("⭐ ikkinchi yuklashda 304 javoblari ≤ 2 (assets — keshdan); qoidasiz har asset 304 edi", async ({ browser }) => {
    const withRule = await serveDist(parseHeaders());
    const withoutRule = await serveDist(parseHeaders().filter((rule) => rule.path !== "/assets/*"));
    try {
      const before = await browser.newContext();
      const legacy = notModified(await secondVisit(await before.newPage(), withoutRule));
      await before.close();
      // Avvalgi holat: sarlavhasiz har asset qayta tasdiqlatiladi.
      expect(legacy.filter((item) => item.path.startsWith("/assets/")).length).toBeGreaterThan(5);

      const after = await browser.newContext();
      const current = notModified(await secondVisit(await after.newPage(), withRule));
      await after.close();
      expect(current.length, JSON.stringify(current)).toBeLessThanOrEqual(2);
      expect(current.filter((item) => item.path.startsWith("/assets/"))).toEqual([]);
    } finally {
      withRule.server.close();
      withoutRule.server.close();
    }
  });
});

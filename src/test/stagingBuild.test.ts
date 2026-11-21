import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import headersFile from "../../public/_headers?raw";
import manifestFile from "../../public/manifest.webmanifest?raw";
import robotsFile from "../../public/robots.txt?raw";
import swFile from "../../public/sw.js?raw";
import html from "../../index.html?raw";
import {
  checkDeployTarget,
  checkSameOriginWorker,
  envApiHost,
  envSameOrigin,
  wranglerTarget,
} from "../../scripts/check-deploy-target.mjs";
import { fillInlineScriptHashes, inlineScriptHashes } from "../../scripts/csp-headers.mjs";
import {
  PRODUCTION_API_HOST,
  PRODUCTION_SITE_HOST,
  SAME_ORIGIN_API_PATH,
  STAGING_ROBOTS_TXT,
  STAGING_SITE_HOST,
  STAGING_TITLE_PREFIX,
  stagingApiHost,
  stagingApiTarget,
  stagingHeaders,
  stagingIndexHtml,
  stagingManifest,
  stagingServiceWorker,
} from "../../scripts/staging-build.mjs";
import { STAGING_TITLE_PREFIX as BANNER_TITLE_PREFIX } from "../widgets/staging-banner";
import { API_PREFIX, SOCKET_IO_PREFIX } from "../../worker/proxy";

/**
 * TEST MUHIT (staging) BUILD'I — `npm run build:staging` (`.env.staging`, `scripts/staging-build.mjs`) va deploy
 * qo'riqchisi `npm run check:target` (`scripts/check-deploy-target.mjs`). Production build'i bu funksiyalarni
 * chaqirmaydi (`vite.config.ts`: faqat `VITE_APP_ENV=staging`).
 */
const root = process.cwd();
const readText = (file: string) => readFileSync(resolve(root, file), "utf8");
const env = (file: string) =>
  Object.fromEntries([...readText(file).matchAll(/^(VITE_\w+)=(\S*)$/gm)].map(([, key, value]) => [key, value]));
const changedLines = (before: string, after: string) => {
  const a = before.split("\n");
  const b = after.split("\n");
  expect(b).toHaveLength(a.length);
  return b.flatMap((line, index) => (line === a[index] ? [] : [[a[index].trim(), line.trim()]]));
};

describe(".env.staging / .env.production", () => {
  it("staging: bir domenli API (/api/ → Worker), ommaviy API hosti — test API (https), VITE_APP_ENV=staging, debug o'chiq", () => {
    expect(env(".env.staging")).toEqual({
      VITE_BASE_URL: SAME_ORIGIN_API_PATH,
      VITE_PUBLIC_API_URL: "https://test-api.elchipochta.uz/",
      VITE_APP_ENV: "staging",
      VITE_DEBUG: "false",
    });
    expect(envSameOrigin(root, "staging")).toBe(true);
    expect(stagingApiTarget(env(".env.staging"))).toEqual({ apiHost: "test-api.elchipochta.uz", sameOrigin: true });
  });

  it("production: bir domenli API (/api/ → Worker), ommaviy API hosti — production API, VITE_APP_ENV=production", () => {
    expect(env(".env.production")).toEqual({
      VITE_BASE_URL: SAME_ORIGIN_API_PATH,
      VITE_PUBLIC_API_URL: `https://${PRODUCTION_API_HOST}/`,
      VITE_DEBUG: "false",
      VITE_APP_ENV: "production",
    });
    expect(envSameOrigin(root, "production")).toBe(true);
    expect(envApiHost(root, "production")).toBe(PRODUCTION_API_HOST);
    expect(envApiHost(root, "staging")).toBe("test-api.elchipochta.uz");
  });

  it("staging API hosti: faqat https va production hostidan farqli — aks holda build yiqiladi", () => {
    expect(stagingApiHost("https://test-api.elchipochta.uz/")).toBe("test-api.elchipochta.uz");
    expect(() => stagingApiHost("http://test-api.elchipochta.uz/")).toThrow(/https/);
    expect(() => stagingApiHost(`https://${PRODUCTION_API_HOST}/`)).toThrow(/production/);
    expect(() => stagingApiHost(undefined)).toThrow(/VITE_BASE_URL/);
    expect(() => stagingApiHost("")).toThrow(/VITE_BASE_URL/);
  });

  it("build maqsadi: absolyut VITE_BASE_URL — to'g'ridan-to'g'ri API (orqaga qaytish rejimi), /api/ — bir domenli", () => {
    expect(stagingApiTarget({ VITE_BASE_URL: "https://test-api.elchipochta.uz/" })).toEqual({
      apiHost: "test-api.elchipochta.uz",
      sameOrigin: false,
    });
    expect(
      stagingApiTarget({ VITE_BASE_URL: "/api/", VITE_PUBLIC_API_URL: "https://test-api.elchipochta.uz/" }),
    ).toEqual({ apiHost: "test-api.elchipochta.uz", sameOrigin: true });
    // Worker faqat /api/* ni proksi qiladi — boshqa nisbiy yo'l SPA index.html ga tushardi.
    expect(() => stagingApiTarget({ VITE_BASE_URL: "/v1/", VITE_PUBLIC_API_URL: "https://test-api.elchipochta.uz/" })).toThrow(
      /faqat \/api\//,
    );
    expect(() => stagingApiTarget({ VITE_BASE_URL: "/api" })).toThrow(/faqat \/api\//);
    // Bir domenli rejimda ham API hosti majburiy va production bo'lmasin.
    expect(() => stagingApiTarget({ VITE_BASE_URL: "/api/" })).toThrow(/VITE_PUBLIC_API_URL/);
    expect(() =>
      stagingApiTarget({ VITE_BASE_URL: "/api/", VITE_PUBLIC_API_URL: `https://${PRODUCTION_API_HOST}/` }),
    ).toThrow(/production/);
    expect(() => stagingApiTarget({ VITE_BASE_URL: "/api/", VITE_PUBLIC_API_URL: "http://test-api.elchipochta.uz/" })).toThrow(
      /https/,
    );
  });

  it("Worker prefiksi = VITE_BASE_URL (/api/), socket.io sukut yo'li", () => {
    expect(`${API_PREFIX}/`).toBe(SAME_ORIGIN_API_PATH);
    expect(SOCKET_IO_PREFIX).toBe("/socket.io/");
  });
});

describe("staging build almashtirishlari (scripts/staging-build.mjs)", () => {
  it("index.html: noindex, «[TEST]» sarlavha, PWA nomlari — boshqa hech narsa o'zgarmaydi", () => {
    const staged = stagingIndexHtml(html);
    expect(changedLines(html, staged)).toEqual([
      ['<meta name="robots" content="index, follow" />', '<meta name="robots" content="noindex, nofollow" />'],
      ['<meta name="googlebot" content="index, follow" />', '<meta name="googlebot" content="noindex, nofollow" />'],
      [
        "<title>Elchi Pochta — Logistika va Kuryer Xizmati</title>",
        "<title>[TEST] Elchi Pochta — Logistika va Kuryer Xizmati</title>",
      ],
      ['<meta name="apple-mobile-web-app-title" content="Elchi" />', '<meta name="apple-mobile-web-app-title" content="Elchi TEST" />'],
      ['<meta name="application-name" content="Elchi Pochta" />', '<meta name="application-name" content="Elchi Pochta TEST" />'],
    ]);
    // Ichki skriptlar tegilmaydi — CSP xeshlari staging'da ham to'g'ri.
    expect(inlineScriptHashes(staged)).toEqual(inlineScriptHashes(html));
  });

  it("manifest: nomi «… TEST», scope / start_url / ikonkalar o'sha (o'z origin'ida — production ilovasi bilan adashmaydi)", () => {
    const original = JSON.parse(manifestFile) as Record<string, unknown>;
    const staged = JSON.parse(stagingManifest(manifestFile)) as Record<string, unknown>;
    expect(staged.name).toBe("Elchi Pochta TEST");
    expect(staged.short_name).toBe("Elchi TEST");
    expect({ ...staged, name: original.name, short_name: original.short_name }).toEqual(original);
  });

  it("sw.js: bildirishnoma sarlavhasi «[TEST] …», SW versiyasi «…-staging»; boshqa qator o'zgarmaydi", () => {
    const changes = changedLines(swFile, stagingServiceWorker(swFile));
    expect(changes).toHaveLength(2);
    expect(changes[0][1]).toMatch(/^const SW_VERSION = "[^"]+-staging";$/);
    expect(changes[1][1]).toBe('return self.registration.showNotification("[TEST] " + payload.title, {');
  });

  it("robots.txt: staging'da butun sayt yopiq, production'da — avvalgidek", () => {
    expect(STAGING_ROBOTS_TXT).toMatch(/^User-agent: \*\nDisallow: \/$/m);
    expect(robotsFile).not.toMatch(/^Disallow: \/$/m);
  });

  it("shablon o'zgarib almashtirish joyi topilmasa — xato (staging jimgina production qiymatlari bilan chiqmaydi)", () => {
    expect(() => stagingIndexHtml(html.replace('name="robots"', 'name="x-robots"'))).toThrow(/robots/);
    expect(() => stagingServiceWorker(swFile.replace("showNotification(payload.title,", "showNotification(t,"))).toThrow(
      /showNotification/,
    );
    expect(() => stagingHeaders(headersFile.replaceAll(PRODUCTION_API_HOST, "example.com"), "test-api.elchipochta.uz")).toThrow(
      /topilmadi/,
    );
    expect(() =>
      stagingHeaders(headersFile.replace(`wss://${PRODUCTION_SITE_HOST} `, ""), "test-api.elchipochta.uz"),
    ).toThrow(/connect-src/);
  });

  it("sarlavha prefiksi build (index.html) va ekrandagi belgi (sahifa nomlari) uchun bir xil", () => {
    expect(BANNER_TITLE_PREFIX).toBe(STAGING_TITLE_PREFIX);
  });
});

describe("wrangler.jsonc — production va staging: bir xil bir domenli Worker, alohida API", () => {
  type WorkerConfig = {
    name: string;
    main?: string;
    routes?: { pattern: string; custom_domain: boolean }[];
    assets: Record<string, unknown>;
    vars?: Record<string, string>;
    compatibility_date: string;
    workers_dev?: boolean;
  };
  const config = JSON.parse(readText("wrangler.jsonc").replace(/^\s*\/\/.*$/gm, "")) as WorkerConfig & {
    env: Record<string, WorkerConfig>;
  };

  const zone = (host: string) => host.split(".").slice(-2).join(".");

  it("production (yuqori daraja): Worker elchi-frontend, marshrutsiz (domen dashboard'da), dist SPA", () => {
    expect(config.name).toBe("elchi-frontend");
    expect(config.routes).toBeUndefined();
    expect(config.assets).toMatchObject({ directory: "./dist", not_found_handling: "single-page-application" });
  });

  it("production: bir domenli API — FAQAT /api/* va /socket.io/* Worker'ga, API_ORIGIN — production API, BIR zonada", () => {
    expect(config.main).toBe("worker/index.ts");
    expect(config.assets).toEqual({
      directory: "./dist",
      not_found_handling: "single-page-application",
      binding: "ASSETS",
      run_worker_first: [`${API_PREFIX}/*`, `${SOCKET_IO_PREFIX}*`],
    });
    expect(config.vars).toEqual({ API_ORIGIN: `https://${PRODUCTION_API_HOST}` });
    expect(checkSameOriginWorker(wranglerTarget(root, "production"), envApiHost(root, "production"))).toEqual([]);
    expect(zone(PRODUCTION_API_HOST)).toBe(zone(PRODUCTION_SITE_HOST));
  });

  it("env.staging: Worker elchi-frontend-test + custom domen test-admin.elchipochta.uz, o'sha dist/SPA", () => {
    const staging = config.env.staging;
    expect(Object.keys(config.env)).toEqual(["staging"]);
    expect(staging.name).toBe("elchi-frontend-test");
    expect(staging.routes).toEqual([{ pattern: STAGING_SITE_HOST, custom_domain: true }]);
    expect(staging.compatibility_date).toBe(config.compatibility_date);
    expect(staging.workers_dev).toBe(false);
  });

  it("env.staging: production bilan bir xil Worker va assets (meros emas — qayta yozilgan), API — test API", () => {
    const staging = config.env.staging;
    expect(staging.main).toBe(config.main);
    expect(staging.assets).toEqual(config.assets);
    expect(checkSameOriginWorker(wranglerTarget(root, "staging"), envApiHost(root, "staging"))).toEqual([]);
  });

  it("API_ORIGIN — .env.staging dagi API hosti, https, kabinet bilan BIR zonada (aks holda CF-Connecting-IP = Worker IP)", () => {
    const origin = new URL(config.env.staging.vars?.API_ORIGIN ?? "");
    expect(origin.href).toBe(`https://${envApiHost(root, "staging")}/`);
    expect(zone(origin.host)).toBe("elchipochta.uz");
    expect(zone(origin.host)).toBe(zone(STAGING_SITE_HOST));
  });

  it("Worker sharti buzilsa — deploy qo'riqchisi aniq xato beradi", () => {
    const errors = checkSameOriginWorker(
      { main: undefined, assets: { run_worker_first: ["/api/*"] }, vars: { API_ORIGIN: `https://${PRODUCTION_API_HOST}` } },
      "test-api.elchipochta.uz",
    );
    expect(errors).toEqual([
      "wrangler: Worker skripti (main) yo'q",
      "wrangler: assets.binding ASSETS emas",
      "wrangler: run_worker_first da /socket.io/* yo'q",
      `wrangler: vars.API_ORIGIN https://test-api.elchipochta.uz emas (https://${PRODUCTION_API_HOST})`,
    ]);
  });
});

describe(".github/workflows/deploy.yml — test → staging, main → production", () => {
  const workflow = readText(".github/workflows/deploy.yml");
  const step = (name: string) => {
    const start = workflow.indexOf(`- name: ${name}\n`);
    expect(start, name).toBeGreaterThan(-1);
    const end = workflow.indexOf("\n      - ", start + 1);
    return workflow.slice(start, end === -1 ? undefined : end);
  };

  it("push: main va test; PR — har branchga (test'ga ham)", () => {
    expect(workflow).toMatch(/push:\n\s+branches: \[main, test\]\n\s+pull_request:\n/);
  });

  it("production deploy — faqat main, `--env` siz (avvalgidek)", () => {
    const production = step("Deploy (production)");
    expect(production).toContain("if: github.ref == 'refs/heads/main'\n");
    expect(production).toContain("run: npx wrangler deploy\n");
  });

  it("staging deploy — faqat test + STAGING_ENABLED, `--env staging`", () => {
    const staging = step("Deploy (staging)");
    expect(staging).toContain("if: github.ref == 'refs/heads/test' && vars.STAGING_ENABLED == 'true'\n");
    expect(staging).toContain("run: npx wrangler deploy --env staging\n");
  });

  it("staging darvozasi — main + STAGING_ENABLED, birinchi qadam, «Deploy (staging)» natijasiga qaraydi", () => {
    const gate = step("Staging darvozasi (test saytdan o'tganmi)");
    expect(gate).toContain("if: github.ref == 'refs/heads/main' && vars.STAGING_ENABLED == 'true'\n");
    // Darvoza shu nom bilan qidiradi — qadam nomi o'zgarsa darvoza hamma narsani rad etardi.
    expect(gate).toContain('select(.name == "Deploy (staging)" and .conclusion == "success")');
    expect(workflow).toContain("- name: Deploy (staging)\n");
    expect(workflow.indexOf("- name: Staging darvozasi")).toBeLessThan(workflow.indexOf("- uses: actions/checkout"));
    expect(workflow).toMatch(/permissions:\n\s+contents: read\n(\s+#.*\n)?\s+actions: read\n/);
  });

  it("test'da production build'i yo'q — staging build'i va dist ↔ muhit tekshiruvi", () => {
    expect(workflow).toMatch(/- run: npm run build\n\s+if: github\.ref != 'refs\/heads\/test'\n/);
    expect(step("Build (staging)")).toContain("if: github.ref == 'refs/heads/test'\n");
    expect(step("Deploy maqsadi (dist ↔ muhit)")).toContain(
      "npm run check:target -- ${{ github.ref == 'refs/heads/test' && 'staging' || 'production' }}",
    );
  });
});

describe("deploy qo'riqchisi (scripts/check-deploy-target.mjs)", () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

  /** Haqiqiy build qadamlarini takrorlaydigan soxta `dist` (shablonlar + o'sha almashtirishlar). */
  const fakeDist = (target: "production" | "staging") => {
    const dir = mkdtempSync(join(tmpdir(), `elchi-dist-${target}-`));
    dirs.push(dir);
    const staging = target === "staging";
    const host = staging ? "test-api.elchipochta.uz" : PRODUCTION_API_HOST;
    const page = staging ? stagingIndexHtml(html) : html;
    const headers = fillInlineScriptHashes(headersFile, inlineScriptHashes(page));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "assets", "index-abc123.js"), `const a="https://${host}/";const b="https://${PRODUCTION_API_HOST}";`);
    writeFileSync(join(dir, "_headers"), staging ? stagingHeaders(headers, host) : headers);
    writeFileSync(join(dir, "index.html"), page);
    writeFileSync(join(dir, "manifest.webmanifest"), staging ? stagingManifest(manifestFile) : manifestFile);
    writeFileSync(join(dir, "robots.txt"), staging ? STAGING_ROBOTS_TXT : robotsFile);
    return dir;
  };

  it("har build o'z muhitiga mos", () => {
    expect(checkDeployTarget({ target: "production", dir: fakeDist("production"), root })).toEqual([]);
    expect(checkDeployTarget({ target: "staging", dir: fakeDist("staging"), root })).toEqual([]);
  });

  it("staging build'i production'ga (va aksincha) o'tmaydi", () => {
    const toProduction = checkDeployTarget({ target: "production", dir: fakeDist("staging"), root });
    expect(toProduction).toEqual(
      expect.arrayContaining([
        `_headers: «https://${PRODUCTION_API_HOST}» yo'q`,
        "_headers: begona API hosti test-api.elchipochta.uz",
        "index.html: robots noindex bor",
        "assets: production JS'da staging hosti test-api.elchipochta.uz",
      ]),
    );
    const toStaging = checkDeployTarget({ target: "staging", dir: fakeDist("production"), root });
    expect(toStaging).toEqual(
      expect.arrayContaining([
        `_headers: begona API hosti ${PRODUCTION_API_HOST}`,
        "index.html: «[TEST]» sarlavha yo'q",
        "assets: API manzili https://test-api.elchipochta.uz yo'q",
        "robots.txt: «Disallow: /» yo'q",
      ]),
    );
  });

  it("bir domenli build: o'z kabinetining wss'i bo'lmasa — xato (production ham, staging ham)", () => {
    for (const [target, site] of [
      ["staging", STAGING_SITE_HOST],
      ["production", PRODUCTION_SITE_HOST],
    ] as const) {
      const dir = fakeDist(target);
      writeFileSync(join(dir, "_headers"), readFileSync(join(dir, "_headers"), "utf8").replace(` wss://${site}`, ""));
      expect(checkDeployTarget({ target, dir, root }), target).toEqual([`_headers: «wss://${site}» yo'q`]);
    }
  });

  it("⭐ Worker'siz wrangler bilan bir domenli production build'i chiqmaydi (har API so'rovi index.html olardi)", () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), "elchi-root-"));
    dirs.push(fakeRoot);
    writeFileSync(join(fakeRoot, ".env.production"), readText(".env.production"));
    writeFileSync(join(fakeRoot, ".env.staging"), readText(".env.staging"));
    const config = JSON.parse(readText("wrangler.jsonc").replace(/^\s*\/\/.*$/gm, "")) as Record<string, unknown>;
    // Avvalgi (statik) production sozlamasi: skript, binding, run_worker_first va vars yo'q.
    const withoutWorker = Object.fromEntries(Object.entries(config).filter(([key]) => key !== "main" && key !== "vars"));
    const assets = { directory: "./dist", not_found_handling: "single-page-application" };
    writeFileSync(join(fakeRoot, "wrangler.jsonc"), JSON.stringify({ ...withoutWorker, assets }));
    expect(checkDeployTarget({ target: "production", dir: fakeDist("production"), root: fakeRoot })).toEqual([
      "wrangler: Worker skripti (main) yo'q",
      "wrangler: assets.binding ASSETS emas",
      "wrangler: run_worker_first da /api/* yo'q",
      "wrangler: run_worker_first da /socket.io/* yo'q",
      "wrangler: vars.API_ORIGIN https://api.elchipochta.uz emas (yo'q)",
    ]);
  });

  it("noma'lum muhit yoki bo'sh papka — xato", () => {
    expect(checkDeployTarget({ target: "preview", dir: tmpdir(), root })).toHaveLength(1);
    const empty = mkdtempSync(join(tmpdir(), "elchi-dist-empty-"));
    dirs.push(empty);
    expect(checkDeployTarget({ target: "production", dir: empty, root })).toEqual(
      expect.arrayContaining(["_headers yo'q", "index.html yo'q", "assets/*.js yo'q"]),
    );
  });
});

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import headersFile from "../../public/_headers?raw";
import manifestFile from "../../public/manifest.webmanifest?raw";
import robotsFile from "../../public/robots.txt?raw";
import swFile from "../../public/sw.js?raw";
import html from "../../index.html?raw";
import { checkDeployTarget, envApiHost } from "../../scripts/check-deploy-target.mjs";
import { fillInlineScriptHashes, inlineScriptHashes } from "../../scripts/csp-headers.mjs";
import {
  PRODUCTION_API_HOST,
  STAGING_ROBOTS_TXT,
  STAGING_TITLE_PREFIX,
  stagingApiHost,
  stagingHeaders,
  stagingIndexHtml,
  stagingManifest,
  stagingServiceWorker,
} from "../../scripts/staging-build.mjs";
import { STAGING_TITLE_PREFIX as BANNER_TITLE_PREFIX } from "../widgets/staging-banner";

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
  it("staging: test API (https), VITE_APP_ENV=staging, debug o'chiq", () => {
    expect(env(".env.staging")).toEqual({
      VITE_BASE_URL: "https://test-api.elchipochta.uz/",
      VITE_APP_ENV: "staging",
      VITE_DEBUG: "false",
    });
  });

  it("production: VITE_APP_ENV=production (staging kodi build vaqtida tushib qoladi), API o'zgarmagan", () => {
    expect(env(".env.production")).toEqual({
      VITE_BASE_URL: `https://${PRODUCTION_API_HOST}/`,
      VITE_DEBUG: "false",
      VITE_APP_ENV: "production",
    });
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
  });

  it("sarlavha prefiksi build (index.html) va ekrandagi belgi (sahifa nomlari) uchun bir xil", () => {
    expect(BANNER_TITLE_PREFIX).toBe(STAGING_TITLE_PREFIX);
  });
});

describe("wrangler.jsonc — staging alohida Worker, production o'zgarmagan", () => {
  const config = JSON.parse(readText("wrangler.jsonc").replace(/^\s*\/\/.*$/gm, "")) as {
    name: string;
    routes?: unknown;
    assets: unknown;
    compatibility_date: string;
    env: Record<string, { name: string; routes: unknown; assets: unknown; compatibility_date: string; workers_dev: boolean }>;
  };

  it("production (yuqori daraja): Worker elchi-frontend, marshrutsiz (domen dashboard'da), dist SPA", () => {
    expect(config.name).toBe("elchi-frontend");
    expect(config.routes).toBeUndefined();
    expect(config.assets).toEqual({ directory: "./dist", not_found_handling: "single-page-application" });
  });

  it("env.staging: Worker elchi-frontend-test + custom domen test-admin.elchipochta.uz, o'sha dist/SPA", () => {
    const staging = config.env.staging;
    expect(Object.keys(config.env)).toEqual(["staging"]);
    expect(staging.name).toBe("elchi-frontend-test");
    expect(staging.routes).toEqual([{ pattern: "test-admin.elchipochta.uz", custom_domain: true }]);
    expect(staging.assets).toEqual(config.assets);
    expect(staging.compatibility_date).toBe(config.compatibility_date);
    expect(staging.workers_dev).toBe(false);
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

  it("noma'lum muhit yoki bo'sh papka — xato", () => {
    expect(checkDeployTarget({ target: "preview", dir: tmpdir(), root })).toHaveLength(1);
    const empty = mkdtempSync(join(tmpdir(), "elchi-dist-empty-"));
    dirs.push(empty);
    expect(checkDeployTarget({ target: "production", dir: empty, root })).toEqual(
      expect.arrayContaining(["_headers yo'q", "index.html yo'q", "assets/*.js yo'q"]),
    );
  });
});

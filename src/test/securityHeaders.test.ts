import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import headersFile from "../../public/_headers?raw";
import html from "../../index.html?raw";
import {
  fillInlineScriptHashes,
  INLINE_SCRIPT_HASHES_PLACEHOLDER,
  inlineScriptHashes,
} from "../../scripts/csp-headers.mjs";

/**
 * XAVFSIZLIK SARLAVHALARI (KwodkKWY): `public/_headers` (Cloudflare Workers assets) — CSP, frame-ancestors,
 * nosniff, Referrer-Policy, Permissions-Policy (kamera — skaner uchun o'zimizga), HSTS. Ilova ishlashi uchun
 * kerakli manbalar (API https + wss, Google Fonts, Telegram SDK) siyosatdan tushib qolmasin.
 */
type Rule = { path: string; set: Map<string, string>; unset: string[] };

const parseHeaders = (source: string): Rule[] => {
  const rules: Rule[] = [];
  for (const raw of source.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      rules.push({ path: line.trim(), set: new Map(), unset: [] });
      continue;
    }
    const rule = rules[rules.length - 1];
    const text = line.trim();
    if (text.startsWith("!")) {
      rule.unset.push(text.slice(1).trim().toLowerCase());
      continue;
    }
    const colon = text.indexOf(":");
    rule.set.set(text.slice(0, colon).trim().toLowerCase(), text.slice(colon + 1).trim());
  }
  return rules;
};

const rules = parseHeaders(headersFile);
const rule = (path: string) => rules.find((item) => item.path === path);
const all = rule("/*")!;
const directives = (policy: string) =>
  new Map(
    policy
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...sources] = part.split(/\s+/);
        return [name, sources] as const;
      }),
  );

// `.env*` ni Vite `?raw` bilan import qilib bo'lmaydi (server.fs.deny) — to'g'ridan-to'g'ri o'qiladi.
const envProduction = readFileSync(resolve(process.cwd(), ".env.production"), "utf8");
const apiHost = new URL(/VITE_BASE_URL=(\S+)/.exec(envProduction)?.[1] ?? "").host;
const reportOnly = directives(all.set.get("content-security-policy-report-only") ?? "");

describe("public/_headers — xavfsizlik sarlavhalari (KwodkKWY)", () => {
  it("har sahifada: nosniff, X-Frame-Options, Referrer-Policy, HSTS", () => {
    expect(all.set.get("x-content-type-options")).toBe("nosniff");
    expect(all.set.get("x-frame-options")).toBe("DENY");
    expect(all.set.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(all.set.get("strict-transport-security")).toMatch(/^max-age=(\d{8,})$/);
  });

  it("majburiy CSP: frame-ancestors 'none' (clickjacking) — boshqa direktiva ilovani buzmasin", () => {
    const enforced = directives(all.set.get("content-security-policy") ?? "");
    expect(enforced.get("frame-ancestors")).toEqual(["'none'"]);
    expect([...enforced.keys()].sort()).toEqual(["base-uri", "frame-ancestors"]);
  });

  it("Permissions-Policy: kamera o'zimizga ruxsat (skaner), mikrofon / geolokatsiya / to'lov o'chiq", () => {
    const policy = all.set.get("permissions-policy") ?? "";
    expect(policy).toContain("camera=(self)");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
    expect(policy).toContain("payment=()");
  });

  it("Report-Only CSP: skriptlar faqat o'zimizdan + xesh, 'unsafe-inline' / 'unsafe-eval' yo'q", () => {
    const scripts = reportOnly.get("script-src") ?? [];
    expect(scripts).toEqual(["'self'", INLINE_SCRIPT_HASHES_PLACEHOLDER, "https://telegram.org"]);
    expect(reportOnly.get("default-src")).toEqual(["'self'"]);
    expect(reportOnly.get("object-src")).toEqual(["'none'"]);
    expect(reportOnly.get("base-uri")).toEqual(["'self'"]);
  });

  it("Report-Only CSP: API (https + wss — socket.io /realtime), Google Fonts, blob worker (qr-scanner)", () => {
    expect(apiHost).toBe("api.elchipochta.uz");
    expect(reportOnly.get("connect-src")).toEqual(
      expect.arrayContaining(["'self'", `https://${apiHost}`, `wss://${apiHost}`]),
    );
    expect(reportOnly.get("style-src")).toEqual(["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]);
    expect(reportOnly.get("font-src")).toEqual(expect.arrayContaining(["https://fonts.gstatic.com"]));
    expect(reportOnly.get("img-src")).toEqual(expect.arrayContaining(["'self'", "data:", "blob:", `https://${apiHost}`]));
    expect(reportOnly.get("worker-src")).toEqual(["'self'", "blob:"]);
    expect(reportOnly.get("manifest-src")).toEqual(["'self'"]);
  });

  it("/tg/scan — Telegram Web iframe'i uchun frame-ancestors faqat web.telegram.org ga ochiladi", () => {
    const tg = rule("/tg/scan*")!;
    expect(rules.indexOf(tg)).toBeGreaterThan(rules.indexOf(all));
    expect(tg.unset).toEqual(["x-frame-options", "content-security-policy"]);
    const enforced = directives(tg.set.get("content-security-policy") ?? "");
    expect(enforced.get("frame-ancestors")).toEqual(["'self'", "https://web.telegram.org"]);
  });

  it("sw.js zaxira sarlavhalari saqlangan (QgqO0CdZ)", () => {
    const sw = rule("/sw.js")!;
    expect(sw.set.get("content-type")).toBe("application/javascript; charset=utf-8");
    expect(sw.set.get("service-worker-allowed")).toBe("/");
  });
});

describe("scripts/csp-headers.mjs — ichki skript xeshlari", () => {
  it("index.html: mavzu skripti xeshlanadi, JSON-LD va src li skriptlar e'tiborsiz", () => {
    const theme = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
    expect(theme).toContain("theme-version");
    const expected = `'sha256-${createHash("sha256").update(theme, "utf8").digest("base64")}'`;
    expect(inlineScriptHashes(html)).toEqual([expected]);
  });

  it("joy tutuvchi xeshlar bilan almashtiriladi; xesh yoki joy tutuvchi bo'lmasa — xato (build yiqiladi)", () => {
    const hashes = inlineScriptHashes(`<script>a()</script><script type="module" src="/x.js"></script><script>b()</script>`);
    expect(hashes).toHaveLength(2);
    const filled = fillInlineScriptHashes(headersFile, hashes);
    expect(filled).not.toContain(INLINE_SCRIPT_HASHES_PLACEHOLDER);
    expect(filled).toContain(`script-src 'self' ${hashes.join(" ")} https://telegram.org;`);
    expect(() => fillInlineScriptHashes(filled, hashes)).toThrow(/topilmadi/);
    expect(() => fillInlineScriptHashes(headersFile, [])).toThrow(/xesh/);
  });
});

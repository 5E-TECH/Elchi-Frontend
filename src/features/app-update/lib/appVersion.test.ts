import { describe, expect, it, vi } from "vitest";
import {
  checkForNewVersion,
  fetchLatestSignature,
  isNewerBundle,
  parseBundleSignature,
  readBundleSignature,
} from "./appVersion";

/** Production `index.html` ning qisqartirilgan nusxasi (admin.elchipochta.uz, 2026-11-08). */
const indexHtml = (entry: string, css = "/assets/index-DIVlrNnH.css") => `<!doctype html>
<html lang="uz">
  <head>
    <meta charset="UTF-8" />
    <script>(()=>{const f={"login":[],"app":["/assets/uzRest-Cq1.js"]};})()</script>
    <link rel="preload" as="font" type="font/woff2" href="/assets/Manrope-wght-latin-B6Sd7_ZV.woff2" crossorigin />
    <script type="module" crossorigin src="${entry}"></script>
    <link rel="modulepreload" crossorigin href="/assets/vendor-react-Bwwh13xQ.js">
    <link rel="stylesheet" crossorigin href="${css}">
    <link rel="manifest" href="/manifest.webmanifest" />
  </head>
  <body><div id="root"></div></body>
</html>`;

const htmlResponse = (body: string, init: ResponseInit = {}) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init });

const docOf = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("appVersion — bundle izi", () => {
  it("reads the entry module script and /assets/ stylesheets only", () => {
    expect(parseBundleSignature(indexHtml("/assets/index-BWRmdp5K.js"))).toEqual({
      entry: "/assets/index-BWRmdp5K.js",
      styles: ["/assets/index-DIVlrNnH.css"],
    });
  });

  it("is unknown for dev builds and foreign HTML (captive portal, error page)", () => {
    expect(parseBundleSignature(indexHtml("/src/main.tsx"))).toBeNull();
    expect(parseBundleSignature("<html><body>Wi-Fi login</body></html>")).toBeNull();
    expect(readBundleSignature(docOf('<script src="https://telegram.org/js/telegram-web-app.js"></script>'))).toBeNull();
  });

  it("detects a new entry script", () => {
    const current = parseBundleSignature(indexHtml("/assets/index-BWRmdp5K.js"))!;
    expect(isNewerBundle(current, parseBundleSignature(indexHtml("/assets/index-C5yLh6TJ.js"))!)).toBe(true);
    expect(isNewerBundle(current, current)).toBe(false);
  });

  it("detects a CSS-only release, but extra runtime stylesheets (lazy sections) are not a new version", () => {
    const current = {
      entry: "/assets/index-BWRmdp5K.js",
      styles: ["/assets/index-DIVlrNnH.css", "/assets/MapView-Ab12.css"],
    };
    expect(isNewerBundle(current, { entry: current.entry, styles: ["/assets/index-DIVlrNnH.css"] })).toBe(false);
    expect(isNewerBundle(current, { entry: current.entry, styles: ["/assets/index-NEWcss01.css"] })).toBe(true);
  });
});

describe("fetchLatestSignature", () => {
  it("asks the server for / bypassing the browser cache", async () => {
    const fetchImpl = vi.fn(async () => htmlResponse(indexHtml("/assets/index-C5yLh6TJ.js")));
    await expect(fetchLatestSignature(fetchImpl)).resolves.toEqual({
      entry: "/assets/index-C5yLh6TJ.js",
      styles: ["/assets/index-DIVlrNnH.css"],
    });
    expect(fetchImpl).toHaveBeenCalledWith("/", expect.objectContaining({ cache: "no-store" }));
  });

  it("is unknown on network errors, non-2xx and non-HTML answers", async () => {
    await expect(fetchLatestSignature(async () => Promise.reject(new TypeError("Failed to fetch")))).resolves.toBeNull();
    await expect(
      fetchLatestSignature(async () => htmlResponse(indexHtml("/assets/index-C5yLh6TJ.js"), { status: 503 })),
    ).resolves.toBeNull();
    await expect(
      fetchLatestSignature(
        async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
      ),
    ).resolves.toBeNull();
  });
});

describe("checkForNewVersion", () => {
  const running = docOf(indexHtml("/assets/index-BWRmdp5K.js"));

  it("is true only when the server build differs from the running one", async () => {
    await expect(
      checkForNewVersion(running, async () => htmlResponse(indexHtml("/assets/index-C5yLh6TJ.js"))),
    ).resolves.toBe(true);
    await expect(
      checkForNewVersion(running, async () => htmlResponse(indexHtml("/assets/index-BWRmdp5K.js"))),
    ).resolves.toBe(false);
  });

  it("never asks the server in dev (entry /src/main.tsx)", async () => {
    const fetchImpl = vi.fn(async () => htmlResponse(indexHtml("/assets/index-C5yLh6TJ.js")));
    await expect(checkForNewVersion(docOf(indexHtml("/src/main.tsx")), fetchImpl)).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("stays false when the server answer is unknown", async () => {
    await expect(checkForNewVersion(running, async () => htmlResponse("<html></html>"))).resolves.toBe(false);
  });
});

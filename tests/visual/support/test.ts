import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test as base, type Page, type TestInfo } from "@playwright/test";
import { assertManropeLoaded } from "./fonts";
import { installMockApi, type ApiTable } from "./mockApi";
import { assertModeAllowed, snapshotAction } from "./policy";
import { installSession, profileFor, type BranchType, type Role, type Theme } from "./session";
import {
  DEFAULT_MAX_HEIGHT,
  expandToContent,
  FIXED_NOW,
  GLOBAL_MASK,
  pinOnline,
  queryErrors,
  waitForReady,
} from "./stabilize";

/**
 * Vizual snapshotlar — sahna shartnomasi (docs/DESIGN_SYSTEM.md §12.5).
 *
 *   defineScene({ id: "orders", route: "/orders", role: "superadmin", maket: ["superadmin-orders-list"], api: { … } });
 *
 * Har sahna 4 loyihada (desktop/phone × light/dark) yuradi → `__screenshots__/<loyiha>/<id>.png`.
 * Rejimlar:
 *   - oddiy (CI, Docker obrazi): `toHaveScreenshot`; baseline hali yo'q bo'lsa test «skipped» (neytral) va
 *     `$GITHUB_STEP_SUMMARY` ga «baseline yo'q» yoziladi — job yiqilmaydi; baseline bor bo'lsa farq yiqitadi;
 *   - `VISUAL_DRY=1` (lokal, kuchsiz kompyuter): solishtirish/yangilash YO'Q — sahifa chiziladi, barcha
 *     tekshiruvlar yuradi, rasm `test-results-visual/dry/<loyiha>/<id>.png` ga, hisobot `<id>.json` ga yoziladi.
 */
export type { Theme, Role, BranchType };

export interface Scene {
  /** Global noyob: snapshot — `__screenshots__/<loyiha>/<id>.png`. */
  id: string;
  route: string;
  /** `null` — mehmon (`/login`). */
  role: Role | null;
  /** Profildagi filial turi (sukut: menejer HYBRID, registrator HQ, kuryer REGIONAL). */
  branchType?: BranchType | null;
  /** Asos bo'lgan maketlar `<rol>-<viewId>` (hisobotda chiqadi). */
  maket: string[];
  /** Soxta API jadvali: `"GET orders"`, `"GET orders/:id"` → JSON yoki `(req) => JSON` (`reply(body, status)`). */
  api: ApiTable;
  /** Qo'shimcha tayyorlik selektori. */
  ready?: string;
  /** Sahifa tayyor bo'lgach bajariladigan amal (dialog ochish, tanlash). */
  act?: (page: Page) => Promise<void>;
  /** `content` (sukut) — kontent balandligigacha to'liq sahifa; `viewport` — faqat oyna (dialog sahnalari). */
  capture?: "content" | "viewport";
  /** `content` chegarasi, px (sukut 6000). */
  maxHeight?: number;
  /** Qo'shimcha niqob selektorlari (kutilmaydi — soat muzlatilgan). */
  mask?: string[];
  /** Faqat sababi bilan (grafik sahnasi), global qiymat hech qachon oshirilmaydi. */
  maxDiffPixels?: number;
  /** Sahifa yuklanish holatlarini ataylab ko'rsatadi — sabab (masalan `ui-kit`). */
  allowBusy?: string;
  /** Xato holatlarini (`ErrorState`) ataylab ko'rsatadi — sabab (masalan `ui-kit`); aks holda xato holati yiqitadi. */
  allowErrors?: string;
  /** Kutilgan konsol xatolari — har biri sababi bilan. */
  allowConsole?: ReadonlyArray<{ pattern: RegExp; reason: string }>;
}

export const DRY = process.env.VISUAL_DRY === "1";

const SUPPORT_DIR = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_CSS = join(SUPPORT_DIR, "screenshot.css");
const FIXTURES_DIR = join(SUPPORT_DIR, "..", "fixtures");

/** `tests/visual/fixtures/<yo'l>` dagi JSON (nusxa — e2e support fayllari import qilinmaydi). */
export const fixture = <T = Record<string, unknown>>(path: string): T =>
  JSON.parse(readFileSync(join(FIXTURES_DIR, path), "utf8")) as T;

export const test = base.extend<{ theme: Theme }>({
  theme: ["light", { option: true }],
});
export { expect };

/** Shell (har sahifada): o'qilmagan bildirishnomalar soni — 0 (qo'ng'iroqcha nishonsiz). Sahna ustidan yozishi mumkin. */
const SHELL_API: ApiTable = {
  "GET notifications/inbox/unread-count": { statusCode: 200, data: { unread: 0 } },
};

const sceneIds = new Set<string>();

/** Sahnani ro'yxatga oladi: bitta test, nomi = `id`. */
export const defineScene = (scene: Scene) => {
  if (sceneIds.has(scene.id)) throw new Error(`Vizual sahna id takrorlandi: «${scene.id}» (id global, snapshot nomi).`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(scene.id)) throw new Error(`Vizual sahna id faqat kebab-case: «${scene.id}»`);
  if (!scene.maket.length) throw new Error(`Vizual sahna «${scene.id}»: maket ro'yxati bo'sh (kamida bitta <rol>-<viewId>).`);
  sceneIds.add(scene.id);
  test(
    scene.id,
    {
      annotation: [
        { type: "route", description: `${scene.role ?? "guest"} ${scene.route}` },
        { type: "maket", description: scene.maket.join(", ") },
      ],
    },
    async ({ page, theme }, testInfo) => {
      await runScene(page, theme, scene, testInfo);
    },
  );
};

const routePath = (route: string) => new URL(route, "http://x").pathname;

const summary = (line: string) => {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  try {
    appendFileSync(file, `${line}\n`);
  } catch {
    /* hisobot yozilmasa ham test natijasi o'zgarmaydi */
  }
};

const runScene = async (page: Page, theme: Theme, scene: Scene, testInfo: TestInfo) => {
  // Konfiguratsiyadagi argv tekshiruvining zaxirasi: Playwright tahlil qilgan haqiqiy rejim (`-xu`, `-uall` …).
  assertModeAllowed(testInfo.config.updateSnapshots, process.env);
  const project = testInfo.project.name;
  const baseURL = testInfo.project.use.baseURL;
  if (!baseURL) throw new Error("Vizual: loyihada baseURL yo'q (playwright.visual.config.ts).");
  const appOrigin = new URL(baseURL).origin;
  const context = page.context();

  const table: ApiTable = {
    ...(scene.role ? { "GET auth/my-profile": profileFor(scene.role, theme, scene.branchType), ...SHELL_API } : {}),
    ...scene.api,
  };
  const network = await installMockApi(context, { appOrigin, table });
  await installSession(context, { role: scene.role, theme });
  await pinOnline(context);
  await page.clock.setFixedTime(FIXED_NOW);

  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text().slice(0, 400));
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${String(error.message ?? error).slice(0, 400)}`));

  await page.goto(scene.route, { waitUntil: "load" });
  const ready = { ready: scene.ready, allowBusy: scene.allowBusy };
  await waitForReady(page, ready);
  if (scene.act) {
    await scene.act(page);
    await waitForReady(page, ready);
  }
  await assertManropeLoaded(page);
  // Suratdan OLDIN: lotin 600 dan boshqa bo'lak (cyrillic «№», latin-ext) olinmagan bo'lsa ham snapshot olinmaydi.
  expect(network.fontErrors, `Vizual «${scene.id}»: Google Fonts bo'laklari olinmadi (zaxira shrift bilan chizilgan)`).toEqual([]);

  const finalPath = new URL(page.url()).pathname;
  expect(finalPath, `Vizual «${scene.id}»: sahifa boshqa yo'lga yo'naltirildi (guard / rol / sessiya)`).toBe(
    routePath(scene.route),
  );

  const capture = scene.capture ?? "content";
  if (capture === "content") await expandToContent(page, scene.maxHeight ?? DEFAULT_MAX_HEIGHT, ready);
  // Suratdan OLDIN: so'rov xato bergan yoki oflayn kutib turgan blok bo'lsa snapshot olinmaydi — xato holati
  // («Internet aloqasi yo'q», «0 ta») jim suratga tushmasin, test aniq sabab bilan yiqilsin.
  if (!scene.allowErrors) {
    expect(
      await queryErrors(page),
      `Vizual «${scene.id}»: xato / oflayn holat chizilgan (data-query-state="error" / ErrorState) — fixture yoki mock'ni tekshiring`,
    ).toEqual([]);
  }
  const mask = [...GLOBAL_MASK, ...(scene.mask ?? [])].map((selector) => page.locator(selector));
  const name = `${scene.id}.png`;
  const baseline = testInfo.snapshotPath(name, { kind: "screenshot" });
  const updateSnapshots = testInfo.config.updateSnapshots;
  const action = snapshotAction({ dry: DRY, updateSnapshots, baselineExists: existsSync(baseline) });
  const shoot = (path?: string) =>
    page.screenshot({
      path,
      fullPage: capture === "content",
      mask,
      animations: "disabled",
      caret: "hide",
      style: readFileSync(SCREENSHOT_CSS, "utf8"),
    });

  if (action === "dry") {
    const out = join(testInfo.project.outputDir, "dry", project);
    mkdirSync(out, { recursive: true });
    await shoot(join(out, name));
    const report = {
      scene: scene.id,
      project,
      route: scene.route,
      finalPath,
      viewport: page.viewportSize(),
      media: await page.evaluate(() => ({
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        dark: matchMedia("(prefers-color-scheme: dark)").matches,
        htmlClass: document.documentElement.className,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        now: new Date().toISOString(),
      })),
      baseline: relative(process.cwd(), baseline),
      baselineExists: existsSync(baseline),
      updateSnapshots,
      unmocked: [...new Set(network.unmocked)],
      writes: network.writes,
      blocked: network.blocked,
      fontErrors: network.fontErrors,
      consoleErrors: errors,
    };
    writeFileSync(join(out, `${scene.id}.json`), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`[visual:dry] ${project}/${scene.id} → test-results-visual/dry/${project}/${name}`);
    if (report.unmocked.length) console.log(`[visual:dry] unmocked GET:\n  ${report.unmocked.join("\n  ")}`);
  } else if (action === "neutral") {
    await testInfo.attach(`${scene.id}-actual.png`, { body: await shoot(), contentType: "image/png" });
  } else {
    await expect(page).toHaveScreenshot(name, {
      fullPage: capture === "content",
      mask,
      ...(scene.maxDiffPixels ? { maxDiffPixels: scene.maxDiffPixels } : {}),
    });
  }

  for (const entry of new Set(network.unmocked)) testInfo.annotations.push({ type: "unmocked", description: entry });
  const allowed = scene.allowConsole ?? [];
  const unexpected = errors.filter((text) => !allowed.some(({ pattern }) => pattern.test(text)));
  expect(network.blocked, `Vizual «${scene.id}»: ruxsatsiz tarmoq so'rovlari (faqat ilova, soxta API, Google Fonts)`).toEqual([]);
  expect(network.writes, `Vizual «${scene.id}»: jadvalda yo'q yozish so'rovlari (sahna faqat o'qiydi)`).toEqual([]);
  // Qayta: sahifa cho'zilgach yangi bo'lak so'ralgan bo'lishi mumkin.
  expect(network.fontErrors, `Vizual «${scene.id}»: Google Fonts bo'laklari olinmadi (zaxira shrift bilan chizilgan)`).toEqual([]);
  expect(unexpected, `Vizual «${scene.id}»: konsol xatolari`).toEqual([]);

  if (action === "neutral") {
    // Baseline hali yo'q (PR yugurishi): solishtirilmadi — test neytral, job yiqilmaydi.
    const description = `baseline yo'q — Run workflow (update) bilan yarating: ${project}/${name}`;
    testInfo.annotations.push({ type: "baseline-missing", description });
    summary(`- baseline yo'q: \`${project}/${name}\` — «Actions → Visual → Run workflow» (update) bilan yarating`);
    test.skip(true, description);
  }
};

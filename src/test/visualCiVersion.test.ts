import { describe, expect, it } from "vitest";
import installed from "@playwright/test/package.json";
import workflowText from "../../.github/workflows/visual.yml?raw";
import lockText from "../../package-lock.json?raw";
import pkg from "../../package.json";

/**
 * VIZUAL SNAPSHOTLAR — CI Docker obrazi = o'rnatilgan Playwright (dizayn v2, 5-bosqich; docs/DESIGN_SYSTEM.md §12.5).
 *
 * Baseline'lar faqat `mcr.microsoft.com/playwright:v<X>-noble` obrazida yaratiladi va solishtiriladi
 * (`.github/workflows/visual.yml`). Obrazdagi brauzerlar aynan shu Playwright versiyasiga tegishli, shuning uchun:
 *  - workflow'dagi HAR obraz tegi (`container.image` va uning nusxasi `VISUAL_IMAGE`) = o'rnatilgan `@playwright/test`
 *    (CI'ning «Playwright versiyasi = Docker obrazi» qadami esa obrazda shu versiya brauzerlari borligini tekshiradi);
 *  - package.json da `@playwright/test` va `playwright` — aniq pin (`^`/`~` siz), package-lock ham shu versiyada.
 * Versiyani ko'tarish = bitta PR'da package.json + package-lock + workflow obrazi + qayta yaratilgan baseline'lar.
 *
 * Qo'shimcha: workflow'ning qat'iy qoidalari (ega/lead qarori): baseline faqat «Run workflow (update)» job'ida
 * yoziladi va faqat u `contents: write` oladi; PR job'i `--update-snapshots=none`; commit'ga faqat
 * `tests/visual/__screenshots__/**` tushadi.
 */

type Lock = {
  packages: Record<
    string,
    { version?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
  >;
};
type Manifest = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

const PLAYWRIGHT_PACKAGES = ["@playwright/test", "playwright", "playwright-core"] as const;
const PINNED = ["@playwright/test", "playwright"] as const;

// ── yordamchilar (sof funksiyalar — pastda sintetik kirish bilan ham sinaladi) ──────────────────────────────

/** Workflow matnidagi barcha `mcr.microsoft.com/playwright:v<versiya>-noble` teglari (izohlardagisi ham). */
const imageVersions = (text: string) =>
  [...text.matchAll(/mcr\.microsoft\.com\/playwright:v([^\s"'`-]+)-noble/g)].map((m) => m[1]);

/** Job matnidagi `<kalit>: mcr.microsoft.com/playwright:v<versiya>-noble` qatorlari (`image`, `VISUAL_IMAGE`). */
const keyedImages = (block: string, key: string) =>
  [...block.matchAll(new RegExp(`^\\s+${key}: mcr\\.microsoft\\.com/playwright:v(\\S+)-noble\\s*$`, "gm"))].map((m) => m[1]);

/** `jobs:` ostidagi har job matni (2 bo'shliqli kalit → keyingisigacha). YAML kutubxonasisiz — tuzilma oddiy. */
function jobBlocks(text: string): Record<string, string> {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  const blocks: Record<string, string> = {};
  if (start < 0) return blocks;
  let current: string | null = null;
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break; // keyingi yuqori darajadagi kalit
    const key = /^ {2}([\w-]+):\s*$/.exec(line);
    if (key) {
      current = key[1];
      blocks[current] = "";
    } else if (current) {
      blocks[current] += `${line}\n`;
    }
  }
  return blocks;
}

/** Versiya mosligi muammolari (bo'sh — hammasi joyida). */
function versionProblems(input: { workflow: string; manifest: Manifest; lock: Lock; installed: string }): string[] {
  const { workflow, manifest, lock, installed: want } = input;
  const problems: string[] = [];
  const images = imageVersions(workflow);
  if (!images.length) problems.push("visual.yml: `mcr.microsoft.com/playwright:v<versiya>-noble` obrazi topilmadi");
  for (const tag of images) {
    if (tag !== want) problems.push(`visual.yml: obraz v${tag}-noble ≠ o'rnatilgan @playwright/test ${want}`);
  }
  const declared = { ...manifest.dependencies, ...manifest.devDependencies };
  const root = lock.packages[""] ?? {};
  const lockDeclared = { ...root.dependencies, ...root.devDependencies };
  for (const name of PINNED) {
    if (declared[name] !== want) {
      problems.push(`package.json: "${name}": "${declared[name]}" — aniq "${want}" bo'lsin (^/~ siz, obraz tegi bilan bir xil)`);
    }
    if (lockDeclared[name] !== want) problems.push(`package-lock.json (root): "${name}": "${lockDeclared[name]}" ≠ "${want}"`);
  }
  for (const name of PLAYWRIGHT_PACKAGES) {
    const version = lock.packages[`node_modules/${name}`]?.version;
    if (version !== want) problems.push(`package-lock.json: node_modules/${name} ${version} ≠ ${want}`);
  }
  return problems;
}

const lock = JSON.parse(lockText) as Lock;
const manifest = pkg as Manifest;
const jobs = jobBlocks(workflowText);

describe("vizual CI — yordamchilar (sintetik kirish)", () => {
  const good = {
    workflow: [
      "jobs:",
      "  visual:",
      "    container:",
      "      image: mcr.microsoft.com/playwright:v1.59.1-noble",
      "    env:",
      "      VISUAL_IMAGE: mcr.microsoft.com/playwright:v1.59.1-noble",
    ].join("\n"),
    manifest: { dependencies: { "@playwright/test": "1.59.1" }, devDependencies: { playwright: "1.59.1" } },
    lock: {
      packages: {
        "": { dependencies: { "@playwright/test": "1.59.1" }, devDependencies: { playwright: "1.59.1" } },
        "node_modules/@playwright/test": { version: "1.59.1" },
        "node_modules/playwright": { version: "1.59.1" },
        "node_modules/playwright-core": { version: "1.59.1" },
      },
    },
    installed: "1.59.1",
  };

  it("hammasi bir versiyada — muammo yo'q", () => {
    expect(versionProblems(good)).toEqual([]);
  });

  it("obraz tegi o'rnatilgan versiyadan farq qilsa — yiqiladi", () => {
    const workflow = good.workflow.replace("v1.59.1-noble", "v1.58.2-noble"); // faqat bittasi (image)
    expect(versionProblems({ ...good, workflow })).toEqual([
      "visual.yml: obraz v1.58.2-noble ≠ o'rnatilgan @playwright/test 1.59.1",
    ]);
  });

  it("npm yangilangan, obraz eski qolgan — yiqiladi", () => {
    const problems = versionProblems({ ...good, installed: "1.60.0" });
    expect(problems.filter((p) => p === "visual.yml: obraz v1.59.1-noble ≠ o'rnatilgan @playwright/test 1.60.0")).toHaveLength(2);
  });

  it("package.json da `^` qolgan yoki lock boshqa versiyada — yiqiladi", () => {
    const manifest = { ...good.manifest, devDependencies: { playwright: "^1.59.1" } };
    expect(versionProblems({ ...good, manifest })).toEqual([
      'package.json: "playwright": "^1.59.1" — aniq "1.59.1" bo\'lsin (^/~ siz, obraz tegi bilan bir xil)',
    ]);
    const lock = { packages: { ...good.lock.packages, "node_modules/playwright-core": { version: "1.59.0" } } };
    expect(versionProblems({ ...good, lock })).toEqual(["package-lock.json: node_modules/playwright-core 1.59.0 ≠ 1.59.1"]);
  });

  it("obraz yo'qolsa — yiqiladi", () => {
    expect(versionProblems({ ...good, workflow: "jobs:\n  visual:\n" })).toEqual([
      "visual.yml: `mcr.microsoft.com/playwright:v<versiya>-noble` obrazi topilmadi",
    ]);
  });

  it("image / VISUAL_IMAGE qatorlari kalit bo'yicha ajratiladi", () => {
    expect(keyedImages(good.workflow, "image")).toEqual(["1.59.1"]);
    expect(keyedImages(good.workflow, "VISUAL_IMAGE")).toEqual(["1.59.1"]);
    expect(keyedImages("      image: node:22", "image")).toEqual([]);
  });

  it("job bloklari: izoh qatorlari va keyingi yuqori kalit hisobga olinmaydi", () => {
    const blocks = jobBlocks(["on: {}", "jobs:", "  # izoh", "  a:", "    x: 1", "  b:", "    y: 2", "other:", "  c:"].join("\n"));
    expect(Object.keys(blocks)).toEqual(["a", "b"]);
    expect(blocks.a).toBe("    x: 1\n");
  });
});

describe("vizual CI — .github/workflows/visual.yml", () => {
  it("Docker obrazi tegi = o'rnatilgan @playwright/test; package.json pin va lock ham shu versiyada", () => {
    expect(versionProblems({ workflow: workflowText, manifest, lock, installed: installed.version })).toEqual([]);
  });

  it("ikkala job ham shu obrazda, VISUAL_IN_DOCKER=1 bilan va versiyani obrazga qarab tekshiradi", () => {
    expect(Object.keys(jobs).sort()).toEqual(["baselines", "visual"]);
    for (const [name, block] of Object.entries(jobs)) {
      expect(keyedImages(block, "image"), `${name}: container.image`).toEqual([installed.version]);
      expect(keyedImages(block, "VISUAL_IMAGE"), `${name}: env.VISUAL_IMAGE (= container.image)`).toEqual([installed.version]);
      expect(block, `${name}: env`).toMatch(/^\s+VISUAL_IN_DOCKER: "1"$/m);
      expect(block, `${name}: «Playwright versiyasi = Docker obrazi» qadami`).toContain("process.env.VISUAL_IMAGE");
    }
  });

  it("PR job'i faqat o'qiydi va solishtiradi; baseline faqat «Run workflow (update)» job'ida", () => {
    const { visual, baselines } = jobs;
    expect(visual).toMatch(/github\.event_name == 'pull_request' && github\.event\.pull_request\.draft == false/);
    expect(visual).toMatch(/^\s+contents: read$/m);
    expect(visual).not.toMatch(/contents: write/);
    expect(visual).toMatch(/--update-snapshots=none/);
    expect(visual).not.toMatch(/--update-snapshots=all/);

    expect(baselines).toMatch(/^\s+if: github\.event_name == 'workflow_dispatch' && inputs\.update$/m);
    expect(baselines).not.toMatch(/pull_request/);
    expect(baselines).toMatch(/^\s+contents: write$/m);
    expect(baselines).toMatch(/--update-snapshots=all/);
  });

  it("baseline commit'i faqat tests/visual/__screenshots__/** ni oladi va main/dev ga push qilmaydi", () => {
    const { baselines } = jobs;
    expect(baselines).toContain("git add -A -- tests/visual/__screenshots__");
    expect(baselines).toContain("grep -v '^tests/visual/__screenshots__/'");
    expect(baselines).toMatch(/main\|dev\)/);
    expect(baselines).toContain("baseline'lar yangilandi [skip ci]");
    // Token .git/config ga yozilmaydi (npm o'rnatish skriptlari uni ko'rmasin) — faqat push qadamida.
    expect(baselines).toMatch(/persist-credentials: false/);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * B2 — YETIM SAHIFA QOLMASIN.
 *
 * Muammo shu edi: `*-ops` sahifalari va `/settlement` kodda bor, marshruti ham
 * bor, lekin UI'da hech qayerdan havola yo'q edi — ularni faqat URL'ni qo'lda
 * yozib ochish mumkin edi. 800 qatordan ortiq ishlaydigan kod foydalanuvchi
 * uchun mavjud emasdi va buni hech narsa ushlab qolmasdi.
 *
 * Bu test aynan o'sha holatning qaytishini to'sadi: har bir ops sahifasi
 * markazdagi tabda, `/settlement` esa menyuda bo'lishi shart.
 */

const ROOT = join(__dirname, "..", "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

/** UI'dan ochilishi SHART bo'lgan sahifalar. */
const OPS_PAGES = [
  "finance-operators",
  "integrations-ops",
  "investors-ops",
  "logistics-ops",
  "branch-ops",
  "identity-ops",
  "system-ops",
];

describe("ops markazi — barcha ichki sahifalar qamralgan", () => {
  const opsSource = read("pages/ops/index.tsx");

  it.each(OPS_PAGES)("%s sahifasi markazda tab sifatida bor", (page) => {
    // Lazy import va eski marshrut eslatmasi — ikkalasi ham bo'lishi kerak.
    expect(opsSource).toContain(`import("../${page}")`);
    expect(opsSource).toContain(`/${page}`);
  });

  it("markazda kutilganidan ortiqcha yoki kam tab yo'q", () => {
    const lazyImports = [...opsSource.matchAll(/import\("\.\.\/([a-z-]+)"\)/g)]
      .map((match) => match[1])
      .sort();

    expect(lazyImports).toEqual([...OPS_PAGES].sort());
  });
});

describe("menyudan ochilishi shart bo'lgan sahifalar", () => {
  const menuSource = read("widgets/Sidebar/model/menuConfig.tsx");

  it.each([
    ["/settlement", "COD hisob-kitobi — pul oqimi ekrani"],
    ["/ops", "ichki xizmat ekranlari markazi"],
  ])("%s menyuda bor (%s)", (path) => {
    expect(menuSource).toContain(`to: "${path}"`);
  });

  it("ikkalasi ham guruhga biriktirilgan", () => {
    expect(menuSource).toContain(`"/settlement": 'finance'`);
    expect(menuSource).toContain(`"/ops": 'system'`);
  });
});

describe("eski marshrutlar buzilmagan", () => {
  const routesSource = read("app/lib/routes.tsx");

  it.each(OPS_PAGES)("/%s marshruti saqlangan", (page) => {
    // Eski havola yoki xatcho'p ishlashda davom etishi kerak — markaz
    // qo'shildi, o'rniga bosmadi.
    expect(routesSource).toContain(`path: "${page}"`);
  });

  it("markazning o'z marshruti ham bor", () => {
    expect(routesSource).toContain(`path: "ops"`);
  });
});

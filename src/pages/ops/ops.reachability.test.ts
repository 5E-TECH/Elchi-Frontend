import { describe, expect, it } from "vitest";
import { OPS_TABS } from "./tabs";
import {
  SIDEBAR_CONFIG,
  SIDEBAR_GROUP_BY_PATH,
} from "../../widgets/Sidebar/model/menuConfig";

/**
 * B2 — YETIM SAHIFA QOLMASIN.
 *
 * Muammo shu edi: `*-ops` sahifalari va `/settlement` kodda bor, marshruti ham
 * bor, lekin UI'da hech qayerdan havola yo'q edi — ularni faqat URL'ni qo'lda
 * yozib ochish mumkin edi. 800 qatordan ortiq ishlaydigan kod foydalanuvchi
 * uchun mavjud emasdi va buni hech narsa ushlab qolmasdi.
 *
 * ⚠️ Bu test ATAYLAB fayl tizimini O'QIMAYDI. Avvalgi variant `node:fs` bilan
 * manba matnini o'qir edi va `npm run build` (`tsc -b`) da yiqildi: test
 * fayllari `tsconfig.vitest.json` ostida kompilyatsiya qilinadi, unda esa
 * `node` turlari yo'q (testlar brauzer muhitida yoziladi degan qoida).
 *
 * Endi tekshiruv MODUL darajasida — bu mustahkamroq ham: matn qidirish emas,
 * haqiqiy qiymatlar solishtiriladi.
 */

/**
 * `src/pages/` ichidagi ops sahifalari — Vite build paytida sanaydi.
 * Yangi `*-ops` papka qo'shilsa, u avtomatik shu ro'yxatga tushadi va
 * markazda tabi yo'q bo'lsa test yiqiladi.
 */
const opsPageModules = import.meta.glob("../*-ops/index.tsx");
/** `finance-operators` nomi naqshga tushmaydi — alohida qo'shiladi. */
const extraOpsPages = ["finance-operators"];

const discoveredDirs = [
  ...Object.keys(opsPageModules).map(
    (path) => path.replace("../", "").replace("/index.tsx", ""),
  ),
  ...extraOpsPages,
].sort();

describe("ops markazi — barcha ichki sahifalar qamralgan", () => {
  it("kodda mavjud har bir ops sahifasi markazda tab sifatida bor", () => {
    const covered = OPS_TABS.map((tab) => tab.pageDir).sort();
    expect(covered).toEqual(discoveredDirs);
  });

  it("markazda mavjud bo'lmagan sahifaga tab yo'q", () => {
    for (const tab of OPS_TABS) {
      expect(discoveredDirs, `${tab.key} tabi`).toContain(tab.pageDir);
    }
  });

  it("tab kalitlari va eski marshrutlar takrorlanmaydi", () => {
    const keys = OPS_TABS.map((tab) => tab.key);
    const paths = OPS_TABS.map((tab) => tab.legacyPath);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("har bir eski marshrut o'z papkasiga mos", () => {
    // `/system-ops` -> `system-ops`. Nomuvofiqlik eski havolani buzardi.
    for (const tab of OPS_TABS) {
      expect(tab.legacyPath).toBe(`/${tab.pageDir}`);
    }
  });
});

describe("menyudan ochilishi shart bo'lgan sahifalar", () => {
  const superadminPaths = SIDEBAR_CONFIG.superadmin.map((item) => item.to);

  it.each([
    ["/settlement", "COD hisob-kitobi — pul oqimi ekrani"],
    ["/ops", "ichki xizmat ekranlari markazi"],
  ])("%s menyuda bor (%s)", (path) => {
    expect(superadminPaths).toContain(path);
  });

  it("ikkalasi ham guruhga biriktirilgan", () => {
    expect(SIDEBAR_GROUP_BY_PATH["/settlement"]).toBe("finance");
    expect(SIDEBAR_GROUP_BY_PATH["/ops"]).toBe("system");
  });
});

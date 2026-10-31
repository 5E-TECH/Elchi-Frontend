import { describe, expect, it } from "vitest";
import { MOVED_OPS_TABS, OPS_TABS } from "./tabs";
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
/**
 * Naqshga (`*-ops`) tushmaydigan, lekin markazga ATAYLAB kiritilgan sahifalar.
 *
 * `finance-operators` — nomi boshqacha, mazmuni ops.
 * `logs`             — ilgari menyuda "Loglar" deb turardi, lekin u jurnal
 *                      EMAS: ichida `POST /auth/refresh` sinov tugmasi bor.
 *                      Nomi bilan mazmuni mos kelmagani uchun operator
 *                      "Loglar"ni bosib haqiqiy jurnalni topolmasdi. Menyudan
 *                      olindi, o'rni — Ops markazi.
 * `expense-categories` — kassa xarajati kategoriyalari sozlamasi («Asosiy
 *                      kassa» oynasidan ko'chirilgan). Hub ichida tug'ilgan —
 *                      to'g'ridan-to'g'ri eski yo'li yo'q.
 * `delivery-tariffs` — «Yetkazish narxi» (tariflar, hisob qoidalari, hajm
 *                      chegarasi). «Hududlar» bo'limining sahifasi
 *                      (`/delivery-tariffs`, admin ham) — hub uni `embedded`
 *                      bilan chizadi; eski ops manzili emas.
 *
 * ⚠️ Bu ro'yxat QO'LDA to'ldiriladi, `*-ops` esa avtomatik sanaladi. Ya'ni
 * yangi `*-ops` papka qo'shilsa va unga tab berilmasa, test HAMON yiqiladi —
 * yetim sahifa kafolati buzilmaydi.
 */
const extraOpsPages = ["finance-operators", "logs", "expense-categories", "delivery-tariffs"];

/** Hub'dan ish sahifasiga ko'chgan vositalar (F2NzXpMv): yetim emas, `/returns` va `/batches` ichida chiziladi. */
const movedOpsPages = ["logistics-ops", "branch-ops"];

const discoveredDirs = [
  ...Object.keys(opsPageModules)
    .map((path) => path.replace("../", "").replace("/index.tsx", ""))
    .filter((dir) => !movedOpsPages.includes(dir)),
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

  it("ko'chgan tablar hub'da yo'q va yangi manzili bor", () => {
    expect(Object.keys(MOVED_OPS_TABS).sort()).toEqual(["branches", "logistics"]);
    expect(OPS_TABS.filter((tab) => tab.key in MOVED_OPS_TABS)).toEqual([]);
  });

  it("tab kalitlari va eski marshrutlar takrorlanmaydi", () => {
    const keys = OPS_TABS.map((tab) => tab.key);
    const paths = OPS_TABS.flatMap((tab) => (tab.legacyPath ? [tab.legacyPath] : []));
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("har bir eski marshrut o'z papkasiga mos", () => {
    // `/system-ops` -> `system-ops`. Nomuvofiqlik eski havolani buzardi.
    for (const tab of OPS_TABS) {
      if (tab.legacyPath === undefined) continue;
      expect(tab.legacyPath).toBe(`/${tab.pageDir}`);
    }
  });

  it("eski yo'lsiz tablar — «Xarajat kategoriyalari» (hub ichida tug'ilgan, moliya guruhida) va «Yetkazish narxi» (Hududlar sahifasi)", () => {
    expect(OPS_TABS.filter((tab) => tab.legacyPath === undefined).map((tab) => tab.key)).toEqual([
      "expense-categories",
      "delivery-pricing",
    ]);
    expect(OPS_TABS.map((tab) => tab.key).slice(0, 2)).toEqual(["finance", "expense-categories"]);
  });
});

describe("menyudan ochilishi shart bo'lgan sahifalar", () => {
  const superadminPaths = SIDEBAR_CONFIG.superadmin.map((item) => item.to);

  it.each([["/ops", "ichki xizmat ekranlari markazi"]])(
    "%s menyuda bor (%s)",
    (path) => {
      expect(superadminPaths).toContain(path);
    },
  );

  it("/ops guruhga biriktirilgan", () => {
    expect(SIDEBAR_GROUP_BY_PATH["/ops"]).toBe("system");
  });

  /**
   * ⭐ /settlement OLIB TASHLANDI. Marketga to'lov endi FIFO (eng eski
   * buyurtmadan) avtomatik yopadi (backend 7AWmSQ1p), qo'lda COD hisob-kitob
   * formasi ortiqcha edi. Menyuda ham, guruh xaritasida ham bo'lmasligi kerak.
   */
  it("/settlement menyudan va guruh xaritasidan olib tashlangan", () => {
    expect(superadminPaths).not.toContain("/settlement");
    expect(SIDEBAR_GROUP_BY_PATH["/settlement"]).toBeUndefined();
  });
});

describe("⭐ 'Loglar' bandi menyudan olib tashlandi (M7)", () => {
  /**
   * Menyuda ikki band turardi: "Faoliyat jurnali" va "Loglar". Ikkinchisi
   * jurnal ko'rsatmaydi — ichida `POST /auth/refresh` sinov tugmasi bor.
   * Biror hodisani tekshirmoqchi bo'lgan operator "Loglar"ni bosib, token
   * yangilash tugmasini ko'rardi.
   *
   * Reja bu ikkisini "Jurnallar" deb BIRLASHTIRISHNI taklif qilgan edi, lekin
   * bu xato bo'lardi: audit jurnaliga diagnostika tugmasini qo'shish holatni
   * yomonlashtirardi. To'g'ri yechim — diagnostikani Ops markaziga ko'chirish.
   */
  it("hech bir rol menyusida `/logs` yo'q", () => {
    const allItems = Object.values(SIDEBAR_CONFIG).flat();
    expect(allItems.some((item) => item.to === "/logs")).toBe(false);
  });

  it("`/logs` guruh xaritasidan ham olindi", () => {
    expect(SIDEBAR_GROUP_BY_PATH["/logs"]).toBeUndefined();
  });

  it("haqiqiy jurnal (`/activity-logs`) menyuda QOLADI", () => {
    // Diagnostikani olib tashlash jurnalni ham yo'qotib qo'ymasligi kerak.
    const allItems = Object.values(SIDEBAR_CONFIG).flat();
    expect(allItems.some((item) => item.to === "/activity-logs")).toBe(true);
    expect(SIDEBAR_GROUP_BY_PATH["/activity-logs"]).toBe("system");
  });

  it("diagnostika Ops markazida tab bo'lib mavjud", () => {
    const tab = OPS_TABS.find((t) => t.legacyPath === "/logs");
    expect(tab).toBeDefined();
    expect(tab!.pageDir).toBe("logs");
  });
});

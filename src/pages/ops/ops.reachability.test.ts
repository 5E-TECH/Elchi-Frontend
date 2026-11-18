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
 * `expense-categories` — kassa xarajati kategoriyalari sozlamasi («Asosiy
 *                      kassa» oynasidan ko'chirilgan). Hub ichida tug'ilgan —
 *                      to'g'ridan-to'g'ri eski yo'li yo'q.
 * `daily-schedule`   — «Kun tartibi» (2026-11-10): buyurtma yaratish / qabul
 *                      chegaralari, kun almashishi, smena jadvali. Hub ichida
 *                      tug'ilgan — eski yo'li yo'q.
 * `payments/shiftSettings` — «Kassa smenasi» (ega 2026-11-16): ilgari
 *                      `/payments/shift-settings` sahifasi, endi hub tabi;
 *                      eski yo'l `routes.tsx` da tabga yo'naltiradi.
 *
 * ⚠️ Bu ro'yxat QO'LDA to'ldiriladi, `*-ops` esa avtomatik sanaladi. Ya'ni
 * yangi `*-ops` papka qo'shilsa va unga tab berilmasa, test HAMON yiqiladi —
 * yetim sahifa kafolati buzilmaydi.
 *
 * LIuf0DcD (ega 2026-11-16, 2026-11-18): «Kirish diagnostikasi» (`pages/logs`), «Xodimlar» (`identity-ops`),
 * «Investorlar» (`investors-ops`) o'chirildi, «Yetkazish narxi» (`delivery-tariffs`) — faqat «Hududlar» sahifasi.
 */
const extraOpsPages = ["expense-categories", "payments/shiftSettings", "daily-schedule"];

/**
 * Hub'dan ish sahifasiga ko'chgan vositalar (F2NzXpMv): yetim emas, `/batches` ichida chiziladi. `logistics-ops`
 * u5HTJtqK da o'chirildi — qaytarish so'rovlari «Pochta → Qaytarish» da.
 */
const movedOpsPages = ["branch-ops"];

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

  it("ko'chgan va olib tashlangan tablar hub'da yo'q va yangi manzili bor", () => {
    expect(Object.keys(MOVED_OPS_TABS).sort()).toEqual([
      "auth",
      "branches",
      "delivery-pricing",
      "finance",
      "identity",
      "integrations",
      "investors",
      "logistics",
    ]);
    expect(OPS_TABS.filter((tab) => tab.key in MOVED_OPS_TABS)).toEqual([]);
  });

  it("LIuf0DcD: olib tashlangan tablar o'rnini bosuvchi sahifaga olib boradi", () => {
    expect(MOVED_OPS_TABS.auth).toBe("/activity-logs");
    expect(MOVED_OPS_TABS.identity).toBe("/all-users");
    expect(MOVED_OPS_TABS.investors).toBe("/all-users?role=investor");
    expect(MOVED_OPS_TABS["delivery-pricing"]).toBe("/delivery-tariffs");
  });

  it("F2qp6FtE: «Moliya operatorlari» (`finance`) — «Market operatorlari» ga (market o'z operatoriga o'zi to'laydi)", () => {
    expect(MOVED_OPS_TABS.finance).toBe("/all-users?role=market_operator");
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

  it("eski yo'lsiz tablar — «Xarajat kategoriyalari» (hub ichida tug'ilgan, moliya guruhida), «Kassa smenasi» (ega 2026-11-16, yo'naltirish routes.tsx da) va «Kun tartibi» (hub ichida tug'ilgan, 2026-11-10)", () => {
    expect(OPS_TABS.filter((tab) => tab.legacyPath === undefined).map((tab) => tab.key)).toEqual([
      "expense-categories",
      "shift-settings",
      "daily-schedule",
    ]);
    // F2qp6FtE: «Moliya operatorlari» olib tashlandi — moliya guruhi «Xarajat kategoriyalari» dan boshlanadi.
    expect(OPS_TABS.map((tab) => tab.key).slice(0, 2)).toEqual(["expense-categories", "shift-settings"]);
    expect(OPS_TABS.map((tab) => tab.key)).not.toContain("finance");
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

  /**
   * LIuf0DcD (ega 2026-11-16): «Kirish diagnostikasi» (token yangilash sinovi) Ops'dan ham olib tashlandi — foydasiz
   * vosita. Eski `/logs` havolasi haqiqiy jurnalga (`/activity-logs`) olib boradi (`routes.tsx`).
   */
  it("diagnostika tabi yo'q — `?tab=auth` haqiqiy jurnalga", () => {
    expect(OPS_TABS.some((t) => t.key === "auth" || t.legacyPath === "/logs")).toBe(false);
    expect(MOVED_OPS_TABS.auth).toBe("/activity-logs");
  });
});

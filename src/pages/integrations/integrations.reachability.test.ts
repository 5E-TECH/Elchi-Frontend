import { describe, expect, it } from "vitest";
import { INTEGRATION_TABS, DEFAULT_INTEGRATION_TAB } from "./tabs";
import {
  SIDEBAR_CONFIG,
  SIDEBAR_GROUP_BY_PATH,
} from "../../widgets/Sidebar/model/menuConfig";

/**
 * B3 — INTEGRATSIYALAR UYI.
 *
 * Muammo shu edi: integratsiya IKKI joyda boshqarilardi va ikkalasi ham
 * "Integratsiyalar" deb nomlanardi — `/partners` (bizga ulanadiganlar) va
 * `/new-orders/integrations` (biz ulanadiganlar). Ikkinchisi kunlik buyurtma
 * ekranining ICHIDA turardi, ya'ni sozlama ishi operatsion yuzada edi.
 *
 * Bu test uyning navigatsiyasi BUTUN qolishini qulflaydi: menyuda bandi bor,
 * guruhi bor, har bir tab noyob va eski yo'llari yozilgan.
 */
describe("Integratsiyalar uyi — navigatsiya butunligi", () => {
  it("menyuda `/integrations` bandi bor (aks holda uy yetim qoladi)", () => {
    const allItems = Object.values(SIDEBAR_CONFIG).flat();
    const found = allItems.filter((item) => item.to === "/integrations");

    expect(found.length).toBeGreaterThan(0);
  });

  it("`/integrations` sidebar guruhiga biriktirilgan", () => {
    // Guruhsiz band menyuda "boshqa" bo'limiga tushib, chalkashlik beradi.
    expect(SIDEBAR_GROUP_BY_PATH["/integrations"]).toBe("integrations");
  });

  it("eski `/partners` bandi menyudan OLIB TASHLANGAN", () => {
    // Bir tushuncha ikki joyda turmasligi kerak — aynan shu chalkashlik
    // tuzatilayotgan muammo edi. Marshrut redirect bilan yashaydi, lekin
    // menyuda ko'rinmaydi.
    const allItems = Object.values(SIDEBAR_CONFIG).flat();

    expect(allItems.some((item) => item.to === "/partners")).toBe(false);
  });

  it("tab kalitlari va yo'llari NOYOB", () => {
    const keys = INTEGRATION_TABS.map((t) => t.key);
    const paths = INTEGRATION_TABS.map((t) => t.path);

    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("har bir tabda izoh va yo'nalish bor", () => {
    // Yo'nalish (`inbound`/`outbound`) — aynan shu farq chalkashgan edi,
    // shuning uchun har bir tab uchun majburiy.
    for (const tab of INTEGRATION_TABS) {
      expect(tab.label.trim().length).toBeGreaterThan(0);
      expect(tab.hint.trim().length).toBeGreaterThan(0);
      expect(["inbound", "outbound", "both"]).toContain(tab.direction);
    }
  });

  it("har bir tab ESKI yo'lini yozib qoldiradi (redirect kerakligi ko'rinsin)", () => {
    for (const tab of INTEGRATION_TABS) {
      expect(tab.legacyPath.startsWith("/")).toBe(true);
    }
  });

  it("standart tab ro'yxatning birinchisi", () => {
    expect(DEFAULT_INTEGRATION_TAB).toBe(INTEGRATION_TABS[0]);
  });

  it("`sources` tabi eski `/new-orders/integrations` o'rnini bosadi", () => {
    // Bu aynan foydalanuvchi ko'rsatgan qoldiq: integratsiya CRUD kunlik
    // buyurtma ekranining ichida edi.
    const sources = INTEGRATION_TABS.find((t) => t.key === "sources");

    expect(sources?.legacyPath).toBe("/new-orders/integrations");
    /**
     * `both` — chunki bu tab ICHIDA har xil rol bo'ladi: yetkazuvchi
     * (bizdan posilka oladi), manba (bizga buyurtma beradi), to'lov, ko'zgu.
     * Avval "outbound" edi va tab "Manbalar" deb nomlangan edi — ikkisi ham
     * xato, chunki mavjud yozuvlar aslida YETKAZUVCHI naqshida ishlaydi.
     */
    expect(sources?.direction).toBe("both");
  });
});

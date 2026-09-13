import { describe, expect, it } from "vitest";
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
 * Bu test uyning navigatsiyasi BUTUN qolishini qulflaydi: menyuda bandi bor
 * va guruhi bor.
 *
 * ⚠️ ILGARI bu yerda `INTEGRATION_TABS` (eski tab metama'lumoti) ham
 * tekshirilardi. UI PCS shakliga o'tganda qobiq o'sha ro'yxatdan voz kechdi
 * va modul faqat SHU TEST tomonidan ishlatilib qoldi — ya'ni test hech
 * nimani qo'riqlamay, "tekshirilgan" tuyg'usini berardi. Shuning uchun
 * o'sha tekshiruvlar va modulning o'zi olib tashlandi.
 *
 * Eski marshrutlar (`/integrations/partners`, `/integrations/sources`)
 * routes.tsx da SAQLANADI — xatcho'plar buzilmaydi.
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

});

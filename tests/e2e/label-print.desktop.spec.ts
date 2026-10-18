import { expect, test, type Page } from "@playwright/test";

/**
 * «Brauzer orqali» yorliq (CKIflHFL) — 100×60 mm varaqda qatorlar ustma-ust tushmaydi, har yorliq alohida
 * chop sahifasi. Yorliq HTML'i ilovaning o'z modulidan olinadi (`openOrdersLabelBrowserPrint`), haqiqiy
 * brauzerda chiziladi va o'lchanadi (jsdom maket chizmaydi). Tashqi so'rovlar (QR xizmati, API) yuborilmaydi.
 */
const ORIGIN = "http://127.0.0.1:4173";

const LONG = {
  id: "53",
  order_number: "EL-100053",
  where_deliver: "address",
  total_price: 1_250_000,
  to_be_paid: 1_285_000,
  createdAt: "2026-10-14T09:30:00.000Z",
  customer: {
    name: "Abdurahmonova Mohinur Abdulazizxon qizi",
    phone_number: "998901234567",
    extra_number: "998977654321",
    region: { name: "Toshkent viloyati" },
    district: { name: "Yangiyo'l tumani" },
  },
  address: "Gulbahor MFY, Mustaqillik ko'chasi 128-uy, 4-podyezd, 37-xonadon",
  landmark: "Eski bozor yonida, ko'k darvozali uy, 3-qavat",
  comment: "Qo'ng'iroq qilib keyin olib boring, tushlikdan keyin uyda bo'ladi",
  market: { name: "TEST Market 37 — Elektronika va maishiy texnika", phone_number: "998712345678" },
  operator: "Operator Dilnoza",
  courier: { name: "Eldor Mahmudov", phone_number: "998935551122" },
  items: [
    { quantity: 2, product: { name: "Samsung Galaxy A55 128GB qora" } },
    { quantity: 1, product: { name: "Himoya oynasi va silikon g'ilof" } },
    { quantity: 3, product: null, product_name: "Zaryadlovchi kabel USB-C 2 metr" },
  ],
};
const SHORT = {
  ...LONG,
  id: "54",
  order_number: "EL-100054",
  customer: { name: "Ali", phone_number: "998901112233", region: { name: "Toshkent sh." }, district: { name: "Chilonzor" } },
  address: "",
  landmark: "",
  comment: "",
  items: [{ quantity: 1, product: { name: "Kitob" } }],
};

const labelHtml = async (page: Page, lang: string) => {
  await page.context().route("**/*", (route) =>
    new URL(route.request().url()).origin === ORIGIN ? route.continue() : route.abort(),
  );
  await page.goto("/login");
  await expect(page.locator("body")).not.toBeEmpty({ timeout: 90_000 });
  const html = await page.evaluate(
    async ([orders, language]) => {
      const i18n = (await import("/src/i18n.ts")).default;
      await i18n.changeLanguage(language);
      const { openOrdersLabelBrowserPrint } = await import("/src/pages/new_orders/components/lib/printLabelPdf.ts");
      let url = "";
      window.open = ((target: string) => {
        url = target;
        return {} as Window;
      }) as typeof window.open;
      openOrdersLabelBrowserPrint(orders as never);
      return fetch(url).then((response) => response.text());
    },
    [[LONG, SHORT], lang] as const,
  );
  // Avtomatik chop oynasi sinovda ochilmaydi; yorliqning o'z skripti (yorliq shriftini sig'dirish) ishlaydi.
  return html.replace("<head>", "<head><script>window.print = () => {}; window.close = () => {};</script>");
};

for (const lang of ["uz", "ru"]) {
  test(`⭐ ${lang}: yuqori/pastki jadval va chap ustun varaqdan toshmaydi, yorliqlar ustunga sig'adi; 2 yorliq — 2 sahifa`, async ({ page }) => {
    const html = await labelHtml(page, lang);
    await page.setContent(html, { waitUntil: "load" });

    const sheets = await page.evaluate(() => {
      const mm = (px: number) => (px / 96) * 25.4;
      return [...document.querySelectorAll(".sheet")].map((sheet) => {
        const box = (selector: string) => sheet.querySelector(selector)!.getBoundingClientRect();
        const left = sheet.querySelector(".left") as HTMLElement;
        return {
          topOverflow: mm(box(".top-table").bottom - box(".label").bottom),
          bottomOverflow: mm(box(".bottom-table").bottom - (sheet.getBoundingClientRect().bottom - (2 * 96) / 25.4)),
          leftOverflow: mm(left.scrollHeight - left.clientHeight),
          wideLabels: [...sheet.querySelectorAll<HTMLElement>("td.k")]
            .filter((cell) => cell.scrollWidth > cell.clientWidth + 1)
            .map((cell) => cell.textContent),
        };
      });
    });

    expect(sheets).toHaveLength(2);
    for (const sheet of sheets) {
      expect(sheet.topOverflow).toBeLessThanOrEqual(0.05);
      expect(sheet.bottomOverflow).toBeLessThanOrEqual(0.05);
      expect(sheet.leftOverflow).toBeLessThanOrEqual(0.05);
      expect(sheet.wideLabels).toEqual([]);
    }

    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).toHaveLength(2);
  });
}

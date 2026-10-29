import { expect, test, type Page } from "@playwright/test";

/**
 * Chek (HJ5sLHiz, maket `tizim-receipts`) — haqiqiy brauzerda: ilovaning o'z moduli (`features/print-receipts`)
 * buyurtma cheklarini termal 100×60 va A4 (12 ta) da, paket chekini A5 da chizadi. Tekshiriladi:
 *  - har chek / varaq alohida chop sahifasi (`page.pdf` sahifalari soni);
 *  - matn sahifa chegarasidan chiqmaydi, chek shriftlari (o'z TTF fayllari) yuklangan;
 *  - brauzer yo'li: yashirin iframe, `print()` chaqiriladi, popup yo'q;
 *  - ilova tashqarisiga birorta so'rov ketmaydi (QR ilova ichida — tashqi QR xizmati yo'q, TZ qabul 4).
 */
const ORIGIN = "http://127.0.0.1:4194";

const order = (id: number, patch: Record<string, unknown> = {}) => ({
  id: String(id),
  order_number: `EL-${100000 + id}`,
  qr_code_token: `${id}`.padStart(24, "a"),
  status: "new",
  where_deliver: "address",
  total_price: 185_000,
  createdAt: "2026-10-23T05:00:00.000Z",
  customer: {
    name: "Dilnoza Karimova",
    phone_number: "998901234567",
    region: { name: "Samarqand" },
    district: { name: "Urgut tumani" },
  },
  address: "Navoiy ko'chasi 14-uy, 3-xonadon, Urgut bozori yonida",
  comment: "Soat 18:00 dan keyin qo'ng'iroq qiling",
  market: { name: "Baraka Shop", phone_number: "998712001122" },
  items: [
    { quantity: 1, product: { name: "Smart soat X8 Pro" } },
    { quantity: 2, product: { name: "Quvvatlagich 20W" } },
  ],
  ...patch,
});

const LONG = order(53, {
  customer: {
    name: "Abdurahmonova Mohinur Abdulazizxon qizi",
    phone_number: "998901234567",
    extra_number: "998977654321",
    region: { name: "Тошкент вилояти" },
    district: { name: "Қибрай тумани" },
  },
  address:
    "Mahtumquli ko'chasi 112-uy, 4-podyezd, 9-qavat, 36-xonadon. Mo'ljal: Yashnobod dehqon bozori ro'parasi",
  comment:
    "Iltimos, avval qo'ng'iroq qiling: uyda faqat soat 18:00 dan keyin bo'lamiz. Domofon ishlamaydi, 4-podyezd oldida kuting yoki qo'shniga (36-xonadon) qoldiring.",
  items: Array.from({ length: 9 }, (_, index) => ({
    quantity: 1,
    product: { name: `Mahsulot nomi ${index + 1}` },
  })),
});

/**
 * Ilova sahifasini ochadi; ilova tashqarisiga so'rovlar to'xtatiladi va yoziladi. Ilova qobig'ining o'zi (index.html —
 * interfeys shrifti) so'raganlari sahifa ochilgach hisobdan chiqariladi: qolgani — chek yo'lining so'rovlari.
 */
const openApp = async (page: Page) => {
  const external: string[] = [];
  const all: string[] = [];
  await page.context().route("**/*", (route) => {
    const url = route.request().url();
    if (new URL(url).origin === ORIGIN || url.startsWith("blob:") || url.startsWith("data:"))
      return route.continue();
    external.push(url);
    all.push(url);
    return route.abort();
  });
  await page.goto("/login");
  await expect(page.locator("body")).not.toBeEmpty({ timeout: 90_000 });
  external.length = 0;
  return { external, all };
};

/** Chek HTML'i — `printOrderReceipts` bilan bir xil yo'l (shriftlar → o'lchov → joylash → `renderReceiptHtml`). */
const receiptHtml = (page: Page, orders: unknown[], sheet: "thermal" | "a4") =>
  page.evaluate(
    async ([items, kind]) => {
      const fonts = await import("/src/features/print-receipts/lib/printReceiptFonts.ts");
      const printing = await import("/src/features/print-receipts/lib/printReceipts.ts");
      const html = await import("/src/features/print-receipts/lib/printReceiptHtml.ts");
      const measure = printing.createReceiptMeasure(await fonts.loadReceiptFontData());
      const pages = await printing.buildOrderReceiptPages(items as never, measure, {
        sheet: kind as never,
      });
      return html.renderReceiptHtml(pages);
    },
    [orders, sheet] as const,
  );

const pdfPages = async (page: Page) => {
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
};

/** Har sahifada matn chegaradan chiqmaydimi; chek shriftlari yuklanganmi. */
const inspect = (page: Page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].filter((face) => face.status === "loaded").length;
    const overflow = [...document.querySelectorAll<HTMLElement>(".p")].flatMap((sheet) => {
      const box = sheet.getBoundingClientRect();
      return [...sheet.querySelectorAll<HTMLElement>(".t")]
        .map((text) => text.getBoundingClientRect())
        .filter((rect) => rect.right > box.right + 0.5 || rect.bottom > box.bottom + 0.5)
        .map((rect) => `${Math.round(rect.right - box.left)}×${Math.round(rect.bottom - box.top)}`);
    });
    return { pages: document.querySelectorAll(".p").length, faces, overflow };
  });

test("⭐ termal 100×60: 1 chek = 1 sahifa, uzun buyurtma 1/2 + 2/2, matn chekdan chiqmaydi, tashqi so'rov yo'q", async ({
  page,
}) => {
  const { external, all } = await openApp(page);
  const html = await receiptHtml(
    page,
    [order(41), LONG, order(42, { qr_code_token: null })],
    "thermal",
  );
  await page.setContent(html, { waitUntil: "load" });

  const result = await inspect(page);
  expect(result.pages).toBeGreaterThanOrEqual(4);
  expect(result.faces).toBeGreaterThanOrEqual(3);
  expect(result.overflow).toEqual([]);
  await expect(page.getByText("№EL-100041")).toBeVisible();
  await expect(page.getByText("QR yo'q")).toBeVisible();
  expect(await pdfPages(page)).toBe(result.pages);
  expect(external).toEqual([]);
  expect(all.filter((url) => /qrserver|create-qr-code/i.test(url))).toEqual([]);
});

test("⭐ A4: 13 ta chek — 2 varaq (12 + 1), kesish chiziqlari, matn katakdan chiqmaydi", async ({
  page,
}) => {
  const { external, all } = await openApp(page);
  const orders = Array.from({ length: 13 }, (_, index) => order(60 + index));
  await page.setContent(await receiptHtml(page, orders, "a4"), { waitUntil: "load" });

  const result = await inspect(page);
  expect(result.pages).toBe(2);
  expect(result.overflow).toEqual([]);
  expect(await page.locator(".p").first().locator("line[stroke-dasharray]").count()).toBe(6);
  expect(await pdfPages(page)).toBe(2);
  expect(external).toEqual([]);
  expect(all.filter((url) => /qrserver|create-qr-code/i.test(url))).toEqual([]);
});

test("⭐ brauzer yo'li: yashirin iframe'da shriftlar yuklanib print() chaqiriladi; paket A5 cheki; popup yo'q", async ({
  page,
}) => {
  const { external, all } = await openApp(page);
  const calls = await page.evaluate(async () => {
    const printed: Array<{ size: string; pages: number; text: string }> = [];
    const opened: string[] = [];
    window.open = ((url: string) => {
      opened.push(String(url));
      return null;
    }) as typeof window.open;
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLIFrameElement)) continue;
          node.addEventListener("load", () => {
            const win = node.contentWindow!;
            win.print = () => {
              const doc = node.contentDocument!;
              printed.push({
                size: doc.querySelector("style")!.textContent!.match(/@page\{size:([^;]+);/)![1],
                pages: doc.querySelectorAll(".p").length,
                text: doc.body.textContent ?? "",
              });
            };
          });
        }
    }).observe(document.body, { childList: true });

    const receipts = await import("/src/features/print-receipts/index.ts");
    const orders = await receipts.printOrderReceipts(
      [
        {
          id: "41",
          qr_code_token: "a".repeat(24),
          total_price: 64_000,
          customer: { name: "Ulug'bek Hasanov", phone_number: "998913846207" },
        },
      ],
      { output: "browser" },
    );
    const pkg = await receipts.printPackageReceipt(
      {
        kind: "batch",
        id: "172",
        token: "BTB-1a2b3c4d5e6f7a8b",
        createdAt: "2026-10-23T09:15:00.000Z",
        from: "Toshkent HQ",
        to: "Samarqand filiali",
        ordersCount: 48,
        totalPrice: 8_640_000,
        driver: { name: "Aziz Rahimov", phone_number: "998901234567" },
        vehiclePlate: "30 A 456 BC",
      },
      { sheet: "a5", output: "browser" },
    );
    return { printed, opened, delivery: [...orders.delivery, ...pkg.delivery] };
  });

  expect(calls.opened).toEqual([]);
  expect(calls.delivery).toEqual(["printed", "printed"]);
  expect(calls.printed).toHaveLength(2);
  expect(calls.printed[0]).toMatchObject({ size: "100mm 60mm", pages: 1 });
  expect(calls.printed[0].text).toContain("№41");
  expect(calls.printed[1]).toMatchObject({ size: "148mm 210mm", pages: 1 });
  expect(calls.printed[1].text).toContain("B-172");
  expect(calls.printed[1].text).toContain("Samarqand filiali");
  expect(external).toEqual([]);
  expect(all.filter((url) => /qrserver|create-qr-code/i.test(url))).toEqual([]);
});

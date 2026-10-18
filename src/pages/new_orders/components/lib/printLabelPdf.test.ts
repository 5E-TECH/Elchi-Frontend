import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiOrder } from "../../model/apiOrder";
import { openOrdersLabelBrowserPrint } from "./printLabelPdf";

/**
 * CKIflHFL — «Brauzer orqali» yorliq (60×100 mm). Maketni jsdom chiza olmaydi: haqiqiy o'lchov
 * `tests/e2e/label-print.desktop.spec.ts` da; bu yerda chop HTML'ining tuzilmasi qulflanadi.
 */
const order = {
  id: "53",
  order_number: "EL-100053",
  where_deliver: "address",
  total_price: 1_250_000,
  to_be_paid: 1_285_000,
  createdAt: "2026-10-14T09:30:00.000Z",
  customer: {
    name: "Abdurahmonova Mohinur <b>Abdulazizxon</b> qizi",
    phone_number: "998901234567",
    extra_number: "998977654321",
    region: { name: "Toshkent viloyati" },
    district: { name: "Yangiyo'l tumani" },
  },
  address: "Gulbahor MFY, Mustaqillik ko'chasi 128-uy",
  comment: "Tushlikdan keyin",
  market: { name: "TEST Market", phone_number: "998712345678" },
  items: [
    { quantity: 2, product: { name: "Samsung Galaxy A55" } },
    { quantity: 3, product: null, product_name: "Kabel USB-C" },
  ],
} as unknown as ApiOrder;

let html = "";

// jsdom'dagi Blob'da `text()` yo'q — FileReader bilan o'qiladi.
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

beforeEach(() => {
  html = "";
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    void readBlob(blob as Blob).then((text) => {
      html = text;
    });
    return "blob:label";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(window, "open").mockReturnValue({} as Window);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const render = async (orders: ApiOrder[]) => {
  openOrdersLabelBrowserPrint(orders);
  await vi.waitFor(() => expect(html).not.toBe(""));
  return new DOMParser().parseFromString(html, "text/html");
};

describe("«Brauzer orqali» yorliq — qatorlar ustma-ust tushmaydi (CKIflHFL)", () => {
  it("⭐ har qator PDF'dagidek qat'iy balandlikda, qiymat o'z katagida kesiladi (1–2 qator)", async () => {
    const doc = await render([order]);
    const sheet = doc.querySelector(".sheet")!;

    expect([...sheet.querySelectorAll(".top-table tr")].map((tr) => tr.className)).toEqual([
      "r-name",
      "r-phone",
      "r-address",
      "r-total",
      "r-sender",
    ]);
    expect([...sheet.querySelectorAll(".bottom-table tr")].map((tr) => tr.className)).toEqual([
      "r-product",
      "r-line",
      "r-line",
      "r-line",
    ]);
    // Har qiymat kesiladigan qobiq ichida — katakdan tashqariga chiqmaydi.
    for (const cell of sheet.querySelectorAll("td.v")) {
      expect(cell.children.length).toBeGreaterThan(0);
      for (const child of cell.children) expect(["one", "two"].some((name) => child.classList.contains(name))).toBe(true);
    }
    // Qo'shimcha telefon va ko'cha — alohida qatorda; mahsulot — ko'pi bilan 2 qator.
    expect(sheet.querySelector(".r-phone .sub")?.textContent).toBe("+998 (97) 765-43-21");
    expect(sheet.querySelector(".r-address .sub")?.textContent).toBe("Gulbahor MFY, Mustaqillik ko'chasi 128-uy");
    expect(sheet.querySelector(".r-product .two")?.textContent).toBe("Samsung Galaxy A55 x2, Kabel USB-C x3");
    // Mijoz matni HTML sifatida emas, matn sifatida.
    expect(sheet.querySelector(".r-name b")).toBeNull();
    expect(sheet.querySelector(".r-name .one")?.textContent).toContain("<b>Abdulazizxon</b>");

    const css = doc.querySelector("style")?.textContent ?? "";
    expect(css).toMatch(/\.v \.one \{[^}]*text-overflow: ellipsis/);
    expect(css).toMatch(/\.v \.two \{[^}]*-webkit-line-clamp: 2/);
    expect(css).toMatch(/\.sheet \{[^}]*overflow: hidden/);
  });

  it("ko'cha yo'q bo'lsa — manzil 2 qatorgacha; qo'shimcha telefon yo'q bo'lsa — telefon yirik, bitta qator", async () => {
    const doc = await render([
      { ...order, address: "", customer: { ...order.customer, extra_number: null } } as unknown as ApiOrder,
    ]);

    expect(doc.querySelector(".r-address .two")?.textContent).toBe("Toshkent viloyati Yangiyo'l tumani");
    expect(doc.querySelector(".r-address .sub")).toBeNull();
    expect(doc.querySelector(".r-phone .big")?.textContent).toBe("+998 (90) 123-45-67");
    expect(doc.querySelector(".r-phone .sub")).toBeNull();
  });

  it("⭐ bir nechta yorliq — har biri alohida sahifa: chop CSS'i `html/body` ni 60 mm da kesmaydi, oxirgisidan keyin bo'sh sahifa yo'q", async () => {
    const doc = await render([order, { ...order, id: "54", order_number: "EL-100054" } as ApiOrder]);
    const css = doc.querySelector("style")?.textContent ?? "";

    expect(doc.querySelectorAll(".sheet")).toHaveLength(2);
    expect(css).not.toMatch(/html,\s*body\s*\{[^}]*height:\s*60mm/);
    expect(css).toMatch(/\.sheet:last-of-type \{[^}]*break-after: auto/);
  });
});

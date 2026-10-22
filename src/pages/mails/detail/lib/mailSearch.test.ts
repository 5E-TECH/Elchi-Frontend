import { describe, expect, it } from "vitest";
import type { PostOrder } from "../../../../entities/mails";
import {
  duplicateSiblings,
  filterMailOrders,
  findDuplicatePhones,
  isPhoneQuery,
  looksLikeTypedSearch,
  normalizeSearchText,
  parseMailSearch,
  valueBeforeScan,
} from "./mailSearch";

const order = (id: string, name: string, phone: string, district: string, market: string) =>
  ({
    id,
    status: "received",
    total_price: 100000,
    where_deliver: "address",
    customer: { id: `c${id}`, name, phone_number: phone },
    district: { id: `d${id}`, name: district },
    market: { id: `m${id}`, name: market },
  }) as unknown as PostOrder;

const ORDERS = [
  order("10212", "Shoxrux Rahmonov", "+998914521830", "Qarshi sh.", "Baraka Shop"),
  order("10209", "Mohira Ergasheva", "+998937180462", "Shahrisabz tumani", "Nur Elektronika"),
  order("10207", "Laylo Hasanova", "998902335179", "Kitob tumani", "Chilonzor Market"),
  order("10192", "Laylo Hasanova", "90 233 51 79", "Kitob tumani", "Baraka Shop"),
  order("10188", "Zarina Usmonova", "+998 93 718 04 62", "Muborak tumani", "Ipak Yo'li Savdo"),
  order("10195", "G‘ulom O'tkirov", "+998884023951", "Yakkabog' tumani", "Chilonzor Market"),
];

const ids = (raw: string) => filterMailOrders(ORDERS, raw).visible.map((item) => item.id);

describe("mailSearch — qidiruv (MD-1)", () => {
  it("bo'sh so'rov — qidiruv yo'q, hammasi ko'rinadi", () => {
    expect(filterMailOrders(ORDERS, "   ")).toEqual({ active: false, visible: ORDERS, byMarket: false });
  });

  it("buyurtma raqami: №, # va raqamning o'zi", () => {
    expect(ids("№10207")).toEqual(["10207"]);
    expect(ids("#10192")).toEqual(["10192"]);
    expect(ids("10209")).toEqual(["10209"]);
  });

  it("telefon: +998 bilan va siz, bo'shliqlar bilan, raqam qismi (parseUzbekPhone)", () => {
    expect(ids("+998 90 233 51 79")).toEqual(["10207", "10192"]);
    expect(ids("902335179")).toEqual(["10207", "10192"]);
    expect(ids("998937180462")).toEqual(["10209", "10188"]);
    expect(ids("718 04")).toEqual(["10209", "10188"]);
  });

  it("ism: registr va apostrof turlari farqsiz", () => {
    expect(ids("laylo")).toEqual(["10207", "10192"]);
    expect(ids("GULOM")).toEqual(["10195"]);
    expect(ids("g'ulom o‘tkirov")).toEqual(["10195"]);
  });

  it("tuman va market nomi; faqat market bo'yicha topilsa — byMarket", () => {
    expect(ids("kitob")).toEqual(["10207", "10192"]);
    expect(ids("yakkabog")).toEqual(["10195"]);
    const market = filterMailOrders(ORDERS, "Baraka");
    expect(market.visible.map((item) => item.id)).toEqual(["10212", "10192"]);
    expect(market.byMarket).toBe(true);
    expect(filterMailOrders(ORDERS, "Laylo").byMarket).toBe(false);
  });

  it("topilmasa — bo'sh ro'yxat, qidiruv faol", () => {
    expect(filterMailOrders(ORDERS, "Dilshod")).toEqual({ active: true, visible: [], byMarket: false });
  });

  it("so'rovni tahlil qilish", () => {
    expect(parseMailSearch("№ 10207")).toMatchObject({ digits: "10207", numberOnly: true, phone: null });
    expect(parseMailSearch("+998 (90) 233-51-79")).toMatchObject({ digits: "998902335179", phone: "902335179" });
    expect(parseMailSearch("Baraka 2")).toMatchObject({ digits: null, text: "baraka 2" });
    expect(normalizeSearchText("  O‘G‘IL   Bola ")).toBe("ogil bola");
  });
});

describe("mailSearch — takroriy telefonlar (ega S1, S2)", () => {
  it("bir xil raqamlar normallashib guruhlanadi (raqam o'sishi tartibida — maketdagidek), yolg'iz raqam guruh emas", () => {
    const groups = findDuplicatePhones(ORDERS);
    // Pochtada «+998 93 …» birinchi uchraydi, lekin chiplar raqam tartibida (maket `*-mails-detail-duplicates`).
    expect(groups).toEqual([
      { key: "902335179", phone: "+998 90 233 51 79", orderIds: ["10207", "10192"] },
      { key: "937180462", phone: "+998 93 718 04 62", orderIds: ["10209", "10188"] },
    ]);
    const siblings = duplicateSiblings(groups);
    expect(siblings.get("10207")).toEqual(["10192"]);
    expect(siblings.get("10212")).toBeUndefined();
  });

  it("bir xil raqamli 3 ta buyurtma (har xil yozilgan) — bitta guruh, ichida 3 ta id; har biriga qolgan ikkitasi (mSix70Ca 83e677)", () => {
    const triple = [
      order("501", "Dilnoza Aliyeva", "+998901112233", "Qarshi sh.", "Baraka Shop"),
      order("502", "Sardor Karimov", "+998935556677", "Kitob tumani", "Nur Elektronika"),
      order("503", "Dilnoza Aliyeva", "90 111 22 33", "Qarshi sh.", "Chilonzor Market"),
      order("504", "D. Aliyeva", "998901112233", "Koson tumani", "Ipak Yo'li Savdo"),
    ];
    const groups = findDuplicatePhones(triple);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual({ key: "901112233", phone: "+998 90 111 22 33", orderIds: ["501", "503", "504"] });
    const siblings = duplicateSiblings(groups);
    expect(siblings.get("501")).toEqual(["503", "504"]);
    expect(siblings.get("503")).toEqual(["501", "504"]);
    expect(siblings.get("504")).toEqual(["501", "503"]);
    expect(siblings.has("502")).toBe(false);
    expect(isPhoneQuery("+998 90 111 22 33", groups[0])).toBe(true);
    expect(filterMailOrders(triple, groups[0].phone).visible.map((item) => item.id)).toEqual(["501", "503", "504"]);
  });

  it("telefonsiz buyurtma takroriy hisoblanmaydi", () => {
    const blank = [order("1", "A", "", "X", "Y"), order("2", "B", "", "X", "Y")];
    expect(findDuplicatePhones(blank)).toEqual([]);
  });

  it("faol chip: so'rov shu raqamning o'zi", () => {
    const [, group] = findDuplicatePhones(ORDERS);
    expect(isPhoneQuery("+998 93 718 04 62", group)).toBe(true);
    expect(isPhoneQuery("937180462", group)).toBe(true);
    expect(isPhoneQuery("93718", group)).toBe(false);
  });

  it("O'zbekiston raqami bo'lmagan takroriy raqam: chip qidiruvi faol deb taniladi (qayta bosish tozalaydi)", () => {
    const foreign = [
      order("1", "A", "+7 912 345 67 89", "X", "Y"),
      order("2", "B", "79123456789", "X", "Y"),
    ];
    const [group] = findDuplicatePhones(foreign);
    expect(group.key).toBe("79123456789");
    expect(isPhoneQuery(group.phone, group)).toBe(true);
    expect(isPhoneQuery("+7 912 345 67 89", group)).toBe(true);
    expect(isPhoneQuery("912345", group)).toBe(false);
    expect(isPhoneQuery("Baraka 79123456789", group)).toBe(false);
    expect(filterMailOrders(foreign, group.phone).visible.map((item) => item.id)).toEqual(["1", "2"]);
  });
});

describe("looksLikeTypedSearch — qidiruvga tez yozib Enter (USB skanerga o'xshaydi)", () => {
  it("shu pochtada ism / tuman / market bo'yicha topiladigan matn — qidiruv", () => {
    expect(looksLikeTypedSearch(ORDERS, "Baraka")).toBe(true);
    expect(looksLikeTypedSearch(ORDERS, "Laylo Hasanova")).toBe(true);
    expect(looksLikeTypedSearch(ORDERS, "kitob tumani")).toBe(true);
  });

  it("raqam, havola, topilmaydigan token — skan («Bu pochtada yo'q»)", () => {
    expect(looksLikeTypedSearch(ORDERS, "102071")).toBe(false);
    expect(looksLikeTypedSearch(ORDERS, "https://elchi.uz/scan/abc123")).toBe(false);
    expect(looksLikeTypedSearch(ORDERS, "QX7K2PZ9")).toBe(false);
    expect(looksLikeTypedSearch(ORDERS, "   ")).toBe(false);
  });
});

describe("valueBeforeScan — USB skan qidiruv maydoniga yozilganda", () => {
  it("tez ketma-ket o'zgarishlar portlashidan oldingi qiymat qaytadi", () => {
    const edits = [
      { before: "", after: "B", at: 1000 },
      { before: "B", after: "Ba", at: 1300 },
      { before: "Ba", after: "Ba1", at: 2000 },
      { before: "Ba1", after: "Ba12", at: 2010 },
      { before: "Ba12", after: "Ba123", at: 2020 },
    ];
    expect(valueBeforeScan(edits, 2030)).toBe("Ba");
  });

  it("oxirgi o'zgarish eski bo'lsa (skaner maydonga yozmagan) — null", () => {
    expect(valueBeforeScan([{ before: "", after: "x", at: 1000 }], 5000)).toBeNull();
    expect(valueBeforeScan([], 5000)).toBeNull();
  });
});

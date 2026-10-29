import type { ReceiptOrderSource } from "./printReceiptModel";
import type { ReceiptPackageSource } from "./printReceiptPackage";

/**
 * Maket `tizim-receipts` (01, 01.B, 02) namunalari — buyurtma / paket manbasi shaklida. Joylash testlari
 * (`printReceiptLayout.test.ts`) ularni maket koordinatalari bilan solishtiradi; `/ops/ui-kit?section=receipts`
 * (`receiptPreview.ts`) ham shularni chizadi. `order_number` yo'q — chekda «№{id}» (maketdagidek «№10241»).
 */

const created = "2026-10-23T05:00:00.000Z";
const token = (seed: string) => seed.padEnd(24, "0").slice(0, 24);

const baraka = { market: { name: "Baraka Shop", phone_number: "+998712001122" } };
const ipak = { market: { name: "Ipak Yo'li Savdo", phone_number: "+998712449012" } };
const nur = { market: { name: "Nur Elektronika", phone_number: "+998712556677" } };
const chilonzor = { market: { name: "Chilonzor Market", phone_number: "+998712304567" } };

const LONG_NAME = "Abdurahmonova Mohinur Abdulazizxon qizi";
const LONG_ADDRESS =
  "Mahtumquli ko'chasi 112-uy, 4-podyezd, 9-qavat, 36-xonadon. Mo'ljal: Yashnobod dehqon bozori ro'parasi, bank filiali yonidagi oq bino";
/** 01.B d — «210 belgili» izoh (maketdagi matn, 205 belgi). */
export const LONG_COMMENT =
  "Iltimos, avval qo'ng'iroq qiling: uyda faqat soat 18:00 dan keyin bo'lamiz. Domofon ishlamaydi, 4-podyezd oldida kuting yoki qo'shniga (36-xonadon) qoldiring. Pulni naqd beramiz, qaytimni tayyorlab keling.";

const item = (name: string, quantity: number) => ({ quantity, product: { name } });

const NINE_HOUSEHOLD = [
  item("Choynak to'plami", 1),
  item("Piyola", 6),
  item("Lagan", 2),
  item("Dazmol", 1),
  item("Blender", 1),
  item("Choy qoshiq to'plami", 1),
  item("Sochiq", 4),
  item("Dasturxon", 1),
  item("Termos 1 l", 1),
];

const NINE_APPLIANCES = [
  item("Kir yuvish mashinasi 7 kg", 1),
  item("Changyutgich", 1),
  item("Elektr choynak", 2),
  item("Dazmol", 1),
  item("Blender", 1),
  item("Tarozi", 1),
  item("Mikroto'lqinli pech", 1),
  item("Choynak to'plami", 1),
  item("Gilam", 2),
];

export const RECEIPT_SAMPLES = {
  /** 01 «Yangi» — anatomiya. */
  main: {
    id: "10241",
    qr_code_token: token("a3f91c07be4d2e58f0c6a1d9"),
    status: "new",
    where_deliver: "address",
    total_price: 185_000,
    createdAt: created,
    customer: {
      name: "Dilnoza Karimova",
      phone_number: "+998901234567",
      region: { name: "Samarqand" },
      district: { name: "Urgut tumani" },
    },
    address: "Navoiy ko'chasi 14-uy, 3-xonadon, Urgut bozori yonida",
    items: [item("Smart soat X8 Pro", 1), item("Quvvatlagich 20W", 2)],
    comment: "Soat 18:00 dan keyin qo'ng'iroq qiling",
    operator_phone: "+998712001122",
    ...baraka,
  },
  /** 01 «Markazgacha, qisman to'langan». */
  partial: {
    id: "10388",
    qr_code_token: token("b1"),
    status: "new",
    where_deliver: "center",
    total_price: 250_000,
    paid_online_amount: 130_000,
    createdAt: "2026-10-22T05:00:00.000Z",
    customer: {
      name: "Shahzoda Olimova",
      phone_number: "+998935551234",
      region: { name: "Farg'ona" },
      district: { name: "Marg'ilon shahri" },
    },
    address: null,
    items: [item("Bolalar krossovkasi, 32-o'lcham", 1)],
    comment: null,
    ...chilonzor,
  },
  /** 01 «Uzun ism, ikki telefon, 6 ta mahsulot». */
  longName: {
    id: "10412",
    qr_code_token: token("c2"),
    status: "new",
    where_deliver: "address",
    total_price: 1_250_000,
    createdAt: created,
    customer: {
      name: LONG_NAME,
      phone_number: "+998973428806",
      extra_number: "+998991981929",
      region: { name: "Toshkent sh." },
      district: { name: "Yashnobod tumani" },
    },
    address: "Mahtumquli ko'chasi 112-uy, 4-podyezd, 9-qavat, 36-xonadon, domofon ishlamaydi",
    items: [
      item("Kir yuvish mashinasi 7 kg", 1),
      item("Changyutgich", 1),
      item("Muzlatgich Artel HD 345 FN", 1),
      item("Dazmol", 1),
      item("Blender", 1),
      item("Tarozi", 1),
    ],
    comment: "Avval qo'ng'iroq qiling, uyda faqat kechqurun bo'lamiz, eshik kodi 4512",
    ...ipak,
  },
  /** 01 «To'liq to'langan». */
  paid: {
    id: "10433",
    qr_code_token: token("d3"),
    status: "new",
    where_deliver: "address",
    total_price: 300_000,
    paid_online_amount: 300_000,
    createdAt: created,
    customer: {
      name: "Nodira Yusupova",
      phone_number: "+998917770315",
      region: { name: "Toshkent sh." },
      district: { name: "Chilonzor tumani" },
    },
    address: "Qatortol ko'chasi 5-uy",
    items: [item("Kitob to'plami", 1)],
    ...nur,
  },
  /** Ega qarori 3: qaytayotgan buyurtma qayta chop etilsa — ramkada «Qaytarish». */
  returning: {
    id: "10455",
    qr_code_token: token("e3"),
    status: "cancelled",
    where_deliver: "address",
    total_price: 410_000,
    createdAt: created,
    customer: {
      name: "Jamshid Qodirov",
      phone_number: "+998946120034",
      region: { name: "Toshkent sh." },
      district: { name: "Mirobod tumani" },
    },
    address: "Amir Temur ko'chasi 41-uy, 7-xonadon",
    items: [item("Simsiz quloqchin", 1)],
    ...nur,
  },
  /** Ega qarori 2: to'liq «№EL-…» (rwAy8Qyk) — 185 000 so'm bilan № 14, summa 14. */
  elNumber: {
    id: "81",
    order_number: "EL-100081",
    qr_code_token: token("ef"),
    status: "new",
    where_deliver: "address",
    total_price: 185_000,
    createdAt: created,
    customer: {
      name: "Dilnoza Karimova",
      phone_number: "+998901234567",
      region: { name: "Samarqand" },
      district: { name: "Urgut tumani" },
    },
    address: "Navoiy ko'chasi 14-uy, 3-xonadon",
    items: [item("Smart soat X8 Pro", 1)],
    operator_phone: "+998712001122",
    ...baraka,
  },
  /** 01.B a — qo'shimcha telefon. */
  a: {
    id: "10244",
    qr_code_token: token("e4"),
    status: "new",
    where_deliver: "address",
    total_price: 340_000,
    createdAt: created,
    customer: {
      name: "Sherzod Nazarov",
      phone_number: "+998973428806",
      extra_number: "+998991981929",
      region: { name: "Buxoro" },
      district: { name: "G'ijduvon tumani" },
    },
    address: "Mustaqillik ko'chasi 27-uy, maktab ro'parasi",
    items: [item("Elektr choynak", 2)],
    comment: "Ikkinchi raqam — turmush o'rtog'i",
    ...ipak,
  },
  /** 01.B b — 9 ta mahsulot. */
  b: {
    id: "10247",
    qr_code_token: token("f5"),
    status: "new",
    where_deliver: "address",
    total_price: 612_000,
    createdAt: created,
    customer: {
      name: "Gulnora Saidova",
      phone_number: "+998909087145",
      region: { name: "Navoiy" },
      district: { name: "Karmana tumani" },
    },
    address: "Tinchlik ko'chasi 3-uy, 12-xonadon",
    items: NINE_HOUSEHOLD,
    ...ipak,
  },
  /** 01.B c — uzun manzil, mo'ljal bilan. */
  c: {
    id: "10251",
    qr_code_token: token("06"),
    status: "new",
    where_deliver: "address",
    total_price: 279_000,
    createdAt: created,
    customer: {
      name: "Bekzod Aliyev",
      phone_number: "+998946153008",
      region: { name: "Toshkent sh." },
      district: { name: "Yashnobod tumani" },
    },
    address: LONG_ADDRESS,
    items: [item("Simsiz quloqchin", 1)],
    ...nur,
  },
  /** 01.B d — uzun izoh (210 belgi). */
  d: {
    id: "10263",
    qr_code_token: token("17"),
    status: "new",
    where_deliver: "address",
    total_price: 330_000,
    createdAt: created,
    customer: {
      name: "Feruza Mamatova",
      phone_number: "+998931015590",
      region: { name: "Jizzax" },
      district: { name: "Zomin tumani" },
    },
    address: "Bog'bon mahallasi 22-uy",
    items: [item("Bolalar kiyimi to'plami", 2)],
    comment: LONG_COMMENT,
    ...baraka,
  },
  /** 01.B e — hammasi birga: 1/2 + 2/2. */
  e: {
    id: "104127",
    qr_code_token: token("28"),
    status: "new",
    where_deliver: "address",
    total_price: 12_500_000,
    createdAt: created,
    customer: {
      name: LONG_NAME,
      phone_number: "+998973428806",
      extra_number: "+998991981929",
      region: { name: "Toshkent sh." },
      district: { name: "Yashnobod tumani" },
    },
    address: LONG_ADDRESS,
    items: NINE_APPLIANCES,
    comment: LONG_COMMENT,
    ...ipak,
  },
  /** 01.B f — qisqa: bitta mahsulot, izohsiz. */
  f: {
    id: "10270",
    qr_code_token: token("39"),
    status: "new",
    where_deliver: "address",
    total_price: 64_000,
    createdAt: created,
    customer: {
      name: "Ulug'bek Hasanov",
      phone_number: "+998913846207",
      region: { name: "Surxondaryo" },
      district: { name: "Termiz shahri" },
    },
    address: "At-Termiziy ko'chasi 6-uy",
    items: [item("Telefon g'ilofi", 2)],
    ...nur,
  },
} satisfies Record<string, ReceiptOrderSource>;

export type ReceiptSampleKey = keyof typeof RECEIPT_SAMPLES;

/** Maket 02: filial paketi (B-172, `BTB-…`) va pochta (№2493, `POST-…`) cheki — termal 100×60 va A5. */
export const RECEIPT_PACKAGE_SAMPLES = {
  batch: {
    kind: "batch",
    id: "172",
    direction: "forward",
    token: "BTB-1a2b3c4d5e6f7a8b",
    createdAt: "2026-10-23T09:15:00.000Z",
    from: "Toshkent HQ",
    to: "Samarqand filiali",
    ordersCount: 48,
    totalPrice: 8_640_000,
    driver: { name: "Aziz Rahimov", phone_number: "998901234567" },
    vehiclePlate: "30 A 456 BC",
  },
  post: {
    kind: "post",
    id: "2493",
    token: "POST-1a2b3c4d5e6f7a8b9c",
    createdAt: "2026-10-23T11:40:00.000Z",
    from: "Toshkent HQ",
    to: "Samarqand viloyati",
    ordersCount: 40,
    totalPrice: 7_420_000,
    courier: { name: "Jasur Tursunov", phone_number: "998905554433" },
  },
} satisfies Record<string, ReceiptPackageSource>;

import { describe, expect, it } from "vitest";
import iconRegistry from "../../../../design/icon-registry.json";
import en from "../../../locales/en/status.json";
import ru from "../../../locales/ru/status.json";
import uz from "../../../locales/uz/status.json";
import type { Tone } from "../../../shared/ui/primitives/tone";
import type { OrderStatus } from "../types/order";
import {
  ORDER_STATUSES,
  ORDER_STATUS_REGISTRY,
  ORDER_STATUS_UNKNOWN_LABEL_KEY,
  humanizeOrderStatus,
  normalizeOrderStatus,
  resolveDisplayOrderStatus,
} from "./statusRegistry";

/**
 * BUYURTMA HOLATI REGISTRI — ega qulflagan tonlar (DESIGN_SYSTEM §8),
 * maketdagi o'zbekcha yorliqlar, kanonik ikonkalar va API yozilishlari.
 */

/** `OrderStatus` turidagi barcha 11 holat — `Record` bo'lgani uchun yangi holat qo'shilsa TS shu yerni ham talab qiladi. */
const ALL: Record<OrderStatus, true> = {
  created: true,
  new: true,
  received: true,
  "on the road": true,
  waiting: true,
  sold: true,
  cancelled: true,
  "cancelled (sent)": true,
  paid: true,
  partly_paid: true,
  closed: true,
};

/** Ega qarori (2026-10-09) — o'zgartirish faqat ega roziligi bilan. */
const LOCKED_TONES: Record<OrderStatus, Tone> = {
  new: "info",
  created: "info",
  received: "info",
  "on the road": "warning",
  waiting: "warning",
  partly_paid: "warning",
  sold: "success",
  paid: "success",
  cancelled: "danger",
  "cancelled (sent)": "danger",
  closed: "neutral",
};

/** Maket matni (`tizim-states-data` «Holat belgilari», DESIGN_SYSTEM §8). */
const UZ_LABELS: Record<OrderStatus, string> = {
  new: "Yangi",
  created: "Yaratilgan",
  received: "Qabul qilindi",
  "on the road": "Yo'lda",
  waiting: "Kutilmoqda",
  partly_paid: "Qisman to'langan",
  sold: "Sotilgan",
  paid: "To'langan",
  cancelled: "Bekor qilingan",
  "cancelled (sent)": "Bekor — jo'natilgan",
  closed: "Yopilgan",
};

const lookup = (locale: object, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale);

const keys = (obj: object, prefix = ""): string[] =>
  Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === "object" ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );

const canonicalIcons = new Set(
  (iconRegistry.groups as Array<{ items: Array<{ icon: string }> }>).flatMap((group) =>
    group.items.map((item) => item.icon),
  ),
);

describe("ORDER_STATUS_REGISTRY", () => {
  it("11 holatning hammasi bor, ortiqchasi yo'q", () => {
    expect(Object.keys(ORDER_STATUS_REGISTRY).sort()).toEqual(Object.keys(ALL).sort());
    expect([...ORDER_STATUSES].sort()).toEqual(Object.keys(ALL).sort());
    expect(new Set(ORDER_STATUSES).size).toBe(11);
  });

  it("ORDER_STATUSES — maketdagi tartib", () => {
    expect(ORDER_STATUSES.map((status) => UZ_LABELS[status])).toEqual([
      "Yangi",
      "Yaratilgan",
      "Qabul qilindi",
      "Yo'lda",
      "Kutilmoqda",
      "Qisman to'langan",
      "Sotilgan",
      "To'langan",
      "Bekor qilingan",
      "Bekor — jo'natilgan",
      "Yopilgan",
    ]);
  });

  it.each(Object.entries(LOCKED_TONES))("%s → %s (qulflangan ton)", (status, tone) => {
    expect(ORDER_STATUS_REGISTRY[status as OrderStatus].tone).toBe(tone);
  });

  it("faqat «Bekor — jo'natilgan» chegarali, qolgani yumshoq", () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_STATUS_REGISTRY[status].variant).toBe(status === "cancelled (sent)" ? "outline" : "soft");
    }
  });

  it("labelKey = order.<key>, key — bo'shliq va qavssiz", () => {
    for (const status of ORDER_STATUSES) {
      const { key, labelKey } = ORDER_STATUS_REGISTRY[status];
      expect(key).toMatch(/^[a-z_]+$/);
      expect(labelKey).toBe(`order.${key}`);
    }
    expect(ORDER_STATUS_REGISTRY["on the road"].key).toBe("on_the_road");
    expect(ORDER_STATUS_REGISTRY["cancelled (sent)"].key).toBe("cancelled_sent");
  });

  it("har ikonka lucide-react va ikonka katalogidagi kanonik nom", () => {
    for (const status of ORDER_STATUSES) {
      const icon = ORDER_STATUS_REGISTRY[status].icon as { displayName?: string };
      expect(icon, status).toBeTruthy();
      expect(canonicalIcons.has(icon.displayName ?? ""), `${status}: ${icon.displayName}`).toBe(true);
    }
  });

  it("holat ikonkalari maketdagi holat tarixi bilan mos", () => {
    const name = (status: OrderStatus) => (ORDER_STATUS_REGISTRY[status].icon as { displayName?: string }).displayName;
    expect(name("new")).toBe("Plus");
    expect(name("received")).toBe("Inbox");
    expect(name("on the road")).toBe("Truck");
    expect(name("waiting")).toBe("Clock");
    expect(name("sold")).toBe("PackageCheck");
    expect(name("cancelled")).toBe("CircleX");
  });
});

describe("status.json — uz/ru/en yorliqlari", () => {
  it.each([
    ["uz", uz],
    ["ru", ru],
    ["en", en],
  ])("%s: har holat va «noma'lum» uchun bo'sh bo'lmagan yorliq", (_lang, locale) => {
    for (const status of ORDER_STATUSES) {
      const label = lookup(locale, ORDER_STATUS_REGISTRY[status].labelKey);
      expect(typeof label, status).toBe("string");
      expect((label as string).trim(), status).not.toBe("");
    }
    expect(lookup(locale, ORDER_STATUS_UNKNOWN_LABEL_KEY)).toEqual(expect.any(String));
  });

  it("ru va en uz bilan bir xil kalitlarga ega", () => {
    expect(keys(ru).sort()).toEqual(keys(uz).sort());
    expect(keys(en).sort()).toEqual(keys(uz).sort());
  });

  it("o'zbekcha yorliqlar maketdagidek", () => {
    for (const status of ORDER_STATUSES) {
      expect(lookup(uz, ORDER_STATUS_REGISTRY[status].labelKey), status).toBe(UZ_LABELS[status]);
    }
  });

  it("bir tilda ikki holat bir xil nomlanmaydi", () => {
    for (const locale of [uz, ru, en]) {
      const labels = ORDER_STATUSES.map((status) => lookup(locale, ORDER_STATUS_REGISTRY[status].labelKey));
      expect(new Set(labels).size).toBe(ORDER_STATUSES.length);
    }
  });
});

describe("normalizeOrderStatus", () => {
  it.each<[unknown, OrderStatus]>([
    ["created", "created"],
    ["new", "new"],
    ["NEW", "new"],
    ["  received  ", "received"],
    ["on the road", "on the road"],
    ["on_the_road", "on the road"],
    ["on-the-road", "on the road"],
    ["ON_THE_ROAD", "on the road"],
    ["On the road", "on the road"],
    ["onTheRoad", "on the road"],
    ["on  the   road", "on the road"],
    ["waiting", "waiting"],
    ["sold", "sold"],
    ["cancelled", "cancelled"],
    ["canceled", "cancelled"],
    ["CANCELLED", "cancelled"],
    ["cancelled (sent)", "cancelled (sent)"],
    ["cancelled_sent", "cancelled (sent)"],
    ["cancelled_(sent)", "cancelled (sent)"],
    ["cancelled sent", "cancelled (sent)"],
    ["canceled (sent)", "cancelled (sent)"],
    ["CANCELLED_SENT", "cancelled (sent)"],
    ["cancelled(sent)", "cancelled (sent)"],
    ["paid", "paid"],
    ["partly_paid", "partly_paid"],
    ["partly paid", "partly_paid"],
    ["PARTLY_PAID", "partly_paid"],
    ["partlyPaid", "partly_paid"],
    ["closed", "closed"],
  ])("%j → %s", (raw, expected) => {
    expect(normalizeOrderStatus(raw)).toBe(expected);
  });

  it("har kanonik qiymat o'ziga qaytadi", () => {
    for (const status of ORDER_STATUSES) expect(normalizeOrderStatus(status)).toBe(status);
  });

  it.each([undefined, null, "", "   ", 5, {}, [], "lost_in_transit", "waiting_customer", "returned_to_market"])(
    "%j → null (mantiq uchun boshqa holatga yaqinlashtirilmaydi)",
    (raw) => {
      expect(normalizeOrderStatus(raw)).toBeNull();
    },
  );
});

describe("resolveDisplayOrderStatus", () => {
  it("normalizeOrderStatus bilan bir xil + backend ichki holatlari", () => {
    expect(resolveDisplayOrderStatus("ON_THE_ROAD")).toBe("on the road");
    expect(resolveDisplayOrderStatus("waiting_customer")).toBe("waiting");
    expect(resolveDisplayOrderStatus("WAITING_CUSTOMER")).toBe("waiting");
    expect(resolveDisplayOrderStatus("returned_to_market")).toBe("cancelled");
    expect(resolveDisplayOrderStatus("lost_in_transit")).toBeNull();
    expect(resolveDisplayOrderStatus(null)).toBeNull();
  });
});

describe("humanizeOrderStatus", () => {
  it.each<[unknown, string | null]>([
    ["lost_in_transit", "Lost in transit"],
    ["lostInTransit", "Lost in transit"],
    ["LOST_IN_TRANSIT", "Lost in transit"],
    ["  ON-HOLD ", "On hold"],
    [42, "42"],
    ["", null],
    ["   ", null],
    [null, null],
    [undefined, null],
    [{}, null],
  ])("%j → %j", (raw, expected) => {
    expect(humanizeOrderStatus(raw)).toBe(expected);
  });
});

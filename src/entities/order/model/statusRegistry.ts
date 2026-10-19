import {
  Banknote,
  CircleCheck,
  CircleX,
  Clock,
  Inbox,
  Lock,
  PackageCheck,
  Plus,
  RotateCcw,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { BadgeVariant } from "../../../shared/ui/primitives/Badge";
import type { Tone } from "../../../shared/ui/primitives/tone";
import type { OrderStatus } from "../types/order";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  BUYURTMA HOLATI REGISTRI — dizayn v2 (yagona manba)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Har holatning toni, yorlig'i (`status` nomlar fazosi) va ikonkasi FAQAT shu
 *  yerdan olinadi — sahifalar o'z rang xaritasini yozmaydi (v1 `statusColorMap`
 *  va `pages/orders/list/OrderStatusBadge` 5-bosqichda o'chirildi).
 *
 *  Tonlar EGA tomonidan qulflangan (`docs/DESIGN_SYSTEM.md` §8,
 *  `design/kit/AUTHORING.md` «Order status → badge»):
 *    Yangi / Yaratilgan / Qabul qilindi → info · Yo'lda / Kutilmoqda /
 *    Qisman to'langan → warning · Sotilgan / To'langan → success ·
 *    Bekor qilingan → danger · Bekor — jo'natilgan → danger + chegarali ·
 *    Yopilgan → neutral · Marketga topshirildi → neutral (ega qarori 2026-10-19:
 *    bekor qilingan posilka marketga qaytdi, zanjir yopildi).
 *
 *  Bekor qilingan buyurtmaning JOY BOSQICHI («Bekor · HQ'da» …) — `cancelReturnStage.ts`.
 *
 *  Ikonka — `design/icon-registry.json` dagi kanonik nom (holat tarixi, filtr
 *  menyusi, ko'rsatkich kartasi uchun). Badge'ning O'ZIDA ikonka yo'q: katalog
 *  qoidasi «Buyurtma holati … badge'lari ikonkasiz — rangli nuqta» va maketdagi
 *  barcha holat belgilari nuqtali (`OrderStatusBadge`).
 */

/** Tarjima kaliti uchun holat nomi (bo'shliq va qavslarsiz). */
export type OrderStatusKey =
  | "new"
  | "created"
  | "received"
  | "on_the_road"
  | "waiting"
  | "partly_paid"
  | "sold"
  | "paid"
  | "cancelled"
  | "cancelled_sent"
  | "closed"
  | "returned_to_market";

export interface OrderStatusMeta {
  /** Tarjima kaliti uchun nom (`status:order.<key>`). */
  key: OrderStatusKey;
  tone: Tone;
  /** `status` nomlar fazosidagi kalit: `t(labelKey, { ns: ORDER_STATUS_NS })`. */
  labelKey: `order.${OrderStatusKey}`;
  icon: LucideIcon;
  /** Badge ko'rinishi: faqat «Bekor — jo'natilgan» chegarali (`.el-badge-outline`). */
  variant: Extract<BadgeVariant, "soft" | "outline">;
}

/** Holat yorliqlari nomlar fazosi: `src/locales/{uz,ru,en}/status.json`. */
export const ORDER_STATUS_NS = "status";

/** Noma'lum yoki bo'sh holat yorlig'i. */
export const ORDER_STATUS_UNKNOWN_LABEL_KEY = "order.unknown";

const meta = (
  key: OrderStatusKey,
  tone: Tone,
  icon: LucideIcon,
  variant: OrderStatusMeta["variant"] = "soft",
): OrderStatusMeta => ({ key, tone, labelKey: `order.${key}`, icon, variant });

export const ORDER_STATUS_REGISTRY: Readonly<Record<OrderStatus, OrderStatusMeta>> = {
  new: meta("new", "info", Plus),
  created: meta("created", "info", Plus),
  received: meta("received", "info", Inbox),
  "on the road": meta("on_the_road", "warning", Truck),
  waiting: meta("waiting", "warning", Clock),
  partly_paid: meta("partly_paid", "warning", Banknote),
  sold: meta("sold", "success", PackageCheck),
  paid: meta("paid", "success", CircleCheck),
  cancelled: meta("cancelled", "danger", CircleX),
  "cancelled (sent)": meta("cancelled_sent", "danger", RotateCcw, "outline"),
  closed: meta("closed", "neutral", Lock),
  returned_to_market: meta("returned_to_market", "neutral", PackageCheck),
};

/**
 * Barcha 12 holat — maketdagi tartibda (`tizim-states-data` «Buyurtma holati»):
 * yangi → jarayonda → bajarildi → bekor → yopilgan; oxirida «Marketga topshirildi»
 * (bekor zanjirining yakuni, `tizim-states-data` §09).
 */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  "new",
  "created",
  "received",
  "on the road",
  "waiting",
  "partly_paid",
  "sold",
  "paid",
  "cancelled",
  "cancelled (sent)",
  "closed",
  "returned_to_market",
];

/**
 * Yozilish shakli → holat. Kalit — `canonicalForm()` natijasi: kichik harf,
 * `_`/`-`/qavs/bo'shliq bitta bo'shliqqa, `canceled` → `cancelled`.
 */
const SPELLINGS: Readonly<Record<string, OrderStatus>> = {
  new: "new",
  created: "created",
  received: "received",
  "on the road": "on the road",
  waiting: "waiting",
  "partly paid": "partly_paid",
  sold: "sold",
  paid: "paid",
  cancelled: "cancelled",
  "cancelled sent": "cancelled (sent)",
  closed: "closed",
  "returned to market": "returned_to_market",
};

/**
 * Backend'ning ichki holatlari — FAQAT KO'RSATISH uchun eng yaqin holatga bog'lanadi
 * (`pages/integrations/statusLabel.ts` bilan bir xil): `waiting_customer` — mijozni
 * kutish, «Kutilmoqda». (`returned_to_market` endi alohida holat — «Marketga topshirildi».)
 */
const DISPLAY_ALIASES: Readonly<Record<string, OrderStatus>> = {
  "waiting customer": "waiting",
};

const canonicalForm = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const form = raw
    .trim()
    // camelCase (`onTheRoad`, `partlyPaid`) → so'zlar
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[\s_()-]+/g, " ")
    .trim()
    .replace(/\bcanceled\b/g, "cancelled");
  return form || null;
};

/**
 * Xom holat qiymatini 11 holatdan biriga keltiradi. Kodda va API'da uchraydigan
 * yozilishlarni qabul qiladi: `on the road` / `on_the_road` / `on-the-road` /
 * `ON_THE_ROAD` / `onTheRoad`; `cancelled (sent)` / `cancelled_sent` /
 * `cancelled_(sent)` / `canceled (sent)` / `cancelled sent`; `partly_paid` /
 * `partly paid`; harf katta-kichikligi va chetdagi bo'shliqlar farq qilmaydi.
 * Noma'lum, bo'sh yoki satr bo'lmagan qiymat — `null`.
 *
 * Mantiq uchun ham xavfsiz: boshqa holatga «yaqinlashtirmaydi»
 * (`waiting_customer` → `null`). Ko'rsatish uchun `resolveDisplayOrderStatus`.
 */
export const normalizeOrderStatus = (raw: unknown): OrderStatus | null => {
  const form = canonicalForm(raw);
  return form ? (SPELLINGS[form] ?? null) : null;
};

/**
 * Badge va yorliq uchun: `normalizeOrderStatus` + backend'ning ichki holatlari
 * (`waiting_customer` → «Kutilmoqda»).
 * Mantiqda (amal ruxsati, filtr) ishlatilmaydi.
 */
export const resolveDisplayOrderStatus = (raw: unknown): OrderStatus | null => {
  const form = canonicalForm(raw);
  if (!form) return null;
  return SPELLINGS[form] ?? DISPLAY_ALIASES[form] ?? null;
};

/**
 * Noma'lum holatni o'qiladigan qilib beradi: `lost_in_transit` / `lostInTransit` → «Lost in transit».
 * Xom qiymat yashirilmaydi (yangi backend holati «holat yo'q» bo'lib ko'rinmasin).
 * Bo'sh yoki satr/son bo'lmagan qiymat — `null` (chaqiruvchi «Noma'lum» yozadi).
 */
export const humanizeOrderStatus = (raw: unknown): string | null => {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const text = String(raw)
    .trim()
    // camelCase ham so'zlarga (`lostInTransit` → «Lost in transit»), `normalizeOrderStatus` kabi
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : null;
};

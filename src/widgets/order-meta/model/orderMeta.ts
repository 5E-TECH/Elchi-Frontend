/**
 * BUYURTMA META — `GET orders/:id` (enriched) javobidan o'qiladigan maydonlar.
 *
 * Backend har so'rovda 50+ maydon yuboradi, detal sahifa esa ularning
 * ko'pini ko'rsatmasdi: "Hozir kimda?", "Kim yetkazyapti?", "Bu buyurtmadan
 * qancha?" savollariga javob yo'q edi. Bu yerda faqat O'QISH va TOZALASH —
 * hech narsa taxmin qilinmaydi: yo'q / buzuq qiymat `null` bo'lib qoladi va UI
 * "—" ko'rsatadi (0 emas).
 *
 * ⚠️ Backend detal javobi kuryer va "hozir kimda" filialining FAQAT id'sini
 * beradi (nomi yo'q) — nomlar alohida so'raladi (`useOrderMetaLookups`).
 */

export type HolderType = "HQ" | "BRANCH" | "COURIER" | "MARKET";

export interface OrderMetaData {
  id: string;
  /** Sotilgan vaqt (backend epoch ms satr yoki ISO beradi). */
  soldAt: Date | null;
  market: { id: string | null; name: string | null; phone: string | null } | null;
  /** Buyurtmaning uy (egasi) filiali — javobda nomi bilan keladi. */
  branch: { id: string | null; name: string | null } | null;
  postId: string | null;
  courierId: string | null;
  holderType: HolderType | null;
  holderBranchId: string | null;
  holderCourierId: string | null;
  whereDeliver: "center" | "address" | null;
  tariffs: {
    marketTariff: number | null;
    courierTariff: number | null;
    courierShare: number | null;
    branchShare: number | null;
  };
  /** Qisman sotuvdan tug'ilgan bo'lsa — asosiy (ota) buyurtma. */
  parentOrderId: string | null;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const id = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** `numeric` satr bo'lib kelishi mumkin. Yo'q / buzuq — `null`, HECH QACHON 0. */
const amount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** `"1784557174975"` (epoch ms satr), raqam yoki ISO. */
const date = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  const raw = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value;
  const parsed = new Date(raw as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const HOLDER_TYPES: readonly HolderType[] = ["HQ", "BRANCH", "COURIER", "MARKET"];

export const readOrderMeta = (raw: unknown): OrderMetaData | null => {
  const order = record(raw);
  const orderId = id(order?.id);
  if (!order || !orderId) return null;

  const market = record(order.market);
  const branch = record(order.branch);
  const holder = text(order.holder_type)?.toUpperCase() ?? null;
  const where = text(order.where_deliver);

  return {
    id: orderId,
    soldAt: date(order.sold_at),
    market: market
      ? { id: id(market.id), name: text(market.name), phone: text(market.phone_number) }
      : null,
    branch: branch ? { id: id(branch.id), name: text(branch.name) } : null,
    postId: id(order.post_id),
    courierId: id(order.courier_id),
    holderType: holder && (HOLDER_TYPES as readonly string[]).includes(holder) ? (holder as HolderType) : null,
    holderBranchId: id(order.holder_branch_id),
    holderCourierId: id(order.holder_courier_id),
    whereDeliver: where === "center" || where === "address" ? where : null,
    tariffs: {
      marketTariff: amount(order.market_tariff),
      courierTariff: amount(order.courier_tariff),
      courierShare: amount(order.courier_share),
      branchShare: amount(order.branch_share),
    },
    parentOrderId: id(order.parent_order_id),
  };
};

export type TariffField = keyof OrderMetaData["tariffs"];

/**
 * TARIF — ROL bo'yicha (maxfiylik):
 *   superadmin / admin / manager → hammasi (tariflar + ulushlar);
 *   market                       → faqat o'z to'lovi (market tarifi);
 *   kuryer                       → faqat o'z tarifi;
 *   qolganlar (registrator, operator...) → hech narsa.
 */
export const visibleTariffs = (role: string | null | undefined): TariffField[] => {
  switch ((role ?? "").toLowerCase()) {
    case "superadmin":
    case "admin":
    case "manager":
      return ["marketTariff", "courierTariff", "courierShare", "branchShare"];
    case "market":
      return ["marketTariff"];
    case "courier":
      return ["courierTariff"];
    default:
      return [];
  }
};

/** Kuryer kontaktini (`GET users/:id`) so'ray oladigan rollar — backend ruxsati bilan bir xil. */
export const canLookupUsers = (role: string | null | undefined) =>
  ["superadmin", "admin", "manager"].includes((role ?? "").toLowerCase());

/** Filial nomini (`GET branches/:id`) so'ray oladigan rollar. */
export const canLookupBranches = (role: string | null | undefined) =>
  ["superadmin", "admin"].includes((role ?? "").toLowerCase());

/** `tel:` havolasi uchun — faqat raqamlar va boshidagi `+`. */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, "")}`;

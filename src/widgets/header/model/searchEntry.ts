import type { GlobalSearchItem } from "../../../features/search/api/useGlobalSearch";

/**
 * Global qidiruv natijasini ko'rinishga tayyorlash: qaysi guruh (maket: «Buyurtmalar», «Foydalanuvchilar»),
 * qayerga olib boradi va qaysi qo'shimcha belgilar bor (buyurtma holati, foydalanuvchi roli).
 *
 * O'tish yo'llari avvalgidek (header'ning eski xulqi): foydalanuvchi → `/all-users/:id`,
 * buyurtma → `/orders/edit/:id`; boshqa turdagi natija hech qayerga olib bormaydi (faqat ro'yxat yopiladi).
 */

export type SearchEntryKind = "orders" | "users" | "other";

export type SearchEntry = {
  /** Ro'yxatdagi kalit (`item.id`). */
  key: string;
  kind: SearchEntryKind;
  /** `null` — o'tish yo'q. */
  href: string | null;
  /** Backend sarlavhasi; buyurtmada «Order #123» bo'lsa `orderId` alohida beriladi (matn locale'dan). */
  title: string;
  orderId: string | null;
  subtitle: string | null;
  /** Buyurtma holati (`metadata.status`) — bo'lsa holat belgisi chiziladi. */
  status: string | null;
  /** Foydalanuvchi roli (`metadata.role` yoki `type`). */
  role: string | null;
  /** Foydalanuvchi telefoni (`metadata.phone_number`). */
  phone: string | null;
  item: GlobalSearchItem;
};

/** Eski header'dagi ro'yxat aynan (identity manbasidan kelgan har natija ham foydalanuvchi). */
const USER_TYPES = new Set(["manager", "courier", "admin", "registrator", "market", "operator", "user"]);

const text = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const ORDER_TITLE = /^order\s*#\s*(.+)$/i;

export const toSearchEntry = (item: GlobalSearchItem): SearchEntry => {
  const sourceId = item.sourceId ?? text(item.raw.sourceId) ?? "";
  const type = (item.type ?? "").toLowerCase();
  const source = (item.source ?? "").toLowerCase();
  const metadata = item.metadata ?? {};

  const isUser = source === "identity" || USER_TYPES.has(type);
  const isOrder = !isUser && (source === "orders" || source === "order" || type === "order");

  if (isUser) {
    return {
      key: item.id,
      kind: "users",
      href: sourceId ? `/all-users/${sourceId}` : null,
      title: item.title,
      orderId: null,
      subtitle: item.subtitle ?? null,
      status: null,
      role: text(metadata.role) ?? (type || null),
      phone: text(metadata.phone_number),
      item,
    };
  }

  if (isOrder) {
    const orderId = sourceId || text(item.raw.order_id) || text(item.raw.id) || "";
    const titleId = ORDER_TITLE.exec(item.title)?.[1]?.trim() ?? null;
    return {
      key: item.id,
      kind: "orders",
      href: orderId ? `/orders/edit/${orderId}` : null,
      title: item.title,
      orderId: titleId,
      subtitle: item.subtitle ?? null,
      status: text(metadata.status),
      role: null,
      phone: null,
      item,
    };
  }

  return {
    key: item.id,
    kind: "other",
    href: null,
    title: item.title,
    orderId: null,
    subtitle: item.subtitle ?? item.type ?? item.source ?? null,
    status: null,
    role: null,
    phone: null,
    item,
  };
};

export const SEARCH_GROUP_ORDER: readonly SearchEntryKind[] = ["orders", "users", "other"];

export type SearchGroup = { kind: SearchEntryKind; entries: SearchEntry[] };

/** Natijalarni maketdagi tartibda guruhlaydi (buyurtmalar → foydalanuvchilar → boshqa); bo'sh guruh tushib qoladi. */
export const groupSearchEntries = (entries: readonly SearchEntry[]): SearchGroup[] =>
  SEARCH_GROUP_ORDER.map((kind) => ({ kind, entries: entries.filter((entry) => entry.kind === kind) })).filter(
    (group) => group.entries.length > 0,
  );

/** Matndagi qidiruv so'zi bo'laklari (ajratib ko'rsatish uchun), katta-kichik harf farqsiz. */
export const splitByQuery = (value: string, query: string): { text: string; match: boolean }[] => {
  const needle = query.trim();
  if (!needle) return [{ text: value, match: false }];
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = value.split(new RegExp(`(${escaped})`, "gi")).filter((part) => part.length > 0);
  return parts.map((part) => ({ text: part, match: part.toLowerCase() === needle.toLowerCase() }));
};

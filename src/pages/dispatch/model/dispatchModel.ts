import { getBackendErrorMessage } from "../../scan/lib/scanResource";

/**
 * «Kuryerga biriktirish» (`/dispatch`) — sof yordamchilar: skanerlangan buyurtma va kuryer javoblarini
 * tozalash, ko'rsatkichlar, kuryer qidiruvi, xato matni. Sahifa holati `../index.tsx` da.
 */

/** Ro'yxatdagi (savatdagi) buyurtma — `GET orders/qr-code/:token` javobidan. */
export type DispatchOrder = {
  id: string;
  /** Skanerlangan token (takrorni aniqlash uchun). */
  token: string;
  market: string | null;
  name: string | null;
  phone: string | null;
  district: string | null;
  region: string | null;
  amount: number;
  /** Xom `where_deliver`: `address` / `home` — uygacha, `center` — markazgacha. */
  deliveryKind: DispatchDeliveryKind | null;
  /** Xom sana (ISO) — `formatDateTimeLocalized` uchun. */
  createdAt: string | null;
  status: string | null;
};

export type DispatchDeliveryKind = "home" | "center";

/** `GET /couriers` elementi (identity: `name`, `phone_number`, `region`). */
export type DispatchCourier = {
  id: string;
  name: string;
  phone: string | null;
  region: string | null;
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" ? (value as UnknownRecord) : {};

const text = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const unwrapOrderPayload = (payload: unknown) => {
  const source = asRecord(payload);
  const responseData = asRecord(source.data ?? source);
  const responsePayload = asRecord(responseData.data ?? responseData);
  return asRecord(responsePayload.order ?? responseData.order ?? responsePayload);
};

export const readDeliveryKind = (value: unknown): DispatchDeliveryKind | null => {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "address" || raw === "home") return "home";
  if (raw === "center") return "center";
  return null;
};

/** Skan javobidan ro'yxat qatori; buyurtma `id` si bo'lmasa — `null`. */
export const normalizeDispatchOrder = (payload: unknown, token: string): DispatchOrder | null => {
  const order = unwrapOrderPayload(payload);
  const id = text(order.id);
  if (!id) return null;

  const market = asRecord(order.market);
  const sender = asRecord(order.sender);
  const customer = asRecord(order.customer);
  const district = asRecord(order.district ?? customer.district);
  const region = asRecord(order.region ?? district.region ?? customer.region);

  return {
    id,
    token,
    market: text(market.name ?? sender.name),
    name: text(customer.fullName ?? customer.full_name ?? customer.name ?? order.customer_name ?? order.name),
    phone: text(customer.phone_number ?? customer.phone ?? order.phone_number ?? order.phone),
    district: text(district.name ?? order.district_name),
    region: text(region.name ?? order.region_name),
    amount: Number(order.total_price ?? 0) || 0,
    deliveryKind: readDeliveryKind(order.where_deliver ?? order.delivery_type ?? order.deliveryType),
    createdAt: text(order.createdAt ?? order.created_at ?? order.updatedAt ?? order.updated_at),
    status: text(order.status),
  };
};

/** Ro'yxat javobining turli shakllari (`{ data: { items } }`, `{ data: [] }` …). */
export const extractList = (payload: unknown): unknown[] => {
  const source = asRecord(payload);
  const data = asRecord(source.data);

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(source.data)) return source.data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.couriers)) return data.couriers;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(source.items)) return source.items;
  if (Array.isArray(source.couriers)) return source.couriers;
  if (Array.isArray(source.rows)) return source.rows;
  if (Array.isArray(source.results)) return source.results;
  return [];
};

export const normalizeCourier = (value: unknown): DispatchCourier | null => {
  const item = asRecord(value);
  const user = asRecord(
    item.user ?? item.employee ?? item.courier ?? item.identity_user ?? item.identityUser ?? item.profile ?? item,
  );
  const id = text(user.id ?? item.user_id ?? item.userId ?? item.courier_id ?? item.courierId ?? item.id);
  const phone = text(user.phone_number ?? user.phone ?? item.phone_number ?? item.phone);
  const name = text(
    user.fullName ?? user.full_name ?? user.name ?? user.username ?? item.fullName ?? item.full_name ?? item.name ?? item.username,
  ) ?? phone;

  if (!id || !name) return null;

  const region = asRecord(user.region ?? item.region);
  return { id, name, phone, region: text(region.name ?? user.region_name ?? item.region_name) };
};

export const extractCouriers = (payload: unknown): DispatchCourier[] =>
  extractList(payload)
    .map(normalizeCourier)
    .filter((courier): courier is DispatchCourier => courier !== null);

export type DispatchStats = {
  total: number;
  selected: number;
  selectedAmount: number;
  home: number;
  homeAmount: number;
  center: number;
  centerAmount: number;
};

/** Ko'rsatkichlar: tanlangan, uygacha, markazgacha (xom `where_deliver` bo'yicha — tarjima matni emas). */
export const getDispatchStats = (
  orders: readonly DispatchOrder[],
  selectedIds: ReadonlySet<string>,
): DispatchStats =>
  orders.reduce<DispatchStats>(
    (stats, order) => {
      stats.total += 1;
      if (selectedIds.has(order.id)) {
        stats.selected += 1;
        stats.selectedAmount += order.amount;
      }
      if (order.deliveryKind === "home") {
        stats.home += 1;
        stats.homeAmount += order.amount;
      } else if (order.deliveryKind === "center") {
        stats.center += 1;
        stats.centerAmount += order.amount;
      }
      return stats;
    },
    { total: 0, selected: 0, selectedAmount: 0, home: 0, homeAmount: 0, center: 0, centerAmount: 0 },
  );

const digits = (value: string) => value.replace(/\D/g, "");

/** Kuryer qidiruvi (yuklangan ≤ 100 ta ichida): ism yoki telefon (raqamlar bo'yicha ham). */
export const filterCouriers = (couriers: readonly DispatchCourier[], query: string): DispatchCourier[] => {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...couriers];
  const needleDigits = digits(needle);
  return couriers.filter((courier) => {
    if (courier.name.toLocaleLowerCase().includes(needle)) return true;
    if (!courier.phone) return false;
    if (courier.phone.toLocaleLowerCase().includes(needle)) return true;
    return needleDigits.length > 0 && digits(courier.phone).includes(needleDigits);
  });
};

/**
 * «{filial} filialining …» uchun filial nomi: oxiridagi «filiali» / «filial» so'zi olib tashlanadi
 * («Urgut filiali» → «Urgut», «Toshkent HQ» → o'zgarmaydi). Bo'sh — `null`.
 */
export const getBranchStem = (branchName: string | null | undefined): string | null => {
  const stem = String(branchName ?? "")
    .trim()
    .replace(/\s+filial(i)?$/i, "")
    .trim();
  return stem || null;
};

type BackendOrderError = {
  order_id?: string | number;
  orderId?: string | number;
  id?: string | number;
  token?: string;
  message?: string;
  error?: string;
};

/** Biriktirish xatosi: buyurtmalar bo'yicha xatolar ro'yxati («10241: …; 10242: …») yoki backend matni. */
export const getDispatchErrorMessage = (error: unknown, fallback: string) => {
  const responseData = asRecord((error as { response?: { data?: unknown } } | null)?.response?.data);
  const errors = responseData.errors ?? responseData.failed ?? responseData.items;

  if (Array.isArray(errors) && errors.length) {
    return errors
      .map((item: BackendOrderError) => {
        const orderLabel = item.order_id ?? item.orderId ?? item.id ?? item.token ?? "—";
        const message = item.message ?? item.error ?? fallback;
        return `${orderLabel}: ${message}`;
      })
      .join("; ");
  }

  return getBackendErrorMessage(error) ?? fallback;
};

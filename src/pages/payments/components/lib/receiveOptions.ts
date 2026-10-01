import { useMemo } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useCashBox } from "../../../../entities/payments";
import { useUser } from "../../../../entities/user/api/userApi";

/**
 * "QABUL QILINISHI KERAK" OYNASI QATORLARI — /payments kartasi va "Asosiy
 * kassa" tezkor amali bitta manbadan foydalanadi (ilgari ikkala sahifada
 * takroriy mapper'lar bor edi).
 *
 * Kim nimani ko'radi:
 *  - superadmin/admin: filial menejerlari (filial kassasi → Asosiy kassa) va
 *    HQ kuryerlari (kuryer kassasi → Asosiy kassa). Filial kuryerlari bu
 *    ro'yxatda HECH QACHON chiqmaydi — ularning puli kuryer → filial
 *    menejeri → HQ yo'li bilan keladi;
 *  - menejer: o'z filiali kuryerlari (avvalgidek).
 *
 * ⚠️ `key` = `${kind}:${id}`. Filial va foydalanuvchi ID lari bitta raqamli
 * fazoda (filial 15 va kuryer 15 bo'lishi mumkin), PopupSelect esa kalitni
 * ham React key, ham tanlov tengligi uchun ishlatadi — `id` bo'yicha
 * kalitlansa, filial 15 ni tanlash kuryer 15 ni ham "tanlangan" qilardi.
 * ⚠️ Satr maydonlari hech qachon undefined emas (standart ''): PopupSelect
 * qidiruvi `String(item[key])` qiladi va "undefined" matniga mos kelib qolardi.
 */
export type ReceiveOptionKind = "branch" | "courier";

export type ReceiveOption = {
  key: string;
  kind: ReceiveOptionKind;
  /** kind=branch → filial ID; kind=courier → kuryer (foydalanuvchi) ID. */
  id: string;
  name: string;
  phone_number: string;
  subtitle: string;
  region: string;
  branch_name: string;
  amount: number;
};

export const RECEIVE_SEARCH_KEYS: (keyof ReceiveOption)[] = [
  "name",
  "phone_number",
  "subtitle",
  "region",
  "branch_name",
];

type Translate = TFunction<"payments">;
type UnknownRecord = Record<string, unknown>;

const FULL_LIST_LIMIT = 10000;

const MANAGER_AMOUNT_KEYS = ["berilishi_kerak", "payable_to_hq", "payableToHq", "amount"];
const COURIER_AMOUNT_KEYS = [
  "olinishi_kerak",
  "to_be_received",
  "toBeReceived",
  "receivable",
  "courier_receivable",
  "balance",
  "amount",
];

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" ? (value as UnknownRecord) : {};

const toText = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const getText = (record: UnknownRecord, ...keys: string[]) => {
  for (const key of keys) {
    const text = toText(record[key]);
    if (text) return text;
  }
  return "";
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getNumber = (record: UnknownRecord, keys: string[], fallback = 0) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return toNumber(value);
  }
  return fallback;
};

const toDataItems = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;

  const record = asRecord(value);
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.data)) return record.data;

  const data = asRecord(record.data);
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;

  return [];
};

/** Ism → telefon → "Foydalanuvchi". Identity'da bitta `name` ustuni bor. */
const resolveName = (record: UnknownRecord, phone: string, t: Translate) =>
  getText(record, "name", "full_name", "fullName") ||
  [toText(record.first_name), toText(record.last_name)].filter(Boolean).join(" ") ||
  phone ||
  t("userFallback");

/** Bir xil kalitli takroriy qatorlar tashlanadi (birinchisi qoladi). */
const uniqueByKey = (options: ReceiveOption[]) => {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.key)) return false;
    seen.add(option.key);
    return true;
  });
};

/**
 * GET /managers → filial qatorlari (`id` = filial ID). HQ (bosh ofis) filiali
 * tashlanadi: HQ'da menejer bo'lmaydi, HQ puli HQ kuryerlari qatorlarida
 * chiqadi, HQ qatorini tanlash esa branch-to-main'ni HQ'ning o'ziga yuborardi.
 */
export const toBranchManagerOptions = (source: unknown, t: Translate): ReceiveOption[] =>
  uniqueByKey(
    toDataItems(source).flatMap((manager): ReceiveOption[] => {
      const m = asRecord(manager);
      const branch = asRecord(m.branch);
      const nestedBranch = asRecord(branch.branch);
      const resolvedBranch = Object.keys(nestedBranch).length ? nestedBranch : branch;
      const branchType = (getText(resolvedBranch, "type") || getText(branch, "type")).toUpperCase();
      if (branchType === "HQ") return [];

      const id =
        getText(m, "branch_id", "branchId") ||
        getText(resolvedBranch, "id") ||
        getText(branch, "id");
      if (!id) return [];

      const region = asRecord(resolvedBranch.region ?? branch.region ?? m.region);
      const cashbox = asRecord(
        resolvedBranch.cashbox ?? branch.cashbox ?? m.cashbox ?? m.cashBox ?? m.cash_box ?? m.kassa,
      );
      const phone = getText(m, "phone_number", "phone");
      const branchName = getText(resolvedBranch, "name");
      const regionName = getText(region, "name") || t("unknown");

      return [
        {
          key: `branch:${id}`,
          kind: "branch",
          id,
          name: resolveName(m, phone, t),
          phone_number: phone,
          subtitle: branchName || regionName,
          region: regionName,
          branch_name: branchName,
          amount: getNumber(m, MANAGER_AMOUNT_KEYS, getNumber(cashbox, MANAGER_AMOUNT_KEYS)),
        },
      ];
    }),
  );

/** GET /couriers (menejer — o'z filiali kuryerlari) → kuryer qatorlari. */
export const toBranchCourierOptions = (source: unknown, t: Translate): ReceiveOption[] =>
  uniqueByKey(
    toDataItems(source).flatMap((courier): ReceiveOption[] => {
      const c = asRecord(courier);
      const id = getText(c, "id");
      if (!id) return [];

      const region = asRecord(c.region);
      const cashbox = asRecord(c.cashbox ?? c.cashBox ?? c.cash_box ?? c.kassa);
      const phone = getText(c, "phone_number", "phone");
      const regionName = getText(region, "name") || t("unknown");

      return [
        {
          key: `courier:${id}`,
          kind: "courier",
          id,
          name: resolveName(c, phone, t),
          phone_number: phone,
          subtitle: regionName,
          region: regionName,
          branch_name: "",
          amount: getNumber(c, COURIER_AMOUNT_KEYS, getNumber(cashbox, COURIER_AMOUNT_KEYS)),
        },
      ];
    }),
  );

/**
 * GET /finance/cashbox/hq-couriers → HQ kuryeri qatorlari. Summa — kuryer
 * kassasidagi pul (HQ kuryerining butun kassasi HQ'ga qarz); superadmin/admin
 * shu summagacha oladi.
 */
export const toHqCourierOptions = (source: unknown, t: Translate): ReceiveOption[] =>
  uniqueByKey(
    toDataItems(source).flatMap((courier): ReceiveOption[] => {
      const c = asRecord(courier);
      const id = getText(c, "id");
      if (!id) return [];

      const phone = getText(c, "phone_number", "phone");
      const label = t("hqCourierLabel");

      return [
        {
          key: `courier:${id}`,
          kind: "courier",
          id,
          name: resolveName(c, phone, t),
          phone_number: phone,
          subtitle: phone ? `${label} · ${phone}` : label,
          region: "",
          branch_name: "",
          amount: getNumber(c, ["balance"], getNumber(asRecord(c.cashbox), ["balance"])),
        },
      ];
    }),
  );

/**
 * Tanlangan qatordan kassa sahifasiga o'tish. Tur (`?type=`) qatorning
 * o'zidan olinadi, roldan EMAS — superadmin ro'yxatida filial ham, kuryer ham bor.
 * `?type=` URL'da ham turadi: F5 / ulashilgan havolada state yo'qoladi.
 */
export const getReceiveDetailTarget = (item: ReceiveOption) => ({
  path: `/payments/cash-detail/${item.id}?type=${item.kind}`,
  state: {
    type: item.kind,
    entity: {
      id: item.id,
      name: item.name,
      phone_number: item.phone_number,
      role: item.kind,
      amount: item.amount,
    },
  },
});

type UseReceiveOptionsParams = {
  isManagerRole: boolean;
  /** Faqat oyna ochiq bo'lganda yuklanadi. */
  enabled: boolean;
};

export const useReceiveOptions = ({ isManagerRole, enabled }: UseReceiveOptionsParams) => {
  const { t } = useTranslation("payments");
  const { useGetManagers, useGetCouriers } = useUser();
  const { useGetHqCourierReceivables } = useCashBox();

  const managersQuery = useGetManagers(
    { status: "active", limit: FULL_LIST_LIMIT },
    enabled && !isManagerRole,
  );
  const hqCouriersQuery = useGetHqCourierReceivables(enabled && !isManagerRole);
  const couriersQuery = useGetCouriers(
    { status: "active", limit: FULL_LIST_LIMIT },
    enabled && isManagerRole,
  );

  const options = useMemo<ReceiveOption[]>(
    () =>
      isManagerRole
        ? toBranchCourierOptions(couriersQuery.data, t)
        : [
            ...toBranchManagerOptions(managersQuery.data, t),
            ...toHqCourierOptions(hqCouriersQuery.data, t),
          ],
    [couriersQuery.data, hqCouriersQuery.data, isManagerRole, managersQuery.data, t],
  );

  return {
    options,
    isLoading: isManagerRole
      ? couriersQuery.isLoading
      : managersQuery.isLoading || hqCouriersQuery.isLoading,
    description: isManagerRole
      ? t("selectCourierDescription")
      : t("selectReceiveSourceDescription"),
  };
};

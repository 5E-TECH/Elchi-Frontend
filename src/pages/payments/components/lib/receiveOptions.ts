import { useMemo } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useCashBox } from "../../../../entities/payments";
import { useUser } from "../../../../entities/user/api/userApi";
import { useBranches } from "../../../../entities/branch/api/useBranches";

/**
 * "QABUL QILINISHI KERAK" OYNASI QATORLARI — /payments kartasi va "Asosiy
 * kassa" tezkor amali bitta manbadan foydalanadi (ilgari ikkala sahifada
 * takroriy mapper'lar bor edi).
 *
 * Kim nimani ko'radi:
 *  - superadmin/admin: filial menejerlari (filial kassasi → Asosiy kassa),
 *    menejeri biriktirilmagan, lekin HQ'ga qarzi bor filiallar va HQ
 *    kuryerlari (kuryer kassasi → Asosiy kassa). Filial kuryerlari bu
 *    ro'yxatda HECH QACHON chiqmaydi — ularning puli kuryer → filial
 *    menejeri → HQ yo'li bilan keladi;
 *  - menejer: o'z filiali kuryerlari (avvalgidek).
 *
 * Faol bo'lmagan (bloklangan) menejer/kuryer ham chiqadi, agar uning summasi
 * noldan farq qilsa (FE-PAY-13, CODE-19): karta summasi ularni ham o'z ichiga
 * oladi, ro'yxatdan yashirilsa pulni UI'dan qabul qilib bo'lmasdi.
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
  /** Menejer/kuryer faol emas (bloklangan) — ro'yxatda belgi bilan ko'rsatiladi. */
  is_inactive: boolean;
};

/**
 * Foydalanuvchi holati (identity: `active` | `inactive`; HQ kuryerlari
 * ro'yxatida `blocked` ham bo'lishi mumkin). Holat kelmasa — faol deb olinadi.
 */
export const isInactiveStatus = (status: unknown) => {
  const value = typeof status === "string" ? status.trim().toLowerCase() : "";
  return Boolean(value) && value !== "active";
};

/**
 * Pul oynalarida qator ko'rsatiladimi: faol qator har doim; faol bo'lmagani —
 * faqat summasi noldan farq qilsa (aks holda ro'yxat bo'sh qatorlarga to'lardi).
 */
export const isListedSettlementRow = (row: { is_inactive: boolean; amount: number }) =>
  !row.is_inactive || row.amount !== 0;

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
 * Faol qatorlar oldinga (barqaror tartib) — bitta filialda eski (bloklangan)
 * va yangi (faol) menejer bo'lsa, takror tashlanganda faoli qoladi.
 */
const activeFirst = (options: ReceiveOption[]) =>
  [...options].sort((left, right) => Number(left.is_inactive) - Number(right.is_inactive));

/**
 * GET /managers → filial qatorlari (`id` = filial ID). HQ (bosh ofis) filiali
 * tashlanadi: HQ'da menejer bo'lmaydi, HQ puli HQ kuryerlari qatorlarida
 * chiqadi, HQ qatorini tanlash esa branch-to-main'ni HQ'ning o'ziga yuborardi.
 */
export const toBranchManagerOptions = (source: unknown, t: Translate): ReceiveOption[] =>
  uniqueByKey(
    activeFirst(
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
            is_inactive: isInactiveStatus(m.status),
          },
        ];
      }),
    ),
  ).filter(isListedSettlementRow);

/**
 * CODE-27: GET /branches (karta summasi bilan bir manba — faol filiallar,
 * `berilishi_kerak` = filialning HQ'ga qarzi) → menejer qatorlarida YO'Q,
 * lekin qarzi bor filiallar. Ilgari karta ularning pulini ham qo'shardi,
 * oynada esa ular umuman chiqmasdi (pulni hech kim tanlay olmasdi).
 */
export const toUnmanagedBranchOptions = (
  source: unknown,
  listedKeys: ReadonlySet<string>,
  t: Translate,
): ReceiveOption[] =>
  uniqueByKey(
    toDataItems(source).flatMap((branch): ReceiveOption[] => {
      const b = asRecord(branch);
      if (getText(b, "type").toUpperCase() === "HQ") return [];
      if (isInactiveStatus(b.status)) return [];

      const id = getText(b, "id");
      const key = `branch:${id}`;
      if (!id || listedKeys.has(key)) return [];

      const amount = getNumber(b, ["berilishi_kerak", "olinishi_kerak"]);
      if (!(amount > 0)) return [];

      const branchName = getText(b, "name");
      const regionName = getText(asRecord(b.region), "name") || t("unknown");

      return [
        {
          key,
          kind: "branch",
          id,
          name: branchName || regionName,
          phone_number: getText(b, "phone_number", "phone"),
          subtitle: t("branchWithoutManager"),
          region: regionName,
          branch_name: branchName,
          amount,
          is_inactive: false,
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
          is_inactive: isInactiveStatus(c.status),
        },
      ];
    }),
  ).filter(isListedSettlementRow);

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
          is_inactive: isInactiveStatus(c.status),
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

/**
 * Karta summasi (`cashbox/all-info` → `branch_managers_receivable`) bilan bir
 * xil manba: faol filiallar ro'yxati. Kalit kassa sahifasidagi so'rov bilan bir
 * xil — kesh ulashiladi va to'lovdan keyin ["branches"] bilan yangilanadi.
 */
export const RECEIVE_BRANCHES_PARAMS = { status: "active", page: 1, limit: 100 } as const;

export const useReceiveOptions = ({ isManagerRole, enabled }: UseReceiveOptionsParams) => {
  const { t } = useTranslation("payments");
  const { useGetManagers, useGetCouriers } = useUser();
  const { useGetHqCourierReceivables } = useCashBox();

  // `status: "active"` YO'Q: bloklangan menejer/kuryerda pul qolgan bo'lsa ham
  // u qabul qilinishi kerak (karta summasi uni o'z ichiga oladi).
  const managersQuery = useGetManagers(
    { limit: FULL_LIST_LIMIT },
    enabled && !isManagerRole,
  );
  const branchesQuery = useBranches({ ...RECEIVE_BRANCHES_PARAMS }, enabled && !isManagerRole);
  const hqCouriersQuery = useGetHqCourierReceivables(enabled && !isManagerRole);
  const couriersQuery = useGetCouriers(
    { limit: FULL_LIST_LIMIT },
    enabled && isManagerRole,
  );

  const options = useMemo<ReceiveOption[]>(() => {
    if (isManagerRole) return toBranchCourierOptions(couriersQuery.data, t);

    const managerRows = toBranchManagerOptions(managersQuery.data, t);
    const listedKeys = new Set(managerRows.map((row) => row.key));
    return [
      ...managerRows,
      ...toUnmanagedBranchOptions(branchesQuery.data, listedKeys, t),
      ...toHqCourierOptions(hqCouriersQuery.data, t),
    ];
  }, [branchesQuery.data, couriersQuery.data, hqCouriersQuery.data, isManagerRole, managersQuery.data, t]);

  return {
    options,
    // Menejersiz filiallar qo'shimcha qatorlar — ularni kutib asosiy ro'yxat
    // ushlab turilmaydi.
    isLoading: isManagerRole
      ? couriersQuery.isLoading
      : managersQuery.isLoading || hqCouriersQuery.isLoading,
    description: isManagerRole
      ? t("selectCourierDescription")
      : t("selectReceiveSourceDescription"),
  };
};

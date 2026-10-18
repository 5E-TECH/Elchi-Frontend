/**
 * KASSA TARIXI YORLIQLARI — «Moliya» sahifalari uchun umumiy (manba turi, to'lov turi, kassa turi, yo'nalish).
 *
 * `getPaymentSourceTypeLabel` — eski (v1) yorliqlar, imzosi va natijasi o'zgarmaydi (boshqa sahifalar, Excel).
 * Dizayn v2 ko'rinishlari `getPaymentSourceTitle` dan foydalanadi: maketdagi matnlar ko'ruvchiga bog'liq —
 * superadmin/admin asosiy kassasida `courier_payment` «Kuryer to'lovi», filial/kuryer kassasida «Kuryerdan
 * filialga o'tkazma»; marketning o'z kassasida `market_payment` «HQ'dan marketga o'tkazma», xodimda «Market to'lovi».
 */
type Translate = (key: string) => string;

const SOURCE_TYPE_KEYS: Record<string, string> = {
  courier_payment: "courierToBranchTransfer",
  market_payment: "hqToMarketTransfer",
  branch_to_main: "branchToMainSource",
  manual_income: "financialBalanceSourceManualIncome",
  manual_expense: "financialBalanceSourceManualExpense",
  correction: "financialBalanceSourceCorrection",
  salary: "financialBalanceSourceSalary",
  sell: "sell",
  cancel: "cancelOperation",
  extra_cost: "extraCost",
  bills: "financialBalanceSourceBills",
};

const humanizeSourceType = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const normalize = (value?: string | null) => (value ?? "").trim().toLowerCase();

export const getPaymentSourceTypeLabel = (
  value?: string | null,
  translate?: (key: string) => string,
) => {
  if (!value) return "—";

  const normalized = value.trim().toLowerCase();
  if (!normalized) return "—";

  const translationKey = SOURCE_TYPE_KEYS[normalized];

  return translationKey && translate
    ? translate(translationKey)
    : humanizeSourceType(normalized);
};

/** Kim ko'ryapti va qaysi kassa qatori — yorliq va yo'nalish shunga qarab tanlanadi. */
export type PaymentViewer = {
  /** Joriy foydalanuvchi roli (`superadmin` | `admin` | `manager` | `market` | `courier` …). */
  role?: string | null;
  /** Qator kassasi (`main` | `couriers` | `markets` | `branch`). */
  cashboxType?: string | null;
};

const isStaffViewer = (role?: string | null) => {
  const value = normalize(role);
  return value === "superadmin" || value === "admin";
};

const isBranchCashbox = (cashboxType?: string | null) => {
  const value = normalize(cashboxType);
  return value === "branch" || value === "branches" || value === "for_branch";
};

/** v2 manba yorlig'i kalitlari (`payments:v2Common.sourceType.*`). */
const V2_SOURCE_KEYS: Record<string, string> = {
  branch_to_main: "v2Common.sourceType.branchToMain",
  manual_income: "v2Common.sourceType.manualIncome",
  manual_expense: "v2Common.sourceType.manualExpense",
  correction: "v2Common.sourceType.correction",
  salary: "v2Common.sourceType.salary",
  sell: "v2Common.sourceType.sell",
  cancel: "v2Common.sourceType.cancel",
  extra_cost: "v2Common.sourceType.extraCost",
  bills: "v2Common.sourceType.bills",
};

/**
 * Dizayn v2 manba yorlig'i (jadval sarlavhasi, tafsilot «Manba turi»). Matnlar maketdagidek:
 * `courier_payment` — superadmin/admin filial bo'lmagan kassada «Kuryer to'lovi», aks holda «Kuryerdan filialga
 * o'tkazma»; `market_payment` — market o'z kassasida «HQ'dan marketga o'tkazma», boshqalarda «Market to'lovi».
 * Noma'lum tur — o'qiladigan ko'rinish («New Source»), bo'sh — «—».
 */
export const getPaymentSourceTitle = (
  value: string | null | undefined,
  translate: Translate,
  viewer: PaymentViewer = {},
) => {
  const normalized = normalize(value);
  if (!normalized) return "—";

  if (normalized === "courier_payment") {
    return translate(
      isStaffViewer(viewer.role) && !isBranchCashbox(viewer.cashboxType)
        ? "v2Common.sourceType.courierPayment"
        : "v2Common.sourceType.courierToBranch",
    );
  }
  if (normalized === "market_payment") {
    return translate(
      normalize(viewer.role) === "market" ? "v2Common.sourceType.hqToMarket" : "v2Common.sourceType.marketPayment",
    );
  }

  const key = V2_SOURCE_KEYS[normalized];
  return key ? translate(key) : humanizeSourceType(normalized);
};

/**
 * Buyurtma bo'yicha manbalar — qator ostida «Buyurtma №{source_id}» (maket). Tuzatishda ham `source_id` buyurtma
 * bo'lishi mumkin, lekin maket uning ostida izohni ko'rsatadi.
 */
export const ORDER_LINKED_SOURCE_TYPES: ReadonlySet<string> = new Set(["sell", "cancel", "extra_cost"]);

export const isOrderLinkedSource = (value?: string | null) => ORDER_LINKED_SOURCE_TYPES.has(normalize(value));

/**
 * To'lov turi: cash → «Naqd», click/card/transfer → «O'tkazma», click_to_market → «Marketga o'tkazma»,
 * payme → «Payme»; noma'lum — qiymatning o'zi, bo'sh — «—». Asosiy kassa sahifasi `click` uchun
 * «Karta (Click)» (`v2Common.paymentMethod.cardClick`) ni o'zi ishlatadi.
 */
export const getPaymentMethodLabel = (value: string | null | undefined, translate: Translate) => {
  const normalized = normalize(value);
  if (!normalized) return "—";
  if (normalized === "cash") return translate("v2Common.paymentMethod.cash");
  if (normalized === "click" || normalized === "card" || normalized === "transfer") {
    return translate("v2Common.paymentMethod.transfer");
  }
  if (normalized === "click_to_market") return translate("v2Common.paymentMethod.toMarket");
  if (normalized === "payme") return translate("v2Common.paymentMethod.payme");
  return String(value).trim();
};

/**
 * Kassa turi: main → «Asosiy kassa», couriers|courier → «Kuryer kassasi», markets|market → «Market kassasi»,
 * branch → «Filial kassasi». Menejer uchun o'z filiali kassasi — «Asosiy kassa» (maket `manager-payments-*`:
 * menejerning asosiy kassasi — filial kassasi). Bo'sh — «—».
 */
export const getCashboxTypeLabel = (
  value: string | null | undefined,
  translate: Translate,
  viewerRole?: string | null,
) => {
  const normalized = normalize(value);
  if (!normalized) return "—";
  if (normalized === "main" || normalized === "hq") return translate("v2Common.cashbox.main");
  if (normalized === "couriers" || normalized === "courier" || normalized === "for_courier") {
    return translate("v2Common.cashbox.courier");
  }
  if (normalized === "markets" || normalized === "market" || normalized === "for_market") {
    return translate("v2Common.cashbox.market");
  }
  if (isBranchCashbox(normalized)) {
    return translate(normalize(viewerRole) === "manager" ? "v2Common.cashbox.main" : "v2Common.cashbox.branch");
  }
  return String(value).trim();
};

export type PaymentDirection = "income" | "expense";

/**
 * Ko'ruvchi nuqtai nazaridagi yo'nalish (ega qarori D2, 2026-10-17): marketning o'z kassasida HQ → market
 * o'tkazmasi (`market_payment`) — «Chiqim −»: market balansi = Elchining qarzi, to'lov uni kamaytiradi.
 * Boshqa rollar va manbalarda — qatorning `operation_type` i. Noma'lum — `null`.
 */
export const getViewerOperationType = (
  row: { operation_type?: string | null; source_type?: string | null } | null | undefined,
  viewerRole?: string | null,
): PaymentDirection | null => {
  if (!row) return null;
  if (normalize(viewerRole) === "market" && normalize(row.source_type) === "market_payment") return "expense";
  const operation = normalize(row.operation_type);
  return operation === "income" || operation === "expense" ? operation : null;
};

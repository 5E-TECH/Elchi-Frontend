export interface FinancialBalanceData {
  currentSituation: number;
  difference: number;
  main: {
    balance: number;
  };
  markets: {
    marketsTotalBalans: number;
    marketsTotalBalance: number;
    items: FinancialBalanceParty[];
  };
  couriers: {
    couriersTotalBalanse: number;
    couriersTotalBalance: number;
    items: FinancialBalanceParty[];
  };
}

type UnknownRecord = Record<string, unknown>;

export interface FinancialBalanceParty {
  id: string;
  name: string;
  location: string;
  balance: number;
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toRecord = (value: unknown): UnknownRecord =>
  isRecord(value) ? value : {};

export const toFinancialNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const pickNumber = (source: UnknownRecord, keys: string[]): number | undefined => {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return toFinancialNumber(source[key]);
    }
  }

  return undefined;
};

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const pickArray = (source: UnknownRecord, keys: string[]): unknown[] => {
  for (const key of keys) {
    const value = source[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
};

const pickText = (source: UnknownRecord, keys: string[]): string => {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
};

const pickRelatedName = (source: UnknownRecord, keys: string[]): string => {
  for (const key of keys) {
    const related = toRecord(source[key]);
    const name = pickText(related, ["name", "full_name", "title"]);

    if (name) {
      return name;
    }
  }

  return "";
};

const uniqueById = (items: FinancialBalanceParty[]): FinancialBalanceParty[] => {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
};

const normalizePartyItems = (items: unknown[], mode: "market" | "courier"): FinancialBalanceParty[] =>
  uniqueById(
    items.map((item, index) => {
      const row = toRecord(item);
      const user = toRecord(row.user);
      const market = toRecord(row.market);
      const region = toRecord(user.region ?? row.region);
      const district = toRecord(user.district ?? row.district);
      const name =
        pickText(user, ["name", "full_name", "phone_number", "phone"]) ||
        pickText(market, ["name", "title"]) ||
        pickText(row, ["name", "title", "phone_number", "phone"]) ||
        `#${index + 1}`;
      const location =
        pickText(region, ["name", "title"]) ||
        pickText(district, ["name", "title"]) ||
        pickRelatedName(row, ["region", "district"]) ||
        "";
      const rawBalance = toFinancialNumber(
        row.balance ?? row.amount ?? row.totalBalance ?? row.totalBalans ?? row.total_balance,
      );
      const balance = mode === "market" ? -Math.abs(rawBalance) : rawBalance;

      return {
        id: String(row.id ?? user.id ?? market.id ?? index),
        name,
        location,
        balance,
      };
    }),
  ).filter((item) => item.name);

const pickPartyItems = (
  source: unknown,
  payload: UnknownRecord,
  nestedKeys: string[],
  rootKeys: string[],
): unknown[] => {
  if (Array.isArray(source)) {
    return source.concat(rootKeys.flatMap((key) => toArray(payload[key])));
  }

  const record = toRecord(source);

  return pickArray(record, nestedKeys).concat(rootKeys.flatMap((key) => toArray(payload[key])));
};

export const normalizeFinancialBalance = (response: unknown): FinancialBalanceData | null => {
  const responseRecord = toRecord(response);
  const payload = toRecord(responseRecord.data ?? responseRecord);
  const main = toRecord(payload.main ?? payload.cashbox ?? payload.mainCashbox);
  const mainCashbox = toRecord(main.cashbox);
  const markets = toRecord(payload.markets ?? payload.market);
  const couriers = toRecord(payload.couriers ?? payload.courier);
  const marketItems = normalizePartyItems(
    pickPartyItems(
      payload.markets ?? payload.market,
      payload,
      [
        "allMarketCashboxes",
        "marketCashboxes",
        "marketBalances",
        "marketBalanses",
        "items",
        "data",
        "list",
      ],
      ["allMarketCashboxes", "marketCashboxes"],
    ),
    "market",
  );
  const courierItems = normalizePartyItems(
    pickPartyItems(
      payload.couriers ?? payload.courier,
      payload,
      [
        "allCourierCashboxes",
        "courierCashboxes",
        "courierBalances",
        "courierBalanses",
        "items",
        "data",
        "list",
      ],
      ["allCourierCashboxes", "courierCashboxes"],
    ),
    "courier",
  );

  const cashBalanceValue =
    pickNumber(main, ["balance", "totalBalance", "total_balans", "totalBalanceUz"]) ??
    pickNumber(mainCashbox, ["balance", "totalBalance"]) ??
    pickNumber(payload, ["cashboxBalance", "mainBalance", "mainCashboxTotal"]);

  const marketsBalanceValue =
    pickNumber(markets, [
      "marketsTotalBalans",
      "marketsTotalBalance",
      "marketsTotalBalanse",
      "totalBalance",
      "totalBalans",
      "balance",
      "amount",
    ]) ??
    pickNumber(payload, ["marketsTotalBalans", "marketsTotalBalance", "marketCashboxTotal"]);

  const couriersBalanceValue =
    pickNumber(couriers, [
      "couriersTotalBalanse",
      "couriersTotalBalance",
      "couriersTotalBalans",
      "totalBalance",
      "totalBalans",
      "balance",
      "amount",
    ]) ??
    pickNumber(payload, ["couriersTotalBalanse", "couriersTotalBalance", "courierCashboxTotal"]);

  const totalValue = pickNumber(payload, [
    "currentSituation",
    "current_situation",
    "difference",
    "totalBalance",
    "totalBalans",
    "balance",
  ]);

  if (
    cashBalanceValue === undefined &&
    marketsBalanceValue === undefined &&
    couriersBalanceValue === undefined &&
    totalValue === undefined
  ) {
    return null;
  }

  const cashBalance = cashBalanceValue ?? 0;
  const marketsBalance =
    marketsBalanceValue ?? marketItems.reduce((sum, item) => sum + item.balance, 0);
  const couriersBalance =
    couriersBalanceValue ?? courierItems.reduce((sum, item) => sum + item.balance, 0);
  const computedTotal = cashBalance + marketsBalance + couriersBalance;
  const total = totalValue ?? computedTotal;

  return {
    currentSituation: total,
    difference: total,
    main: {
      balance: cashBalance,
    },
    markets: {
      marketsTotalBalans: marketsBalance,
      marketsTotalBalance: marketsBalance,
      items: marketItems,
    },
    couriers: {
      couriersTotalBalanse: couriersBalance,
      couriersTotalBalance: couriersBalance,
      items: courierItems,
    },
  };
};

export const extractFinancialLedgerItems = (response: unknown): unknown[] => {
  const responseRecord = toRecord(response);
  const body = responseRecord.data ?? response;

  if (Array.isArray(body)) {
    return body;
  }

  const payload = toRecord(body);
  const directItems = pickArray(payload, [
    "items",
    "data",
    "list",
    "entries",
    "transactions",
    "topImpacts",
    "top_impacts",
    "impacts",
    "history",
    "ledger",
  ]);

  if (directItems.length) {
    return directItems;
  }

  for (const key of ["history", "ledger", "records", "result"]) {
    const nested = toRecord(payload[key]);
    const nestedItems = pickArray(nested, [
      "items",
      "data",
      "list",
      "entries",
      "transactions",
      "topImpacts",
      "top_impacts",
      "impacts",
    ]);

    if (nestedItems.length) {
      return nestedItems;
    }
  }

  return [];
};

export const extractFinancialLedgerPagination = (response: unknown): Record<string, unknown> | undefined => {
  const responseRecord = toRecord(response);
  const payload = toRecord(responseRecord.data ?? responseRecord);

  for (const source of [
    payload,
    toRecord(payload.history),
    toRecord(payload.ledger),
    toRecord(payload.records),
    toRecord(payload.result),
  ]) {
    const pagination = toRecord(source.pagination ?? source.meta);

    if (Object.keys(pagination).length) {
      return pagination;
    }
  }

  return undefined;
};

export const formatFinancialAmount = (value: number, separator: "space" | "comma" = "space") => {
  const formatted = value.toLocaleString("ru-RU");
  return separator === "comma" ? formatted.replace(/\s/g, ",") : formatted.replace(/\s/g, " ");
};

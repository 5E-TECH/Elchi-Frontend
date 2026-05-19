export interface FinancialBalanceData {
  currentSituation: number;
  difference: number;
  main: {
    balance: number;
  };
  markets: {
    marketsTotalBalans: number;
    marketsTotalBalance: number;
  };
  couriers: {
    couriersTotalBalanse: number;
    couriersTotalBalance: number;
  };
}

type UnknownRecord = Record<string, unknown>;

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

export const normalizeFinancialBalance = (response: unknown): FinancialBalanceData => {
  const responseRecord = toRecord(response);
  const payload = toRecord(responseRecord.data ?? responseRecord);
  const main = toRecord(payload.main ?? payload.cashbox ?? payload.mainCashbox);
  const mainCashbox = toRecord(main.cashbox);
  const markets = toRecord(payload.markets ?? payload.market);
  const couriers = toRecord(payload.couriers ?? payload.courier);

  const cashBalance =
    pickNumber(main, ["balance", "totalBalance", "total_balans", "totalBalanceUz"]) ??
    pickNumber(mainCashbox, ["balance", "totalBalance"]) ??
    pickNumber(payload, ["cashboxBalance", "mainBalance", "mainCashboxTotal"]) ??
    0;

  const marketsBalance =
    pickNumber(markets, [
      "marketsTotalBalans",
      "marketsTotalBalance",
      "marketsTotalBalanse",
      "totalBalance",
      "totalBalans",
      "balance",
      "amount",
    ]) ??
    pickNumber(payload, ["marketsTotalBalans", "marketsTotalBalance", "marketCashboxTotal"]) ??
    0;

  const couriersBalance =
    pickNumber(couriers, [
      "couriersTotalBalanse",
      "couriersTotalBalance",
      "couriersTotalBalans",
      "totalBalance",
      "totalBalans",
      "balance",
      "amount",
    ]) ??
    pickNumber(payload, ["couriersTotalBalanse", "couriersTotalBalance", "courierCashboxTotal"]) ??
    0;

  const computedTotal = cashBalance + marketsBalance + couriersBalance;
  const total =
    pickNumber(payload, [
      "currentSituation",
      "current_situation",
      "difference",
      "totalBalance",
      "totalBalans",
      "balance",
    ]) ?? computedTotal;

  return {
    currentSituation: total,
    difference: total,
    main: {
      balance: cashBalance,
    },
    markets: {
      marketsTotalBalans: marketsBalance,
      marketsTotalBalance: marketsBalance,
    },
    couriers: {
      couriersTotalBalanse: couriersBalance,
      couriersTotalBalance: couriersBalance,
    },
  };
};

export const formatFinancialAmount = (value: number, separator: "space" | "comma" = "space") => {
  const formatted = value.toLocaleString("ru-RU");
  return separator === "comma" ? formatted.replace(/\s/g, ",") : formatted.replace(/\s/g, " ");
};

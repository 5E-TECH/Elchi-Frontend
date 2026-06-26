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

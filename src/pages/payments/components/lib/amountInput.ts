export const normalizeAmountInput = (value: string) => value.replace(/\D/g, "");

export const parseAmountInput = (value?: string | null) => {
  const normalized = normalizeAmountInput(value ?? "");
  return normalized ? Number(normalized) : 0;
};

export const formatAmountInput = (value?: string | null) => {
  const amount = parseAmountInput(value);
  return amount ? amount.toLocaleString("uz-UZ") : "";
};

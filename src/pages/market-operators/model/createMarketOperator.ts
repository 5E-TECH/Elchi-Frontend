export type MarketOperatorCreateFormValues = {
  name: string;
  phone_number: string;
  password: string;
};

export type CreateMarketOperatorRequest = {
  name: string;
  phone_number: string;
  password: string;
};

const normalizePhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
};

export const buildCreateMarketOperatorPayload = (
  values: MarketOperatorCreateFormValues,
): CreateMarketOperatorRequest => ({
  name: values.name.trim().replace(/\s+/g, " "),
  phone_number: normalizePhoneNumber(values.phone_number),
  password: values.password,
});

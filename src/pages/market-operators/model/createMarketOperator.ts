import type { CreateMarketOperatorRequest } from "../../../entities/market-operator";
import { isCompleteUzbekistanPhone } from "../../../shared/lib/phone";

export type MarketOperatorCreateFormValues = {
  name: string;
  phone_number: string;
  password: string;
};

export type CreateOperatorErrorCode =
  | "nameRequired"
  | "nameLength"
  | "phoneRequired"
  | "phoneTaken"
  | "passwordRequired"
  | "passwordShort";
export type CreateOperatorErrors = Partial<Record<keyof MarketOperatorCreateFormValues, CreateOperatorErrorCode>>;

/** Backend `CreateMarketOperatorDto`: ism 2..100, parol kamida 4 belgi, telefon — UZ. */
export const NAME_MIN = 2;
export const NAME_MAX = 100;
export const PASSWORD_MIN_LENGTH = 4;

const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ");

const normalizePhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
};

/**
 * `POST /market-operators` tanasi — FAQAT 3 maydon (`forbidNonWhitelisted`): `market_id` va `role` serverda JWT dan,
 * komissiya alohida `PATCH :id/commission` bilan.
 */
export const buildCreateMarketOperatorPayload = (
  values: MarketOperatorCreateFormValues,
): CreateMarketOperatorRequest => ({
  name: normalizeName(values.name),
  phone_number: normalizePhoneNumber(values.phone_number),
  password: values.password,
});

/** Mijoz tomonidagi tekshiruv (backend bilan bir xil chegaralar). Bo'sh obyekt — xato yo'q. */
export const validateCreateOperator = (values: MarketOperatorCreateFormValues): CreateOperatorErrors => {
  const errors: CreateOperatorErrors = {};
  const name = normalizeName(values.name);
  if (!name) errors.name = "nameRequired";
  else if (name.length < NAME_MIN || name.length > NAME_MAX) errors.name = "nameLength";
  if (!isCompleteUzbekistanPhone(values.phone_number)) errors.phone_number = "phoneRequired";
  if (!values.password.trim()) errors.password = "passwordRequired";
  else if (values.password.length < PASSWORD_MIN_LENGTH) errors.password = "passwordShort";
  return errors;
};

import type { CreateMarketOperatorRequest } from "../../../entities/market-operator";
import { isCompleteUzbekistanPhone } from "../../../shared/lib/phone";
import { checkPasswordPolicy } from "../../../shared/lib/passwordPolicy";

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
  | "passwordShort"
  | "passwordSpaces"
  | "passwordLong"
  | "passwordUpper"
  | "passwordLower"
  | "passwordDigit";
export type CreateOperatorErrors = Partial<Record<keyof MarketOperatorCreateFormValues, CreateOperatorErrorCode>>;

/**
 * Backend `CreateMarketOperatorDto`: ism 2..100, telefon — UZ; parol — NDmZMzCP siyosati (market operatori xodim
 * emas — hamma rol kabi kamida 6 belgi, katta va kichik harf, raqam; `shared/lib/passwordPolicy`).
 */
export const NAME_MIN = 2;
export const NAME_MAX = 100;
export const OPERATOR_ROLE = "market_operator";

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
  const passwordIssue = checkPasswordPolicy(values.password);
  if (passwordIssue === "required") errors.password = "passwordRequired";
  else if (passwordIssue === "tooShort") errors.password = "passwordShort";
  else if (passwordIssue === "edgeSpaces") errors.password = "passwordSpaces";
  else if (passwordIssue === "tooLong") errors.password = "passwordLong";
  else if (passwordIssue === "noUpper") errors.password = "passwordUpper";
  else if (passwordIssue === "noLower") errors.password = "passwordLower";
  else if (passwordIssue === "noDigit") errors.password = "passwordDigit";
  return errors;
};

export type { CustomerDistrict, CustomerSuggestMatch, CustomerSuggestion, CustomerSuggestParams } from "./types";
export {
  CUSTOMER_DISTRICT_KEY,
  CUSTOMER_SUGGEST_KEY,
  CUSTOMER_SUGGEST_MIN_DIGITS,
  customerDistrictQuery,
  fetchCustomerSuggestions,
  toCustomerDistrict,
  toCustomerSuggestions,
  useCustomerDistrictNames,
  useCustomerSuggest,
} from "./api";

import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { extractScannerToken, normalizeScannerCandidates } from "../../../shared/lib/scanToken";

export { extractScannerToken, normalizeScannerCandidates };

export const getScanOrderQueryKey = (token: string) =>
  ["scan-order", extractScannerToken(token) ?? token.trim()] as const;

export const fetchScanOrder = async (token: string) => {
  const normalizedToken = extractScannerToken(token) ?? token.trim();
  return api
    .get(API_ENDPOINTS.ORDERS.QR_CODE(encodeURIComponent(normalizedToken)))
    .then((res) => res.data);
};

export const normalizeScannerValue = (value: string) => {
  return normalizeScannerCandidates(value);
};

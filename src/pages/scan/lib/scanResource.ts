import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { extractScannerToken } from "../../../shared/lib/scanToken";
export { getBackendErrorMessage } from "../../../shared/lib/backendError";

export type ScanResourceType = "order" | "package" | "returned-package" | "post";

export interface ScanDetailResponse<T = unknown> {
  type: ScanResourceType;
  data: T;
}

const normalizeToken = (token: string) => extractScannerToken(token) ?? token.trim();

export const getScanResourceType = (token: string): ScanResourceType => {
  const normalizedToken = normalizeToken(token).toUpperCase();

  if (normalizedToken.startsWith("BTB-")) return "package";
  if (normalizedToken.startsWith("BTR-")) return "returned-package";
  if (normalizedToken.startsWith("PST-")) return "post";
  return "order";
};

export const getScanDetailQueryKey = (token: string) => {
  const normalizedToken = normalizeToken(token);
  return ["scan-detail", getScanResourceType(normalizedToken), normalizedToken] as const;
};

export const fetchScanDetail = async (token: string): Promise<ScanDetailResponse> => {
  const normalizedToken = normalizeToken(token);
  const resourceType = getScanResourceType(normalizedToken);

  if (resourceType === "post") {
    const response = await api
      .get(API_ENDPOINTS.POSTS.SCAN(encodeURIComponent(normalizedToken)))
      .then((res) => res.data);

    return { type: resourceType, data: response };
  }

  if (resourceType === "package" || resourceType === "returned-package") {
    const response = await api
      .get(API_ENDPOINTS.SCAN.BY_TOKEN(encodeURIComponent(normalizedToken)))
      .then((res) => res.data);

    return { type: resourceType, data: response };
  }

  const response = await api
    .get(API_ENDPOINTS.ORDERS.QR_CODE(encodeURIComponent(normalizedToken)))
    .then((res) => res.data);

  return { type: resourceType, data: response };
};

export const receiveScannedPackage = async (packageIdOrToken: string) =>
  api
    .patch(API_ENDPOINTS.BATCHES.RECEIVE(encodeURIComponent(packageIdOrToken)))
    .then((res) => res.data);

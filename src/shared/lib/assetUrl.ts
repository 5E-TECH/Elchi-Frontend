import { BASE_URL } from "../const";

const rawAssetBaseUrl = import.meta.env.VITE_ASSET_BASE_URL?.trim();

const getAssetBaseUrl = () => {
  const baseUrl = rawAssetBaseUrl || BASE_URL;

  if (baseUrl.startsWith("/")) return baseUrl.replace(/\/+$/, "");

  try {
    return new URL(baseUrl).origin;
  } catch {
    return BASE_URL;
  }
};

const isInternalAssetHost = (url: URL) =>
  url.hostname === "minio" ||
  url.hostname === "localhost" ||
  url.hostname === "127.0.0.1" ||
  url.hostname === "0.0.0.0" ||
  url.port === "9000";

const toPublicAssetUrl = (url: URL) => {
  const assetBaseUrl = getAssetBaseUrl();
  const pathWithSearch = `${url.pathname.replace(/^\/+/, "")}${url.search}`;

  if (assetBaseUrl.startsWith("/")) {
    return `${assetBaseUrl}/${pathWithSearch}`;
  }

  return new URL(pathWithSearch, `${assetBaseUrl.replace(/\/+$/, "")}/`).toString();
};

export const resolveAssetUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined;

  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;

  try {
    const parsedUrl = new URL(trimmed);

    if (isInternalAssetHost(parsedUrl)) {
      return toPublicAssetUrl(parsedUrl);
    }

    return parsedUrl.toString();
  } catch {
    if (trimmed.startsWith("/")) {
      return trimmed;
    }

    try {
      if (BASE_URL.startsWith("/")) {
        return `${BASE_URL.replace(/\/+$/, "")}/${trimmed.replace(/^\/+/, "")}`;
      }

      return new URL(trimmed.replace(/^\/+/, ""), `${BASE_URL.replace(/\/+$/, "")}/`).toString();
    } catch {
      return trimmed;
    }
  }
};

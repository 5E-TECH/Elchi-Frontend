import { BASE_URL } from "../const";

export const resolveAssetUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined;

  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;

  try {
    const parsedUrl = new URL(trimmed);
    return parsedUrl.toString();
  } catch {
    if (trimmed.startsWith("/")) return trimmed;

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

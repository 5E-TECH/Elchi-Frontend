export const isInactiveMarketStatus = (status?: string | null) => {
  const normalizedStatus = String(status ?? "").trim().toLowerCase();

  return normalizedStatus === "inactive" || normalizedStatus === "blocked";
};

export const unwrapMarketPayload = <T extends { status?: string | null }>(
  response: unknown,
): T | null => {
  const payload = response as Record<string, any> | undefined;

  if (!payload) return null;
  if ("status" in payload) return payload as T;
  if (payload.data && "status" in payload.data) return payload.data as T;
  if (payload.data?.data && "status" in payload.data.data) return payload.data.data as T;

  return null;
};

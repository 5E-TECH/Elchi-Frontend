const pickBackendMessage = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim() || undefined;

  if (Array.isArray(value)) {
    const message = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join(", ");
    return message || undefined;
  }

  return undefined;
};

export const getBackendErrorMessage = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;

  const source = error as {
    response?: {
      data?: {
        message?: unknown;
        errors?: unknown;
        error?: unknown;
        detail?: unknown;
        data?: {
          message?: unknown;
          errors?: unknown;
          error?: unknown;
          detail?: unknown;
        };
      };
    };
    message?: unknown;
    isAxiosError?: unknown;
  };
  const data = source.response?.data;
  const nested = data?.data;

  return (
    pickBackendMessage(data?.message) ??
    pickBackendMessage(data?.errors) ??
    pickBackendMessage(data?.error) ??
    pickBackendMessage(data?.detail) ??
    pickBackendMessage(nested?.message) ??
    pickBackendMessage(nested?.errors) ??
    pickBackendMessage(nested?.error) ??
    pickBackendMessage(nested?.detail) ??
    // axios xatosining `message` i — kutubxona matni («Network Error», «Request failed with status code 413»,
    // «timeout of 20000ms exceeded»), backend xabari emas: chaqiruvchining o'z (lokallashtirilgan) matni ishlasin
    // (G6F68ti6, 4-band). Oddiy `Error` / `{ message }` uchun avvalgidek.
    (source.isAxiosError === true ? undefined : pickBackendMessage(source.message))
  );
};

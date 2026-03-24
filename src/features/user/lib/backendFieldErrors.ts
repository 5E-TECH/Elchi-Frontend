import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

type BackendFieldMap = Partial<Record<string, string | string[]>>;

export const normalizeBackendFieldMessage = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const message = value.trim();
    return message || undefined;
  }

  if (Array.isArray(value)) {
    const message = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join(", ");

    return message || undefined;
  }

  return undefined;
};

export const extractBackendFieldErrors = (error: unknown): BackendFieldMap => {
  if (typeof error !== "object" || error === null) return {};

  const responseData = (
    error as {
      response?: {
        data?: {
          errors?: BackendFieldMap;
          data?: {
            errors?: BackendFieldMap;
          };
        };
      };
    }
  ).response?.data;

  return responseData?.errors ?? responseData?.data?.errors ?? {};
};

export const applyBackendFieldErrors = <TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
  fieldNameMap: Record<string, Path<TFieldValues>>,
) => {
  const fieldErrors = extractBackendFieldErrors(error);

  Object.entries(fieldErrors).forEach(([fieldName, message]) => {
    const formFieldName = fieldNameMap[fieldName];
    const normalizedMessage = normalizeBackendFieldMessage(message);

    if (!formFieldName || !normalizedMessage) return;

    setError(formFieldName, {
      type: "server",
      message: normalizedMessage,
    });
  });
};

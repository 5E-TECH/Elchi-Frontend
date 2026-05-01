import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import i18n from "../../../i18n";
import {
  applyBackendFieldErrors,
  normalizeBackendFieldMessage,
} from "../../user/lib/backendFieldErrors";

const getBackendMessage = (error: unknown) => {
  if (typeof error !== "object" || error === null) return undefined;

  const responseData = (
    error as {
      response?: {
        data?: {
          message?: unknown;
          error?: unknown;
        };
      };
    }
  ).response?.data;

  return (
    normalizeBackendFieldMessage(responseData?.message) ??
    normalizeBackendFieldMessage(responseData?.error)
  );
};

export const applyBranchBackendErrors = <TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
) => {
  applyBackendFieldErrors(error, setError, {
    code: "code" as Path<TFieldValues>,
    parent: "parent_id" as Path<TFieldValues>,
    parent_id: "parent_id" as Path<TFieldValues>,
  });

  const message = getBackendMessage(error);
  if (!message) return;

  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("code") ||
    lowerMessage.includes("mavjud") ||
    lowerMessage.includes("already exists") ||
    lowerMessage.includes("duplicate") ||
    lowerMessage.includes("unique")
  ) {
    setError("code" as Path<TFieldValues>, {
      type: "server",
      message: i18n.t("branches:errors.codeExists"),
    });
    return;
  }

  if (lowerMessage.includes("circular") || lowerMessage.includes("aylanma")) {
    setError("parent_id" as Path<TFieldValues>, {
      type: "server",
      message: i18n.t("branches:errors.circularParent"),
    });
  }
};

import type { NotificationInstance } from "antd/es/notification/interface";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import i18n from "../../../i18n";
import {
  applyBackendFieldErrors,
  extractBackendFieldErrors,
  normalizeBackendFieldMessage,
} from "../../user/lib/backendFieldErrors";

export interface ApplyBranchBackendErrorsOptions {
  /**
   * NotificationProvider `api`i (`useAppNotification().api`). Berilsa, hech bir
   * forma maydoniga bog'lanmagan server javobi bildirishnoma bilan ko'rsatiladi —
   * backend rad etishi (masalan "HQ filial turini o'zgartirib bo'lmaydi") jim
   * yutilib ketmaydi. Berilmasa — avvalgidek faqat maydon xatolari (chaqiruvchi
   * o'zi xabar ko'rsatadi, masalan BranchFormModal).
   */
  notification?: Pick<NotificationInstance, "error">;
}

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

/** Server javob bergan. Javobsiz (tarmoq) xatoni interceptor "Tarmoq xatosi" deb o'zi ko'rsatadi. */
const hasServerResponse = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  Boolean((error as { response?: unknown }).response);

/**
 * `errors` xaritasi: forma maydoniga bog'langan xato bormi (u maydon ostida
 * ko'rinadi) va bog'lanmaganlarining matni. `errors` xarita emas, matn/ro'yxat
 * bo'lsa — uning o'zi xabar.
 */
const splitFieldErrors = (error: unknown, fieldNameMap: Record<string, unknown>) => {
  const fieldErrors: unknown = extractBackendFieldErrors(error);

  if (typeof fieldErrors !== "object" || fieldErrors === null || Array.isArray(fieldErrors)) {
    return { hasMappedFieldError: false, unmappedMessage: normalizeBackendFieldMessage(fieldErrors) };
  }

  let hasMappedFieldError = false;
  const unmappedMessages: string[] = [];

  Object.entries(fieldErrors).forEach(([fieldName, fieldMessage]) => {
    const normalizedMessage = normalizeBackendFieldMessage(fieldMessage);
    if (!normalizedMessage) return;

    if (Object.prototype.hasOwnProperty.call(fieldNameMap, fieldName)) {
      hasMappedFieldError = true;
    } else {
      unmappedMessages.push(normalizedMessage);
    }
  });

  return { hasMappedFieldError, unmappedMessage: unmappedMessages.join(", ") || undefined };
};

export const applyBranchBackendErrors = <TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
  { notification }: ApplyBranchBackendErrorsOptions = {},
) => {
  const fieldNameMap: Record<string, Path<TFieldValues>> = {
    code: "code" as Path<TFieldValues>,
    parent: "parent_id" as Path<TFieldValues>,
    parent_id: "parent_id" as Path<TFieldValues>,
  };
  applyBackendFieldErrors(error, setError, fieldNameMap);

  const message = getBackendMessage(error);

  if (message) {
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
      return;
    }
  }

  // Fallback: forma maydoniga bog'lanmagan server rad etishi jim qolmasin.
  if (!notification) return;

  const { hasMappedFieldError, unmappedMessage } = splitFieldErrors(error, fieldNameMap);
  const fallbackMessage =
    message ??
    unmappedMessage ??
    (hasMappedFieldError || !hasServerResponse(error) ? undefined : i18n.t("branches:errors.generic"));

  if (fallbackMessage) {
    notification.error({ message: fallbackMessage, placement: "topRight" });
  }
};

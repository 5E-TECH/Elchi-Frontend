import { describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { applyBranchBackendErrors } from "./backendBranchErrors";

/** Gateway xato konverti: `{ statusCode, message }` (AllExceptionsFilter). */
const serverError = (data: unknown, status = 400) => ({
  isAxiosError: true,
  message: `Request failed with status code ${status}`,
  response: { status, data },
});

const setup = () => ({ setError: vi.fn(), notification: { error: vi.fn() } });

describe("applyBranchBackendErrors — bog'lanmagan server xabari (fallback)", () => {
  it("shows an unmapped backend message (HQ type lock) as an error notification", () => {
    const { setError, notification } = setup();

    applyBranchBackendErrors(
      serverError({ statusCode: 400, message: "HQ filial turini o'zgartirib bo'lmaydi" }),
      setError,
      { notification },
    );

    expect(notification.error).toHaveBeenCalledTimes(1);
    expect(notification.error).toHaveBeenCalledWith({
      message: "HQ filial turini o'zgartirib bo'lmaydi",
      placement: "topRight",
    });
    expect(setError).not.toHaveBeenCalled();
  });

  it("joins an array message (class-validator) before showing it", () => {
    const { setError, notification } = setup();

    applyBranchBackendErrors(
      serverError({ message: ["name must be longer than or equal to 2 characters", "phone_number must be a string"] }),
      setError,
      { notification },
    );

    expect(notification.error).toHaveBeenCalledWith({
      message: "name must be longer than or equal to 2 characters, phone_number must be a string",
      placement: "topRight",
    });
  });

  it("falls back to `error` when the body has no `message`", () => {
    const { setError, notification } = setup();

    applyBranchBackendErrors(serverError({ error: "Forbidden resource" }, 403), setError, { notification });

    expect(notification.error).toHaveBeenCalledWith({ message: "Forbidden resource", placement: "topRight" });
  });

  it("shows the generic error when the server rejected without any message", () => {
    const { setError, notification } = setup();

    applyBranchBackendErrors(serverError("<html>502 Bad Gateway</html>", 502), setError, { notification });

    expect(notification.error).toHaveBeenCalledWith({
      message: i18n.t("branches:errors.generic"),
      placement: "topRight",
    });
  });

  it("stays quiet for a network failure without a response (the interceptor shows 'Tarmoq xatosi')", () => {
    const { setError, notification } = setup();

    applyBranchBackendErrors({ isAxiosError: true, code: "ERR_NETWORK", message: "Network Error" }, setError, {
      notification,
    });

    expect(notification.error).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });
});

describe("applyBranchBackendErrors — maydonga bog'langan xatolar (o'zgarmagan)", () => {
  it("maps a duplicate-code conflict to the code field without a notification", () => {
    const { setError, notification } = setup();

    applyBranchBackendErrors(
      serverError({ statusCode: 409, message: "Branch with this code already exists" }, 409),
      setError,
      { notification },
    );

    expect(setError).toHaveBeenCalledWith("code", {
      type: "server",
      message: i18n.t("branches:errors.codeExists"),
    });
    expect(notification.error).not.toHaveBeenCalled();
  });

  it("maps a circular-parent error to the parent field without a notification", () => {
    const { setError, notification } = setup();

    applyBranchBackendErrors(serverError({ message: "Aylanma bog'lanish" }), setError, { notification });

    expect(setError).toHaveBeenCalledWith("parent_id", {
      type: "server",
      message: i18n.t("branches:errors.circularParent"),
    });
    expect(notification.error).not.toHaveBeenCalled();
  });

  it("applies backend field errors inline and does not notify when there is no message", () => {
    const { setError, notification } = setup();

    applyBranchBackendErrors(serverError({ errors: { parent: "Yuqori filial topilmadi" } }), setError, {
      notification,
    });

    expect(setError).toHaveBeenCalledWith("parent_id", { type: "server", message: "Yuqori filial topilmadi" });
    expect(notification.error).not.toHaveBeenCalled();
  });

  it("shows field errors for fields the form does not have, while mapped ones stay inline", () => {
    const { setError, notification } = setup();

    applyBranchBackendErrors(
      serverError({ errors: { manager_id: "Menejer topilmadi", code: "Kod band", region_id: ["Viloyat noto'g'ri"] } }),
      setError,
      { notification },
    );

    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith("code", { type: "server", message: "Kod band" });
    expect(notification.error).toHaveBeenCalledWith({
      message: "Menejer topilmadi, Viloyat noto'g'ri",
      placement: "topRight",
    });
  });

  it("treats a plain-text `errors` value as the message, not as a field map", () => {
    const { setError, notification } = setup();

    applyBranchBackendErrors(serverError({ errors: "Filial topilmadi" }, 404), setError, { notification });

    expect(notification.error).toHaveBeenCalledWith({ message: "Filial topilmadi", placement: "topRight" });
  });

  it("without the notification option keeps the old behaviour (caller shows its own toast)", () => {
    const setError = vi.fn();

    expect(() =>
      applyBranchBackendErrors(serverError({ message: "HQ filial turini o'zgartirib bo'lmaydi" }), setError),
    ).not.toThrow();
    expect(setError).not.toHaveBeenCalled();
  });
});

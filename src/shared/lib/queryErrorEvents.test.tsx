import { AxiosError, type AxiosResponse } from "axios";
import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import { emitQueryError, QUERY_ERROR_EVENT } from "./queryErrorEvents";

const httpError = (status: number) =>
  new AxiosError("fail", "ERR_BAD_RESPONSE", undefined, undefined, { status, data: {} } as AxiosResponse);

describe("emitQueryError", () => {
  it("announces 403 and 5xx failures", () => {
    const listener = vi.fn();
    window.addEventListener(QUERY_ERROR_EVENT, listener);
    emitQueryError(httpError(403));
    emitQueryError(httpError(500));
    window.removeEventListener(QUERY_ERROR_EVENT, listener);

    expect(listener).toHaveBeenCalledTimes(2);
    expect((listener.mock.calls[0][0] as CustomEvent).detail.status).toBe(403);
  });

  it("stays quiet for network errors (own toast), 401 (refresh flow) and silent background queries", () => {
    const listener = vi.fn();
    window.addEventListener(QUERY_ERROR_EVENT, listener);
    emitQueryError(new AxiosError("Network Error", "ERR_NETWORK"));
    emitQueryError(httpError(401));
    emitQueryError(httpError(500), { silentError: true });
    window.removeEventListener(QUERY_ERROR_EVENT, listener);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("NotificationProvider query error toast", () => {
  it("shows a notification for a 403 so the page is not silently empty", async () => {
    renderWithProviders(<div />);

    act(() => emitQueryError(httpError(403)));

    expect(await screen.findByText("Ma'lumotni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText(/ruxsatingiz yo'q \(403\)/)).toBeInTheDocument();
  });
});

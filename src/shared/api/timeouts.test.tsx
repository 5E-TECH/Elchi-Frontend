import { act, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { api, API_TIMEOUT_MS, LONG_REQUEST_TIMEOUT_MS } from "./api";
import { authClient, AUTH_TIMEOUT_MS } from "../../auth/authService";
import TableSkeleton, { SLOW_LOADING_AFTER_MS } from "../ui/TableSkeleton";

describe("axios timeouts (qJjLP109)", () => {
  it("the shared api instance gives up after 20 s", () => {
    expect(API_TIMEOUT_MS).toBe(20000);
    expect(api.defaults.timeout).toBe(20000);
  });

  it("the bootstrap/auth client gives up after 15 s", () => {
    expect(AUTH_TIMEOUT_MS).toBe(15000);
    expect(authClient.defaults.timeout).toBe(15000);
  });

  it("long requests (uploads, exports) get a separate, longer limit", () => {
    expect(LONG_REQUEST_TIMEOUT_MS).toBe(120000);
  });
});

describe("TableSkeleton slow notice", () => {
  it("tells the user the wait is long after 15 s, not before", () => {
    vi.useFakeTimers();
    try {
      render(
        <I18nextProvider i18n={i18n}>
          <TableSkeleton />
        </I18nextProvider>,
      );
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(SLOW_LOADING_AFTER_MS - 1));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByRole("status")).toHaveTextContent("Kutish uzoq davom etmoqda");
    } finally {
      vi.useRealTimers();
    }
  });
});

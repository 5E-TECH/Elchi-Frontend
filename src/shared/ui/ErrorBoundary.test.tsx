import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import ErrorBoundary from "./ErrorBoundary";

const Thrower = ({ error }: { error: Error }) => {
  throw error;
};

const chunkError = () => new TypeError("Failed to fetch dynamically imported module: https://admin.example/assets/orders-1a2b.js");

describe("ErrorBoundary — bo'lim fayli yuklanmadi (G6F68ti6, 6-band)", () => {
  const reload = vi.fn();
  const replace = vi.fn();

  beforeEach(() => {
    window.sessionStorage.clear();
    reload.mockReset();
    replace.mockReset();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload, replace } as Location);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("onlayn — «Ilova xatosi» ga o'tmaydi, yangi versiya uchun sahifa bir marta qayta yuklanadi", () => {
    renderWithProviders(
      <ErrorBoundary>
        <Thrower error={chunkError()} />
      </ErrorBoundary>,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("onlayn, yaqinda qayta yuklangan — odatdagi yo'l (/runtime-error), cheksiz halqa yo'q", () => {
    window.sessionStorage.setItem("elchi:chunk-reload-at", String(Date.now()));
    renderWithProviders(
      <ErrorBoundary>
        <Thrower error={chunkError()} />
      </ErrorBoundary>,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/runtime-error");
  });

  it("oflayn — «Internet aloqasi yo'q» holati, /runtime-error yo'q; aloqa qaytgach qayta yuklanadi", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderWithProviders(
      <ErrorBoundary>
        <Thrower error={chunkError()} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Internet aloqasi yo'q")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();

    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("oddiy kod xatosi — avvalgidek /runtime-error", () => {
    renderWithProviders(
      <ErrorBoundary>
        <Thrower error={new TypeError("Cannot read properties of undefined")} />
      </ErrorBoundary>,
    );
    expect(replace).toHaveBeenCalledWith("/runtime-error");
    expect(reload).not.toHaveBeenCalled();
  });
});

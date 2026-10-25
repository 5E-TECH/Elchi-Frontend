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

/**
 * QKCeGZ3N — joyida ko'rsatish (`fallbackRender`): shell kontent zonasi va dashboard bo'limlari. Xato saqlanadi
 * (kod, takror hisobi), lekin `/runtime-error` ga ham, to'liq qayta yuklash ham yo'q; «Qayta urinish» — qayta chizish.
 */
describe("ErrorBoundary — joyida ko'rsatish (QKCeGZ3N)", () => {
  const reload = vi.fn();
  const replace = vi.fn();
  const shouldThrow = { current: true };
  const Flaky = () => {
    if (shouldThrow.current) throw new TypeError("r.forEach is not a function");
    return <p>Sahifa tiklandi</p>;
  };
  const Fallback = ({ code, retry }: { code: string; retry: () => void }) => (
    <div role="alert">
      <span>{code}</span>
      <button type="button" onClick={retry}>
        Qayta urinish
      </button>
    </div>
  );

  beforeEach(() => {
    window.sessionStorage.clear();
    shouldThrow.current = true;
    reload.mockReset();
    replace.mockReset();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload, replace } as Location);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("⭐ xato joyida chiziladi (null emas), /runtime-error ga o'tilmaydi va qayta yuklanmaydi; yozuv saqlanadi", () => {
    renderWithProviders(
      <ErrorBoundary fallbackRender={({ error, reset }) => <Fallback code={`#${error.retryCount}`} retry={reset} />}>
        <Flaky />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("#1");
    expect(replace).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(JSON.parse(window.sessionStorage.getItem("elchi_runtime_error") ?? "{}")).toMatchObject({
      message: "r.forEach is not a function",
      retryCount: 1,
    });
    // Prod'da ham konsolda (4-band).
    expect(console.error).toHaveBeenCalledWith("ErrorBoundary xatoligi:", expect.any(TypeError), expect.anything());
  });

  it("«Qayta urinish» bolalarni qayta chizadi; yana yiqilsa takror hisobi oshadi", () => {
    renderWithProviders(
      <ErrorBoundary fallbackRender={({ error, reset }) => <Fallback code={`#${error.retryCount}`} retry={reset} />}>
        <Flaky />
      </ErrorBoundary>,
    );

    act(() => screen.getByRole("button", { name: "Qayta urinish" }).click());
    expect(screen.getByRole("alert")).toHaveTextContent("#2");

    shouldThrow.current = false;
    act(() => screen.getByRole("button", { name: "Qayta urinish" }).click());
    expect(screen.getByText("Sahifa tiklandi")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("`record={false}` (bo'lim) — yozuv saqlanmaydi, sahifa xatosining takror hisobiga qo'shilmaydi", () => {
    renderWithProviders(
      <ErrorBoundary record={false} fallbackRender={({ reset }) => <Fallback code="bo'lim" retry={reset} />}>
        <Flaky />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("bo'lim");
    expect(window.sessionStorage.getItem("elchi_runtime_error")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("`resetKey` o'zgarsa (boshqa bo'limga o'tildi) — chegara tozalanadi", () => {
    const view = renderWithProviders(
      <ErrorBoundary resetKey="/orders" fallbackRender={({ reset }) => <Fallback code="x" retry={reset} />}>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    shouldThrow.current = false;
    view.rerender(
      <ErrorBoundary resetKey="/mails" fallbackRender={({ reset }) => <Fallback code="x" retry={reset} />}>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Sahifa tiklandi")).toBeInTheDocument();
  });
});

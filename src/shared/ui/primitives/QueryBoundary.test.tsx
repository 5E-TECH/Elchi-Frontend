import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { QueryBoundary, type QueryLike } from "./QueryBoundary";
import { SKELETON_DELAY_MS, SLOW_LOADING_MS } from "./useLoadingPhase";

/**
 * QueryBoundary — `tizim-loading` (0–400 ms hech narsa → skelet → 15 s izoh; fon yangilanishi) va
 * `tizim-errors` 02 (yuklanmoqda · bo'sh · xato · tayyor).
 */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

type Rows = string[];
const loading: QueryLike<Rows> = { data: undefined, isLoading: true, isFetching: true, isError: false };
const ready = (data: Rows, extra: Partial<QueryLike<Rows>> = {}): QueryLike<Rows> => ({
  data,
  isLoading: false,
  isFetching: false,
  isError: false,
  ...extra,
});

const List = ({ query, ...rest }: { query: QueryLike<Rows> } & Partial<Parameters<typeof QueryBoundary<Rows>>[0]>) => (
  <QueryBoundary query={query} {...rest}>
    {(rows, { isRefetching, isPreviousData }) => (
      <ul data-refetching={isRefetching ? "" : undefined} data-previous={isPreviousData ? "" : undefined}>
        {rows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    )}
  </QueryBoundary>
);

const state = (container: HTMLElement) => container.querySelector("[data-query-state]");

describe("QueryBoundary", () => {
  it("yuklanish: 400 ms gacha skelet ko'rinmaydi (joy band), keyin ko'rinadi + «Yuklanmoqda…»", () => {
    const { container } = render(<List query={loading} loadingLabel="Buyurtmalar yuklanmoqda" />);
    const root = state(container);
    expect(root).toHaveAttribute("data-query-state", "loading");
    expect(root).toHaveAttribute("aria-busy", "true");
    expect(root?.querySelector("[data-skeleton-preset='lines']")?.parentElement).toHaveClass("invisible");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(SKELETON_DELAY_MS));
    expect(root?.querySelector("[data-skeleton-preset='lines']")?.parentElement).not.toHaveClass("invisible");
    expect(screen.getByRole("status")).toHaveTextContent("Buyurtmalar yuklanmoqda");
  });

  it("tez javobda skelet umuman ko'rinmaydi", () => {
    const { container, rerender } = render(<List query={loading} />);
    act(() => vi.advanceTimersByTime(200));
    rerender(<List query={ready(["№10241"])} />);
    expect(state(container)).toHaveAttribute("data-query-state", "ready");
    expect(container.querySelector("[data-skeleton-visible]")).toBeNull();
    expect(screen.getByText("№10241")).toBeInTheDocument();
  });

  it("15 s dan keyin «Kutish uzoq davom etmoqda…»; `slowAfter={false}` — yo'q", () => {
    const { rerender } = render(<List query={loading} />);
    act(() => vi.advanceTimersByTime(SLOW_LOADING_MS - 1));
    expect(screen.queryByText(/Kutish uzoq davom etmoqda/)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(/Kutish uzoq davom etmoqda/).closest("[role=status]")).not.toBeNull();
    rerender(<List query={{ ...loading }} slowAfter={false} />);
    expect(screen.queryByText(/Kutish uzoq davom etmoqda/)).not.toBeInTheDocument();
  });

  it("jadval skeleti — izoh jadval kartasining pastki qatorida", () => {
    const { container } = render(<List query={loading} skeleton="table" />);
    act(() => vi.advanceTimersByTime(SLOW_LOADING_MS));
    const table = container.querySelector("[data-skeleton-preset='table']");
    expect(table).not.toBeNull();
    expect(table).toHaveTextContent(/Kutish uzoq davom etmoqda/);
  });

  it("xato: ErrorState, «Qayta urinish» → refetch", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const refetch = vi.fn();
    const { container } = render(
      <List query={{ data: undefined, isLoading: false, isError: true, error: { response: { status: 500 } }, refetch }} />,
    );
    expect(state(container)).toHaveAttribute("data-query-state", "error");
    expect(screen.getByRole("alert")).toHaveTextContent("Server xatosi (500)");
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("xato slot: element yoki funksiya", () => {
    const { rerender } = render(
      <List query={{ isError: true, error: new Error("x") }} error={(_, retry) => <button onClick={retry}>Boshqa</button>} />,
    );
    expect(screen.getByRole("button", { name: "Boshqa" })).toBeInTheDocument();
    rerender(<List query={{ isError: true, error: new Error("x") }} error={<p>O'z xatom</p>} />);
    expect(screen.getByText("O'z xatom")).toBeInTheDocument();
  });

  it("bo'sh: sukut — «Ma'lumot yo'q»; `{ data: [] }` ham bo'sh; o'z `empty` va `isEmpty`", () => {
    const { container, rerender } = render(<List query={ready([])} />);
    expect(state(container)).toHaveAttribute("data-query-state", "empty");
    expect(screen.getByText("Ma'lumot yo'q")).toBeInTheDocument();

    rerender(
      <QueryBoundary query={{ data: { data: [], meta: { total: 0 } }, isLoading: false }}>
        {() => <p>tayyor</p>}
      </QueryBoundary>,
    );
    expect(state(container)).toHaveAttribute("data-query-state", "empty");

    rerender(<List query={ready(["a"])} isEmpty={(rows) => rows.length < 2} empty={<p>Filtr bo'yicha topilmadi</p>} />);
    expect(screen.getByText("Filtr bo'yicha topilmadi")).toBeInTheDocument();
  });

  it("qayta so'rovda ro'yxat joyida qoladi; `isRefetching` 400 ms dan keyin", () => {
    const { container, rerender } = render(<List query={ready(["a", "b"])} />);
    rerender(<List query={ready(["a", "b"], { isFetching: true })} />);
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(container.querySelector("ul")).not.toHaveAttribute("data-refetching");
    act(() => vi.advanceTimersByTime(SKELETON_DELAY_MS));
    expect(container.querySelector("ul")).toHaveAttribute("data-refetching");
    expect(state(container)).toHaveAttribute("aria-busy", "true");
  });

  it("kalit almashdi (data yo'q, yuklanmoqda) — oldingi ma'lumot ko'rsatiladi, skelet emas", () => {
    const { container, rerender } = render(<List query={ready(["eski"])} />);
    rerender(<List query={loading} />);
    expect(state(container)).toHaveAttribute("data-query-state", "ready");
    expect(screen.getByText("eski")).toBeInTheDocument();
    expect(container.querySelector("ul")).toHaveAttribute("data-previous");
    rerender(<List query={ready(["yangi"])} />);
    expect(screen.getByText("yangi")).toBeInTheDocument();

    rerender(<List query={loading} keepPreviousData={false} />);
    expect(state(container)).toHaveAttribute("data-query-state", "loading");
  });

  it("ma'lumot bor paytda yiqilgan qayta so'rov ro'yxatni almashtirmaydi", () => {
    const { container } = render(<List query={ready(["a"], { isError: true, error: new Error("x") })} />);
    expect(state(container)).toHaveAttribute("data-query-state", "ready");
    expect(screen.getByText("a")).toBeInTheDocument();
  });

  it("useQuery shakli: isPending + isFetching — yuklanmoqda; o'chiq so'rov — bo'sh", () => {
    const { container, rerender } = render(<List query={{ data: undefined, isPending: true, isFetching: true }} />);
    expect(state(container)).toHaveAttribute("data-query-state", "loading");
    rerender(<List query={{ data: undefined, isPending: true, isFetching: false }} />);
    expect(state(container)).toHaveAttribute("data-query-state", "empty");
  });

  it("oflayn kutayotgan so'rov (isPaused) — «Internet aloqasi yo'q», «Ma'lumot yo'q» emas", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const refetch = vi.fn();
    const { container } = render(
      <List query={{ data: undefined, isPending: true, isLoading: false, isFetching: false, isPaused: true, refetch }} />,
    );
    expect(state(container)).toHaveAttribute("data-query-state", "error");
    expect(container.querySelector("[data-error-kind]")).toHaveAttribute("data-error-kind", "offline");
    expect(screen.getByText("Internet aloqasi yo'q")).toBeInTheDocument();
    expect(screen.queryByText("Ma'lumot yo'q")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

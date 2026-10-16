import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { getPageItems, Pagination } from "./Pagination";

/**
 * Pagination: 5 o'rinli sahifalar qatori, joriy sahifa `aria-current`, chetda o'chiq o'qlar,
 * xulosa (sukut va o'z matni), «10 ta» tanlovi va jami 0 da hech narsa.
 */

beforeEach(async () => {
  if (i18n.language !== "uz") await i18n.changeLanguage("uz");
});

const pages = () =>
  within(screen.getByRole("navigation", { name: "Sahifalar" }))
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? button.textContent);

describe("getPageItems", () => {
  it("≤ 5 sahifa — hammasi; boshida, o'rtada va oxirida 5 o'rin", () => {
    expect(getPageItems(1, 1)).toEqual([1]);
    expect(getPageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageItems(1, 125)).toEqual([1, 2, 3, "…", 125]);
    expect(getPageItems(3, 125)).toEqual([1, 2, 3, "…", 125]);
    expect(getPageItems(4, 125)).toEqual([1, "…", 4, "…", 125]);
    expect(getPageItems(60, 125)).toEqual([1, "…", 60, "…", 125]);
    expect(getPageItems(123, 125)).toEqual([1, "…", 123, 124, 125]);
    expect(getPageItems(125, 125)).toEqual([1, "…", 123, 124, 125]);
  });

  it("telefon (`compact`): 5 sahifa ham «…» bilan — 375 px kartada bitta satr; ≤ 4 — hammasi", () => {
    expect(getPageItems(1, 4, true)).toEqual([1, 2, 3, 4]);
    expect(getPageItems(1, 5, true)).toEqual([1, 2, 3, "…", 5]);
    expect(getPageItems(4, 5, true)).toEqual([1, "…", 3, 4, 5]);
    expect(getPageItems(60, 125, true)).toEqual([1, "…", 60, "…", 125]);
  });
});

describe("Pagination", () => {
  it("maketdagidek: «1–10 / 1 248», ‹ 1 2 3 … 125 ›, joriy sahifa belgilangan, «Oldingi» o'chiq", () => {
    render(<Pagination page={1} pageSize={10} total={1248} onPageChange={vi.fn()} />);

    expect(screen.getByText("1–10 / 1 248")).toBeInTheDocument();
    expect(pages()).toEqual(["Oldingi sahifa", "1", "2", "3", "125", "Keyingi sahifa"]);
    expect(screen.getByRole("button", { name: "1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Oldingi sahifa" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keyingi sahifa" })).toBeEnabled();
  });

  it("sahifa, «Keyingi» va «Oldingi» bosilsa — `onPageChange`; joriy sahifa qayta chaqirmaydi", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={4} pageSize={10} total={1248} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: "125" }));
    await user.click(screen.getByRole("button", { name: "Keyingi sahifa" }));
    await user.click(screen.getByRole("button", { name: "Oldingi sahifa" }));
    await user.click(screen.getByRole("button", { name: "4" }));
    expect(onPageChange.mock.calls).toEqual([[125], [5], [3]]);
  });

  it("oxirgi sahifada «Keyingi» o'chiq; xulosa oxirgi qatorgacha", () => {
    render(<Pagination page={125} pageSize={10} total={1248} onPageChange={vi.fn()} />);
    expect(screen.getByText("1 241–1 248 / 1 248")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keyingi sahifa" })).toBeDisabled();
  });

  it("o'z xulosa matni — sonlar formatlangan holda", () => {
    render(
      <Pagination
        page={1}
        pageSize={10}
        total={1248}
        onPageChange={vi.fn()}
        summary={({ from, to, total }) => `${from}–${to} / ${total} ta buyurtma`}
      />,
    );
    expect(screen.getByText("1–10 / 1 248 ta buyurtma")).toBeInTheDocument();
  });

  it("«10 ta» tanlovi — sahifadagi qatorlar soni o'zgaradi", async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    render(
      <Pagination page={1} pageSize={10} total={1248} onPageChange={vi.fn()} onPageSizeChange={onPageSizeChange} />,
    );

    const trigger = screen.getByRole("combobox", { name: "Sahifadagi qatorlar soni: 10 ta" });
    expect(trigger).toHaveTextContent("10 ta");
    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "25 ta" }));
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it("telefonda 5 sahifa — ‹ 1 2 3 … 5 › (7 ta 44 px tugma 375 px ga sig'maydi); desktopda hammasi", () => {
    const spy = vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query === "(max-width: 767px)",
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    const { unmount } = render(<Pagination page={1} pageSize={10} total={48} onPageChange={vi.fn()} />);
    expect(pages()).toEqual(["Oldingi sahifa", "1", "2", "3", "5", "Keyingi sahifa"]);
    unmount();
    spy.mockRestore();

    render(<Pagination page={1} pageSize={10} total={48} onPageChange={vi.fn()} />);
    expect(pages()).toEqual(["Oldingi sahifa", "1", "2", "3", "4", "5", "Keyingi sahifa"]);
  });

  it("jami 0 — hech narsa chizilmaydi", () => {
    const { container } = render(<Pagination page={1} pageSize={10} total={0} onPageChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("`disabled` — hamma tugma o'chiq (joriydan tashqari)", () => {
    render(<Pagination page={2} pageSize={10} total={50} onPageChange={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: "3" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keyingi sahifa" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page");
  });
});

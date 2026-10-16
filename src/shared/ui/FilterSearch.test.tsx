import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import FilterSearch from "./FilterSearch";

/** FilterSearch — eski API (kechikish bilan `onChange`), ichi v2 qidiruv maydoni. */
describe("FilterSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("yozish debounceDelay dan keyin onChange; placeholder — maydon nomi", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    render(<FilterSearch value="" onChange={onChange} placeholder="Qidirish..." debounceDelay={400} />);
    const input = screen.getByRole("searchbox", { name: "Qidirish..." });
    await user.type(input, "Baraka");
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onChange).toHaveBeenLastCalledWith("Baraka");
  });

  it("tozalash va Enter — darhol", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    render(<FilterSearch value="Nur" onChange={onChange} placeholder="Qidirish..." />);
    await user.click(screen.getByRole("button", { name: "Qidiruvni tozalash" }));
    expect(onChange).toHaveBeenCalledWith("");
    const input = screen.getByRole("searchbox", { name: "Qidirish..." });
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    onChange.mockClear();
    await user.type(input, "abc{Enter}");
    expect(onChange).toHaveBeenCalledWith("abc");
  });

  it("tashqi value o'zgarsa maydon yangilanadi", () => {
    const { rerender } = render(<FilterSearch value="a" onChange={() => {}} placeholder="q" />);
    rerender(<FilterSearch value="" onChange={() => {}} placeholder="q" />);
    expect(screen.getByRole("searchbox", { name: "q" })).toHaveValue("");
  });

  it("QR havolasi yopishtirilsa — token qoladi", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<FilterSearch value="" onChange={() => {}} placeholder="q" />);
    const input = screen.getByRole("searchbox", { name: "q" });
    await user.click(input);
    await user.paste(`${window.location.origin}/scan/ABCDEF123456`);
    expect(input).toHaveValue("ABCDEF123456");
  });
});

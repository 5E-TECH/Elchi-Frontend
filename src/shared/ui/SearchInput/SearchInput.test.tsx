import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../../i18n";
import { SearchInput } from "./index";

/** SearchInput — eski API (`onSearch` kechikish bilan), ichi v2 qidiruv maydoni (antd emas). */
describe("SearchInput", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("kechikish bilan onSearch; tozalash darhol", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} />);
    const input = screen.getByRole("searchbox", { name: "Qidirish" });
    expect(input.closest(".ant-input-affix-wrapper")).toBeNull();
    await user.type(input, "Nur");
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onSearch).toHaveBeenLastCalledWith("Nur");
    await user.click(screen.getByRole("button", { name: "Qidiruvni tozalash" }));
    expect(onSearch).toHaveBeenLastCalledWith("");
  });
});

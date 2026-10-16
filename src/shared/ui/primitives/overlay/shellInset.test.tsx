import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Portal } from "./Portal";
import { isInUiLayer } from "./portalRoot";
import { readShellBottomInset, SHELL_BOTTOM_INSET_VAR, useShellBottomInsetSource, writeShellBottomInset } from "./shellInset";

/** Shell pastki chekkasi (`:root` → `--shell-bottom-inset`) va v2 qatlami tekshiruvi (`isInUiLayer`). */

const Bar = ({ enabled = true }: { enabled?: boolean }) => {
  const ref = useRef<HTMLElement>(null);
  useShellBottomInsetSource(ref, enabled);
  return <nav ref={ref}>menyu</nav>;
};

describe("shellInset", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    writeShellBottomInset(null);
  });

  it("yozish/o'qish: px, manfiy — 0, null — o'zgaruvchi olib tashlanadi", () => {
    expect(readShellBottomInset()).toBe(0);
    writeShellBottomInset(64.4);
    expect(document.documentElement.style.getPropertyValue(SHELL_BOTTOM_INSET_VAR)).toBe("64px");
    expect(readShellBottomInset()).toBe(64);
    writeShellBottomInset(-5);
    expect(readShellBottomInset()).toBe(0);
    writeShellBottomInset(null);
    expect(document.documentElement.style.getPropertyValue(SHELL_BOTTOM_INSET_VAR)).toBe("");
  });

  it("pastki menyu balandligini :root ga yozadi, yo'qolganda olib tashlaydi", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      height: 98,
      width: 390,
      top: 746,
      left: 0,
      right: 390,
      bottom: 844,
      x: 0,
      y: 746,
      toJSON: () => ({}),
    } as DOMRect);
    const { unmount } = render(<Bar />);
    expect(readShellBottomInset()).toBe(98);
    unmount();
    expect(document.documentElement.style.getPropertyValue(SHELL_BOTTOM_INSET_VAR)).toBe("");
  });

  it("menyu chizilmasa (enabled=false) — hech narsa yozilmaydi", () => {
    render(<Bar enabled={false} />);
    expect(document.documentElement.style.getPropertyValue(SHELL_BOTTOM_INSET_VAR)).toBe("");
  });
});

describe("isInUiLayer", () => {
  it("#ui-portal ichidagi nishon — true; sahifadagisi va null — false", () => {
    render(
      <>
        <button type="button">sahifa</button>
        <Portal layer="dropdown">
          <button type="button">ro'yxat</button>
        </Portal>
      </>,
    );
    expect(isInUiLayer(screen.getByText("ro'yxat"))).toBe(true);
    expect(isInUiLayer(screen.getByText("sahifa"))).toBe(false);
    expect(isInUiLayer(null)).toBe(false);
  });
});

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeShellBottomInset } from "./shellInset";
import { computePopoverPosition, usePopover, type PopoverPositionInput } from "./usePopover";

/** Popover joylashuvi: ostida, ag'darish, surish, eni maydonga teng; hook — fixed uslub va yangilanish. */

const box = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

const base: PopoverPositionInput = {
  anchor: box(100, 100, 240, 40),
  floating: { width: 200, height: 200 },
  viewport: { top: 0, left: 0, width: 1440, height: 900 },
  placement: "bottom-start",
  offset: 8,
  padding: 8,
  matchWidth: false,
};

describe("computePopoverPosition", () => {
  it("sukut: maydon ostida, chap chetdan, 8 px oraliq", () => {
    const pos = computePopoverPosition(base);
    expect(pos).toMatchObject({ top: 148, left: 100, side: "bottom", placement: "bottom-start" });
    expect(pos.availableHeight).toBe(900 - 8 - 140 - 8);
  });

  it("pastda joy yetmasa va tepada ko'p bo'lsa — tepaga ag'dariladi", () => {
    const pos = computePopoverPosition({ ...base, anchor: box(100, 700, 240, 40) });
    expect(pos.side).toBe("top");
    expect(pos.placement).toBe("top-start");
    expect(pos.top).toBe(700 - 8 - 200);
  });

  it("ikkala tomonda ham sig'masa — kattarog'ida, balandlik qolgan joyga cheklanadi", () => {
    const pos = computePopoverPosition({ ...base, anchor: box(100, 300, 240, 40), floating: { width: 200, height: 1200 } });
    expect(pos.side).toBe("bottom");
    expect(pos.availableHeight).toBe(900 - 8 - 340 - 8);
  });

  it("o'ng chetdan chiqib ketmaydi (shift)", () => {
    const pos = computePopoverPosition({ ...base, anchor: box(1350, 100, 80, 40), floating: { width: 300, height: 100 } });
    expect(pos.left).toBe(1440 - 8 - 300);
  });

  it("end — o'ng chetga tekislanadi", () => {
    const pos = computePopoverPosition({ ...base, placement: "bottom-end" });
    expect(pos.left).toBe(340 - 200);
  });

  it("matchWidth: eni maydonga teng; 'min' — kamida maydon eni", () => {
    expect(computePopoverPosition({ ...base, matchWidth: true }).width).toBe(240);
    const min = computePopoverPosition({ ...base, matchWidth: "min" });
    expect(min.width).toBeUndefined();
    expect(min.minWidth).toBe(240);
  });

  it("telefon: panel ekrandan keng bo'lsa — eni cheklanadi, chapdan 8 px", () => {
    const pos = computePopoverPosition({
      ...base,
      viewport: { top: 0, left: 0, width: 390, height: 844 },
      anchor: box(16, 100, 358, 44),
      floating: { width: 600, height: 300 },
    });
    expect(pos.maxWidth).toBe(374);
    expect(pos.left).toBe(8);
  });
});

const Harness = ({ open }: { open: boolean }) => {
  const { anchorRef, floatingRef, floatingStyles, placement } = usePopover<HTMLButtonElement>({
    open,
    matchWidth: true,
    maxHeight: 280,
  });
  return (
    <>
      <button ref={anchorRef} type="button">
        maydon
      </button>
      {open ? (
        <div ref={floatingRef} data-testid="panel" data-placement={placement} style={floatingStyles}>
          ro'yxat
        </div>
      ) : null}
    </>
  );
};

describe("usePopover", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fixed joylashuv, eni maydonga teng, maxHeight joyga qarab; skrollda yangilanadi", () => {
    let top = 100;
    vi.spyOn(HTMLButtonElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({ ...box(40, top, 300, 40), x: 40, y: top, toJSON: () => ({}) }) as DOMRect,
    );
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 1;
    });

    render(<Harness open />);
    const panel = screen.getByTestId("panel");
    expect(panel.style.position).toBe("fixed");
    expect(panel.style.top).toBe("148px");
    expect(panel.style.left).toBe("40px");
    expect(panel.style.width).toBe("300px");
    expect(panel.style.maxHeight).toBe("280px");
    expect(panel.style.visibility).toBe("");

    top = 200;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(panel.style.top).toBe("248px");
    expect(raf).toHaveBeenCalled();
  });

  it("telefon pastki menyusi (`--shell-bottom-inset`) ostiga tushmaydi — joy menyu ustigacha", () => {
    vi.spyOn(HTMLButtonElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({ ...box(16, 600, 358, 40), x: 16, y: 600, toJSON: () => ({}) }) as DOMRect,
    );
    // jsdom oynasi 768 px: menyusiz pastda 768 − 8 − 640 − 8 = 112 px joy.
    const { unmount } = render(<Harness open />);
    expect(screen.getByTestId("panel").style.maxHeight).toBe("112px");
    unmount();

    writeShellBottomInset(64);
    try {
      render(<Harness open />);
      // Menyu bilan: (768 − 64) − 8 − 640 − 8 = 48 px.
      expect(screen.getByTestId("panel").style.maxHeight).toBe("48px");
    } finally {
      writeShellBottomInset(null);
    }
  });
});

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeferredMount from "./DeferredMount";

type Callback = (entries: Array<{ isIntersecting: boolean }>) => void;

describe("DeferredMount (NIFAnCvf)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the heavy widget unmounted (space reserved) until it scrolls near the viewport", () => {
    let trigger: Callback = () => undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: Callback) {
          trigger = callback;
        }
        observe() {}
        disconnect() {}
      },
    );

    const { container } = render(
      <DeferredMount minHeight={600}>
        <div>xarita</div>
      </DeferredMount>,
    );

    expect(screen.queryByText("xarita")).not.toBeInTheDocument();
    // Joy oldindan egallangan — mount bo'lganda sahifa sakramaydi.
    expect((container.firstChild as HTMLElement).style.minHeight).toBe("600px");

    act(() => trigger([{ isIntersecting: true }]));

    expect(screen.getByText("xarita")).toBeInTheDocument();
  });

  it("NIFAnCvf: `ready` bo'lmaguncha kuzatilmaydi — skeletlar ostida ekranga tushsa ham mount qilinmaydi", () => {
    const observe = vi.fn();
    let trigger: Callback = () => undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: Callback) {
          trigger = callback;
        }
        observe = observe;
        disconnect() {}
      },
    );

    const { rerender } = render(
      <DeferredMount minHeight={300} ready={false}>
        <div>grafik</div>
      </DeferredMount>,
    );
    expect(observe).not.toHaveBeenCalled();
    expect(screen.queryByText("grafik")).not.toBeInTheDocument();

    rerender(
      <DeferredMount minHeight={300} ready>
        <div>grafik</div>
      </DeferredMount>,
    );
    expect(observe).toHaveBeenCalledTimes(1);
    act(() => trigger([{ isIntersecting: true }]));
    expect(screen.getByText("grafik")).toBeInTheDocument();
  });

  it("mounts right away where IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(
      <DeferredMount minHeight={100}>
        <div>grafik</div>
      </DeferredMount>,
    );

    expect(screen.getByText("grafik")).toBeInTheDocument();
  });
});

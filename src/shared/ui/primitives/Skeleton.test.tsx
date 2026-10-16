import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./Skeleton";

/** Skeleton — `.el-skel-line` / `-block` / `-circle` + `.el-shimmer` (CODE-MAP 2.7): bezak, tokenli, harakat kamaytiriladi. */
describe("Skeleton", () => {
  it("sukut: matn qatori, sunken, yaltiraydi (motion-reduce bilan), aria-hidden", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveAttribute("data-skeleton", "line");
    expect(el).toHaveClass("h-3", "rounded-md", "bg-sunken", "animate-pulse", "motion-reduce:animate-none");
    expect(el.className).not.toMatch(/gradient|bg-linear|#/);
  });

  it.each([
    ["block", "rounded-[10px]"],
    ["circle", "rounded-full"],
  ] as const)("%s shakli", (shape, radius) => {
    const { container } = render(<Skeleton shape={shape} width={32} height={32} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass(radius);
    expect(el.style.width).toBe("32px");
    expect(el.style.height).toBe("32px");
  });

  it("tone='border', width foizda, animated=false", () => {
    const { container } = render(<Skeleton tone="border" width="60%" animated={false} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass("bg-border");
    expect(el).not.toHaveClass("animate-pulse");
    expect(el.style.width).toBe("60%");
  });
});

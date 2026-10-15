import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "./Spinner";

/** YUKLANISH HALQASI — `.el-spinner` (16 / 18 / 32), `currentColor`, harakat kamaytirilganda to'xtaydi. */

const classesOf = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

describe("Spinner", () => {
  it("sukut: bezak (aria-hidden), 16px, 2px chiziq, currentColor, o'ng chorak shaffof", () => {
    const { container } = render(<Spinner />);
    const ring = container.querySelector("[data-spinner]")!;
    expect(ring).toHaveAttribute("aria-hidden", "true");
    expect(classesOf(ring)).toEqual(
      expect.arrayContaining(["size-4", "border-2", "border-current", "border-r-transparent", "rounded-full"]),
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("aylanish 0,7 s, «Harakatni kamaytirish»da to'xtaydi", () => {
    const { container } = render(<Spinner />);
    expect(classesOf(container.querySelector("[data-spinner]")!)).toEqual(
      expect.arrayContaining(["animate-[spin_0.7s_linear_infinite]", "motion-reduce:animate-none"]),
    );
  });

  it.each([
    ["sm", ["size-4", "border-2"]],
    ["md", ["size-[18px]", "border-2"]],
    ["lg", ["size-8", "border-3"]],
  ] as const)("o'lcham %s", (size, expected) => {
    const { container } = render(<Spinner size={size} />);
    expect(classesOf(container.querySelector("[data-spinner]")!)).toEqual(expect.arrayContaining([...expected]));
  });

  it("label berilsa — role=status va ekran o'quvchi matni, halqa bezak bo'lib qoladi", () => {
    const { container } = render(<Spinner size="lg" label="Yuklanmoqda…" className="mx-auto" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Yuklanmoqda…");
    expect(classesOf(status)).toContain("mx-auto");
    expect(container.querySelector("[data-spinner]")).toHaveAttribute("aria-hidden", "true");
  });

  it("rang klassi yo'q — faqat currentColor (tugma matni rangini oladi)", () => {
    const { container } = render(<Spinner />);
    const classes = classesOf(container.querySelector("[data-spinner]")!);
    expect(classes.filter((c) => /^(text|bg)-/.test(c))).toEqual([]);
  });
});

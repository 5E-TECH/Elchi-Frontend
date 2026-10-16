import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import { SkeletonChart, SkeletonLines, SkeletonList, SkeletonTable, SlowLoadingHint } from "./SkeletonPresets";

/** Tayyor skeletlar — `tizim-loading` 03/13, `tizim-errors` «Yuklanmoqda», `tizim-charts` «Yuklanmoqda». */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

describe("SkeletonPresets", () => {
  it("SkeletonLines: 60% · 100% · 80%, border ton, aria-hidden", () => {
    const { container } = render(<SkeletonLines />);
    const lines = container.querySelectorAll("[data-skeleton]");
    expect([...lines].map((line) => (line as HTMLElement).style.width)).toEqual(["60%", "100%", "80%"]);
    for (const line of lines) {
      expect(line).toHaveAttribute("aria-hidden", "true");
      expect(line).toHaveClass("bg-border");
    }
  });

  it("SkeletonTable: sarlavha 40 px (`sunken`), qatorlar 56 px, telefonda kartalar; ustun nomlari matn bo'lib", () => {
    const { container } = render(<SkeletonTable rows={3} columns={["Buyurtma", "Mijoz", "Summa"]} mobileRows={2} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("rounded-[14px]", "border", "border-border", "bg-surface");
    const desktop = root.firstElementChild as HTMLElement;
    expect(desktop).toHaveClass("max-md:hidden");
    const [header, ...rows] = [...desktop.children] as HTMLElement[];
    expect(header).toHaveClass("h-10", "bg-sunken");
    expect(header).toHaveTextContent("BuyurtmaMijozSumma");
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row).toHaveClass("h-14");
    expect(screen.getByText("Summa")).toHaveClass("text-right");
    const mobile = root.querySelector("[data-skeleton-preset='list']");
    expect(mobile).toHaveClass("hidden", "max-md:flex");
    expect(mobile?.children).toHaveLength(2);
  });

  it("SkeletonTable: ustun soni berilsa — sarlavhada ham skelet; `slow` — pastki qator izohi", () => {
    render(<SkeletonTable columns={4} slow />);
    expect(screen.getByRole("status")).toHaveTextContent("Kutish uzoq davom etmoqda — internet sekin bo'lishi mumkin");
    expect(screen.getByRole("status")).toHaveClass("border-t", "border-border");
  });

  it("SkeletonList va SkeletonChart", () => {
    const { container } = render(
      <>
        <SkeletonList rows={4} />
        <SkeletonChart bars={6} />
      </>,
    );
    expect(container.querySelector("[data-skeleton-preset='list']")?.children).toHaveLength(4);
    const chart = container.querySelector("[data-skeleton-preset='chart']") as HTMLElement;
    expect(chart).toHaveClass("h-[200px]", "items-end", "border-b", "border-border");
    expect(chart.children).toHaveLength(6);
    expect(chart.firstElementChild).toHaveClass("max-w-6", "bg-border");
  });

  it("SlowLoadingHint: soat ikonkasi aria-hidden, role=status", () => {
    render(<SlowLoadingHint />);
    const hint = screen.getByRole("status");
    expect(hint.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(hint).toHaveClass("text-[13px]", "text-text-muted");
  });
});

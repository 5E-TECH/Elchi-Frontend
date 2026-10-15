import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import { ThemePair } from "./ThemePair";

/** `ThemePair` — kunduzgi + tungi panel; `layout` panellar joylashuvini tanlaydi. */
describe("ThemePair", () => {
  const panels = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>("[data-kit-theme]")).map((panel) =>
      panel.getAttribute("data-kit-theme"),
    );

  it("sukut (split): ikki panel, keng ekranda yonma-yon, md dan tor bo'lsa ustma-ust", () => {
    const { container } = renderWithProviders(<ThemePair>namuna</ThemePair>, { route: "/ops/ui-kit" });
    expect(panels(container)).toEqual(["light", "dark"]);
    const pair = container.querySelector("[data-kit-layout]");
    expect(pair).toHaveAttribute("data-kit-layout", "split");
    expect(pair).toHaveClass("grid-cols-2", "max-md:grid-cols-1");
  });

  it("layout=stack — har doim ustma-ust (grid-cols-2 umuman yo'q)", () => {
    const { container } = renderWithProviders(<ThemePair layout="stack">namuna</ThemePair>, {
      route: "/ops/ui-kit",
    });
    const pair = container.querySelector("[data-kit-layout]");
    expect(pair).toHaveAttribute("data-kit-layout", "stack");
    expect(pair).toHaveClass("grid-cols-1");
    expect(pair?.className).not.toContain("grid-cols-2");
  });

  it("className va qolgan atributlar tashqi konteynerga o'tadi", () => {
    const { container } = renderWithProviders(
      <ThemePair layout="stack" className="mt-2" data-testid="pair" aria-label="Juftlik">
        namuna
      </ThemePair>,
      { route: "/ops/ui-kit" },
    );
    const pair = screen.getByTestId("pair");
    expect(pair).toBe(container.querySelector("[data-kit-layout]"));
    expect(pair).toHaveClass("mt-2");
    expect(pair).toHaveAttribute("aria-label", "Juftlik");
  });

  it("funksiya-children har panel mavzusini oladi; ?theme-pair=0 — bitta joriy panel", () => {
    const { container, unmount } = renderWithProviders(
      <ThemePair>{(theme) => <span>mavzu-{theme}</span>}</ThemePair>,
      { route: "/ops/ui-kit" },
    );
    expect(screen.getByText("mavzu-light")).toBeInTheDocument();
    expect(screen.getByText("mavzu-dark")).toBeInTheDocument();
    expect(container.querySelector('[data-kit-theme="dark"]')).toHaveClass("dark");
    unmount();

    const single = renderWithProviders(
      <ThemePair layout="stack">{(theme) => <span>mavzu-{theme}</span>}</ThemePair>,
      { route: "/ops/ui-kit?theme-pair=0" },
    );
    expect(panels(single.container)).toEqual(["current"]);
    expect(screen.getByText("mavzu-current")).toBeInTheDocument();
  });
});

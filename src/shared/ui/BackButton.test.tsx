import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import BackButton from "./BackButton";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

/**
 * xYWDHMTi: `BackButton` — v1 rang nomlari (binafsha `main` matn rangi tungi mavzuda 2.05–2.95:1) o'rniga faqat v2
 * tokenlari. Xatti-harakat o'zgarmagan: `onClick` → `to` → `navigate(-1)`.
 */
describe("BackButton (v2 tokenlari)", () => {
  it("klasslarda v1 nomlari va `dark:` juftlari yo'q; matn `text`, hover `action-fg`", () => {
    renderWithProviders(<BackButton />);
    const button = screen.getByRole("button", { name: "Orqaga" });
    const classes = button.className.split(/\s+/);
    const legacy = classes.filter((name) =>
      /(^|:)(text|bg|border)-(main|maindark|primary|primarydark|purple[\w-]*)$|^dark:|border-soft|^\[|color:var/.test(name),
    );
    expect(legacy).toEqual([]);
    expect(classes).toEqual(expect.arrayContaining(["text-text", "bg-surface", "border-border", "hover:text-action-fg"]));
    // Telefonda faqat ikonka (`sm:` telefon chegarasi emas — `max-md:`).
    expect(screen.getByText("Orqaga")).toHaveClass("max-md:hidden");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("fayl manbasida ham v1 rang nomi yo'q (design-guard: legacy / dark-pair / palette)", () => {
    const source = readFileSync(resolve(__dirname, "BackButton.tsx"), "utf8");
    expect(source).not.toMatch(/\b(?:text|bg|border)-(?:main|maindark|primary|primarydark)\b|dark:|--color-border-soft/);
  });

  it("xatti-harakat: onClick ustun, keyin `to`, bo'lmasa navigate(-1)", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { unmount } = renderWithProviders(<BackButton onClick={onClick} to="/x" />);
    await user.click(screen.getByRole("button", { name: "Orqaga" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
    unmount();

    renderWithProviders(<BackButton to="/branches" label="Filiallar" />);
    await user.click(screen.getByRole("button", { name: "Filiallar" }));
    expect(navigateMock).toHaveBeenLastCalledWith("/branches");
  });
});

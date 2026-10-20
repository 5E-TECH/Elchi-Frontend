import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import SkipLink, { MAIN_CONTENT_ID } from "./SkipLink";

/**
 * «Asosiy kontentga o'tish» (KI-S2, maket `superadmin-orders-list-skip-link`): ikkinchi darajali tugma ko'rinishi,
 * faqat `:focus-visible` da ko'rinadi, bosilsa fokus + skroll kontentga, URL'ga `#hash` yozilmaydi.
 */
const renderLink = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <SkipLink />
      <div id={MAIN_CONTENT_ID} tabIndex={-1}>
        <h1>Buyurtmalar</h1>
      </div>
    </I18nextProvider>,
  );

afterEach(async () => {
  await i18n.changeLanguage("uz");
});

describe("SkipLink", () => {
  it("matn va ko'rinish maketdagidek: secondary tugma, ArrowDown, chap yuqorida, faqat focus-visible da", () => {
    renderLink();
    const link = screen.getByRole("link", { name: "Asosiy kontentga o'tish" });
    expect(link).toHaveAttribute("href", "#main-content");
    expect(link).toHaveClass("border-border-strong", "bg-surface", "text-text"); // secondary
    expect(link).toHaveClass("fixed", "top-3", "left-3", "z-60");
    expect(link).toHaveClass("opacity-0", "pointer-events-none", "focus-visible:opacity-100", "focus-visible:translate-y-0");
    const icon = link.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("width", "18");
  });

  it("bosilsa: fokus va skroll kontentga, standart o'tish (#hash) to'xtatiladi", () => {
    renderLink();
    const target = document.getElementById(MAIN_CONTENT_ID) as HTMLElement;
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;

    const link = screen.getByRole("link", { name: "Asosiy kontentga o'tish" });
    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(false);
    expect(target).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });

  it.each([
    ["ru", "Перейти к основному содержимому"],
    ["en", "Skip to main content"],
  ])("%s tilida", async (lang, label) => {
    await i18n.changeLanguage(lang);
    renderLink();
    expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
  });
});

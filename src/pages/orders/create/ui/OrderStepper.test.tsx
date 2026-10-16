import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrderStepper from "./OrderStepper";
import { renderWithProviders } from "../../../../test/test-utils";

/** Qadamlar kartasi — maket `*-create-manual-step1` / `*-create-manual-step2` (`nav` «Qadamlar»). */
describe("OrderStepper (dizayn v2)", () => {
  // Oradagi chiziq (`li aria-hidden`) ro'yxatda sanalmaydi — faqat ikki qadam.
  const steps = () => within(screen.getByRole("navigation", { name: "Qadamlar" })).getAllByRole("listitem");

  it("1-qadam: joriy qadam «Market tanlang», keyingisi «Mijoz va mahsulotlar»", () => {
    renderWithProviders(<OrderStepper step={1} />);

    const [first, second] = steps();
    expect(first).toHaveAttribute("aria-current", "step");
    expect(first).toHaveTextContent("1-qadam");
    expect(first).toHaveTextContent("Market tanlang");
    expect(second).not.toHaveAttribute("aria-current");
    expect(second).toHaveTextContent("2-qadam");
    expect(second).toHaveTextContent("Mijoz va mahsulotlar");
    // 1-qadamda «O'zgartirish» yo'q.
    expect(screen.queryByRole("button", { name: "Marketni o'zgartirish" })).not.toBeInTheDocument();
  });

  it("qadamlar orasidagi chiziq ekran o'quvchidan yashirin va telefonda ko'rinmaydi", () => {
    renderWithProviders(<OrderStepper step={1} />);

    const connector = screen.getByRole("navigation", { name: "Qadamlar" }).querySelector("li[aria-hidden='true']");
    expect(connector).toHaveClass("max-md:hidden");
  });

  it("2-qadam: bajarilgan qadamda market nomi va «O'zgartirish» (1-qadamga qaytaradi)", () => {
    const onChangeMarket = vi.fn();
    renderWithProviders(<OrderStepper step={2} marketName="Baraka Shop" onChangeMarket={onChangeMarket} />);

    const [first, second] = steps();
    expect(first).not.toHaveAttribute("aria-current");
    expect(first).toHaveTextContent("1-qadam · Market");
    expect(first).toHaveTextContent("Baraka Shop");
    expect(second).toHaveAttribute("aria-current", "step");

    const change = screen.getByRole("button", { name: "Marketni o'zgartirish" });
    expect(change).toHaveTextContent("O'zgartirish");
    fireEvent.click(change);
    expect(onChangeMarket).toHaveBeenCalledTimes(1);
  });
});

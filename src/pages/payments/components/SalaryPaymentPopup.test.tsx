import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SalaryPaymentPopup from "./SalaryPaymentPopup";
import { renderWithProviders } from "../../../test/test-utils";
import { scanSource } from "../../../../scripts/design-guard.mjs";
import popupSource from "./SalaryPaymentPopup.tsx?raw";

/** Maosh to'lash — pul kassadan chiqadi, shuning uchun tasdiqlash oynasi orqali (DESIGN_SYSTEM §8). */

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), history: [] as Array<Record<string, unknown>> }));

vi.mock("../../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({
    createSalary: { mutate: mocks.mutate, isPending: false },
    useGetSalaryByUser: () => ({ data: mocks.history, isLoading: false }),
  }),
}));

const employee = { id: "u1", name: "Jasur Tursunov", role: "courier", salary: 3000000 };

describe("SalaryPaymentPopup", () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
    mocks.history = [];
  });

  it("shows a payment confirmation (amount, from → to) before paying", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SalaryPaymentPopup employee={employee} isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Maosh to'lash" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Maosh to'lovini tasdiqlang" });
    expect(dialog).toHaveTextContent("Asosiy kassa");
    expect(dialog).toHaveTextContent("Jasur Tursunov");
    expect(dialog).toHaveTextContent("Naqd");
    expect(mocks.mutate).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.mutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Maosh to'lash" }));
    const again = await screen.findByRole("alertdialog", { name: "Maosh to'lovini tasdiqlang" });
    await user.click(within(again).getByRole("button", { name: "Maosh to'lash" }));

    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", amount: 3000000, type: "cash" }),
      expect.any(Object),
    );
  });

  /**
   * xYWDHMTi «161b9c»: tungi rejimda `--color-main` matn sifatida 2.05–2.95:1 — v1 popupdagi eski aliaslar
   * (`text-main`, `bg-main`, `bg-primary`, `text-maindark`, `--color-text-muted-dark` …) v2 tokenlariga almashtirilgan
   * (ko'rinish tuzilmasi o'zgarmagan): matn/ikonka — `text-action-fg` (tunda ≥ 4.5:1), fon — `bg-action` + `text-on-solid`.
   */
  it("eski rang aliaslari yo'q: design-guard «legacy» 0, matn rangi — text-action-fg", () => {
    const scan = scanSource("src/pages/payments/components/SalaryPaymentPopup.tsx", popupSource);
    expect(scan.violations.filter((hit) => hit.rule === "legacy").map((hit) => `${hit.line}: ${hit.match}`)).toEqual([]);
    expect(popupSource).not.toMatch(/(?<![\w-])(?:text|bg|border|ring|divide|placeholder:text)-main(?![\w-])|--color-main\b/);

    mocks.history = [{ id: "s1", amount: -500000, payment_date: "2026-10-10T09:00:00.000Z" }];
    renderWithProviders(<SalaryPaymentPopup employee={employee} isOpen onClose={vi.fn()} />);
    const heading = screen.getByRole("heading", { name: "Jasur Tursunov" });
    const section = heading.closest("section")!;
    const classes = [section, ...Array.from(section.querySelectorAll("*"))].map((node) => node.getAttribute("class") ?? "");
    expect(classes.filter((value) => /(?:^|\s)(?:[\w-]+:)*(?:text|bg|border|ring|divide)-(?:main|maindark|primary|primarydark)(?:\/\d+)?(?=\s|$)/.test(value))).toEqual([]);
    // Tarix sarlavhasi va qator ikonkalari — matn rangi `text-action-fg`.
    const icons = Array.from(section.querySelectorAll("svg.lucide-history, .lucide-wallet-cards"))
      .map((icon) => icon.closest("[class*='text-']")?.getAttribute("class") ?? icon.getAttribute("class") ?? "");
    expect(icons.some((value) => /(?:^|\s)text-action-fg(?:\s|$)/.test(value))).toBe(true);
    expect(section).toHaveClass("bg-raised", "text-text");
  });
});

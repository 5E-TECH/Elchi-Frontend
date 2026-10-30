import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../../../i18n";
import { renderWithProviders } from "../../../../test/test-utils";
import { SelectionBar } from "./SelectionBar";

/** Chop etish menyusi ikonkalari — `design/icon-registry.json`: A4 varaq — «Hujjat» (`FileText`), `LayoutGrid` emas. */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

describe("SelectionBar — print menu", () => {
  it("«A4 varaq» uses the document icon (FileText), not the cards-view LayoutGrid", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SelectionBar
        selectedCount={2}
        selectedTotal={300_000}
        allSelected={false}
        onToggleAll={vi.fn()}
        transferHint={false}
        canOpenBatches={false}
        onPrint={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Chop etish/ }));
    const items = within(screen.getByRole("menu")).getAllByRole("menuitem");
    const a4 = items.find((item) => /A4/.test(item.textContent ?? ""))!;
    expect(a4.querySelector("svg.lucide-file-text")).not.toBeNull();
    expect(a4.querySelector("svg.lucide-layout-grid")).toBeNull();
  });
});

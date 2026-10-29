import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import BatchPrintMenu from "./BatchPrintMenu";

vi.mock("../../../features/print-receipts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../features/print-receipts")>()),
  preloadReceiptPrinting: () => Promise.resolve(),
}));

/** Paket «Chop etish» menyusi telefonda — pastki varaqa (eng yaqin maket `courier-mails-detail-print-menu`). */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

describe("BatchPrintMenu — telefon (< 768)", () => {
  beforeEach(() => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("max-width: 767px"),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the bottom sheet with a title and description; picking «A5 varaq» prints A5 and closes it", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(<BatchPrintMenu onSelect={onSelect} />);

    const trigger = screen.getByRole("button", { name: "Chop etish" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(trigger);
    const sheet = screen.getByRole("dialog", { name: "Chop etish" });
    expect(sheet).toHaveTextContent("Paket cheki chop etiladi: termal yorliq yoki A5 varaq");
    await user.click(within(sheet).getByRole("menuitem", { name: /A5 varaq/ }));
    expect(onSelect).toHaveBeenCalledWith("a5");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileText, Globe } from "lucide-react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { renderWithProviders } from "../../test/test-utils";
import PrintModeSelect, { type PrintSelectOption } from "./PrintModeSelect";

/** Chop etish menyusi — WAI-ARIA menu button, ichi dizayn v2 (`.el-btn-secondary` + `.el-menu`). */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const OPTIONS: PrintSelectOption[] = [
  { id: "browser", label: "Brauzer orqali chop etish", hint: "Faqat jadvalni chop etadi", icon: <Globe size={16} /> },
  { id: "pdf", label: "PDF yorliq (100×60 mm)", hint: "Har bir buyurtmaga alohida yorliq", icon: <FileText size={16} /> },
];

describe("PrintModeSelect (v2)", () => {
  it("header: «Chop etish N» — v2 secondary tugma, aria-haspopup=menu; soni 0 bo'lsa o'chiq", () => {
    const { unmount } = renderWithProviders(
      <PrintModeSelect count={6} onSelect={() => undefined} buttonLabel="Chop etish" options={OPTIONS} />,
    );
    const trigger = screen.getByRole("button", { name: "Chop etish 6" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("data-variant", "secondary");
    unmount();
    renderWithProviders(<PrintModeSelect count={0} onSelect={() => undefined} buttonLabel="Chop etish" options={OPTIONS} />);
    expect(screen.getByRole("button", { name: /Chop etish/ })).toBeDisabled();
  });

  it("loading (chek tayyorlanmoqda): tugma band, menyu ochilmaydi; ochilganda onOpen (oldindan yuklash)", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const { rerender } = renderWithProviders(
      <PrintModeSelect count={2} onSelect={() => undefined} buttonLabel="Chop etish" options={OPTIONS} onOpen={onOpen} loading />,
    );
    const trigger = screen.getByRole("button", { name: /Chop etish/ });
    expect(trigger).toHaveAttribute("aria-busy", "true");
    await user.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();

    rerender(<PrintModeSelect count={2} onSelect={() => undefined} buttonLabel="Chop etish" options={OPTIONS} onOpen={onOpen} />);
    await user.click(screen.getByRole("button", { name: "Chop etish 2" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("ochilganda fokus birinchi bandda; ↓ ↑ yuradi; Enter tanlaydi, fokus tugmaga qaytadi", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <PrintModeSelect count={6} onSelect={onSelect} buttonLabel="Chop etish" menuLabel="Chop etish usuli" options={OPTIONS} />,
    );
    const trigger = screen.getByRole("button", { name: "Chop etish 6" });
    await user.click(trigger);
    const menu = screen.getByRole("menu", { name: "Chop etish usuli" });
    expect(menu.parentElement).toHaveAttribute("data-ui-layer", "dropdown");
    expect(screen.getByText("6 ta tanlangan")).toBeInTheDocument();
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items[0]).toHaveFocus();
    await user.keyboard("{End}{Enter}");
    expect(onSelect).toHaveBeenCalledWith("pdf");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("Esc yopadi va fokus tugmaga; tashqariga bosish yopadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <PrintModeSelect count={2} onSelect={() => undefined} buttonLabel="Chop etish" options={OPTIONS} />
        <button type="button">Boshqa</button>
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Chop etish 2" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Boshqa" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("allowEmpty: soni 0 bo'lsa ham faol; o'chiq band (aria-disabled) fokuslanadi, lekin tanlanmaydi (HJ5sLHiz)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const options: PrintSelectOption[] = [
      { ...OPTIONS[0], disabled: true, hint: "Avval buyurtmalarni tanlang" },
      { ...OPTIONS[1], disabled: true },
      { id: "post_receipt", label: "Pochta cheki", icon: <FileText size={16} /> },
    ];
    const { rerender } = renderWithProviders(
      <PrintModeSelect count={0} onSelect={onSelect} buttonLabel="Chop etish" options={options} />,
    );
    // `allowEmpty` siz — eski xatti-harakat: 0 da o'chiq.
    expect(screen.getByRole("button", { name: "Chop etish 0" })).toBeDisabled();

    rerender(<PrintModeSelect count={0} allowEmpty onSelect={onSelect} buttonLabel="Chop etish" options={options} />);
    const trigger = screen.getByRole("button", { name: "Chop etish 0" });
    expect(trigger).toBeEnabled();
    await user.click(trigger);
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.getAttribute("aria-disabled"))).toEqual(["true", "true", null]);
    // Ochilganda — birinchi faol band; ↓ o'chiq bandlardan ham o'tadi (WAI-ARIA: fokuslanadi).
    expect(items[2]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items[0]).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(items[1]);
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(items[2]);
    expect(onSelect).toHaveBeenCalledWith("post_receipt");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    // Hamma band o'chiq — tugma ham o'chiq.
    rerender(
      <PrintModeSelect
        count={0}
        allowEmpty
        onSelect={onSelect}
        buttonLabel="Chop etish"
        options={options.slice(0, 2)}
      />,
    );
    expect(screen.getByRole("button", { name: "Chop etish 0" })).toBeDisabled();
  });

  it("icon: ikonka tugma (nomi buttonLabel), ↑ — oxirgi bandga", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PrintModeSelect variant="icon" count={1} onSelect={() => undefined} buttonLabel="Chop etish" options={OPTIONS} />,
    );
    const trigger = screen.getByRole("button", { name: "Chop etish" });
    trigger.focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getAllByRole("menuitem")[1]).toHaveFocus();
  });
  it("Tab menyuni yopadi va fokusni tugmaga qaytaradi (keyingi elementga brauzer o'tkazadi — preventDefault yo'q)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PrintModeSelect count={2} onSelect={() => undefined} buttonLabel="Chop etish" options={OPTIONS} />);
    const trigger = screen.getByRole("button", { name: "Chop etish 2" });
    await user.click(trigger);
    const item = screen.getAllByRole("menuitem")[0];
    expect(item).toHaveFocus();
    const notPrevented = fireEvent.keyDown(item, { key: "Tab" });
    expect(notPrevented).toBe(true);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("hideCount + ariaLabel: «Barchasini chop etish» — sonsiz, nomi aniq (maket `courier-mails-detail-refused`)", () => {
    renderWithProviders(
      <PrintModeSelect
        count={5}
        hideCount
        ariaLabel="Barcha 5 ta buyurtma yorlig'ini chop etish"
        onSelect={() => undefined}
        buttonLabel="Barchasini chop etish"
        options={OPTIONS}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Barcha 5 ta buyurtma yorlig'ini chop etish" });
    expect(trigger).toHaveTextContent(/^Barchasini chop etish$/);
  });

  it("sheetTitle kompyuterda menyuni o'zgartirmaydi (sukut — popover)", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PrintModeSelect count={2} onSelect={() => undefined} buttonLabel="Chop etish" sheetTitle="Chop etish" options={OPTIONS} />,
    );
    await user.click(screen.getByRole("button", { name: "Chop etish 2" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  describe("telefon (< 768) + sheetTitle — pastki varaqa (maket `courier-mails-detail-print-menu`)", () => {
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

    it("sarlavha va izoh, bandlar; tanlash onSelect chaqiradi va varaqani yopadi", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      renderWithProviders(
        <PrintModeSelect
          count={2}
          onSelect={onSelect}
          buttonLabel="Chop etish"
          menuLabel="Chop etish menyusi"
          sheetTitle="Chop etish"
          sheetDescription="2 ta tanlangan buyurtma yorlig'i chop etiladi"
          options={OPTIONS}
        />,
      );
      const trigger = screen.getByRole("button", { name: "Chop etish 2" });
      expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
      await user.click(trigger);
      const sheet = screen.getByRole("dialog", { name: "Chop etish" });
      expect(sheet).toHaveTextContent("2 ta tanlangan buyurtma yorlig'i chop etiladi");
      const menu = within(sheet).getByRole("menu", { name: "Chop etish menyusi" });
      await user.click(within(menu).getByRole("menuitem", { name: /PDF yorliq/ }));
      expect(onSelect).toHaveBeenCalledWith("pdf");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
  });
});

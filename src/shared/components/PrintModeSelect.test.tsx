import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileText, Globe } from "lucide-react";
import { beforeAll, describe, expect, it, vi } from "vitest";
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
});

import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Popup from "./Popup";

const Page = ({ onClose }: { onClose?: () => void }) => {
  const [open, setOpen] = useState(false);
  const close = () => {
    onClose?.();
    setOpen(false);
  };
  return (
    <>
      <input aria-label="fon qidiruvi" />
      <button type="button" onClick={() => setOpen(true)}>
        Mahsulot yaratish
      </button>
      <button type="button">fon tugmasi</button>
      <Popup isShow={open} onClose={close} labelledBy="popup-title">
        <h2 id="popup-title">Marketni tanlang</h2>
        <input aria-label="market qidiruvi" />
        <button type="button">Tanlash</button>
        <button type="button" onClick={close}>
          Bekor
        </button>
      </Popup>
    </>
  );
};

describe("Popup focus handling", () => {
  afterEach(() => {
    document.getElementById("root")?.remove();
  });

  it("is a named modal dialog and moves focus into it on open", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Mahsulot yaratish" }));

    const dialog = screen.getByRole("dialog", { name: "Marketni tanlang" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("never lets Tab or Shift+Tab leave the open dialog", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Mahsulot yaratish" }));
    const dialog = screen.getByRole("dialog");

    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 12; i += 1) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("closes on Escape and returns focus to the button that opened it", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Mahsulot yaratish" }));

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mahsulot yaratish" })).toHaveFocus();
  });

  it("makes the app root inert while open and restores it on close", async () => {
    const user = userEvent.setup();
    const appRoot = document.createElement("div");
    appRoot.id = "root";
    document.body.appendChild(appRoot);
    render(<Page />, { container: appRoot });

    const opener = screen.getByRole("button", { name: "Mahsulot yaratish" });
    await user.click(opener);
    expect(appRoot).toHaveAttribute("inert");
    // Oyna body'ga portal qilingan — o'zi inert emas.
    expect(appRoot.contains(screen.getByRole("dialog"))).toBe(false);

    await user.click(screen.getByRole("button", { name: "Bekor" }));
    expect(appRoot).not.toHaveAttribute("inert");
    expect(opener).toHaveFocus();
  });
});

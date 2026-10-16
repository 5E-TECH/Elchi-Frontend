import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pencil } from "lucide-react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import UpdatePopup from "./popupUpdate";

/** Eski `UpdatePopup` API'si v2 `Dialog` ustida: sarlavha, «Saqlash» / «Bekor qilish», yuklanish, rasm maydoni. */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

describe("UpdatePopup (v2 o'ram)", () => {
  it("nomli oyna, maydonlar tanada, «Saqlash» onSave, «Bekor qilish» va Esc onClose", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <UpdatePopup isOpen onClose={onClose} onSave={onSave} title="Mahsulotni tahrirlash" icon={<Pencil />}>
        <label>
          Mahsulot nomi
          <input />
        </label>
      </UpdatePopup>,
    );
    const dialog = screen.getByRole("dialog", { name: "Mahsulotni tahrirlash" });
    expect(within(dialog).getByRole("textbox", { name: "Mahsulot nomi" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("`isLoading` — «Saqlash» yuklanishda va qayta bosilmaydi, oyna yopilmaydi", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <UpdatePopup isOpen isLoading onClose={onClose} onSave={onSave} title="A" saveLabel="O'zgarishlarni saqlash">
        x
      </UpdatePopup>,
    );
    const save = screen.getByRole("button", { name: "Yuborilmoqda..." });
    expect(save).toHaveAttribute("aria-busy", "true");
    await user.click(save);
    await user.keyboard("{Escape}");
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("rasm maydoni: yorliq, fayl tanlansa onChange; rasm bo'lsa «Almashtirish»", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <UpdatePopup isOpen onClose={() => {}} onSave={() => {}} title="A" imageProps={{ label: "Rasm", onChange }}>
        x
      </UpdatePopup>,
    );
    const input = screen.getByLabelText("Rasm");
    expect(input).toHaveAttribute("type", "file");
    expect(screen.getByText("Rasm yuklash")).toBeInTheDocument();
    const file = new File(["x"], "kurtka.png", { type: "image/png" });
    await user.upload(input, file);
    expect(onChange).toHaveBeenCalledWith(file);

    rerender(
      <UpdatePopup
        isOpen
        onClose={() => {}}
        onSave={() => {}}
        title="A"
        imageProps={{ label: "Rasm", onChange, previewUrl: "https://example.test/a.png" }}
      >
        x
      </UpdatePopup>,
    );
    expect(screen.getByText("Almashtirish")).toBeInTheDocument();
  });
});

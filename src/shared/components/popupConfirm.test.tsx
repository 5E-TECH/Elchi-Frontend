import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import PopupConfirm from "./popupConfirm";

/**
 * Eski `PopupConfirm` API'si v2 `ConfirmDialog` ustida: variant → ton, sukut matnlar, `isLoading` qulfi,
 * matnli `message` — izoh, elementli — tana.
 */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

type Props = Partial<Parameters<typeof PopupConfirm>[0]>;

const Harness = (props: Props) => {
  const [open, setOpen] = useState(true);
  return (
    <PopupConfirm
      isOpen={open}
      onClose={() => setOpen(false)}
      onConfirm={() => setOpen(false)}
      title="Buyurtmani o'chirish"
      message="Bu buyurtma butunlay o'chiriladi. Davom etasizmi?"
      {...props}
    />
  );
};

describe("PopupConfirm (v2 o'ram)", () => {
  it("danger (sukut): modal oyna (v1 roli `dialog`), qizil «O'chirish», fokus «Bekor qilish» da, matn — izoh", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog", { name: "Buyurtmani o'chirish" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Bu buyurtma butunlay o'chiriladi. Davom etasizmi?");
    expect(within(dialog).getByRole("button", { name: "O'chirish" })).toHaveAttribute("data-variant", "danger");
    expect(within(dialog).getByRole("button", { name: "Bekor qilish" })).toHaveFocus();
  });

  it("warning va success — ko'k tugma, sukut matn «Tasdiqlash»", () => {
    const { rerender } = render(<Harness variant="warning" />);
    expect(screen.getByRole("button", { name: "Tasdiqlash" })).toHaveAttribute("data-variant", "primary");
    rerender(<Harness variant="success" confirmLabel="Qabul qilish" />);
    expect(screen.getByRole("button", { name: "Qabul qilish" })).toHaveAttribute("data-variant", "primary");
  });

  it("tasdiqlash — onConfirm, bekor — onClose (Esc ham)", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<PopupConfirm isOpen onClose={onClose} onConfirm={onConfirm} title="A" cancelLabel="Orqaga" />);
    await user.click(screen.getByRole("button", { name: "O'chirish" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Orqaga" }));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("`isLoading` — tugmalar qulf, Esc yopmaydi", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PopupConfirm isOpen isLoading onClose={onClose} onConfirm={() => {}} title="A" />);
    expect(screen.getByRole("button", { name: "Yuborilmoqda..." })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Bekor qilish" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("elementli `message` — oyna tanasida", () => {
    render(
      <Harness
        message={
          <div>
            <strong>Malika Yusupova</strong>
          </div>
        }
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Malika Yusupova").closest("[data-dialog-body]")).not.toBeNull();
  });

  it("async `onConfirm` rad etilsa — xato oyna ichida", async () => {
    const user = userEvent.setup();
    render(<PopupConfirm isOpen onClose={() => {}} onConfirm={() => Promise.reject(new Error("x")) as never} title="A" />);
    await user.click(screen.getByRole("button", { name: "O'chirish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Amalni bajarib bo'lmadi");
  });
});

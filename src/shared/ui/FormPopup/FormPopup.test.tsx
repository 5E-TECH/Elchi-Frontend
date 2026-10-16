import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import FormPopup from "./FormPopup";

const renderPopup = (props: { isLoading?: boolean; submitDisabled?: boolean } = {}) =>
  render(
    <I18nextProvider i18n={i18n}>
      <FormPopup
        isOpen
        onClose={vi.fn()}
        onSubmit={(event) => event.preventDefault()}
        title="Sinov oynasi"
        submitLabel="Yuborish"
        {...props}
      >
        <p>Tana</p>
      </FormPopup>
    </I18nextProvider>,
  );

describe("FormPopup submit button", () => {
  it("is enabled by default (existing callers are unchanged)", () => {
    renderPopup();

    expect(screen.getByRole("button", { name: "Yuborish" })).toBeEnabled();
  });

  it("submitDisabled disables the submit button without the loading label", () => {
    renderPopup({ submitDisabled: true });

    expect(screen.getByRole("button", { name: "Yuborish" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Yuborilmoqda..." })).not.toBeInTheDocument();
  });

  it("isLoading still disables it and shows the submitting label", () => {
    renderPopup({ isLoading: true });

    expect(screen.getByRole("button", { name: "Yuborilmoqda..." })).toBeDisabled();
  });

  it("never disables the cancel button", () => {
    renderPopup({ submitDisabled: true });

    expect(screen.getByRole("button", { name: "Bekor qilish" })).toBeEnabled();
  });
});

describe("FormPopup — v2 Dialog o'rami", () => {
  it("nomli modal oyna, izoh; «Yopish» va Esc onClose; Enter formani yuboradi", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <I18nextProvider i18n={i18n}>
        <FormPopup isOpen onClose={onClose} onSubmit={onSubmit} title="Yangi filial" description="Filial ma'lumotlari">
          <label>
            Nomi
            <input />
          </label>
        </FormPopup>
      </I18nextProvider>,
    );
    const dialog = screen.getByRole("dialog", { name: "Yangi filial" });
    expect(dialog).toHaveAccessibleDescription("Filial ma'lumotlari");
    // Sukut kenglik (`max-w-2xl`) → v2 keng forma 640.
    expect(dialog).toHaveClass("max-w-[640px]");
    await user.type(screen.getByRole("textbox", { name: "Nomi" }), "Qarshi{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Yopish" }));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("`isLoading` — «Bekor qilish» ham qulf, Esc yopmaydi", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const onClose = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <FormPopup isOpen isLoading onClose={onClose} onSubmit={() => {}} title="A" widthClassName="max-w-xl">
          <p>Tana</p>
        </FormPopup>
      </I18nextProvider>,
    );
    expect(screen.getByRole("dialog", { name: "A" })).toHaveClass("max-w-[560px]");
    expect(screen.getByRole("button", { name: "Bekor qilish" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("antd `Form.Item` oralig'i important bilan (antd CSS-in-JS qatlamsiz — oddiy utility yutqazadi)", () => {
    renderPopup();
    const body = screen.getByText("Tana").closest<HTMLElement>("[data-dialog-body]")!;
    expect(body.className).toContain("[&_.ant-form-item]:mb-4!");
    expect(body.className).toContain("[&>div>.ant-form-item]:mb-0!");
  });
});

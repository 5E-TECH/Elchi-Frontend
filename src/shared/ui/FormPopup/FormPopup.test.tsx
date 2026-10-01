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

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import ConfirmButton from "./ConfirmButton";

/** Eski `ConfirmButton`: tugma bosilsa v2 tasdiqlash oynasi, `onConfirm` tugagach yopiladi, xato oynada. */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

describe("ConfirmButton (v2 tasdiqlash oynasi)", () => {
  it("bosilsa alertdialog ochiladi; tasdiqlansa onConfirm va yopiladi; fokus tugmaga qaytadi", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(async () => {});
    render(
      <ConfirmButton danger confirmTitle="Filialni o'chirish" onConfirm={onConfirm}>
        O'chirish
      </ConfirmButton>,
    );
    const trigger = screen.getByRole("button", { name: "O'chirish" });
    await user.click(trigger);
    const dialog = screen.getByRole("alertdialog", { name: "Filialni o'chirish" });
    const confirmButton = within(dialog).getByRole("button", { name: "O'chirish" });
    expect(confirmButton).toHaveAttribute("data-variant", "danger");
    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("`danger` siz — ko'k «Tasdiqlash»; `confirmLabel` / `confirmTone` bilan aniq fe'l", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ConfirmButton confirmTitle="Sozlamani o'chirish" onConfirm={() => {}}>
        Amal
      </ConfirmButton>,
    );
    await user.click(screen.getByRole("button", { name: "Amal" }));
    expect(screen.getByRole("button", { name: "Tasdiqlash" })).toHaveAttribute("data-variant", "primary");

    rerender(
      <ConfirmButton confirmTitle="Sozlamani o'chirish" confirmTone="danger" confirmLabel="O'chirish" onConfirm={() => {}}>
        Amal
      </ConfirmButton>,
    );
    expect(screen.getByRole("button", { name: "O'chirish" })).toHaveAttribute("data-variant", "danger");
  });

  it("onConfirm xatosi — oyna ochiq, xato ichida", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmButton danger confirmTitle="A" onConfirm={() => Promise.reject(new Error("x"))}>
        O'chirish
      </ConfirmButton>,
    );
    await user.click(screen.getByRole("button", { name: "O'chirish" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "O'chirish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Amalni bajarib bo'lmadi");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

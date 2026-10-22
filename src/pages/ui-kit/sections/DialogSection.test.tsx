import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { DialogSection } from "./DialogSection";

/**
 * «Oynalar va tasdiqlash» (`?section=dialog`): joyida chizilgan oyna va tasdiqlash oynalari ikkala mavzuda
 * (maket matnlari), telefon varaqalari, qoidalar; jonli namuna — haqiqiy modal va `useConfirm()`.
 */

// `ConfirmHost` — `renderWithProviders` ichida (ilovadagi `UiHost` kabi).
const renderSection = () => renderWithProviders(<DialogSection />, { route: "/ops/ui-kit?section=dialog" });

describe("DialogSection", () => {
  it("langar, sarlavha, kunduzgi va tungi panel", () => {
    renderSection();
    expect(document.querySelector('[data-kit-section="dialog"]')).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Oynalar va tasdiqlash" })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-kit-theme]")).toHaveLength(2);
  });

  it("har panelda: oyna, ikki telefon varaqasi va besh tasdiqlash holati (maket matnlari)", () => {
    renderSection();
    const light = document.querySelector<HTMLElement>('[data-kit-theme="light"]')!;
    const panels = within(light).getAllByRole("group");
    expect(panels.map((panel) => panel.getAttribute("data-layout"))).toEqual([
      "dialog",
      "sheet",
      "sheet",
      "dialog",
      "dialog",
      "dialog",
      "dialog",
      "dialog",
    ]);
    expect(within(light).getByRole("group", { name: "Smenani yopish" })).toBeInTheDocument();
    expect(within(light).getByRole("group", { name: "Kunni yakunlashni tasdiqlang" })).toBeInTheDocument();
    expect(within(light).getByRole("group", { name: "To'lovni tasdiqlang" })).toBeInTheDocument();
    expect(within(light).getAllByText("Bu amalni qaytarib bo'lmaydi.")).toHaveLength(1);
    expect(within(light).getByText("1 250 000")).toBeInTheDocument();
    expect(within(light).getByRole("alert")).toHaveTextContent("Mahsulotni o'chirib bo'lmadi");
  });

  it("joyida chizilgan namunalar modal emas (sahifada `dialog` roli yo'q)", () => {
    renderSection();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("jonli namuna: oyna ochiladi, Esc yopadi; `useConfirm` bekor qilinsa natija yoziladi", async () => {
    const user = userEvent.setup();
    renderSection();
    const open = screen.getByRole("button", { name: "Oynani ochish" });
    await user.click(open);
    const dialog = screen.getByRole("dialog", { name: "Smenani yopish" });
    expect(within(dialog).getByRole("textbox", { name: /Sanalgan naqd/ })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(open).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Tasdiqlashni ochish" }));
    const confirm = screen.getByRole("alertdialog", { name: "O'chirishni tasdiqlang" });
    await user.click(within(confirm).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Javob: bekor qilindi"));
  });
});

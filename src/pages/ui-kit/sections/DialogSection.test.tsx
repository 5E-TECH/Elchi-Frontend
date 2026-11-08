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

  it("har panelda: oyna, ikki telefon varaqasi, yetti tasdiqlash holati va forma oynasi (maket matnlari)", () => {
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
      "dialog",
      "dialog",
      "dialog",
    ]);
    expect(within(light).getByRole("group", { name: "Smenani yopish" })).toBeInTheDocument();
    expect(within(light).getByRole("group", { name: "Kunni yakunlashni tasdiqlang" })).toBeInTheDocument();
    expect(within(light).getByRole("group", { name: "To'lovni tasdiqlang" })).toBeInTheDocument();
    expect(within(light).getAllByText("Bu amalni qaytarib bo'lmaydi.")).toHaveLength(1);
    expect(within(light).getByText("1 250 000")).toBeInTheDocument();
    const alerts = within(light).getAllByRole("alert");
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      "Mahsulotni o'chirib bo'lmadi: u faol buyurtmada bor.",
      "Ko'pi bilan 7 220 000 so'mChegara — Baraka Shopga berilishi kerak qoldiq va joriy to'lov yig'indisi. «Orqaga»ni bosib summani o'zgartiring.",
      "Internet aloqasi yo'qSo'rov yetib bormadi yoki javob kelmadi. Aloqa tiklangach «Qaytarish»ni qayta bosing — to'lov ikki marta qaytarilmaydi.",
    ]);
  });

  it("T6 N2: xato kodi bo'yicha — `blockConfirm` tugmani o'chiradi, oflaynda WifiOff va tugma faol", () => {
    renderSection();
    const light = within(document.querySelector<HTMLElement>('[data-kit-theme="light"]')!);
    const blocked = light.getByRole("group", { name: "Summani tahrirlashni tasdiqlang" });
    const edit = within(blocked).getByRole("button", { name: "Tahrirlash" });
    expect(edit).toBeDisabled();
    expect(edit).toHaveAttribute("aria-describedby", within(blocked).getByRole("alert").id);
    expect(within(blocked).getByRole("button", { name: "Orqaga" })).toBeEnabled();

    const offline = light.getByRole("group", { name: "To'lovni qaytarishni tasdiqlang" });
    expect(within(offline).getByRole("alert").querySelector("svg")).toHaveClass("lucide-wifi-off");
    expect(within(offline).getByRole("button", { name: "Qaytarish" })).toBeEnabled();
    expect(within(offline).getByText("Qaytarishni bekor qilib bo'lmaydi.")).toBeInTheDocument();
  });

  it("T6 N2: forma oynasi — `TransferSummary` xulosasi va «Sabab» hisoblagichi xato qatorida", () => {
    renderSection();
    const light = within(document.querySelector<HTMLElement>('[data-kit-theme="light"]')!);
    const form = light.getByRole("group", { name: "To'lovni qaytarish" });
    expect(within(form).getByText("Qaytariladigan to'lov")).toBeInTheDocument();
    expect(within(form).getByText("1 850 000")).toBeInTheDocument();
    expect(within(form).getByText("Qayerdan")).toBeInTheDocument();
    const reason = within(form).getByRole("textbox", { name: "Sabab" });
    expect(reason).toHaveAttribute("maxlength", "500");
    expect(reason).toHaveAccessibleDescription("Kamida 5 ta belgi yozing");
    expect(within(form).getByText("4 / 500")).toHaveAttribute("data-field-aside");
    expect(within(form).getByRole("button", { name: "Davom etish" })).toBeDisabled();
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

import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { toastStore } from "../../../shared/lib/notify";
import { renderWithProviders } from "../../../test/test-utils";
import { FeedbackSection } from "./FeedbackSection";

/** «Qalqib chiquvchi xabarlar» (`?section=feedback`): `tizim-feedback` 01 namunalari + jonli `notify()`. */

afterEach(() => {
  act(() => toastStore.reset());
});

describe("FeedbackSection", () => {
  it("langar, sarlavha, ikki panel; har panelda 6 ta xabar (maketdagi matnlar)", () => {
    renderWithProviders(<FeedbackSection />, { route: "/ops/ui-kit?section=feedback" });
    expect(document.querySelector('[data-kit-section="feedback"]')).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Qalqib chiquvchi xabarlar" })).toBeInTheDocument();
    const panels = document.querySelectorAll<HTMLElement>("[data-kit-theme]");
    expect(panels).toHaveLength(2);
    for (const panel of panels) {
      expect(panel.querySelectorAll("[data-tone]")).toHaveLength(6);
      expect(within(panel).getByText("To'lov o'tkazildi")).toBeInTheDocument();
      expect(within(panel).getByText("1 250 000 so'm asosiy kassaga o'tkazildi.")).toBeInTheDocument();
      expect(within(panel).getByText("Hisobot yuklanmadi")).toBeInTheDocument();
      expect(within(panel).getByRole("button", { name: "Bekor qilish" })).toBeInTheDocument();
    }
  });

  it("«Sinab ko'rish»: haqiqiy xabar Toaster'da chiqadi; «4 ta ketma-ket» — 3 tasi qoladi", async () => {
    const user = userEvent.setup();
    // `<Toaster />` — `renderWithProviders` ichida (ilovadagi `UiHost` kabi).
    renderWithProviders(<FeedbackSection />, { route: "/ops/ui-kit?section=feedback" });
    await user.click(screen.getByRole("button", { name: "Xato" }));
    const region = screen.getByRole("region", { name: "Bildirishnomalar" });
    expect(within(region).getByText("Ruxsat yo'q")).toBeInTheDocument();
    expect(document.querySelector('[data-toast-announcer="alert"]')).toHaveTextContent("Ruxsat yo'q");

    await user.click(screen.getByRole("button", { name: "4 ta ketma-ket" }));
    expect(toastStore.getSnapshot().filter((toast) => !toast.closing)).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Hammasini yopish" }));
    expect(toastStore.getSnapshot().filter((toast) => !toast.closing)).toHaveLength(0);
  });
});

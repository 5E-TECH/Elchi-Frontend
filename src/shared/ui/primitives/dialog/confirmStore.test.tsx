import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfirmHost } from "../ConfirmHost";
import { cancelAllConfirms, confirm, getConfirmSnapshot } from "./confirmStore";

/**
 * Navbat: hali ko'rsatilmagan (navbatda kutayotgan) so'rov bekor qilinsa — darhol olib tashlanadi.
 * Aks holda u `open: false` bilan navbat boshiga chiqib, hech qachon `onExited` bermasdi va keyingi
 * barcha `confirm()` larni to'sib qo'yardi (brauzer «Orqaga» → `cancelAllConfirms`).
 */
describe("confirmStore — navbat", () => {
  it("«Orqaga» (cancelAllConfirms) navbatdagi so'rovni ham yopadi — keyingi confirm() ochiladi", async () => {
    render(<ConfirmHost />);
    let first!: Promise<boolean>;
    let queued!: Promise<boolean>;
    act(() => {
      first = confirm({ title: "Birinchi", confirmLabel: "Tasdiqlash" });
      queued = confirm({ title: "Navbatdagi", confirmLabel: "Tasdiqlash" });
    });
    expect(await screen.findByRole("alertdialog", { name: "Birinchi" })).toBeInTheDocument();

    act(() => cancelAllConfirms());
    await expect(first).resolves.toBe(false);
    await expect(queued).resolves.toBe(false);
    // Ko'rsatilmagan so'rov navbatda qolmaydi.
    expect(getConfirmSnapshot().requests.map((request) => request.options.title)).not.toContain("Navbatdagi");

    act(() => {
      void confirm({ title: "Keyingi", confirmLabel: "Tasdiqlash" });
    });
    expect(await screen.findByRole("alertdialog", { name: "Keyingi" })).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog", { name: "Navbatdagi" })).not.toBeInTheDocument();
  });
});

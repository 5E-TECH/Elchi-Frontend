import type { ComponentProps } from "react";
import { describe, expect, expectTypeOf, it } from "vitest";
import * as notificationCreate from "./index";
import * as telegramLink from "../telegram-link";

/**
 * TOZ-1: `features/notification-create` faqat «Bildirishnoma qo'shish» oynasini beradi. Havola so'rovi
 * (`useRequestGroupLink`), turlari, `GROUP_LINK_POLL_MS`, muddat hisobi (`toLinkWindow`), sanoq va QR — yagona
 * manba `features/telegram-link` (TG-A); bu yerda nusxa yoki qayta eksport qaytmasin.
 */
describe("features/notification-create — ochiq API (TOZ-1)", () => {
  it("faqat NotificationFormModal eksport qilinadi", () => {
    expect(Object.keys(notificationCreate)).toEqual(["NotificationFormModal"]);
  });

  it("`marketId` prop'i yo'q — oyna har doim market tanlovisiz ochiladi (iste'molchi faqat /notifications)", () => {
    type Props = ComponentProps<typeof notificationCreate.NotificationFormModal>;
    expectTypeOf<Props>().not.toHaveProperty("marketId");
    expectTypeOf<keyof Props>().toEqualTypeOf<"open" | "onClose">();
  });

  it("umumiy havola qismlari telegram-link da", () => {
    expect(telegramLink.useRequestGroupLink).toBeTypeOf("function");
    expect(telegramLink.toLinkWindow).toBeTypeOf("function");
    expect(telegramLink.GROUP_LINK_POLL_MS).toBe(4_000);
  });

  // Ataylab qat'iy «ratchet» (TOZ-1): bu feature'ga yangi `lib/`/`model/`/`api/` fayl qo'shilsa test yiqiladi.
  // Testni bo'shatishdan oldin tekshiring — havola mantig'i `features/telegram-link` ga tegishli emasmi?
  it("feature papkasida telegram-link nusxalari yo'q (api/ va model/ olindi)", () => {
    const files = Object.keys(import.meta.glob("./**/*.{ts,tsx}"));
    expect(
      files.filter((file) => !file.startsWith("./ui/") && file !== "./index.test.ts"),
      "TOZ-1 ratchet: notification-create da faqat ui/ va index.ts bo'ladi — havola so'rovi/turlari/muddat hisobi " +
        "features/telegram-link da (TG-A). Yangi fayl haqiqatan shu feature'niki bo'lsa, ro'yxatni ongli kengaytiring.",
    ).toEqual(["./index.ts"]);
  });
});

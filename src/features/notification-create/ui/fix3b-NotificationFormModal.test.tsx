import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NotificationFormModal from "./NotificationFormModal";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * fix3b CODE-02 — "Token orqali ulash" bo'limi olib tashlandi: u
 * `{ token }` yuborardi, `POST /notifications/connect-by-token` esa
 * `{ text, group_id }` talab qiladi (doim 400). Guruh botda (market tokeni
 * bilan) yoki shu forma orqali (market + guruh ID) ulanadi.
 */

const apiPostMock = vi.fn();

vi.mock("../../../shared/api/instance", () => ({
  api: { post: (...args: unknown[]) => apiPostMock(...args) },
}));

vi.mock("../../../entities/markets", () => ({
  useMarkets: () => ({
    useGetMarkets: () => ({ data: { data: [{ id: "201", name: "Yandex" }] }, isLoading: false }),
  }),
}));

describe("NotificationFormModal (fix3b CODE-02)", () => {
  it("token orqali ulash bo'limi yo'q, qo'lda ulash formasi bor (v2 oyna)", () => {
    renderWithProviders(<NotificationFormModal open onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Bildirishnoma qo'shish" });
    expect(within(dialog).getByRole("textbox", { name: "Telegram guruh ID" })).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: "Market" })).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Bildirishnomani saqlash" }),
    ).toBeInTheDocument();

    expect(screen.queryByText("Token orqali ulash")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Token")).not.toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("bot nomi sozlanmagan bo'lsa — ogohlantirish, «Botni guruhga qo'shish» havolasi yo'q", () => {
    vi.stubEnv("VITE_TELEGRAM_NOTIFICATION_BOT_USERNAME", "");
    renderWithProviders(<NotificationFormModal open onClose={vi.fn()} />);

    expect(screen.getByText("Bot nomi sozlanmagan")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Botni guruhga qo'shish" })).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it("bot nomi bor bo'lsa — «Botni guruhga qo'shish» t.me havolasi", () => {
    vi.stubEnv("VITE_TELEGRAM_NOTIFICATION_BOT_USERNAME", "@elchi_notify_bot");
    renderWithProviders(<NotificationFormModal open onClose={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Botni guruhga qo'shish" })).toHaveAttribute(
      "href",
      "https://t.me/elchi_notify_bot?startgroup=notification",
    );
    vi.unstubAllEnvs();
  });
});

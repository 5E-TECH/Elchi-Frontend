import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NotificationFormModal from "./NotificationFormModal";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * fix3b CODE-02 — "Token orqali ulash" bo'limi olib tashlangan edi (u `{ token }` yuborardi, backend esa
 * `{ text, group_id }` talab qilardi — doim 400). 6jXw0DDr: qo'lda «Telegram group ID» maydoni ham
 * olib tashlandi — guruh endi bir martalik havola orqali ulanadi (`NotificationFormModal.test.tsx`).
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({ api: { get: mocks.get, post: mocks.post } }));

describe("NotificationFormModal (fix3b CODE-02, 6jXw0DDr)", () => {
  it("token orqali ulash va qo'lda guruh ID maydoni yo'q; ochilganda hech narsa yuborilmaydi", async () => {
    mocks.get.mockResolvedValue({ data: { data: [{ id: "201", name: "Yandex" }] } });
    renderWithProviders(<NotificationFormModal open onClose={vi.fn()} />);

    expect(await screen.findByRole("dialog", { name: "Bildirishnoma qo'shish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ulash havolasini olish" })).toBeInTheDocument();

    expect(screen.queryByText("Token orqali ulash")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Token")).not.toBeInTheDocument();
    expect(screen.queryByText(/Telegram group ID/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Telegram guruh ID")).not.toBeInTheDocument();
    expect(screen.queryByText("Guruh ID ni qanday olish mumkin?")).not.toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});

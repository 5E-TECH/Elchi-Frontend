import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationsPage from "./NotificationsPage";
import { renderWithProviders } from "../../../test/test-utils";

/** /notifications (v2): sarlavha, bitta asosiy amal, tahrirlash oynasi (`PATCH /notifications/:id`). */

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), del: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, patch: mocks.patch, post: mocks.post, delete: mocks.del },
}));

const ROW = {
  id: "90",
  createdAt: "2026-10-06T07:34:00.000Z",
  market_id: "12",
  group_id: "-1002184736577",
  group_type: "cancel",
  bot_slug: null,
  is_active: true,
};

describe("NotificationsPage", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.patch.mockReset();
    mocks.get.mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === "markets"
            ? { data: [{ id: "12", name: "Baraka Shop" }, { id: "27", name: "Nur Elektronika" }] }
            : { statusCode: 200, data: { items: [ROW], pagination: { total: 1, page: 1, limit: 10 } } },
      }),
    );
    mocks.patch.mockResolvedValue({ data: { data: ROW } });
  });

  it("sarlavha, izoh va «Bildirishnoma qo'shish» oynasi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Bildirishnomalar" })).toBeInTheDocument();
    expect(
      screen.getByText("Marketlarning Telegram guruhlari: yangi va bekor qilingan buyurtmalar haqida xabar shu yerga boradi"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Bildirishnoma qo'shish" }));
    expect(await screen.findByRole("dialog", { name: "Bildirishnoma qo'shish" })).toBeInTheDocument();
  });

  it("tahrirlash: maydonlar qatordan to'ladi, saqlash — PATCH", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    await user.click(await screen.findByRole("button", { name: "Baraka Shop — bekor qilingan guruhi: tahrirlash" }));
    const dialog = await screen.findByRole("dialog", { name: "Bildirishnomani tahrirlash" });

    const groupId = within(dialog).getByRole("textbox", { name: /Telegram guruh ID/ });
    expect(groupId).toHaveValue("-1002184736577");
    expect(within(dialog).getByRole("radio", { name: "Bekor qilinganlar guruhi" })).toBeChecked();

    await user.clear(groupId);
    await user.click(within(dialog).getByRole("button", { name: "O'zgarishlarni saqlash" }));
    expect(await within(dialog).findByText("Guruh ID sini kiriting")).toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();

    await user.type(groupId, "-1009999");
    await user.click(within(dialog).getByRole("radio", { name: "Yangi buyurtmalar guruhi" }));
    await user.click(within(dialog).getByRole("button", { name: "O'zgarishlarni saqlash" }));

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("notifications/90", {
        market_id: "12",
        group_id: "-1009999",
        group_type: "create",
      }),
    );
    expect(await screen.findByText("Bildirishnoma yangilandi")).toBeInTheDocument();
  });
});

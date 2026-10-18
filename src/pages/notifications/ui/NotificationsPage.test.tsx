import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import NotificationsPage from "./NotificationsPage";

/**
 * «Bildirishnomalar» — marketlarning Telegram guruhlari (dizayn v2, maketlar `superadmin-notifications-telegram-groups`,
 * `-create-dialog`, `-delete-dialog`). Haqiqiy UI orqali: jadval (holat ustuni — 9HIaV80X), sahifalash, qo'shish oynasi
 * (bir martalik havola — oqimning o'zi `NotificationFormModal.test.tsx` da), tahrirlash payloadi, o'chirish tasdig'i.
 * dev'ning `widgets/notification-table` testlari (jadval sahifa ichiga ko'chgan) shu yerga birlashtirilgan.
 */

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../../../shared/api/api", () => ({ api }));

const GROUPS = [
  {
    id: "7",
    market_id: "12",
    market: { id: "12", name: "Baraka Shop", phone_number: "+998901112233" },
    group_id: "-1002184736577",
    group_type: "cancel",
    is_active: true,
    created_at: "2026-10-01T10:14:00+05:00",
  },
  {
    // Backend qatori (`toPublicTelegramMarket`): market obyekti yo'q — nom `GET /markets` dan.
    id: "8",
    market_id: "27",
    group_id: "-1001937420815",
    group_type: "create",
    bot_slug: null,
    is_active: false,
    createdAt: "2026-09-28T17:45:00+05:00",
  },
];

const MARKETS = [
  { id: 12, name: "Baraka Shop", phone_number: "+998901112233" },
  { id: 27, name: "Nur Elektronika" },
  { id: 52, name: "Bahor Kiyim", phone_number: "+998904123675" },
];

beforeEach(() => {
  api.get
    .mockReset()
    .mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === "notifications") {
        return Promise.resolve({
          data: {
            data: {
              items: GROUPS,
              meta: {
                total: 24,
                page: config?.params?.page ?? 1,
                limit: config?.params?.limit ?? 10,
              },
            },
          },
        });
      }
      if (url === "markets") return Promise.resolve({ data: { data: { items: MARKETS } } });
      return Promise.resolve({ data: {} });
    });
  api.post.mockReset().mockResolvedValue({ data: { data: { id: "9" } } });
  api.patch.mockReset().mockResolvedValue({ data: { data: {} } });
  api.delete.mockReset().mockResolvedValue({ data: {} });
});

describe("NotificationsPage — Telegram guruhlari", () => {
  it("header, count badge, rows with market #id, type badge and pagination summary", async () => {
    renderWithProviders(<NotificationsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Bildirishnomalar" })).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: "Ulangan Telegram guruhlari" });
    expect(within(table).getByText("Baraka Shop")).toBeInTheDocument();
    expect(within(table).getByText("#12")).toBeInTheDocument();
    expect(within(table).getByText("-1002184736577")).toBeInTheDocument();
    expect(within(table).getByText("Bekor qilingan buyurtma")).toBeInTheDocument();
    expect(within(table).getByText("Yangi buyurtma")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ulangan guruhlar" })).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("1–10 / 24 ta guruh")).toBeInTheDocument();
    // API'da saralash yo'q — sarlavhada saralash tugmasi chizilmaydi (spec G8).
    expect(within(table).queryByRole("button", { name: /saralash/i })).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("notifications", { params: { page: 1, limit: 10 } });
  });

  it("next page asks the server for page 2", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);
    await screen.findByRole("table", { name: "Ulangan Telegram guruhlari" });

    await user.click(screen.getByRole("button", { name: "Keyingi sahifa" }));
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("notifications", { params: { page: 2, limit: 10 } }),
    );
  });

  it("an emptied last page (e.g. after a delete) goes back to the last existing page", async () => {
    // 2-sahifadagi yagona guruh boshqa joyda o'chirilgan: server 2-sahifa uchun bo'sh ro'yxat, jami 10 qaytaradi.
    api.get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
      if (url !== "notifications") return Promise.resolve({ data: {} });
      const page = Number(config?.params?.page ?? 1);
      return Promise.resolve({
        data: {
          data: {
            items: page === 1 ? GROUPS : [],
            meta: { total: page === 1 ? 11 : 10, page, limit: 10 },
          },
        },
      });
    });
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);
    await screen.findByRole("table", { name: "Ulangan Telegram guruhlari" });
    // 1-sahifa javobida jami 11 (ikki sahifa) — 2-sahifaga o'tamiz, u esa endi bo'sh (jami 10).
    await user.click(screen.getByRole("button", { name: "Keyingi sahifa" }));

    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith("notifications", { params: { page: 1, limit: 10 } }),
    );
    expect(
      await screen.findByRole("table", { name: "Ulangan Telegram guruhlari" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Hali guruh ulanmagan")).not.toBeInTheDocument();
  });

  it("delete asks first (mockup texts); «Bekor qilish» sends nothing", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    await user.click(
      await screen.findByRole("button", { name: "Baraka Shop — bekor qilingan guruhi: o'chirish" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Haqiqatan ham o'chirmoqchimisiz?",
    });
    expect(dialog).toHaveTextContent(
      "Baraka Shop'ning bekor qilingan buyurtmalari haqidagi xabarlar bu guruhga endi yuborilmaydi. Guruhni keyin qayta ulash mumkin.",
    );
    expect(dialog).toHaveTextContent("Guruh ID: -1002184736577");

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("confirmed delete calls DELETE /notifications/:id and shows the toast", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    await user.click(
      await screen.findByRole("button", {
        name: "Nur Elektronika — yangi buyurtma guruhi: o'chirish",
      }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Haqiqatan ham o'chirmoqchimisiz?",
    });
    expect(dialog).toHaveTextContent("Nur Elektronika'ning yangi buyurtmalari haqidagi xabarlar");
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("notifications/8"));
    expect(await screen.findByText("Bildirishnoma o'chirildi")).toBeInTheDocument();
  });

  it("a failed delete keeps the dialog open with the error", async () => {
    api.delete.mockRejectedValueOnce(
      Object.assign(new Error("x"), {
        response: { status: 500, data: { message: "Server xatosi" } },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    await user.click(
      await screen.findByRole("button", {
        name: "Nur Elektronika — yangi buyurtma guruhi: o'chirish",
      }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Haqiqatan ham o'chirmoqchimisiz?",
    });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Server xatosi");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("status column: Faol / Nofaol with the reconnect hint; names come from GET /markets", async () => {
    renderWithProviders(<NotificationsPage />);

    const table = await screen.findByRole("table", { name: "Ulangan Telegram guruhlari" });
    const [, active, inactive] = within(table).getAllByRole("row");

    expect(within(active).getByText("Baraka Shop")).toBeInTheDocument();
    expect(within(active).getByText("Faol")).toBeInTheDocument();
    expect(
      within(active).queryByText("Bot guruhdan chiqarilgan — qayta ulang"),
    ).not.toBeInTheDocument();

    // Qatorda market obyekti yo'q — nom marketlar ro'yxatidan, ostida «#27».
    expect(await within(inactive).findByText("Nur Elektronika")).toBeInTheDocument();
    expect(within(inactive).getByText("#27")).toBeInTheDocument();
    expect(within(inactive).getByText("Yangi buyurtma")).toBeInTheDocument();
    expect(within(inactive).getByText("Nofaol")).toBeInTheDocument();
    expect(within(inactive).getByText("Bot guruhdan chiqarilgan — qayta ulang")).toBeInTheDocument();
  });

  it("a market missing from GET /markets shows #id once (no duplicate sub-line)", async () => {
    api.get.mockImplementation((url: string) => {
      if (url === "notifications") {
        return Promise.resolve({
          data: {
            data: {
              items: [{ ...GROUPS[1], id: "9", market_id: "99" }],
              meta: { total: 1, page: 1, limit: 10 },
            },
          },
        });
      }
      if (url === "markets") return Promise.resolve({ data: { data: { items: MARKETS } } });
      return Promise.resolve({ data: {} });
    });
    renderWithProviders(<NotificationsPage />);

    const table = await screen.findByRole("table", { name: "Ulangan Telegram guruhlari" });
    expect(within(table).getAllByText("#99")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "#99 — yangi buyurtma guruhi: tahrirlash" }),
    ).toBeInTheDocument();
  });

  it("add opens the one-time link dialog — no manual group ID field", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    expect(
      screen.getByText(
        "Marketlarning Telegram guruhlari: yangi va bekor qilingan buyurtmalar haqida xabar shu yerga boradi",
      ),
    ).toBeInTheDocument();
    const add = screen.getByRole("button", { name: "Bildirishnoma qo'shish" });
    expect(add).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(add);
    const dialog = await screen.findByRole("dialog", { name: "Bildirishnoma qo'shish" });
    expect(within(dialog).getByText("Telegram guruhga bildirishnoma ulash")).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Yangi buyurtmalar guruhi" })).toBeChecked();
    expect(
      within(dialog).getByRole("button", { name: "Ulash havolasini olish" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("textbox", { name: /Telegram guruh ID/ }),
    ).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("edit dialog is prefilled, validates the group ID and PATCHes the changed group", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    await user.click(
      await screen.findByRole("button", {
        name: "Baraka Shop — bekor qilingan guruhi: tahrirlash",
      }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Bildirishnomani tahrirlash" });
    const groupInput = within(dialog).getByRole("textbox", { name: /Telegram guruh ID/ });
    expect(groupInput).toHaveValue("-1002184736577");
    expect(within(dialog).getByRole("radio", { name: "Bekor qilinganlar guruhi" })).toBeChecked();
    // Tahrirlashda ulash izohi yo'q (faqat qo'shishda).
    expect(
      within(dialog).queryByText("Telegram guruhga bildirishnoma ulash"),
    ).not.toBeInTheDocument();

    await user.clear(groupInput);
    await user.click(within(dialog).getByRole("button", { name: "O'zgarishlarni saqlash" }));
    expect(await within(dialog).findByText("Guruh ID sini kiriting")).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();

    await user.type(groupInput, " -1009999999999 ");
    await user.click(within(dialog).getByRole("radio", { name: "Yangi buyurtmalar guruhi" }));
    await user.click(within(dialog).getByRole("button", { name: "O'zgarishlarni saqlash" }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("notifications/7", {
        market_id: "12",
        group_id: "-1009999999999",
        group_type: "create",
      }),
    );
    expect(await screen.findByText("Bildirishnoma yangilandi")).toBeInTheDocument();
  });

  it("empty list shows the empty state; a failed list shows the error with retry", async () => {
    api.get.mockImplementation((url: string) =>
      url === "notifications"
        ? Promise.resolve({ data: { data: { items: [], meta: { total: 0 } } } })
        : Promise.resolve({ data: {} }),
    );
    const { unmount } = renderWithProviders(<NotificationsPage />);
    expect(await screen.findByText("Hali guruh ulanmagan")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    unmount();

    api.get.mockImplementation((url: string) =>
      url === "notifications"
        ? Promise.reject(Object.assign(new Error("x"), { response: { status: 500, data: {} } }))
        : Promise.resolve({ data: {} }),
    );
    renderWithProviders(<NotificationsPage />);
    expect(await screen.findByText("Guruhlar ro'yxatini olib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Qayta urinish/ })).toBeInTheDocument();
  });
});

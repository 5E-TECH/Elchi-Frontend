import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import NotificationsPage from "./NotificationsPage";

/**
 * «Bildirishnomalar» — marketlarning Telegram guruhlari (dizayn v2, maketlar `superadmin-notifications-telegram-groups`,
 * `-create-dialog`, `-delete-dialog`). Haqiqiy UI orqali: jadval, sahifalash, qo'shish / tahrirlash payloadi,
 * o'chirish tasdiq oynasi.
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
    created_at: "2026-10-01T10:14:00+05:00",
  },
  {
    id: "8",
    market_id: "27",
    market: { id: "27", name: "Nur Elektronika" },
    group_id: "-1001937420815",
    group_type: "create",
    created_at: "2026-09-28T17:45:00+05:00",
  },
];

const MARKETS = [
  { id: 12, name: "Baraka Shop", phone_number: "+998901112233" },
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

  it("add dialog: validation, then POST { market_id, group_id, group_type }", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    await user.click(screen.getByRole("button", { name: "Bildirishnoma qo'shish" }));
    const dialog = await screen.findByRole("dialog", { name: "Bildirishnoma qo'shish" });
    expect(within(dialog).getByText("Telegram guruhga bildirishnoma ulash")).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Yangi buyurtmalar guruhi" })).toBeChecked();

    await user.click(within(dialog).getByRole("button", { name: "Bildirishnomani saqlash" }));
    expect(await within(dialog).findByText("Marketni tanlang")).toBeInTheDocument();
    expect(within(dialog).getByText("Telegram guruh ID ni kiriting")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("combobox", { name: "Market" }));
    await user.click(await screen.findByRole("option", { name: /^Bahor Kiyim/ }));
    await user.type(
      within(dialog).getByRole("textbox", { name: "Telegram guruh ID" }),
      " -1002251847019 ",
    );
    await user.click(within(dialog).getByRole("radio", { name: "Bekor qilinganlar guruhi" }));
    await user.click(within(dialog).getByRole("button", { name: "Bildirishnomani saqlash" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("notifications", {
        market_id: "52",
        group_id: "-1002251847019",
        group_type: "cancel",
      }),
    );
    expect(await screen.findByText("Bildirishnoma yaratildi")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Bildirishnoma qo'shish" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("edit dialog is prefilled and PATCHes the changed group", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    await user.click(
      await screen.findByRole("button", {
        name: "Baraka Shop — bekor qilingan guruhi: tahrirlash",
      }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Bildirishnomani tahrirlash" });
    const groupInput = within(dialog).getByRole("textbox", { name: "Telegram guruh ID" });
    expect(groupInput).toHaveValue("-1002184736577");
    expect(within(dialog).getByRole("radio", { name: "Bekor qilinganlar guruhi" })).toBeChecked();
    // Tahrirlashda ulash izohi yo'q (faqat qo'shishda).
    expect(
      within(dialog).queryByText("Telegram guruhga bildirishnoma ulash"),
    ).not.toBeInTheDocument();

    await user.clear(groupInput);
    await user.type(groupInput, "-1009999999999");
    await user.click(within(dialog).getByRole("button", { name: "Bildirishnomani saqlash" }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("notifications/7", {
        market_id: "12",
        group_id: "-1009999999999",
        group_type: "cancel",
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

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import NotificationsPage from "./NotificationsPage";

const asPhone = () => {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query.includes("max-width: 767px"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
};

/** Qator menyusini ochib, bandni tanlaydi (desktop popover). */
const pickFromMenu = async (
  user: ReturnType<typeof userEvent.setup>,
  rowLabel: string,
  item: string,
) => {
  await user.click(await screen.findByRole("button", { name: rowLabel }));
  const menu = await screen.findByRole("menu", { name: rowLabel });
  await user.click(within(menu).getByRole("menuitem", { name: item }));
};

/**
 * «Bildirishnomalar» — marketlarning Telegram guruhlari (dizayn v2, maketlar `superadmin-notifications-telegram-groups`,
 * `-row-menu`, `-row-menu-inactive`, `-create-dialog`, `-deactivate-dialog`, `-activate-dialog`, `-delete-dialog`).
 * Haqiqiy UI orqali: jadval (holat ustuni — sabab kelmasa umumiy neytral izoh D1, sababi bilan — NG-C bloki), sahifalash, qo'shish oynasi (bir martalik havola —
 * oqimning o'zi `NotificationFormModal.test.tsx` da), qator menyusi (desktop popover, telefonda pastki varaqa),
 * nofaol qilish / faollashtirish (`PATCH {is_active}`) va o'chirish tasdiqlari. «Tahrirlash» yo'q (NG-S4).
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NotificationsPage — Telegram guruhlari", () => {
  it("header, count badge, rows with market #id, type badge and pagination summary", async () => {
    renderWithProviders(<NotificationsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Bildirishnoma sozlamalari" })).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: "Ulangan Telegram guruhlari" });
    expect(within(table).getByText("Baraka Shop")).toBeInTheDocument();
    expect(within(table).getByText("#12")).toBeInTheDocument();
    expect(within(table).getByText("-1002184736577")).toBeInTheDocument();
    // Tur ikki joyda: «Xabar turi» ustuni (≥ 1024) va planshetda market nomi ostida (CSS bilan bittasi ko'rinadi).
    expect(within(table).getAllByText("Bekor qilingan buyurtma")).toHaveLength(2);
    expect(within(table).getAllByText("Yangi buyurtma")).toHaveLength(2);
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

    await pickFromMenu(user, "Baraka Shop — bekor qilingan guruhi: amallar", "O'chirish");
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

    await pickFromMenu(user, "Nur Elektronika — yangi buyurtma guruhi: amallar", "O'chirish");
    const dialog = await screen.findByRole("alertdialog", {
      name: "Haqiqatan ham o'chirmoqchimisiz?",
    });
    expect(dialog).toHaveTextContent("Nur Elektronika'ning yangi buyurtmalari haqidagi xabarlar");
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("notifications/8"));
    expect(await screen.findByText("Bildirishnoma o'chirildi")).toBeInTheDocument();
  });

  it("a failed delete keeps the dialog open with an i18n error (raw backend text is never shown)", async () => {
    api.delete.mockRejectedValueOnce(
      Object.assign(new Error("x"), {
        response: { status: 500, data: { message: "QueryFailedError: relation telegram_markets" } },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    await pickFromMenu(user, "Nur Elektronika — yangi buyurtma guruhi: amallar", "O'chirish");
    const dialog = await screen.findByRole("alertdialog", {
      name: "Haqiqatan ham o'chirmoqchimisiz?",
    });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Bildirishnomani o'chirishda xatolik yuz berdi");
    expect(alert).not.toHaveTextContent("QueryFailedError");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("row menu (desktop popover): active group → «Nofaol qilish», inactive → «Faollashtirish»; no «Tahrirlash»", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    const activeTrigger = await screen.findByRole("button", {
      name: "Baraka Shop — bekor qilingan guruhi: amallar",
    });
    expect(activeTrigger).toHaveAttribute("aria-haspopup", "menu");
    expect(activeTrigger).toHaveAttribute("aria-expanded", "false");
    await user.click(activeTrigger);
    expect(activeTrigger).toHaveAttribute("aria-expanded", "true");
    let menu = await screen.findByRole("menu", { name: "Baraka Shop — bekor qilingan guruhi: amallar" });
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Nofaol qilish",
      "O'chirish",
    ]);
    // Ochilganda fokus birinchi bandda; ↓ keyingisiga; Esc yopadi va fokusni kebabga qaytaradi.
    await waitFor(() =>
      expect(within(menu).getByRole("menuitem", { name: "Nofaol qilish" })).toHaveFocus(),
    );
    await user.keyboard("{ArrowDown}");
    expect(within(menu).getByRole("menuitem", { name: "O'chirish" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(activeTrigger).toHaveFocus();

    await user.click(
      await screen.findByRole("button", { name: "Nur Elektronika — yangi buyurtma guruhi: amallar" }),
    );
    menu = await screen.findByRole("menu", { name: "Nur Elektronika — yangi buyurtma guruhi: amallar" });
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Faollashtirish",
      "O'chirish",
    ]);
    expect(screen.queryByRole("menuitem", { name: /Tahrirlash/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tahrirlash/ })).not.toBeInTheDocument();
  });

  it("deactivate: danger confirm with mockup texts, PATCH only {is_active: false}, toast", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    await pickFromMenu(user, "Baraka Shop — bekor qilingan guruhi: amallar", "Nofaol qilish");
    const dialog = await screen.findByRole("alertdialog", { name: "Nofaol qilishni tasdiqlang" });
    expect(dialog).toHaveTextContent(
      "Baraka Shop'ning bekor qilingan buyurtmalari haqidagi xabarlar bu guruhga yuborilmaydi. Ulanish o'chirilmaydi — uni istalgan vaqtda amallar menyusidan qayta faollashtirish mumkin.",
    );
    expect(dialog).toHaveTextContent("Guruh ID: -1002184736577");
    expect(within(dialog).getByText("Bekor qilingan buyurtma")).toBeInTheDocument();
    // Maket: «Baraka Shop #12» — 14 px nom, 13 px id, oddiy bo'sh joy (telefonda tur belgisi bir qatorga sig'adi).
    const marketId = within(dialog).getByText("#12");
    expect(marketId).toHaveClass("text-[13px]");
    expect(marketId).not.toHaveClass("ml-1.5");
    expect(marketId.parentElement).toHaveClass("text-sm");
    expect(marketId.parentElement).toHaveTextContent(/^Baraka Shop #12$/);

    expect(within(dialog).getByRole("button", { name: "Nofaol qilish" })).toHaveAttribute(
      "data-variant",
      "danger",
    );
    await user.click(within(dialog).getByRole("button", { name: "Nofaol qilish" }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("notifications/7", { is_active: false }),
    );
    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Guruh nofaol qilindi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("activate: primary confirm with the neutral bot warning, PATCH only {is_active: true}", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    await pickFromMenu(user, "Nur Elektronika — yangi buyurtma guruhi: amallar", "Faollashtirish");
    const dialog = await screen.findByRole("alertdialog", { name: "Faollashtirishni tasdiqlang" });
    expect(dialog).toHaveTextContent(
      "Nur Elektronika'ning yangi buyurtmalari haqidagi xabarlar bu guruhga yana yuboriladi.",
    );
    const warning = within(dialog).getByRole("note");
    expect(warning).toHaveTextContent("Bot guruhda ekanini tekshiring");
    // Sabab kelmadi (`inactive_reason` yo'q) — «Bot guruhdan chiqarilgan» deb yozilmaydi (D1; sababli holat — NG-C bloki).
    expect(dialog).not.toHaveTextContent("Bot guruhdan chiqarilgan");

    expect(within(dialog).getByRole("button", { name: "Faollashtirish" })).toHaveAttribute(
      "data-variant",
      "primary",
    );
    await user.click(within(dialog).getByRole("button", { name: "Faollashtirish" }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("notifications/8", { is_active: true }),
    );
    expect(await screen.findByText("Guruh faollashtirildi")).toBeInTheDocument();
  });

  it("a failed toggle keeps the dialog open with an i18n error; «Bekor qilish» returns focus to the kebab", async () => {
    api.patch.mockRejectedValueOnce(
      Object.assign(new Error("x"), { response: { status: 400, data: { message: "Bad Request" } } }),
    );
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    const label = "Baraka Shop — bekor qilingan guruhi: amallar";
    await pickFromMenu(user, label, "Nofaol qilish");
    const dialog = await screen.findByRole("alertdialog", { name: "Nofaol qilishni tasdiqlang" });
    await user.click(within(dialog).getByRole("button", { name: "Nofaol qilish" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Guruhni nofaol qilib bo'lmadi. Qayta urinib ko'ring.");
    expect(alert).not.toHaveTextContent("Bad Request");

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: label })).toHaveFocus());
  });

  it("phone: card kebab opens a bottom sheet (title, type · ID, inactive status, 52 px items) → confirm", async () => {
    asPhone();
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    const list = await screen.findByRole("list", { name: "Telegram guruhlari" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const trigger = within(list).getByRole("button", {
      name: "Nur Elektronika — yangi buyurtma guruhi: amallar",
    });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(trigger);

    const sheet = await screen.findByRole("dialog", { name: "Nur Elektronika #27" });
    expect(sheet).toHaveTextContent("Yangi buyurtma · -1001937420815");
    expect(within(sheet).getByText("Nofaol")).toBeInTheDocument();
    expect(within(sheet).getByText("Xabarlar bu guruhga yuborilmayapti")).toBeInTheDocument();
    const menu = within(sheet).getByRole("menu", {
      name: "Nur Elektronika — yangi buyurtma guruhi: amallar",
    });
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Faollashtirish", "O'chirish"]);
    for (const item of items) expect(item.className).toContain("min-h-[52px]");

    await user.click(within(menu).getByRole("menuitem", { name: "Faollashtirish" }));
    expect(
      await screen.findByRole("alertdialog", { name: "Faollashtirishni tasdiqlang" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Nur Elektronika #27" })).not.toBeInTheDocument();
  });

  it("status column: Faol / Nofaol with the neutral hint (D1); names come from GET /markets", async () => {
    renderWithProviders(<NotificationsPage />);

    const table = await screen.findByRole("table", { name: "Ulangan Telegram guruhlari" });
    const [, active, inactive] = within(table).getAllByRole("row");

    expect(within(active).getByText("Baraka Shop")).toBeInTheDocument();
    expect(within(active).getByText("Faol")).toBeInTheDocument();
    expect(within(active).queryByText("Xabarlar bu guruhga yuborilmayapti")).not.toBeInTheDocument();

    // Qatorda market obyekti yo'q — nom marketlar ro'yxatidan, ostida «#27».
    expect(await within(inactive).findByText("Nur Elektronika")).toBeInTheDocument();
    expect(within(inactive).getByText("#27")).toBeInTheDocument();
    expect(within(inactive).getAllByText("Yangi buyurtma")).toHaveLength(2);
    expect(within(inactive).getByText("Nofaol")).toBeInTheDocument();
    // Sabab noma'lum — «Nofaol» neytral (qizil emas); «Faol» — yashil.
    expect(within(inactive).getByText("Nofaol").closest(".bg-sunken")).not.toBeNull();
    expect(within(inactive).getByText("Nofaol").closest(".bg-danger-soft")).toBeNull();
    expect(within(active).getByText("Faol").closest(".bg-success-soft")).not.toBeNull();
    expect(within(inactive).getByText("Xabarlar bu guruhga yuborilmayapti")).toBeInTheDocument();
    // Sabab kelmadi — «bot chiqarilgan» deb yozilmaydi (sababli holat — NG-C bloki).
    expect(within(inactive).queryByText(/Bot guruhdan chiqarilgan/)).not.toBeInTheDocument();
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
      screen.getByRole("button", { name: "#99 — yangi buyurtma guruhi: amallar" }),
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

  it("already connected (market, type) — the warning points to delete, not to the removed «Tahrirlash» (NG-S4)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);
    await screen.findByRole("table", { name: "Ulangan Telegram guruhlari" });

    await user.click(screen.getByRole("button", { name: "Bildirishnoma qo'shish" }));
    const dialog = await screen.findByRole("dialog", { name: "Bildirishnoma qo'shish" });
    await user.click(within(dialog).getByRole("combobox", { name: /^Market/ }));
    await user.click(await screen.findByRole("option", { name: /Baraka Shop/ }));
    await user.click(within(dialog).getByRole("radio", { name: "Bekor qilinganlar guruhi" }));

    const alert = await within(dialog).findByRole("alert");
    // Maket `superadmin-notifications-create-exists-dialog` matni.
    expect(alert).toHaveTextContent(
      "Baraka Shop uchun bu turdagi guruh ulangan (ID: -1002184736577). Bot uni almashtirmaydi — boshqa guruh ulash uchun avval eskisini ro'yxatdan o'chiring.",
    );
    expect(alert).not.toHaveTextContent(/tahrirla/i);
    expect(within(dialog).getByRole("button", { name: "Ulash havolasini olish" })).toBeDisabled();
  });

  it("loading skeleton has the table's columns: 36 px icon, type/date hidden below 1024, 64 px kebab", async () => {
    api.get.mockImplementation((url: string) =>
      url === "notifications" ? new Promise(() => {}) : Promise.resolve({ data: {} }),
    );
    const { container } = renderWithProviders(<NotificationsPage />);

    expect(await screen.findByRole("status")).toHaveTextContent("Guruhlar yuklanmoqda");
    const skeleton = container.querySelector("[data-skeleton-preset='notifications-table']") as HTMLElement;
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    const headers = within(skeleton).getAllByRole("columnheader", { hidden: true });
    expect(headers.map((th) => th.textContent)).toEqual([
      "Market",
      "Telegram guruh ID",
      "Xabar turi",
      "Holat",
      "Sana",
      "Amallar",
    ]);
    // Planshetda jadvaldagidek 3 ustun + kebab — ma'lumot kelganda ustunlar sakramaydi.
    expect(headers[2]).toHaveClass("max-lg:hidden");
    expect(headers[4]).toHaveClass("max-lg:hidden");
    expect(headers[5]).toHaveClass("w-16");
    const rows = within(skeleton).getAllByRole("row", { hidden: true }).slice(1);
    expect(rows).toHaveLength(6);
    const icon = rows[0].querySelector("[data-skeleton='block']") as HTMLElement;
    expect(icon.style.width).toBe("36px");
    expect(icon.style.height).toBe("36px");
  });

  it("phone loading skeleton is cards with the market icon (no table)", async () => {
    asPhone();
    api.get.mockImplementation((url: string) =>
      url === "notifications" ? new Promise(() => {}) : Promise.resolve({ data: {} }),
    );
    const { container } = renderWithProviders(<NotificationsPage />);

    await screen.findByRole("status");
    const skeleton = container.querySelector("[data-skeleton-preset='notifications-table']") as HTMLElement;
    expect(within(skeleton).queryByRole("table", { hidden: true })).not.toBeInTheDocument();
    const cards = within(skeleton).getAllByRole("listitem", { hidden: true });
    expect(cards).toHaveLength(6);
    expect((cards[0].querySelector("[data-skeleton='block']") as HTMLElement).style.width).toBe("36px");
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

/**
 * NG-C (G085w5Qr): `inactive_reason` + `inactive_at` — maket `superadmin-notifications-telegram-groups` /
 * `-row-menu-inactive` / `-activate-dialog`: bot guruhga yetolmaydi — qizil «Nofaol» + sababga xos izoh, qo'lda —
 * neytral «Qo'lda nofaol qilingan», `null` yoki noma'lum qiymat — neytral umumiy izoh (D1).
 */
describe("NotificationsPage — nofaollik sababi (NG-C)", () => {
  const REASON_GROUPS = [
    { id: "21", market_id: "27", group_id: "-1001", group_type: "create", is_active: false, inactive_reason: "kicked", inactive_at: "2026-09-28T17:45:00+05:00", createdAt: "2026-09-01T10:00:00+05:00" },
    { id: "22", market_id: "12", group_id: "-1002", group_type: "create", is_active: false, inactive_reason: "manual", inactive_at: null, createdAt: "2026-09-01T10:00:00+05:00" },
    { id: "23", market_id: "52", group_id: "-1003", group_type: "cancel", is_active: false, inactive_reason: "chat_not_found", inactive_at: null, createdAt: "2026-09-01T10:00:00+05:00" },
    { id: "24", market_id: "12", group_id: "-1004", group_type: "cancel", is_active: false, inactive_reason: "blocked_on_send", inactive_at: null, createdAt: "2026-09-01T10:00:00+05:00" },
    // Frontend bilmagan yangi qiymat — umumiy izoh (sabab sifatida ko'rsatilmaydi).
    { id: "25", market_id: "52", group_id: "-1005", group_type: "create", is_active: false, inactive_reason: "archived", inactive_at: null, createdAt: "2026-09-01T10:00:00+05:00" },
  ];

  beforeEach(() => {
    api.get.mockImplementation((url: string) => {
      if (url === "notifications") {
        return Promise.resolve({
          data: { data: { items: REASON_GROUPS, meta: { total: REASON_GROUPS.length, page: 1, limit: 10 } } },
        });
      }
      if (url === "markets") return Promise.resolve({ data: { data: { items: MARKETS } } });
      return Promise.resolve({ data: {} });
    });
  });

  const rowOf = (table: HTMLElement, groupId: string) =>
    within(table).getAllByRole("row").find((row) => row.textContent?.includes(groupId)) as HTMLElement;

  it("status column: reason text, danger tone when the bot cannot reach the group, inactive_at line", async () => {
    renderWithProviders(<NotificationsPage />);
    const table = await screen.findByRole("table", { name: "Ulangan Telegram guruhlari" });

    const kicked = rowOf(table, "-1001");
    expect(within(kicked).getByText("Bot guruhdan chiqarilgan — qayta qo'shing va faollashtiring")).toBeInTheDocument();
    expect(within(kicked).getByText("Nofaol").closest(".bg-danger-soft")).not.toBeNull();
    const since = within(kicked).getByText(/^Nofaol bo'lgan: /);
    expect(since.tagName).toBe("TIME");
    expect(since).toHaveTextContent("Nofaol bo'lgan: 28.09.2026, 17:45");
    expect(within(kicked).queryByText("Xabarlar bu guruhga yuborilmayapti")).not.toBeInTheDocument();

    const manual = rowOf(table, "-1002");
    expect(within(manual).getByText("Qo'lda nofaol qilingan")).toBeInTheDocument();
    expect(within(manual).getByText("Nofaol").closest(".bg-sunken")).not.toBeNull();
    expect(within(manual).queryByText(/^Nofaol bo'lgan: /)).not.toBeInTheDocument();

    const notFound = rowOf(table, "-1003");
    expect(within(notFound).getByText("Guruh topilmadi — ulanishni o'chirib, qayta ulang")).toBeInTheDocument();
    expect(within(notFound).getByText("Nofaol").closest(".bg-danger-soft")).not.toBeNull();

    const blocked = rowOf(table, "-1004");
    expect(
      within(blocked).getByText("Bot guruhga xabar yubora olmadi — botni qayta qo'shing va faollashtiring"),
    ).toBeInTheDocument();
    expect(within(blocked).getByText("Nofaol").closest(".bg-danger-soft")).not.toBeNull();

    const unknown = rowOf(table, "-1005");
    expect(within(unknown).getByText("Xabarlar bu guruhga yuborilmayapti")).toBeInTheDocument();
    expect(within(unknown).getByText("Nofaol").closest(".bg-sunken")).not.toBeNull();
    expect(unknown).not.toHaveTextContent("archived");
  });

  it("activate dialog: bot removed → mockup warning «Bot guruhdan chiqarilgan»; manual → generic warning", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    await pickFromMenu(user, "Nur Elektronika — yangi buyurtma guruhi: amallar", "Faollashtirish");
    let dialog = await screen.findByRole("alertdialog", { name: "Faollashtirishni tasdiqlang" });
    let warning = within(dialog).getByRole("note");
    expect(warning).toHaveTextContent("Bot guruhdan chiqarilgan");
    expect(warning).toHaveTextContent(
      "Avval botni shu guruhga qayta qo'shing, so'ng faollashtiring. Bot guruhda bo'lmasa, xabar yetmaydi va ulanish yana nofaol bo'ladi.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    await pickFromMenu(user, "Baraka Shop — yangi buyurtma guruhi: amallar", "Faollashtirish");
    dialog = await screen.findByRole("alertdialog", { name: "Faollashtirishni tasdiqlang" });
    warning = within(dialog).getByRole("note");
    expect(warning).toHaveTextContent("Bot guruhda ekanini tekshiring");
    expect(dialog).not.toHaveTextContent("Bot guruhdan chiqarilgan");
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    await pickFromMenu(user, "Bahor Kiyim — bekor qilingan guruhi: amallar", "Faollashtirish");
    dialog = await screen.findByRole("alertdialog", { name: "Faollashtirishni tasdiqlang" });
    expect(within(dialog).getByRole("note")).toHaveTextContent("Guruh topilmadi");
    await user.click(within(dialog).getByRole("button", { name: "Faollashtirish" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("notifications/23", { is_active: true }));
  });

  it("phone: card and bottom sheet show the reason under «Nofaol»", async () => {
    asPhone();
    const user = userEvent.setup();
    renderWithProviders(<NotificationsPage />);

    const list = await screen.findByRole("list", { name: "Telegram guruhlari" });
    const card = within(list)
      .getAllByRole("listitem")
      .find((item) => item.textContent?.includes("-1001")) as HTMLElement;
    expect(within(card).getByText("Bot guruhdan chiqarilgan — qayta qo'shing va faollashtiring")).toBeInTheDocument();
    expect(within(card).getByText("Nofaol bo'lgan: 28.09.2026, 17:45")).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Nur Elektronika — yangi buyurtma guruhi: amallar" }));
    const sheet = await screen.findByRole("dialog", { name: "Nur Elektronika #27" });
    expect(within(sheet).getByText("Bot guruhdan chiqarilgan — qayta qo'shing va faollashtiring")).toBeInTheDocument();
    expect(within(sheet).getByText("Nofaol").closest(".bg-danger-soft")).not.toBeNull();
  });
});

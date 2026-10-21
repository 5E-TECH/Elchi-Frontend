import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationFormModal from "./NotificationFormModal";
import { GROUP_LINK_POLL_MS } from "../model/constants";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * 6jXw0DDr / 4TfLyTrL: guruh bir martalik havola bilan ulanadi — `POST /telegram/link-code`
 * (`purpose: "market_group"`), QR + «Telegram'da ochish», so'ng `GET /notifications` kutiladi.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({ api: { get: mocks.get, post: mocks.post, patch: mocks.patch } }));

const DEEP_LINK = "https://t.me/elchi_bot?startgroup=c0de42";

type Row = { id: string; market_id: string; group_id: string; group_type: "create" | "cancel"; is_active: boolean };

let connections: Row[] = [];

const apiError = (status: number, message: string) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: { statusCode: status, message },
  } as AxiosResponse);

const linkResponse = (expiresInMs = 10 * 60_000, deepLink: string | null = DEEP_LINK) => ({
  data: {
    statusCode: 200,
    message: "Telegram link",
    data: {
      token: "c0de42",
      purpose: "market_group",
      group_type: "cancel",
      expires_at: new Date(Date.now() + expiresInMs).toISOString(),
      deep_link: deepLink,
      command: "/start c0de42",
    },
  },
});

const setupApi = () => {
  mocks.get.mockImplementation((url: string, config?: { params?: { market_id?: string; group_type?: string } }) => {
    if (url === "markets") {
      return Promise.resolve({
        data: { data: [{ id: "12", name: "Baraka Shop", phone_number: "998901234567" }, { id: "27", name: "Nur Elektronika" }] },
      });
    }
    const params = config?.params ?? {};
    const items = connections.filter(
      (row) =>
        (!params.market_id || row.market_id === params.market_id) &&
        (!params.group_type || row.group_type === params.group_type),
    );
    return Promise.resolve({
      data: { statusCode: 200, data: { items, pagination: { total: items.length, page: 1, limit: 1 } } },
    });
  });
};

const pickMarket = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
  await user.click(screen.getByRole("combobox", { name: /^Market/ }));
  await user.click(await screen.findByRole("option", { name }));
};

describe("NotificationFormModal — bir martalik guruh havolasi", () => {
  beforeEach(() => {
    connections = [];
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.patch.mockReset();
    setupApi();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("market va tur bilan havola so'raydi, QR va «Telegram'da ochish» ni ko'rsatadi", async () => {
    const user = userEvent.setup();
    mocks.post.mockResolvedValue(linkResponse());
    renderWithProviders(<NotificationFormModal open onClose={vi.fn()} />);

    await pickMarket(user, /Baraka Shop/);
    await user.click(screen.getByRole("radio", { name: "Bekor qilinganlar guruhi" }));
    await user.click(screen.getByRole("button", { name: "Ulash havolasini olish" }));

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("telegram/link-code", {
        purpose: "market_group",
        group_type: "cancel",
        market_id: "12",
      }),
    );

    const qr = await screen.findByRole("img", { name: "Telegram guruhini ulash havolasining QR kodi" });
    // QR umumiy `LinkQrImage` dan (TG-A, `features/telegram-link`) — SVG, sinxron.
    expect(qr.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);

    const open = screen.getByRole("link", { name: "Telegram'da ochish" });
    expect(open).toHaveAttribute("href", DEEP_LINK);
    expect(open).toHaveAttribute("target", "_blank");
    expect(open).toHaveAttribute("rel", "noopener noreferrer");

    // NG-B: ajratgich ostida teskari sanoq (`LinkCountdown` inline) — «9:59 qoldi · 14:37 gacha amal qiladi».
    expect(screen.getByRole("timer")).toHaveTextContent(/^(10:00|9:\d{2}) qoldi$/);
    expect(screen.getByText(/^· \d{2}:\d{2} gacha amal qiladi$/)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(
      screen.getByText("Havolani oching yoki QR kodni Telegram bor telefonda skanerlang."),
    ).toBeInTheDocument();
    expect(screen.getByText("Guruhni tanlang — bot guruhga qo'shiladi.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Guruh ulanishi kutilmoqda…");
    expect(screen.getByRole("region", { name: "Bir martalik havola tayyor" })).toBeInTheDocument();
  });

  it("kutish paytida guruh paydo bo'lsa — oyna yopiladi va «Guruh ulandi»", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClose = vi.fn();
    mocks.post.mockResolvedValue(linkResponse());
    renderWithProviders(<NotificationFormModal open onClose={onClose} />);

    await pickMarket(user, /Baraka Shop/);
    await user.click(screen.getByRole("radio", { name: "Bekor qilinganlar guruhi" }));
    await user.click(screen.getByRole("button", { name: "Ulash havolasini olish" }));
    await screen.findByRole("link", { name: "Telegram'da ochish" });

    const pollsBefore = mocks.get.mock.calls.filter(([url]) => url === "notifications").length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(GROUP_LINK_POLL_MS);
    });
    // Hali ulanmagan — oyna ochiq, so'rov takrorlandi.
    expect(mocks.get.mock.calls.filter(([url]) => url === "notifications").length).toBeGreaterThan(pollsBefore);
    expect(onClose).not.toHaveBeenCalled();

    connections = [{ id: "90", market_id: "12", group_id: "-1002184736577", group_type: "cancel", is_active: true }];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(GROUP_LINK_POLL_MS);
    });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Guruh ulandi")).toBeInTheDocument();
    expect(screen.getByText("Baraka Shop — Bekor qilinganlar guruhi")).toBeInTheDocument();
  });

  it("shu (market, tur) faol ulangan bo'lsa — havola berilmaydi, faqat o'chirish aytiladi («tahrirlang» yo'q)", async () => {
    const user = userEvent.setup();
    connections = [{ id: "5", market_id: "12", group_id: "-1001111", group_type: "create", is_active: true }];
    renderWithProviders(<NotificationFormModal open onClose={vi.fn()} />);

    await pickMarket(user, /Baraka Shop/);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Bu turdagi guruh allaqachon ulangan");
    expect(alert).toHaveTextContent("ID: -1001111");
    expect(alert).toHaveTextContent("avval eskisini ro'yxatdan o'chiring");
    expect(alert).not.toHaveTextContent(/tahrirla/i);
    expect(screen.getByRole("button", { name: "Ulash havolasini olish" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Faollashtirish" })).not.toBeInTheDocument();

    // Boshqa tur bo'sh — havola olish mumkin.
    await user.click(screen.getByRole("radio", { name: "Bekor qilinganlar guruhi" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Ulash havolasini olish" })).toBeEnabled());
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("market tanlanmasa — xato matni, so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationFormModal open onClose={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Ulash havolasini olish" }));

    expect(await screen.findByText("Marketni tanlang")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Market/ })).toHaveAttribute("aria-invalid", "true");
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("shu tur ulangan, lekin nofaol — «Faollashtirish» ochiq oyna ustida tasdiq, bekor qilinsa fokus qaytadi (NG-S3)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    connections = [{ id: "5", market_id: "27", group_id: "-1001937420815", group_type: "create", is_active: false }];
    mocks.patch.mockResolvedValue({ data: { statusCode: 200, data: {} } });
    renderWithProviders(<NotificationFormModal open onClose={onClose} />);

    await pickMarket(user, /Nur Elektronika/);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Bu turdagi guruh ulangan, lekin nofaol");
    expect(alert).toHaveTextContent("Nur Elektronika uchun bu turdagi guruh nofaol (ID: -1001937420815)");
    // Nofaollik sababi backendda yo'q — «bot chiqarilgan» deb yozilmaydi (D1, NG-C).
    expect(alert).not.toHaveTextContent(/chiqarilgan/);
    expect(screen.queryByRole("button", { name: "Ulash havolasini olish" })).not.toBeInTheDocument();

    const activate = screen.getByRole("button", { name: "Faollashtirish" });
    expect(activate).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(activate);

    // Tasdiq qo'shish oynasi USTIDA — ikkinchisi yopilmaydi.
    let confirmDialog = await screen.findByRole("alertdialog", { name: "Faollashtirishni tasdiqlang" });
    expect(screen.getByRole("dialog", { name: "Bildirishnoma qo'shish", hidden: true })).toBeInTheDocument();
    expect(within(confirmDialog).getByText("Bot guruhda ekanini tekshiring")).toBeInTheDocument();

    await user.click(within(confirmDialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog", { name: "Faollashtirishni tasdiqlang" })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Faollashtirish" })).toHaveFocus());
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Faollashtirish" }));
    confirmDialog = await screen.findByRole("alertdialog", { name: "Faollashtirishni tasdiqlang" });
    await user.click(within(confirmDialog).getByRole("button", { name: "Faollashtirish" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith("notifications/5", { is_active: true }));
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Guruh faollashtirildi")).toBeInTheDocument();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("faollashtirish xatosi — tasdiq oynasi ichida i18n matn, qo'shish oynasi ochiq qoladi", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    connections = [{ id: "5", market_id: "27", group_id: "-1001937420815", group_type: "create", is_active: false }];
    mocks.patch.mockRejectedValue(apiError(500, "Internal: telegram_markets"));
    renderWithProviders(<NotificationFormModal open onClose={onClose} />);

    await pickMarket(user, /Nur Elektronika/);
    await user.click(await screen.findByRole("button", { name: "Faollashtirish" }));
    const confirmDialog = await screen.findByRole("alertdialog", { name: "Faollashtirishni tasdiqlang" });
    await user.click(within(confirmDialog).getByRole("button", { name: "Faollashtirish" }));

    expect(
      await within(confirmDialog).findByText("Guruhni faollashtirib bo'lmadi. Qayta urinib ko'ring."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Internal: telegram_markets")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("backend xatosi — notify.error faqat i18n matn bilan (backend message ko'rsatilmaydi)", async () => {
    const user = userEvent.setup();
    mocks.post.mockRejectedValue(apiError(403, "Guruhni faqat market, uning operatori yoki admin ulay oladi"));
    renderWithProviders(<NotificationFormModal open onClose={vi.fn()} />);

    await pickMarket(user, /Nur Elektronika/);
    await user.click(screen.getByRole("button", { name: "Ulash havolasini olish" }));

    expect(await screen.findByText("Havolani olib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Bu market uchun guruh ulash huquqingiz yo'q.")).toBeInTheDocument();
    expect(screen.queryByText("Guruhni faqat market, uning operatori yoki admin ulay oladi")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Telegram'da ochish" })).not.toBeInTheDocument();
  });

  it("boshqa xato — «Birozdan keyin qayta urinib ko'ring»; javobsiz (tarmoq) xato — ikkinchi xabar chiqmaydi", async () => {
    const user = userEvent.setup();
    mocks.post
      .mockRejectedValueOnce(apiError(500, "relation telegram_link_tokens does not exist"))
      .mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"));
    renderWithProviders(<NotificationFormModal open onClose={vi.fn()} />);

    await pickMarket(user, /Baraka Shop/);
    await user.click(screen.getByRole("button", { name: "Ulash havolasini olish" }));
    expect(await screen.findByText("Birozdan keyin qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.queryByText(/telegram_link_tokens/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ulash havolasini olish" }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText("Havolani olib bo'lmadi")).toHaveLength(1);
  });

  it("muddati tugasa — «Yangi havola olish» yangi kod so'raydi", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mocks.post.mockResolvedValueOnce(linkResponse(1_000)).mockResolvedValueOnce(linkResponse());
    renderWithProviders(<NotificationFormModal open onClose={vi.fn()} />);

    await pickMarket(user, /Baraka Shop/);
    await user.click(screen.getByRole("button", { name: "Ulash havolasini olish" }));
    await screen.findByRole("link", { name: "Telegram'da ochish" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });

    const dialog = screen.getByRole("dialog", { name: "Bildirishnoma qo'shish" });
    expect(within(dialog).getByText("Havola muddati tugadi")).toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "Telegram'da ochish" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Yangi havola olish" }));
    await screen.findByRole("link", { name: "Telegram'da ochish" });
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });

  it("bot nomi sozlanmagan (deep_link yo'q) — guruhga yuboriladigan buyruq ko'rsatiladi", async () => {
    const user = userEvent.setup();
    mocks.post.mockResolvedValue(linkResponse(10 * 60_000, null));
    renderWithProviders(<NotificationFormModal open onClose={vi.fn()} />);

    await pickMarket(user, /Baraka Shop/);
    await user.click(screen.getByRole("button", { name: "Ulash havolasini olish" }));

    expect(await screen.findByText("/start c0de42")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Telegram'da ochish" })).not.toBeInTheDocument();
  });
});

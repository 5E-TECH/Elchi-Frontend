import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationFormModal from "./NotificationFormModal";
import { GROUP_LINK_POLL_MS } from "../model/constants";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * 6jXw0DDr / 4TfLyTrL: guruh bir martalik havola bilan ulanadi — `POST /telegram/link-code`
 * (`purpose: "market_group"`), QR + «Telegram'da ochish», so'ng `GET /notifications` kutiladi.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({ api: { get: mocks.get, post: mocks.post } }));

const DEEP_LINK = "https://t.me/elchi_bot?startgroup=c0de42";

type Row = { id: string; market_id: string; group_id: string; group_type: "create" | "cancel"; is_active: boolean };

let connections: Row[] = [];

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

    expect(screen.getByText(/^\d{2}:\d{2} gacha amal qiladi$/)).toBeInTheDocument();
    expect(screen.getByText("Guruhni tanlang — bot guruhga qo'shiladi.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Guruh ulanishi kutilmoqda…");
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

  it("shu (market, tur) allaqachon ulangan bo'lsa — havola berilmaydi, tahrirlash/o'chirish aytiladi", async () => {
    const user = userEvent.setup();
    connections = [{ id: "5", market_id: "12", group_id: "-1001111", group_type: "create", is_active: false }];
    renderWithProviders(<NotificationFormModal open onClose={vi.fn()} />);

    await pickMarket(user, /Baraka Shop/);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Bu turdagi guruh allaqachon ulangan");
    expect(alert).toHaveTextContent("ID: -1001111");
    expect(screen.getByRole("button", { name: "Ulash havolasini olish" })).toBeDisabled();

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

  it("backend xatosi — notify.error backend matni bilan", async () => {
    const user = userEvent.setup();
    mocks.post.mockRejectedValue({ response: { status: 403, data: { message: "Guruhni faqat market, uning operatori yoki admin ulay oladi" } } });
    renderWithProviders(<NotificationFormModal open onClose={vi.fn()} />);

    await pickMarket(user, /Nur Elektronika/);
    await user.click(screen.getByRole("button", { name: "Ulash havolasini olish" }));

    expect(await screen.findByText("Havolani olib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Guruhni faqat market, uning operatori yoki admin ulay oladi")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Telegram'da ochish" })).not.toBeInTheDocument();
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
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Telegram'da ochish" })).not.toBeInTheDocument();
  });
});

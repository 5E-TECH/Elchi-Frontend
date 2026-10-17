import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { formatTimeLocalized } from "../../../shared/lib/formatDateTime";
import { TelegramLinkCard } from "./TelegramLinkCard";

/**
 * BreQwksC / td89SKXQ / 9uNhwTZp — o'z profilida «Telegram» kartasi: holat, ulash havolasi (QR +
 * «Telegram'da ochish»), muddat tugashi, xato va uzish (tasdiq bilan). Xabar va tasdiq — haqiqiy UI orqali.
 */

const apiPost = vi.fn();
const apiDelete = vi.fn();

vi.mock("../../../shared/api/api", () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: (...args: unknown[]) => apiPost(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
    patch: vi.fn(),
  },
}));

const DEEP_LINK = "https://t.me/elchi_test_bot?start=Kod123";

const linkCodeResponse = (expiresInMs = 10 * 60_000, deepLink: string | null = DEEP_LINK) => ({
  data: {
    statusCode: 200,
    message: "Telegram link",
    data: {
      token: `Kod-${expiresInMs}-${Math.random()}`,
      purpose: "user",
      expires_at: new Date(Date.now() + expiresInMs).toISOString(),
      deep_link: deepLink,
      command: "/start Kod123",
    },
  },
});

const httpError = (status: number, message: string) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: { statusCode: status, message },
  } as AxiosResponse);

describe("TelegramLinkCard", () => {
  beforeEach(() => {
    apiPost.mockReset();
    apiDelete.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ulanmagan holat: neytral belgi, nima berishi va «Telegram'ni ulash»", () => {
    renderWithProviders(<TelegramLinkCard linked={false} />);

    const card = screen.getByRole("region", { name: "Telegram" });
    expect(within(card).getByText("Elchi boti")).toBeInTheDocument();
    expect(within(card).getByText("Ulanmagan")).toBeInTheDocument();
    expect(
      within(card).getByText(
        "Ulasangiz, bot buyurtma kartalari, kassa xabarlari va bildirishnomalarni Telegram'ga yuboradi.",
      ),
    ).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Telegram'ni ulash" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Uzish" })).not.toBeInTheDocument();
  });

  it("ulangan holat: «Ulangan», @username va sana, «Uzish»", () => {
    renderWithProviders(
      <TelegramLinkCard linked username="ali_kuryer" linkedAt="2026-10-17T09:30:00.000Z" />,
    );

    const card = screen.getByRole("region", { name: "Telegram" });
    expect(within(card).getByText("Ulangan")).toBeInTheDocument();
    expect(within(card).getByText("@ali_kuryer · 17.10.2026 da ulangan")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Uzish" })).toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Telegram'ni ulash" }),
    ).not.toBeInTheDocument();
  });

  it("ulash: kod so'raladi, oynada QR, «Telegram'da ochish» havolasi, qadamlar va muddat", async () => {
    const user = userEvent.setup();
    const response = linkCodeResponse();
    apiPost.mockResolvedValue(response);
    renderWithProviders(<TelegramLinkCard linked={false} />);

    await user.click(screen.getByRole("button", { name: "Telegram'ni ulash" }));

    expect(apiPost).toHaveBeenCalledWith("users/me/telegram/link-code");
    const dialog = await screen.findByRole("dialog", { name: "Telegram'ni ulash" });
    const qr = await within(dialog).findByRole("img", {
      name: "Telegram'ni ulash havolasining QR kodi",
    });
    expect(qr.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);

    const open = within(dialog).getByRole("link", { name: "Telegram'da ochish" });
    expect(open).toHaveAttribute("href", DEEP_LINK);
    expect(open).toHaveAttribute("target", "_blank");
    expect(open).toHaveAttribute("rel", "noopener noreferrer");

    const steps = within(dialog).getByRole("list", { name: "Qanday ulanadi" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
    expect(within(steps).getByText("Botda «Start» ni bosing")).toBeInTheDocument();

    const time = formatTimeLocalized(response.data.data.expires_at);
    expect(within(dialog).getByText(`Havola ${time} gacha amal qiladi`)).toBeInTheDocument();
  });

  it("muddat tugasa «Havola eskirdi» va «Yangi havola olish» yangi kod so'raydi", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    apiPost
      .mockResolvedValueOnce(linkCodeResponse(60_000))
      .mockResolvedValueOnce(linkCodeResponse());
    renderWithProviders(<TelegramLinkCard linked={false} />);

    await user.click(screen.getByRole("button", { name: "Telegram'ni ulash" }));
    const dialog = await screen.findByRole("dialog", { name: "Telegram'ni ulash" });
    expect(
      await within(dialog).findByRole("img", { name: "Telegram'ni ulash havolasining QR kodi" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Telegram'da ochish" })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });

    expect(within(dialog).getByText("Havola eskirdi")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("link", { name: "Telegram'da ochish" }),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Yangi havola olish" }));

    expect(apiPost).toHaveBeenCalledTimes(2);
    expect(await within(dialog).findByRole("link", { name: "Telegram'da ochish" })).toHaveAttribute(
      "href",
      DEEP_LINK,
    );
    expect(
      await within(dialog).findByRole("img", { name: "Telegram'ni ulash havolasining QR kodi" }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("Havola eskirdi")).not.toBeInTheDocument();
  });

  it("bot nomi sozlanmagan bo'lsa (deep_link yo'q) — botga yuboriladigan buyruq ko'rsatiladi", async () => {
    const user = userEvent.setup();
    apiPost.mockResolvedValue(linkCodeResponse(10 * 60_000, null));
    renderWithProviders(<TelegramLinkCard linked={false} />);

    await user.click(screen.getByRole("button", { name: "Telegram'ni ulash" }));

    const dialog = await screen.findByRole("dialog", { name: "Telegram'ni ulash" });
    expect(within(dialog).getByText("Botga shu buyruqni yuboring:")).toBeInTheDocument();
    expect(within(dialog).getByText("/start Kod123")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("link", { name: "Telegram'da ochish" }),
    ).not.toBeInTheDocument();
  });

  it("kod olinmasa — backend matni bilan xato xabari, oyna ochilmaydi", async () => {
    const user = userEvent.setup();
    apiPost.mockRejectedValue(httpError(403, "Bu rol Telegram'ni ulay olmaydi"));
    renderWithProviders(<TelegramLinkCard linked={false} />);

    await user.click(screen.getByRole("button", { name: "Telegram'ni ulash" }));

    expect(await screen.findByText("Havolani olib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Bu rol Telegram'ni ulay olmaydi")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Telegram'ni ulash" })).not.toBeInTheDocument();
  });

  it("uzish: tasdiq so'raladi, so'ng DELETE va xabar", async () => {
    const user = userEvent.setup();
    apiDelete.mockResolvedValue({
      data: { statusCode: 200, message: "ok", data: { unlinked: true } },
    });
    renderWithProviders(<TelegramLinkCard linked username="ali_kuryer" />);

    await user.click(screen.getByRole("button", { name: "Uzish" }));

    const confirmDialog = await screen.findByRole("alertdialog", { name: "Telegram'ni uzish" });
    expect(
      within(confirmDialog).getByText(
        "Bot xabarlari va tugmalari bu akkauntga endi kelmaydi. Istalgan vaqtda qayta ulashingiz mumkin.",
      ),
    ).toBeInTheDocument();
    expect(apiDelete).not.toHaveBeenCalled();

    await user.click(within(confirmDialog).getByRole("button", { name: "Uzish" }));

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith("users/me/telegram"));
    expect(await screen.findByText("Telegram uzildi")).toBeInTheDocument();
  });

  it("uzishdan voz kechilsa — DELETE yuborilmaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TelegramLinkCard linked />);

    await user.click(screen.getByRole("button", { name: "Uzish" }));
    const confirmDialog = await screen.findByRole("alertdialog", { name: "Telegram'ni uzish" });
    await user.click(within(confirmDialog).getByRole("button", { name: "Bekor qilish" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(apiDelete).not.toHaveBeenCalled();
  });
});

import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { formatTimeLocalized } from "../../../shared/lib/formatDateTime";
import { TelegramLinkCard } from "./TelegramLinkCard";

/**
 * BreQwksC / td89SKXQ / 9uNhwTZp / ysBqD9Nx (TG-A) — o'z profilida «Telegram» kartasi: holat, ulash havolasi (QR
 * oq ramkada + «Telegram'da ochish», teskari sanoq va progress, «Ulanish kutilmoqda…»), telefon qadamlari va
 * yig'ilgan QR, buyruq rejimi, muddat tugashi, xato (backend matnisiz) va uzish (tasdiq bilan). Maketlar
 * `common-profile-telegram*`. Xabar va tasdiq — haqiqiy UI orqali.
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

/** Telefon kengligi (`useIsPhone` — `matchMedia("(max-width: 767px)")`). */
const asPhone = () => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("max-width: 767px"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
};

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
    // Maket `common-profile-telegram-linked`: qalin «@username», ajratgich «·» va ulangan sana.
    const handle = within(card).getByText("@ali_kuryer");
    expect(handle).toHaveClass("font-semibold");
    expect(within(card).getByText("17.10.2026 da ulangan")).toBeInTheDocument();
    expect(handle.parentElement).toHaveTextContent("@ali_kuryer·17.10.2026 da ulangan");
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

    expect(within(steps).getByText("Havolani oching yoki QR'ni telefon kamerasi bilan skanerlang")).toBeInTheDocument();
    expect(within(steps).getByText("Shu sahifa o'zi yangilanadi")).toBeInTheDocument();

    const time = formatTimeLocalized(response.data.data.expires_at);
    expect(within(dialog).getByText(`Havola ${time} gacha amal qiladi`)).toBeInTheDocument();

    // Teskari sanoq va progress (LinkCountdown): 10 daqiqa = 600 s.
    const timer = within(dialog).getByRole("timer");
    expect(timer).toHaveTextContent(/^(10:00|9:59) qoldi$/);
    const progress = within(dialog).getByRole("progressbar", { name: timer.textContent ?? "" });
    expect(progress).toHaveAttribute("aria-valuemin", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "600");
    expect(Number(progress.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(599);

    expect(within(dialog).getByRole("status")).toHaveTextContent("Ulanish kutilmoqda…");
    // Desktopda QR ochiq ramkada — «Boshqa telefondan» tugmasi yo'q.
    expect(
      within(dialog).queryByRole("button", { name: "Boshqa telefondan — QR kod" }),
    ).not.toBeInTheDocument();
  });

  it("sanoq har soniyada kamayadi, progress u bilan birga", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    apiPost.mockResolvedValue(linkCodeResponse(5 * 60_000));
    renderWithProviders(<TelegramLinkCard linked={false} />);

    await user.click(screen.getByRole("button", { name: "Telegram'ni ulash" }));
    const dialog = await screen.findByRole("dialog", { name: "Telegram'ni ulash" });
    expect(within(dialog).getByRole("timer")).toHaveTextContent(/^(5:00|4:59) qoldi$/);
    // 5 daqiqa qolgan havola — progress yarmida (to'liq muddat 10 daqiqa).
    const valueNow = () => Number(within(dialog).getByRole("progressbar").getAttribute("aria-valuenow"));
    expect(valueNow()).toBeGreaterThanOrEqual(299);
    expect(valueNow()).toBeLessThanOrEqual(300);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });

    expect(within(dialog).getByRole("timer")).toHaveTextContent(/^(3:59|3:58) qoldi$/);
    expect(valueNow()).toBeLessThanOrEqual(239);
  });

  it("server 10 daqiqadan uzoq muddat bersa (soat farqi) — sanoq «… gacha» bilan mos, 10:00 da qotmaydi", async () => {
    apiPost.mockResolvedValue(linkCodeResponse(14 * 60_000));
    const user = userEvent.setup();
    renderWithProviders(<TelegramLinkCard linked={false} />);

    await user.click(screen.getByRole("button", { name: "Telegram'ni ulash" }));
    const dialog = await screen.findByRole("dialog", { name: "Telegram'ni ulash" });

    expect(within(dialog).getByRole("timer")).toHaveTextContent(/^(14:00|13:59) qoldi$/);
    const progress = within(dialog).getByRole("progressbar");
    expect(Number(progress.getAttribute("aria-valuemax"))).toBeGreaterThanOrEqual(839);
    expect(Number(progress.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(839);
  });

  it("telefonda: o'z qadamlari, QR «Boshqa telefondan — QR kod» ostida yig'ilgan", async () => {
    const restore = asPhone();
    try {
      const user = userEvent.setup();
      apiPost.mockResolvedValue(linkCodeResponse());
      renderWithProviders(<TelegramLinkCard linked={false} />);

      await user.click(screen.getByRole("button", { name: "Telegram'ni ulash" }));
      const dialog = await screen.findByRole("dialog", { name: "Telegram'ni ulash" });

      const steps = within(dialog).getByRole("list", { name: "Qanday ulanadi" });
      expect(within(steps).getByText("«Telegram'da ochish» ni bosing")).toBeInTheDocument();
      expect(within(steps).getByText("Botda «Start» ni bosing")).toBeInTheDocument();
      expect(within(steps).getByText("Shu sahifaga qayting — u o'zi yangilanadi")).toBeInTheDocument();
      expect(within(dialog).getByRole("timer")).toBeInTheDocument();
      expect(within(dialog).getByRole("link", { name: "Telegram'da ochish" })).toHaveAttribute("href", DEEP_LINK);

      const toggle = within(dialog).getByRole("button", { name: "Boshqa telefondan — QR kod" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();

      await user.click(toggle);

      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(
        within(dialog).getByRole("img", { name: "Telegram'ni ulash havolasining QR kodi" }),
      ).toBeInTheDocument();
    } finally {
      restore();
    }
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
      within(dialog).getByText(
        "Havola 10 daqiqa amal qiladi va bir marta ishlatiladi. Ulash uchun yangisini oling.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("link", { name: "Telegram'da ochish" }),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("timer")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Ulanish kutilmoqda…")).not.toBeInTheDocument();

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
    expect(within(dialog).getByText(/^Havola \d{2}:\d{2} gacha amal qiladi$/)).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("link", { name: "Telegram'da ochish" }),
    ).not.toBeInTheDocument();

    // Maket `common-profile-telegram-command-dialog`: o'z qadamlari, sanoqsiz, QR'siz, faqat «Yopish».
    const steps = within(dialog).getByRole("list", { name: "Qanday ulanadi" });
    expect(within(steps).getByText("Buyruqni nusxalang")).toBeInTheDocument();
    expect(within(steps).getByText("Uni Elchi botiga shaxsiy xabar qilib yuboring")).toBeInTheDocument();
    expect(within(steps).getByText("Shu sahifa o'zi yangilanadi")).toBeInTheDocument();
    expect(within(dialog).queryByRole("timer")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("status")).toHaveTextContent("Ulanish kutilmoqda…");
    const footerButtons = within(dialog)
      .getAllByRole("button")
      .filter((button) => button.textContent?.trim());
    expect(footerButtons.map((button) => button.textContent?.trim())).toEqual(["Yopish"]);
  });

  it("kod olinmasa (403) — i18n izoh, backend matni ko'rsatilmaydi, oyna ochilmaydi", async () => {
    const user = userEvent.setup();
    apiPost.mockRejectedValue(httpError(403, "Forbidden resource: role customer"));
    renderWithProviders(<TelegramLinkCard linked={false} />);

    await user.click(screen.getByRole("button", { name: "Telegram'ni ulash" }));

    expect(await screen.findByText("Havolani olib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Bu hisob uchun Telegram'ni ulab bo'lmaydi.")).toBeInTheDocument();
    expect(screen.queryByText(/Forbidden resource/)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Telegram'ni ulash" })).not.toBeInTheDocument();
  });

  it("kod olinmasa (500) — «qayta urinib ko'ring», backend matni ko'rsatilmaydi", async () => {
    const user = userEvent.setup();
    apiPost.mockRejectedValue(httpError(500, "TELEGRAM_BOT_USERNAME is not configured"));
    renderWithProviders(<TelegramLinkCard linked={false} />);

    await user.click(screen.getByRole("button", { name: "Telegram'ni ulash" }));

    expect(await screen.findByText("Havolani olib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Birozdan keyin qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.queryByText(/TELEGRAM_BOT_USERNAME/)).not.toBeInTheDocument();
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

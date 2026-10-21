import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { formatTimeLocalized } from "../../../shared/lib/formatDateTime";
import type { GroupLinkCode } from "../model/types";
import { MarketGroupLinkDialog, type MarketGroupLinkDialogProps } from "./MarketGroupLinkDialog";

/**
 * TG-B — «Telegram guruhini ulash» oynasi (maketlar `*-users-detail-telegram-group{,-expired}-dialog`,
 * `market-profile-telegram-group{,-expired}-dialog`): kompyuterda QR + qadamlar `sunken` blokda, telefonda qadamlar
 * va yig'ilgan QR, sanoq, kutish qatori faqat kuzatilganda, buyruq rejimi (sanoqsiz, faqat «Yopish»), muddati tugadi.
 */

const DEEP_LINK = "https://t.me/elchi_bot?startgroup=c0de42";

const code = (deepLink: string | null = DEEP_LINK): GroupLinkCode => ({
  token: "c0de42",
  purpose: "market_group",
  group_type: "cancel",
  expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  deep_link: deepLink,
  command: "/start c0de42",
});

const renderDialog = (props: Partial<MarketGroupLinkDialogProps> = {}) => {
  const onRenew = vi.fn();
  const onClose = vi.fn();
  const expiresAtMs = Date.now() + 9 * 60_000;
  renderWithProviders(
    <MarketGroupLinkDialog
      open
      code={code()}
      marketName="Baraka Shop"
      groupType="cancel"
      expiresAtMs={expiresAtMs}
      expired={false}
      renewing={false}
      watching
      onRenew={onRenew}
      onClose={onClose}
      {...props}
    />,
  );
  return { onRenew, onClose, expiresAtMs };
};

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

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
});

describe("MarketGroupLinkDialog", () => {
  it("kompyuter: sarlavha va «{market} · {tur}», QR + qadamlar bitta blokda, sanoq, kutish, «Telegram'da ochish»", () => {
    const { expiresAtMs } = renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Telegram guruhini ulash" });
    expect(dialog).toHaveAccessibleDescription("Baraka Shop · Bekor qilinganlar guruhi");
    const ready = within(dialog).getByRole("region", { name: "Bir martalik havola tayyor" });
    expect(within(ready).getByRole("img", { name: "Telegram guruhini ulash havolasining QR kodi" })).toBeInTheDocument();
    const steps = within(ready).getByRole("list", { name: "Qanday ulanadi" });
    expect(within(steps).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "1Havolani oching yoki QR kodni telefonda skanerlang",
      "2Guruhni tanlang — bot guruhga qo'shiladi",
      "3Bot guruhni o'zi ulaydi, holat shu yerda yangilanadi",
    ]);
    expect(
      within(dialog).getByText(`Havola ${formatTimeLocalized(expiresAtMs)} gacha amal qiladi`),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("timer")).toHaveTextContent(/qoldi$/);
    expect(within(dialog).getByRole("progressbar")).toBeInTheDocument();
    expect(within(dialog).getByText("Guruh ulanishi kutilmoqda…")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Telegram'da ochish" })).toHaveAttribute("href", DEEP_LINK);
  });

  it("telefon: «Telegram'da ochish» qadamlari, QR «Boshqa telefondan — QR kod» ostida yig'ilgan", async () => {
    restore = asPhone();
    const user = userEvent.setup();
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Telegram guruhini ulash" });
    expect(within(dialog).queryByRole("region", { name: "Bir martalik havola tayyor" })).not.toBeInTheDocument();
    expect(within(dialog).getByText("«Telegram'da ochish» ni bosing")).toBeInTheDocument();
    const toggle = within(dialog).getByRole("button", { name: "Boshqa telefondan — QR kod" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(dialog).queryByRole("img", { name: /QR kodi/ })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(within(dialog).getByRole("img", { name: "Telegram guruhini ulash havolasining QR kodi" })).toBeInTheDocument();
  });

  it("kuzatilmasa (market o'zi): kutish qatori yo'q, 3-qadam — bildirishnoma", () => {
    renderDialog({ watching: false, groupType: "create" });

    const dialog = screen.getByRole("dialog", { name: "Telegram guruhini ulash" });
    expect(dialog).toHaveAccessibleDescription("Baraka Shop · Yangi buyurtmalar guruhi");
    expect(within(dialog).queryByText("Guruh ulanishi kutilmoqda…")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Bot guruhni o'zi ulaydi — ulanganda sizga bildirishnoma keladi")).toBeInTheDocument();
  });

  it("buyruq rejimi (`deep_link` yo'q): buyruq, muddat sanoqsiz, o'z qadamlari, faqat «Yopish»", () => {
    const { expiresAtMs } = renderDialog({ code: code(null) });

    const dialog = screen.getByRole("dialog", { name: "Telegram guruhini ulash" });
    expect(within(dialog).getByText("Guruhga shu buyruqni yuboring:")).toBeInTheDocument();
    expect(within(dialog).getByText("/start c0de42")).toBeInTheDocument();
    expect(within(dialog).getByText(`Havola ${formatTimeLocalized(expiresAtMs)} gacha amal qiladi`)).toBeInTheDocument();
    expect(within(dialog).queryByRole("timer")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Elchi botini guruhga qo'shing")).toBeInTheDocument();
    expect(within(dialog).getByText("Buyruqni nusxalab, guruhga yuboring")).toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "Telegram'da ochish" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
  });

  it("muddati tugadi: bo'sh holat matni va «Yangi havola olish» → `onRenew`", async () => {
    const user = userEvent.setup();
    const { onRenew } = renderDialog({ expired: true });

    const dialog = screen.getByRole("dialog", { name: "Telegram guruhini ulash" });
    expect(within(dialog).getByText("Havola muddati tugadi")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Havola 10 daqiqa amal qiladi va bir marta ishlatiladi. Yangisini oling."),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("timer")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "Telegram'da ochish" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Yangi havola olish" }));
    expect(onRenew).toHaveBeenCalledTimes(1);
  });
});

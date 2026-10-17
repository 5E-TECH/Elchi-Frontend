import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../../../i18n";
import { renderWithProviders } from "../../../../test/test-utils";
import MailStatCards from "./MailStatCards";
import SendButton from "./SendButton";

/** Pochta xulosasi va asosiy amal tugmasi (dizayn v2). */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const stats = {
  homeStats: { homeOrders: 5, homeOrdersTotalPrice: 805000 },
  centerStats: { centerOrders: 4, centerOrdersTotalPrice: 725000 },
};
const flat = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

describe("MailStatCards (v2)", () => {
  it("xodim: «Tanlangan» 6 / 9 ta, «Uygacha» 5 ta jami …, «Markazgacha»; telefon xulosasi `dl`", () => {
    renderWithProviders(<MailStatCards totalOrders={9} selectedCount={6} {...stats} />);
    const group = screen.getByRole("group", { name: "Pochta xulosasi" });
    expect(flat(group.textContent)).toContain("Tanlangan6 / 9 ta6 ta tanlandi");
    expect(flat(group.textContent)).toContain("Uygacha5 tajami 805 000 so'm");
    expect(flat(group.textContent)).toContain("Markazgacha4 tajami 725 000 so'm");
    const summary = screen.getByRole("region", { name: "Pochta xulosasi" });
    expect(within(summary).getAllByRole("term").map((dt) => flat(dt.textContent))).toEqual([
      "Tanlangan6 ta tanlandi",
      "Uygacha5 ta buyurtma",
      "Markazgacha4 ta buyurtma",
    ]);
    expect(within(summary).getAllByRole("definition").map((dd) => flat(dd.textContent))).toEqual([
      "6 / 9 ta",
      "805 000 so'm",
      "725 000 so'm",
    ]);
  });

  it("eski pochta — «Tanlangan» yo'q; tanlanmagan — «Hech biri tanlanmagan»", () => {
    const { unmount } = renderWithProviders(
      <MailStatCards totalOrders={9} selectedCount={0} showSelectionCard={false} {...stats} />,
    );
    expect(screen.getByRole("group", { name: "Pochta xulosasi" })).not.toHaveTextContent("Tanlangan");
    unmount();
    renderWithProviders(<MailStatCards totalOrders={9} selectedCount={0} {...stats} />);
    expect(screen.getByRole("group", { name: "Pochta xulosasi" })).toHaveTextContent("Hech biri tanlanmagan");
  });

  it("kuryer: «Tanlangan» izohi — tanlanganlar summasi + jarayon chizig'i; rad etilgan / eski — birinchi karta", () => {
    const { unmount } = renderWithProviders(
      <MailStatCards layout="courier" totalOrders={6} selectedCount={3} selectedSum={841000} {...stats} />,
    );
    expect(screen.getByRole("group", { name: "Pochta xulosasi" })).toHaveTextContent("jami 841 000 so'm");
    expect(screen.getByRole("progressbar", { name: "Tanlangan buyurtmalar" })).toHaveAttribute("aria-valuenow", "3");
    unmount();
    const { unmount: unmount2 } = renderWithProviders(
      <MailStatCards layout="courier" leadCard="refused" showSelectionCard={false} totalOrders={5} selectedCount={0} totalSum={1418000} {...stats} />,
    );
    expect(flat(screen.getByRole("group", { name: "Pochta xulosasi" }).textContent)).toContain("Rad etilgan5 tajami 1 418 000 so'm");
    unmount2();
    renderWithProviders(
      <MailStatCards layout="courier" leadCard="total" showSelectionCard={false} totalOrders={6} selectedCount={0} totalSum={1668000} {...stats} />,
    );
    expect(flat(screen.getByRole("group", { name: "Pochta xulosasi" }).textContent)).toContain("Jami6 tajami 1 668 000 so'm");
  });
});

describe("SendButton (v2)", () => {
  it("sukut matnlari soni bilan; tanlov bo'sh — o'chiq", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const first = renderWithProviders(
      <SendButton selectedCount={6} isCourier={false} onSend={onSend} onReceive={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Pochtani jo'natish — 6 ta" }));
    expect(onSend).toHaveBeenCalled();
    first.unmount();
    const second = renderWithProviders(<SendButton selectedCount={3} isCourier onSend={vi.fn()} onReceive={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Pochtani qabul qilish — 3 ta" })).toBeEnabled();
    second.unmount();
    renderWithProviders(<SendButton selectedCount={0} isCourier onSend={vi.fn()} onReceive={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Pochtani qabul qilish — 0 ta" })).toBeDisabled();
  });

  it("berilgan matn AYNAN chiqadi (paket: «HQ'ga yuborish — 2 ta»); band — spinner va busyLabel", () => {
    const first = renderWithProviders(
      <SendButton selectedCount={2} isCourier={false} sendLabel="HQ'ga yuborish — 2 ta" onSend={vi.fn()} onReceive={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "HQ'ga yuborish — 2 ta" })).toBeInTheDocument();
    first.unmount();
    renderWithProviders(
      <SendButton selectedCount={2} isCourier={false} isBusy busyLabel="HQ'ga yuborilmoqda…" onSend={vi.fn()} onReceive={vi.fn()} />,
    );
    const busy = screen.getByRole("button", { name: "HQ'ga yuborilmoqda…" });
    expect(busy).toHaveAttribute("aria-busy", "true");
  });
});

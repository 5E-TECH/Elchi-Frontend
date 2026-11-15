import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { ConversationList, ConversationsDialog, type ConversationsState } from "./Conversations";

/**
 * Suhbatlar ro'yxati holatlari (maket `superadmin-ai-assistant-conversations-sheet`, «Boshqa holatlar»): oyna sarlavhasi
 * «N ta» (yuklanish / xatoda — sonsiz), ichida «Yangi suhbat», tanlangan bandda Check («Ochiq suhbat»), skelet, bo'sh,
 * «Ko'proq» + «50 / 63 ta suhbat ko'rsatildi», «Yuklanmoqda…», keyingi sahifa xatosi, ro'yxat oxiri; «90 kun
 * saqlanadi» — yo'q (ega qarori 5).
 */

const ITEMS = [
  { id: "41", title: "Oktabr tushumi va kuryer qarzlari", turns: 2, lastMessageAt: "2026-10-23T09:12:00.000Z", createdAt: null },
  { id: "40", title: "Marketlarga to'lanmagan summa", turns: 1, lastMessageAt: "2026-10-22T13:04:00.000Z", createdAt: null },
];

const state = (patch: Partial<ConversationsState> = {}): ConversationsState => ({
  items: ITEMS,
  total: 2,
  isPending: false,
  isError: false,
  refetch: vi.fn(),
  refetching: false,
  hasMore: false,
  loadMore: vi.fn(),
  loadingMore: false,
  loadMoreError: false,
  complete: false,
  ...patch,
});

const renderSheet = (value: ConversationsState, selectedId: string | null = "41") => {
  const onClose = vi.fn();
  const onNewChat = vi.fn();
  renderWithProviders(
    <ConversationsDialog open onClose={onClose} state={value} selectedId={selectedId} onNewChat={onNewChat} />,
  );
  return { dialog: screen.getByRole("dialog", { name: "Suhbatlar" }), onClose, onNewChat };
};

describe("Suhbatlar varag'i (< 1024)", () => {
  it("sarlavha «N ta», «Yangi suhbat» ichida, tanlangan bandda Check; «90 kun saqlanadi» yo'q", async () => {
    const { dialog, onNewChat, onClose } = renderSheet(state());
    expect(dialog).toHaveAccessibleDescription("2 ta");
    expect(dialog).not.toHaveTextContent(/90 kun/);
    expect(within(dialog).getByRole("button", { name: "Suhbatlarni yopish" })).toBeInTheDocument();

    const nav = within(dialog).getByRole("navigation", { name: "Suhbatlar tarixi" });
    const current = within(nav).getByRole("link", { name: /Oktabr tushumi va kuryer qarzlari/ });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current).toHaveAttribute("href", "/?conversation=41");
    expect(current).toHaveTextContent("Ochiq suhbat");
    expect(current.querySelector("svg.lucide-check")).not.toBeNull();
    const other = within(nav).getByRole("link", { name: /Marketlarga to'lanmagan summa/ });
    expect(other).not.toHaveAttribute("aria-current");
    expect(other.querySelector("svg.lucide-check")).toBeNull();

    const newChat = within(dialog).getByRole("button", { name: "Yangi suhbat" });
    expect(newChat.querySelector("svg.lucide-message-square-plus")).not.toBeNull();
    await userEvent.click(newChat);
    expect(onNewChat).toHaveBeenCalledTimes(1);

    await userEvent.click(other);
    expect(onClose).toHaveBeenCalled();
  });

  it("yuklanmoqda — skelet («Suhbatlar yuklanmoqda»), sarlavhada son yo'q", () => {
    const { dialog } = renderSheet(state({ items: [], total: 0, isPending: true }));
    expect(within(dialog).getByRole("status", { name: "Suhbatlar yuklanmoqda" })).toBeInTheDocument();
    expect(dialog).not.toHaveAccessibleDescription();
    expect(within(dialog).queryByRole("navigation")).toBeNull();
  });

  it("bo'sh — «Hali suhbat yo'q» / «Birinchi savoldan keyin shu yerda chiqadi.»", () => {
    const { dialog } = renderSheet(state({ items: [], total: 0 }), null);
    expect(within(dialog).getByText("Hali suhbat yo'q")).toBeInTheDocument();
    expect(within(dialog).getByText("Birinchi savoldan keyin shu yerda chiqadi.")).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription("0 ta");
    // Bo'sh ro'yxatda ham yangi suhbat boshlash mumkin.
    expect(within(dialog).getByRole("button", { name: "Yangi suhbat" })).toBeInTheDocument();
  });

  it("ro'yxat yuklanmadi — xato + «Qayta urinish», sarlavhada son yo'q", async () => {
    const value = state({ items: [], total: 0, isError: true });
    const { dialog } = renderSheet(value);
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Suhbatlarni yuklab bo'lmadiInternet aloqasini tekshirib, qayta urining.");
    expect(dialog).not.toHaveAccessibleDescription();
    await userEvent.click(within(dialog).getByRole("button", { name: "Qayta urinish" }));
    expect(value.refetch).toHaveBeenCalledTimes(1);
  });

  it("50 tadan ko'p — «Ko'proq» va «50 / 63 ta suhbat ko'rsatildi»", async () => {
    const value = state({ total: 63, hasMore: true });
    const { dialog } = renderSheet(value);
    expect(dialog).toHaveAccessibleDescription("63 ta");
    const more = within(dialog).getByRole("button", { name: "Ko'proq" });
    expect(more).toHaveAccessibleDescription("2 / 63 ta suhbat ko'rsatildi");
    expect(more.querySelector("svg.lucide-chevron-down")).not.toBeNull();
    await userEvent.click(more);
    expect(value.loadMore).toHaveBeenCalledTimes(1);
  });

  it("«Ko'proq» bosilgan — «Yuklanmoqda…» (aria-busy), ostidagi son yashirin", () => {
    const { dialog } = renderSheet(state({ total: 63, hasMore: true, loadingMore: true }));
    const busy = within(dialog).getByRole("button", { name: "Yuklanmoqda…" });
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(within(dialog).queryByText(/ta suhbat ko'rsatildi/)).toBeNull();
  });

  it("«Ko'proq» yuklanmadi — «Keyingi suhbatlarni yuklab bo'lmadi.» + «Qayta urinish» (ro'yxat joyida)", async () => {
    const value = state({ total: 63, hasMore: true, loadMoreError: true });
    const { dialog } = renderSheet(value);
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Keyingi suhbatlarni yuklab bo'lmadi.");
    expect(within(dialog).getAllByRole("link")).toHaveLength(2);
    expect(within(dialog).queryByRole("button", { name: "Ko'proq" })).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Qayta urinish" }));
    expect(value.loadMore).toHaveBeenCalledTimes(1);
  });

  it("bir necha sahifa yuklanib oxiriga yetildi — «Hammasi ko'rsatildi · 63 ta suhbat»", () => {
    const { dialog } = renderSheet(state({ total: 63, complete: true }));
    expect(within(dialog).getByText("Hammasi ko'rsatildi · 63 ta suhbat")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Ko'proq" })).toBeNull();
  });
});

describe("Suhbatlar yon kartasi (≥ 1024)", () => {
  it("bo'sh — xira matn (maket -empty), tanlangan bandda Check yo'q", () => {
    const { unmount } = renderWithProviders(<ConversationList state={state({ items: [], total: 0 })} selectedId={null} />);
    expect(screen.getByText("Hali suhbat yo'q.")).toBeInTheDocument();
    unmount();
    renderWithProviders(<ConversationList state={state()} selectedId="41" />);
    const current = screen.getByRole("link", { name: /Oktabr tushumi/ });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current.querySelector("svg.lucide-check")).toBeNull();
  });

  it("«Ko'proq» holatlari kartada ham", () => {
    renderWithProviders(<ConversationList state={state({ total: 63, hasMore: true })} selectedId={null} />);
    expect(screen.getByRole("button", { name: "Ko'proq" })).toHaveAccessibleDescription("2 / 63 ta suhbat ko'rsatildi");
  });
});

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("../../../shared/api/instance", () => ({ api: { get: mocks.get, patch: mocks.patch, delete: vi.fn() } }));

import NotificationInboxList from "./NotificationInboxList";

/**
 * INBOX FILTRLARI (n1sNvGLn): kategoriya chiplari (o'qilmagan sanoq bilan),
 * "Faqat muhim", URL holati, sahifa 1 ga qaytishi, bo'sh filtr holati.
 */

const note = (id: number, over: Record<string, unknown> = {}) => ({
  id: String(id),
  type: "order.sold",
  category: "order",
  priority: "normal",
  title: `Xabar ${id}`,
  body: null,
  data: null,
  link: null,
  is_read: false,
  read_at: null,
  created_at: "2026-10-06T10:00:00Z",
  ...over,
});

const counts = {
  categories: {
    order: { total: 30, unread: 12 },
    finance: { total: 4, unread: 3 },
    branch: { total: 0, unread: 0 },
    logistics: { total: 0, unread: 0 },
    account: { total: 0, unread: 0 },
    system: { total: 1, unread: 0 },
    marketing: { total: 0, unread: 0 },
  },
  unread: 15,
  important_unread: 2,
};

let listItems: unknown[] = [];
let countsReply: unknown = { statusCode: 200, data: counts };

const listCalls = () =>
  mocks.get.mock.calls.filter(([url]) => url === "notifications/inbox").map(([, cfg]) => (cfg as { params: Record<string, unknown> }).params);

const Probe = () => <span data-testid="search">{useLocation().search}</span>;

const open = (route = "/inbox") =>
  renderWithProviders(
    <>
      <NotificationInboxList />
      <Probe />
    </>,
    { route },
  );

beforeEach(() => {
  listItems = Array.from({ length: 20 }, (_, i) => note(i + 1));
  countsReply = { statusCode: 200, data: counts };
  mocks.get.mockReset();
  mocks.get.mockImplementation((url: string) => {
    if (url === "notifications/inbox/counts") return Promise.resolve({ data: countsReply });
    if (url === "notifications/inbox")
      return Promise.resolve({ data: { data: { items: listItems, unread: 15, meta: { page: 1, limit: 20, total: 60, totalPages: 3 } } } });
    return Promise.resolve({ data: { data: {} } });
  });
});

describe("Inbox filtrlari (n1sNvGLn)", () => {
  it("kategoriya chiplari backend sanog'i bilan — shu kategoriyadagi O'QILMAGANLAR", async () => {
    open();
    const group = await screen.findByRole("group", { name: "Kategoriya" });
    await waitFor(() => expect(within(group).getByRole("button", { name: /Buyurtma\s*12/ })).toBeInTheDocument());
    expect(within(group).getByRole("button", { name: /Moliya\s*3/ })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: /Hammasi\s*15/ })).toBeInTheDocument();
  });

  it("chip bosilganda so'rovga `category=` ketadi va URL ga yoziladi", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: /^Moliya/ }));
    await waitFor(() => expect(listCalls().at(-1)).toMatchObject({ category: "finance", page: 1 }));
    expect(screen.getByTestId("search").textContent).toContain("category=finance");
  });

  it("sahifa 3 da turib kategoriya almashtirilsa sahifa 1 ga qaytadi", async () => {
    open();
    await screen.findByText("Xabar 1");
    fireEvent.click(screen.getByTitle("3"));
    await waitFor(() => expect(listCalls().at(-1)).toMatchObject({ page: 3 }));
    fireEvent.click(screen.getByRole("button", { name: /^Buyurtma/ }));
    await waitFor(() => expect(listCalls().at(-1)).toMatchObject({ page: 1, category: "order" }));
  });

  it("URL `/inbox?category=finance&unread=1` bilan ochilsa filtr holati tiklanadi", async () => {
    open("/inbox?category=finance&unread=1");
    await waitFor(() => expect(listCalls().at(-1)).toMatchObject({ category: "finance", is_read: false }));
    expect(await screen.findByRole("button", { name: /^Moliya/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("sanoq kelmasa chipda raqam CHIQMAYDI (0 yozilmaydi)", async () => {
    countsReply = { statusCode: 500, data: null };
    open();
    const chip = await screen.findByRole("button", { name: /^Buyurtma/ });
    await screen.findByText("Xabar 1");
    expect(chip.textContent).toBe("Buyurtma");
  });

  it("\"Faqat muhim\" yoqilsa `important=true` yuboriladi", async () => {
    open();
    await screen.findByText("Xabar 1");
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(listCalls().at(-1)).toMatchObject({ important: true, page: 1 }));
    expect(screen.getByTestId("search").textContent).toContain("important=1");
  });

  it("filtr natijasi bo'sh — \"Filtrni tozalash\" hammasini qaytaradi", async () => {
    listItems = [];
    open("/inbox?category=marketing&important=1");
    expect(await screen.findByText("Bu filtr bo'yicha hech narsa yo'q")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Filtrni tozalash/ }));
    await waitFor(() => expect(screen.getByTestId("search").textContent).toBe(""));
    expect(listCalls().at(-1)).not.toHaveProperty("category", "marketing");
  });

  it("390px: filtrlar yig'ilgan (telefonda tugma bilan ochiladi), ish stolida ochiq", async () => {
    open();
    const panel = await screen.findByTestId("inbox-filters");
    expect(panel).toHaveClass("hidden", "sm:flex");
    fireEvent.click(screen.getByRole("button", { name: /Filtrlar/ }));
    expect(panel).toHaveClass("flex");
    expect(panel).not.toHaveClass("hidden");
  });
});

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/instance", () => ({
  api: { get: mocks.get, patch: mocks.patch, delete: mocks.delete },
}));

import NotificationInboxList from "./NotificationInboxList";

/**
 * INBOX FILTRLARI (n1sNvGLn) + dizayn v2 ro'yxati (maket `common-inbox`): kategoriya chiplari (o'qilmagan sanoq
 * bilan), "Faqat muhim", URL holati, sahifa 1 ga qaytishi, bo'sh filtr holati, telefondagi «Filtrlar» varaqasi,
 * qator amallari (o'qildi, «…» menyusi, o'chirish tasdig'i).
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
  mocks.get.mock.calls
    .filter(([url]) => url === "notifications/inbox")
    .map(([, cfg]) => (cfg as { params: Record<string, unknown> }).params);

const Probe = () => {
  const location = useLocation();
  return (
    <>
      <span data-testid="search">{location.search}</span>
      <span data-testid="path">{location.pathname}</span>
    </>
  );
};

const open = (route = "/inbox") =>
  renderWithProviders(
    <>
      <NotificationInboxList />
      <Probe />
    </>,
    { route },
  );

const categoryGroup = () => screen.getAllByRole("group", { name: "Kategoriya" })[0];

beforeEach(() => {
  listItems = Array.from({ length: 10 }, (_, i) => note(i + 1));
  countsReply = { statusCode: 200, data: counts };
  mocks.get.mockReset();
  mocks.get.mockImplementation((url: string) => {
    if (url === "notifications/inbox/counts") return Promise.resolve({ data: countsReply });
    if (url === "notifications/inbox")
      return Promise.resolve({
        data: {
          data: {
            items: listItems,
            unread: 15,
            meta: { page: 1, limit: 10, total: 60, totalPages: 6 },
          },
        },
      });
    return Promise.resolve({ data: { data: {} } });
  });
  mocks.patch.mockReset().mockResolvedValue({ data: { data: {} } });
  mocks.delete.mockReset().mockResolvedValue({ data: { data: {} } });
});

describe("Inbox filtrlari (n1sNvGLn)", () => {
  it("kategoriya chiplari backend sanog'i bilan — shu kategoriyadagi O'QILMAGANLAR", async () => {
    open();
    await screen.findByText("Xabar 1");
    await waitFor(() =>
      expect(
        within(categoryGroup()).getByRole("button", { name: /Buyurtma\s*12 ta o'qilmagan/ }),
      ).toBeInTheDocument(),
    );
    expect(within(categoryGroup()).getByRole("button", { name: /Moliya\s*3/ })).toBeInTheDocument();
    expect(
      within(categoryGroup()).getByRole("button", { name: /Barchasi\s*15/ }),
    ).toBeInTheDocument();
    // O'qilmagani 0 bo'lgan kategoriyada raqam yo'q (maket).
    expect(within(categoryGroup()).getByRole("button", { name: "Logistika" })).toBeInTheDocument();
  });

  it("tablar sonlari: «Barchasi» — butun inbox, «O'qilmagan» — o'qilmaganlar", async () => {
    open();
    const tabs = await screen.findByRole("tablist", { name: "O'qilganlik bo'yicha" });
    await waitFor(() =>
      expect(within(tabs).getByRole("tab", { name: /Barchasi\s*35/ })).toBeInTheDocument(),
    );
    expect(within(tabs).getByRole("tab", { name: /O'qilmagan\s*15/ })).toBeInTheDocument();
  });

  it("chip bosilganda so'rovga `category=` ketadi va URL ga yoziladi", async () => {
    open();
    await screen.findByText("Xabar 1");
    fireEvent.click(within(categoryGroup()).getByRole("button", { name: /^Moliya/ }));
    await waitFor(() =>
      expect(listCalls().at(-1)).toMatchObject({ category: "finance", page: 1, limit: 10 }),
    );
    expect(screen.getByTestId("search").textContent).toContain("category=finance");
  });

  it("sahifa 3 da turib kategoriya almashtirilsa sahifa 1 ga qaytadi", async () => {
    open();
    await screen.findByText("Xabar 1");
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Sahifalar" })).getByRole("button", {
        name: "3",
      }),
    );
    await waitFor(() => expect(listCalls().at(-1)).toMatchObject({ page: 3 }));
    fireEvent.click(within(categoryGroup()).getByRole("button", { name: /^Buyurtma/ }));
    await waitFor(() => expect(listCalls().at(-1)).toMatchObject({ page: 1, category: "order" }));
  });

  it("«O'qilmagan» tabi `unread=1` va `is_read=false`", async () => {
    open();
    await screen.findByText("Xabar 1");
    await userEvent.click(screen.getByRole("tab", { name: /O'qilmagan/ }));
    await waitFor(() => expect(listCalls().at(-1)).toMatchObject({ is_read: false, page: 1 }));
    expect(screen.getByTestId("search").textContent).toContain("unread=1");
  });

  it("URL `/inbox?category=finance&unread=1` bilan ochilsa filtr holati tiklanadi", async () => {
    open("/inbox?category=finance&unread=1");
    await waitFor(() =>
      expect(listCalls().at(-1)).toMatchObject({ category: "finance", is_read: false }),
    );
    expect(await within(categoryGroup()).findByRole("button", { name: /^Moliya/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("tab", { name: /O'qilmagan/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("sanoq kelmasa chipda raqam CHIQMAYDI (0 yozilmaydi)", async () => {
    countsReply = { statusCode: 500, data: null };
    open();
    await screen.findByText("Xabar 1");
    const chip = within(categoryGroup()).getByRole("button", { name: /^Buyurtma/ });
    expect(chip.textContent).toBe("Buyurtma");
  });

  it('"Faqat muhim" yoqilsa `important=true` yuboriladi', async () => {
    open();
    await screen.findByText("Xabar 1");
    const toggle = screen.getByRole("switch", { name: /Faqat muhim/ });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    await waitFor(() => expect(listCalls().at(-1)).toMatchObject({ important: true, page: 1 }));
    expect(screen.getByTestId("search").textContent).toContain("important=1");
    expect(screen.getByRole("switch", { name: /Faqat muhim/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it('filtr natijasi bo\'sh — "Filtrni tozalash" hammasini qaytaradi', async () => {
    listItems = [];
    open("/inbox?category=marketing&important=1");
    expect(await screen.findByText("Bu filtr bo'yicha hech narsa yo'q")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Filtrni tozalash/ }));
    await waitFor(() => expect(screen.getByTestId("search").textContent).toBe(""));
    expect(listCalls().at(-1)).not.toHaveProperty("category", "marketing");
  });

  it("filtrsiz bo'sh inbox — «Bildirishnomalar yo'q»", async () => {
    listItems = [];
    open();
    expect(await screen.findByText("Bildirishnomalar yo'q")).toBeInTheDocument();
  });

  it("telefon: «Filtrlar» varaqasida kategoriya tanlanadi va «Natijalarni ko'rsatish» bilan qo'llanadi", async () => {
    open();
    await screen.findByText("Xabar 1");
    await userEvent.click(screen.getByRole("button", { name: "Filtrlar" }));
    const sheet = await screen.findByRole("dialog", { name: "Filtrlar" });
    await userEvent.click(within(sheet).getByRole("button", { name: /^Moliya/ }));
    // Qoralama: «ko'rsatish» bosilmaguncha URL o'zgarmaydi.
    expect(screen.getByTestId("search").textContent).toBe("");
    await userEvent.click(within(sheet).getByRole("button", { name: "Natijalarni ko'rsatish" }));
    await waitFor(() =>
      expect(screen.getByTestId("search").textContent).toContain("category=finance"),
    );
    expect(listCalls().at(-1)).toMatchObject({ category: "finance", page: 1 });
    expect(await screen.findByRole("button", { name: "Filtrlar (1)" })).toBeInTheDocument();
  });
});

describe("Inbox qatori — amallar", () => {
  it("o'qilmagan qatorda «O'qilgan deb belgilash» → PATCH read", async () => {
    open();
    await screen.findByText("Xabar 1");
    const [first] = screen.getAllByRole("button", { name: "O'qilgan deb belgilash" });
    await userEvent.click(first);
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("notifications/inbox/1/read", { read: true }),
    );
  });

  it("«…» menyusi: o'chirish tasdiq oynasi orqali, so'ng xabar", async () => {
    open();
    await screen.findByText("Xabar 1");
    const [menuButton] = screen.getAllByRole("button", { name: "Bildirishnoma amallari" });
    await userEvent.click(menuButton);
    const menu = await screen.findByRole("menu", { name: "Bildirishnoma amallari" });
    expect(
      within(menu).getByRole("menuitem", { name: "O'qilgan deb belgilash" }),
    ).toBeInTheDocument();
    await userEvent.click(within(menu).getByRole("menuitem", { name: "O'chirish" }));

    const dialog = await screen.findByRole("alertdialog", {
      name: "Bildirishnomani o'chirmoqchimisiz?",
    });
    expect(mocks.delete).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "O'chirish" }));
    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith("notifications/inbox/1"));
    expect(await screen.findByText("Bildirishnoma o'chirildi")).toBeInTheDocument();
  });

  it("qator bosilsa — o'qilgan deb belgilanadi va havolaga o'tiladi", async () => {
    listItems = [note(7, { link: "/orders/edit/7", title: "Buyurtma 7 sotildi" })];
    open();
    await userEvent.click(await screen.findByRole("button", { name: /Buyurtma 7 sotildi/ }));
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("notifications/inbox/7/read", { read: true }),
    );
    expect(screen.getByTestId("path").textContent).toBe("/orders/edit/7");
  });

  it("muhimlik badge'i: critical — «Muhim», high — «Yuqori»; o'qilgan qatorda o'qildi tugmasi yo'q", async () => {
    listItems = [
      note(1, { priority: "critical", title: "Kassa qoldig'i" }),
      note(2, { priority: "high", title: "Bekor qilindi", is_read: true }),
    ];
    open();
    await screen.findByText("Kassa qoldig'i");
    expect(screen.getByText("Muhim")).toBeInTheDocument();
    expect(screen.getByText("Yuqori")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "O'qilgan deb belgilash" })).toHaveLength(1);
  });
});

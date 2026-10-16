import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { ThemeProvider } from "../../../app/providers/theme/ThemeContext";
import type { RootState } from "../../../app/config/store";
import { DESKTOP_QUERY, PHONE_QUERY } from "../model/useMediaQuery";
import { RECENT_SEARCHES_KEY } from "../model/recentSearches";
import Header from "./Header";

/**
 * Yuqori panel (dizayn v2, 2-bosqich): maket `.el-topbar`, taxta `tizim-states-navigation` (02, 06),
 * `common-bell-dropdown`, `courier-dashboard-mobile-search`.
 */

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  changeAppLanguage: vi.fn(async () => undefined),
  unread: 0,
  inbox: [] as unknown[],
  search: [] as unknown[],
  get: vi.fn(),
  patch: vi.fn(async () => ({ data: {} })),
}));

vi.mock("../../../shared/lib/useLogout", () => ({ useLogout: () => ({ logout: mocks.logout }) }));

vi.mock("../../../i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../i18n")>()),
  changeAppLanguage: mocks.changeAppLanguage,
}));

vi.mock("../../../shared/api/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/api/api")>()),
  api: { get: mocks.get, patch: mocks.patch },
}));

const envelope = (data: unknown) => ({ data: { statusCode: 200, data } });

const notification = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  type: "order.sold",
  category: "order",
  priority: "normal",
  title: `Xabar ${id}`,
  body: `Matn ${id}`,
  data: null,
  link: `/orders/${id}`,
  is_read: false,
  read_at: null,
  created_at: new Date().toISOString(),
  ...overrides,
});

/** Profil tugmasi nomi ko'rinadigan ism bilan boshlanadi (WCAG 2.5.3 «Label in Name»). */
const PROFILE_TRIGGER = "Shodiyor Ergashev, Profil menyusi";

const menuItems = (menu: HTMLElement) => Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]'));

const LocationProbe = () => <span data-testid="path">{useLocation().pathname}</span>;

type Device = "desktop" | "tablet" | "phone";

const setDevice = (device: Device) => {
  window.matchMedia = ((query: string) => ({
    matches: (query === DESKTOP_QUERY && device === "desktop") || (query === PHONE_QUERY && device === "phone"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

const originalMatchMedia = window.matchMedia;

const userState = (role: string, extra: Record<string, unknown> = {}) =>
  ({
    user: {
      id: "1",
      username: "user",
      name: "Shodiyor Ergashev",
      phone_number: "+998900000000",
      role,
      status: "active",
      createdAt: "",
      updatedAt: "",
      ...extra,
    },
    isAuthenticated: true,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  }) as RootState["user"];

const renderHeader = ({
  role = "superadmin",
  device = "desktop",
  user,
  onMenuClick,
}: {
  role?: string;
  device?: Device;
  user?: Record<string, unknown>;
  onMenuClick?: () => void;
} = {}) => {
  setDevice(device);
  return renderWithProviders(
    <ThemeProvider>
      <Header onMenuClick={onMenuClick} />
      <LocationProbe />
    </ThemeProvider>,
    {
      route: "/orders",
      preloadedState: {
        role: { id: `${role}-1`, role, region: null, name: role },
        user: userState(role, user),
      } as Partial<RootState>,
    },
  );
};

beforeEach(() => {
  mocks.unread = 0;
  mocks.inbox = [];
  mocks.search = [];
  mocks.get.mockImplementation(async (url: string) => {
    if (url === "notifications/inbox/unread-count") return envelope({ unread: mocks.unread });
    if (url === "notifications/inbox") {
      return envelope({
        items: mocks.inbox,
        unread: mocks.inbox.filter((item) => !(item as { is_read: boolean }).is_read).length,
        meta: { page: 1, limit: 5, total: mocks.inbox.length, totalPages: 1 },
      });
    }
    if (url === "search") return envelope({ items: mocks.search, meta: { page: 1, limit: 10, total: mocks.search.length, totalPages: 1 } });
    return envelope({});
  });
  try {
    window.localStorage.clear();
  } catch {
    /* saqlash yopiq */
  }
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.documentElement.classList.remove("dark", "light");
});

describe("Header bar (.el-topbar)", () => {
  it("is a 64px surface bar with a bottom border and the mockup paddings (32 → 16 below 1024)", () => {
    renderHeader();
    const bar = screen.getByRole("banner");
    expect(bar).toHaveClass("h-16", "bg-surface", "border-b", "border-border", "px-8", "max-lg:px-4");
    // Shell slotida turadi — o'zi yopishmaydi.
    expect(bar.className).not.toMatch(/\b(sticky|fixed)\b/);
  });

  it("gives every icon button the same size (40px, 44px on phones)", () => {
    renderHeader({ device: "tablet" });
    const iconButtons = within(screen.getByRole("banner"))
      .getAllByRole("button")
      // IconButton — `title` bilan (matnli «Skanerlash» tugmasida yo'q).
      .filter((button) => button.hasAttribute("data-size") && button.hasAttribute("title"));
    // menyu, qidiruv, qo'ng'iroqcha
    expect(iconButtons).toHaveLength(3);
    for (const button of iconButtons) {
      expect(button).toHaveAttribute("data-size", "md");
      expect(button).toHaveClass("size-10", "max-md:size-11");
    }
    expect(screen.getByRole("button", { name: PROFILE_TRIGGER })).toHaveClass("h-10", "max-md:h-11");
  });

  it("has no separate logout or settings button — they live in the profile menu", () => {
    renderHeader();
    expect(screen.queryByRole("button", { name: /chiqish/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sozlamalar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tezkor tugmalar|shortcut/i })).not.toBeInTheDocument();
  });

  it("opens the slide-over menu below 1024px and mirrors its state in aria-expanded", async () => {
    const user = userEvent.setup();
    const onMenuClick = vi.fn();
    renderHeader({ device: "tablet", onMenuClick });
    const menuButton = screen.getByRole("button", { name: "Menyuni ochish" });
    expect(menuButton).toHaveClass("lg:hidden");
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await user.click(menuButton);
    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it("falls back to the shared mobile-menu state when no handler is given", async () => {
    const user = userEvent.setup();
    const { store } = renderHeader({ device: "phone" });
    const menuButton = screen.getByRole("button", { name: "Menyuni ochish" });
    await user.click(menuButton);
    expect(store.getState().sidebar.isMobileMenuOpen).toBe(true);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
  });

  it("shows «Skanerlash» from 768px (phones scan from the bottom menu) and opens the scanner", async () => {
    const user = userEvent.setup();
    renderHeader();
    const scan = screen.getByRole("button", { name: "Skanerlash" });
    expect(scan).toHaveClass("max-md:hidden");
    expect(scan).toHaveAttribute("data-variant", "secondary");
    await user.click(scan);
    expect(screen.getByTestId("path")).toHaveTextContent("/scan");
  });

  it("market rolida «Skanerlash» yo'q (maket: persona.scan=false, ega qarori)", () => {
    renderHeader({ role: "market" });
    expect(screen.queryByRole("button", { name: "Skanerlash" })).not.toBeInTheDocument();
  });
});

describe("Header notifications bell", () => {
  it.each([
    [0, null, "Bildirishnomalar"],
    [3, "3", "Bildirishnomalar, 3 ta yangi"],
    [150, "99+", "Bildirishnomalar, 99 dan ortiq yangi"],
  ])("shows %i unread as %s", async (count, dot, name) => {
    mocks.unread = count;
    renderHeader();
    const bell = await screen.findByRole("button", { name });
    const wrapper = bell.parentElement!;
    if (dot === null) {
      expect(wrapper.querySelector("[aria-hidden='true'].bg-danger")).toBeNull();
    } else {
      await waitFor(() => expect(wrapper.querySelector(".bg-danger")).toHaveTextContent(dot));
    }
  });

  it("opens the recent notifications panel and closes it with Esc, returning focus", async () => {
    const user = userEvent.setup();
    mocks.unread = 2;
    mocks.inbox = [
      notification("1", { priority: "critical", category: "finance" }),
      notification("2"),
      notification("3", { is_read: true }),
    ];
    renderHeader();
    const bell = await screen.findByRole("button", { name: "Bildirishnomalar, 2 ta yangi" });
    expect(bell).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(bell);

    const panel = screen.getByRole("dialog", { name: "Bildirishnomalar" });
    expect(bell).toHaveAttribute("aria-expanded", "true");
    const list = await within(panel).findByRole("list", { name: "So'nggi bildirishnomalar" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByText("Muhim")).toBeInTheDocument();
    expect(within(list).getAllByText("O'qilmagan:")).toHaveLength(2);
    expect(within(panel).getByRole("link", { name: /Barchasini ko'rish/ })).toHaveAttribute("href", "/inbox");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Bildirishnomalar" })).not.toBeInTheDocument();
    expect(bell).toHaveFocus();
  });

  it("marks a notification read and follows its link", async () => {
    const user = userEvent.setup();
    mocks.unread = 1;
    mocks.inbox = [notification("42")];
    renderHeader();
    await user.click(await screen.findByRole("button", { name: /^Bildirishnomalar/ }));
    await user.click(await screen.findByRole("link", { name: /Xabar 42/ }));
    expect(mocks.patch).toHaveBeenCalledWith("notifications/inbox/42/read", { read: true });
    expect(screen.getByTestId("path")).toHaveTextContent("/orders/42");
    expect(screen.queryByRole("dialog", { name: "Bildirishnomalar" })).not.toBeInTheDocument();
  });

  it("marks everything read from the panel header", async () => {
    const user = userEvent.setup();
    mocks.unread = 1;
    mocks.inbox = [notification("7")];
    renderHeader();
    await user.click(await screen.findByRole("button", { name: /^Bildirishnomalar/ }));
    const markAll = await screen.findByRole("button", { name: /Barchasini o'qilgan deb belgilash/ });
    await waitFor(() => expect(markAll).toBeEnabled());
    await user.click(markAll);
    expect(mocks.patch).toHaveBeenCalledWith("notifications/inbox/read-all");
  });

  it("reports a failed «mark all» inside the panel, without an antd static message", async () => {
    const user = userEvent.setup();
    mocks.unread = 1;
    mocks.inbox = [notification("7")];
    mocks.patch.mockRejectedValueOnce(new Error("500"));
    renderHeader();
    await user.click(await screen.findByRole("button", { name: /^Bildirishnomalar/ }));
    const panel = screen.getByRole("dialog", { name: "Bildirishnomalar" });
    const markAll = await within(panel).findByRole("button", { name: /Barchasini o'qilgan deb belgilash/ });
    await waitFor(() => expect(markAll).toBeEnabled());
    await user.click(markAll);
    expect(await within(panel).findByRole("alert")).toHaveTextContent("Bildirishnomalarni belgilashda xatolik yuz berdi");
    expect(document.querySelector(".ant-message")).toBeNull();
  });

  it("fits a short window: the panel height is bounded and only the list scrolls", async () => {
    const user = userEvent.setup();
    mocks.inbox = [notification("1")];
    renderHeader({ device: "tablet" });
    await user.click(screen.getByRole("button", { name: /^Bildirishnomalar/ }));
    const panel = screen.getByRole("dialog", { name: "Bildirishnomalar" });
    expect(panel).toHaveClass("max-h-[calc(100dvh-80px)]", "overflow-hidden");
    expect(await within(panel).findByRole("list")).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
  });

  it("closes on an outside click", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole("button", { name: /^Bildirishnomalar/ }));
    expect(screen.getByRole("dialog", { name: "Bildirishnomalar" })).toBeInTheDocument();
    await user.click(screen.getByTestId("path"));
    expect(screen.queryByRole("dialog", { name: "Bildirishnomalar" })).not.toBeInTheDocument();
  });

  it("uses a modal bottom sheet on phones", async () => {
    const user = userEvent.setup();
    mocks.inbox = [notification("1")];
    renderHeader({ device: "phone" });
    const bell = screen.getByRole("button", { name: /^Bildirishnomalar/ });
    await user.click(bell);
    const sheet = screen.getByRole("dialog", { name: "Bildirishnomalar" });
    expect(sheet).toHaveAttribute("aria-modal", "true");
    expect(sheet.parentElement?.parentElement).toBe(document.body);
    expect(await within(sheet).findByRole("link", { name: /Barchasini ko'rish/ })).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Bildirishnomalarni yopish" }));
    expect(screen.queryByRole("dialog", { name: "Bildirishnomalar" })).not.toBeInTheDocument();
    await waitFor(() => expect(bell).toHaveFocus());
  });
});

describe("Header profile menu (.el-user + .el-menu)", () => {
  const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
    const trigger = screen.getByRole("button", { name: PROFILE_TRIGGER });
    await user.click(trigger);
    return { trigger, menu: screen.getByRole("menu", { name: "Profil menyusi" }) };
  };

  it("shows initials, name and role on the trigger", () => {
    renderHeader();
    const trigger = screen.getByRole("button", { name: PROFILE_TRIGGER });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(within(trigger).getByText("SE")).toBeInTheDocument();
    expect(within(trigger).getByText("Shodiyor Ergashev")).toBeInTheDocument();
    // Ism va rol planshet/telefonda yashiriladi (maket `.el-user-text` → `el-hide-tablet`).
    expect(within(trigger).getByText("Shodiyor Ergashev").parentElement).toHaveClass("max-lg:hidden");
  });

  it("keeps «Chiqish» reachable in a short window (bounded, scrolling menu)", async () => {
    const user = userEvent.setup();
    renderHeader({ device: "tablet" });
    const { menu } = await openMenu(user);
    expect(menu).toHaveClass("max-h-[calc(100dvh-80px)]", "overflow-y-auto", "[&>*]:shrink-0");
  });

  it("lists profile, settings, shortcuts, theme, language and a red «Chiqish» last", async () => {
    const user = userEvent.setup();
    renderHeader();
    const { trigger, menu } = await openMenu(user);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const items = menuItems(menu);
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      "Profil",
      "Sozlamalar",
      "Tezkor tugmalar?",
      "Kunduzgi",
      "Tungi",
      "TilO'zbekcha",
      "Chiqish",
    ]);
    expect(within(menu).getByRole("menuitem", { name: "Profil" })).toHaveAttribute("href", "/profile");
    expect(within(menu).getByRole("menuitem", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings");
    expect(within(menu).getByRole("menuitem", { name: "Chiqish" })).toHaveClass("text-danger-fg");
    // Birinchi band fokusda.
    expect(items[0]).toHaveFocus();
  });

  it("logs out from the menu with the existing logout behaviour", async () => {
    const user = userEvent.setup();
    renderHeader();
    const { menu } = await openMenu(user);
    await user.click(within(menu).getByRole("menuitem", { name: "Chiqish" }));
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("supports arrow keys, Home/End and Esc with focus return", async () => {
    const user = userEvent.setup();
    renderHeader();
    const trigger = screen.getByRole("button", { name: PROFILE_TRIGGER });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const menu = screen.getByRole("menu");
    const items = menuItems(menu);
    expect(items[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(items[items.length - 1]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(items[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(within(menu).getByRole("menuitem", { name: "Chiqish" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("opens on ArrowUp with the last item focused and closes on an outside click", async () => {
    const user = userEvent.setup();
    renderHeader();
    screen.getByRole("button", { name: PROFILE_TRIGGER }).focus();
    await user.keyboard("{ArrowUp}");
    expect(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Chiqish" })).toHaveFocus();
    await user.click(screen.getByTestId("path"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("switches the theme and saves it to the user settings", async () => {
    const user = userEvent.setup();
    renderHeader();
    const { menu } = await openMenu(user);
    const light = within(menu).getByRole("menuitemradio", { name: "Kunduzgi" });
    const dark = within(menu).getByRole("menuitemradio", { name: "Tungi" });
    expect(light).toHaveAttribute("aria-checked", "true");
    await user.click(dark);
    expect(dark).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveClass("dark");
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        "auth/my-settings",
        expect.objectContaining({
          settings: expect.objectContaining({ appearance: expect.objectContaining({ theme: "dark", themeChosen: true }) }),
        }),
      ),
    );
    // Menyu ochiq qoladi — tanlov ko'rinib turadi.
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("expands the language list and changes the language", async () => {
    const user = userEvent.setup();
    renderHeader();
    const { menu } = await openMenu(user);
    const language = within(menu).getByRole("menuitem", { name: /^Til/ });
    expect(language).toHaveAttribute("aria-expanded", "false");
    await user.click(language);
    expect(language).toHaveAttribute("aria-expanded", "true");
    const group = within(menu).getByRole("group", { name: "Til" });
    expect(within(group).getByRole("menuitemradio", { name: "O'zbekcha" })).toHaveAttribute("aria-checked", "true");
    await user.click(within(group).getByRole("menuitemradio", { name: "Русский" }));
    expect(mocks.changeAppLanguage).toHaveBeenCalledWith("ru");
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        "auth/my-settings",
        expect.objectContaining({
          settings: expect.objectContaining({ appearance: expect.objectContaining({ language: "ru" }) }),
        }),
      ),
    );
  });

  it("opens the keyboard shortcuts dialog from the menu", async () => {
    const user = userEvent.setup();
    renderHeader();
    const { menu } = await openMenu(user);
    await user.click(within(menu).getByRole("menuitem", { name: /Tezkor tugmalar/ }));
    const dialog = screen.getByRole("dialog", { name: /Tezkor tugmalar/ });
    expect(within(dialog).getByText("Qidiruvga o'tish")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /Tezkor tugmalar/ })).not.toBeInTheDocument();
  });

  it.each([
    ["superadmin", {}, "Superadmin", "Superadmin"],
    ["admin", { branch: { name: "Toshkent HQ" } }, "Admin", "Admin · Toshkent HQ"],
    ["manager", { branch: { id: "b1", branch: { id: "b1", name: "Urgut filiali", type: "HYBRID" } } }, "Menejer · Urgut filiali", "Menejer · Urgut filiali"],
    ["registrator", { branch: { id: "b2", name: "Toshkent HQ" } }, "Ro'yxatchi · Toshkent HQ", "Ro'yxatchi · Toshkent HQ"],
    ["market", {}, "Market", "Market"],
    ["courier", { branch: { branch: { name: "Samarqand filiali" } } }, "Kuryer", "Kuryer · Samarqand filiali"],
  ])("shows the %s role line: topbar like the mockup persona, menu header with the branch", async (role, extra, topbar, menuLine) => {
    const user = userEvent.setup();
    renderHeader({ role, user: extra });
    const trigger = screen.getByRole("button", { name: PROFILE_TRIGGER });
    expect(within(trigger).getByText(topbar)).toBeInTheDocument();
    await user.click(trigger);
    expect(within(screen.getByRole("menu")).getByText(menuLine)).toBeInTheDocument();
  });
});

describe("Header global search", () => {
  const ORDERS = [
    { id: "s1", source: "order", type: "order", sourceId: "10241", title: "Order #10241", content: "Dilnoza Karimova", metadata: { status: "new" } },
    { id: "s2", source: "order", type: "order", sourceId: "10198", title: "Order #10198", content: "Dilnoza Yusupova", metadata: { status: "sold" } },
  ];
  const USERS = [
    { id: "s3", source: "identity", type: "courier", sourceId: "77", title: "Dilnoza Rasulova", content: "", metadata: { role: "courier", phone_number: "+998901234567" } },
  ];

  it("renders the desktop field as a combobox with the mockup placeholder", () => {
    renderHeader();
    const field = screen.getByRole("combobox", { name: "Global qidiruv" });
    expect(field).toHaveAttribute("placeholder", "Ism, telefon yoki buyurtma raqami");
    expect(field).toHaveAttribute("aria-expanded", "false");
    expect(field).toHaveClass("text-base", "md:text-sm");
    expect(screen.queryByRole("button", { name: "Qidiruvni ochish" })).not.toBeInTheDocument();
  });

  it("groups results, moves with the arrows and opens the chosen order with Enter", async () => {
    const user = userEvent.setup();
    mocks.search = [...ORDERS, ...USERS];
    renderHeader();
    const field = screen.getByRole("combobox", { name: "Global qidiruv" });
    await user.click(field);
    await user.keyboard("Dilnoza");

    const listbox = await screen.findByRole("listbox", { name: "Qidiruv natijalari" });
    expect(field).toHaveAttribute("aria-expanded", "true");
    expect(within(listbox).getByRole("group", { name: /Buyurtmalar/ })).toBeInTheDocument();
    expect(within(listbox).getByRole("group", { name: /Foydalanuvchilar/ })).toBeInTheDocument();
    expect(within(listbox).getAllByRole("option")).toHaveLength(3);
    expect(within(listbox).getByText("Buyurtma №10241")).toBeInTheDocument();
    expect(within(listbox).getByText("Kuryer · +998 90 123 45 67")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    const first = within(listbox).getAllByRole("option")[0];
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(field).toHaveAttribute("aria-activedescendant", first.id);

    await user.keyboard("{Enter}");
    expect(screen.getByTestId("path")).toHaveTextContent("/orders/edit/10241");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]")).toEqual(["Dilnoza"]);
  });

  it("opens a user result on click", async () => {
    const user = userEvent.setup();
    mocks.search = USERS;
    renderHeader();
    await user.type(screen.getByRole("combobox", { name: "Global qidiruv" }), "Dil");
    const [option] = await screen.findAllByRole("option");
    expect(option).toHaveTextContent("Dilnoza Rasulova");
    await user.click(option);
    expect(screen.getByTestId("path")).toHaveTextContent("/all-users/77");
  });

  it("says when nothing was found and closes with Esc", async () => {
    const user = userEvent.setup();
    renderHeader();
    const field = screen.getByRole("combobox", { name: "Global qidiruv" });
    await user.type(field, "№99999");
    expect(await screen.findByText("Natija topilmadi")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Natija topilmadi")).not.toBeInTheDocument();
    expect(field).toHaveValue("№99999");
  });

  it("offers recent searches on an empty focus and can clear them", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(["№10235", "Aziz Rahimov"]));
    renderHeader();
    await user.click(screen.getByRole("combobox", { name: "Global qidiruv" }));
    const recent = screen.getByRole("listbox", { name: "So'nggi qidiruvlar" });
    expect(within(recent).getAllByRole("option").map((option) => option.textContent)).toEqual(["№10235", "Aziz Rahimov"]);
    await user.click(screen.getByRole("button", { name: "Tozalash" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(RECENT_SEARCHES_KEY)).toBeNull();
  });

  it("focuses the field with Ctrl+K", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("combobox", { name: "Global qidiruv" })).toHaveFocus();
  });

  it.each(["tablet", "phone"] as const)("opens the full-screen search on %s and closes it with «Yopish»", async (device) => {
    const user = userEvent.setup();
    mocks.search = ORDERS;
    renderHeader({ device });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    const open = screen.getByRole("button", { name: "Qidiruvni ochish" });
    expect(open).toHaveClass("lg:hidden");
    await user.click(open);

    const dialog = screen.getByRole("dialog", { name: "Global qidiruv" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const field = within(dialog).getByRole("combobox", { name: "Global qidiruv" });
    expect(field).toHaveFocus();
    await user.keyboard("Dil");
    expect(await within(dialog).findAllByRole("option")).toHaveLength(2);

    await user.click(within(dialog).getByRole("button", { name: "Yopish" }));
    expect(screen.queryByRole("dialog", { name: "Global qidiruv" })).not.toBeInTheDocument();
    await waitFor(() => expect(open).toHaveFocus());
  });

  it("closes the search screen after choosing a result", async () => {
    const user = userEvent.setup();
    mocks.search = ORDERS;
    renderHeader({ device: "phone" });
    await user.click(screen.getByRole("button", { name: "Qidiruvni ochish" }));
    await user.keyboard("Dil");
    await user.click((await screen.findAllByRole("option"))[1]);
    expect(screen.getByTestId("path")).toHaveTextContent("/orders/edit/10198");
    expect(screen.queryByRole("dialog", { name: "Global qidiruv" })).not.toBeInTheDocument();
  });

  it("opens the search screen with Ctrl+K below 1024px", async () => {
    const user = userEvent.setup();
    renderHeader({ device: "tablet" });
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("dialog", { name: "Global qidiruv" })).toBeInTheDocument();
  });
});

describe("Header keyboard shortcuts", () => {
  it("opens the shortcuts list with «?» outside of fields", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.keyboard("?");
    expect(screen.getByRole("dialog", { name: /Tezkor tugmalar/ })).toBeInTheDocument();
  });

  it("ignores «?» while typing in a field", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.type(screen.getByRole("combobox", { name: "Global qidiruv" }), "?");
    expect(screen.queryByRole("dialog", { name: /Tezkor tugmalar/ })).not.toBeInTheDocument();
  });

  it("goes to orders with G → O", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.keyboard("go");
    expect(screen.getByTestId("path")).toHaveTextContent("/orders");
    await act(async () => undefined);
  });

  it.each([
    ["manager", "/batches", true],
    ["courier", "/orders", false],
  ])("G → B for %s goes to %s (batches shortcut listed: %s)", async (role, path, listed) => {
    const user = userEvent.setup();
    renderHeader({ role });
    await user.keyboard("gb");
    expect(screen.getByTestId("path")).toHaveTextContent(path);
    await user.keyboard("?");
    const dialog = screen.getByRole("dialog", { name: /Tezkor tugmalar/ });
    expect(within(dialog).queryByText("Paketlarga o'tish") !== null).toBe(listed);
  });
});

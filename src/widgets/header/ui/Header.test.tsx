import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { ThemeProvider } from "../../../app/providers/theme/ThemeContext";
import Header from "./Header";

vi.mock("../../../shared/lib/useLogout", () => ({
  useLogout: () => ({ logout: vi.fn() }),
}));

const unread = vi.hoisted(() => ({ count: 0 }));
vi.mock("../../../entities/notification-inbox/api/inboxApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/notification-inbox/api/inboxApi")>()),
  getInboxUnreadCount: vi.fn(async () => unread.count),
}));

const LocationProbe = () => <span data-testid="path">{useLocation().pathname}</span>;

const renderHeader = (role = "market") =>
  renderWithProviders(
    <ThemeProvider>
      <Header onMenuClick={vi.fn()} />
      <LocationProbe />
    </ThemeProvider>,
    { route: "/orders", preloadedState: { role: { id: `${role}-1`, role, region: null, name: role } } as never },
  );

/** Telefondagi qo'ng'iroq — `lg:hidden` (desktopdagisi `hidden lg:inline-flex`). */
const phoneBell = () =>
  screen.getAllByRole("button", { name: /^Bildirishnomalar/ }).find((button) => button.className.includes("lg:hidden"))!;

describe("Header notification bell on phones", () => {
  afterEach(() => {
    unread.count = 0;
  });

  it("renders a bell in the phone header row, outside the desktop-only container", () => {
    renderHeader();

    const bell = phoneBell();
    expect(bell).toBeDefined();
    expect(bell.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    // `hidden md:flex` konteyneri ichida emas — telefonda ko'rinadi.
    expect(bell.closest(".hidden")).toBeNull();
    // Hamburger bilan bir qatorda.
    expect(bell.parentElement).toBe(screen.getByRole("button", { name: "Menyuni ochish" }).parentElement);
  });

  it("keeps the desktop bell where it was (lg and wider)", () => {
    renderHeader();

    const desktopBell = screen
      .getAllByRole("button", { name: /^Bildirishnomalar/ })
      .find((button) => button.className.includes("lg:inline-flex"))!;
    const desktopActions = screen.getByRole("button", { name: "Sozlamalar" }).parentElement!;
    expect(within(desktopActions).getByRole("button", { name: /^Bildirishnomalar/ })).toBe(desktopBell);
  });

  it("opens the personal inbox from the phone bell", async () => {
    const user = userEvent.setup();
    renderHeader("courier");

    await user.click(phoneBell());

    expect(screen.getByTestId("path")).toHaveTextContent("/inbox");
  });

  it.each([
    [0, null],
    [3, "3"],
    [150, "99+"],
  ])("shows the unread badge for %i as %s", async (count, expected) => {
    unread.count = count;
    renderHeader();

    if (expected === null) {
      await waitFor(() => expect(phoneBell()).toBeInTheDocument());
      expect(within(phoneBell()).queryByTestId("unread-badge")).not.toBeInTheDocument();
      expect(phoneBell()).toHaveAccessibleName("Bildirishnomalar");
    } else {
      await waitFor(() => expect(within(phoneBell()).getByTestId("unread-badge")).toHaveTextContent(expected));
      expect(phoneBell()).toHaveAccessibleName(`Bildirishnomalar (${count})`);
    }
  });
});

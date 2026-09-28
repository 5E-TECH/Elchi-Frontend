import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import type { ReactNode } from "react";
import { renderWithProviders } from "../../../test/test-utils";
import { ThemeProvider } from "../../../app/providers/theme/ThemeContext";
import MobileMenu from "./MobileMenu";

const roleState = (role: string) =>
  ({ role: { id: `${role}-1`, role, region: null, name: role } }) as never;

const LocationProbe = () => <span data-testid="path">{useLocation().pathname}</span>;

const renderMenu = (ui: ReactNode, role = "admin") =>
  renderWithProviders(
    <ThemeProvider>
      {ui}
      <LocationProbe />
    </ThemeProvider>,
    { route: "/orders", preloadedState: roleState(role) },
  );

vi.mock("../../../shared/lib/useLogout", () => ({
  useLogout: () => ({ logout: vi.fn() }),
}));

const unread = vi.hoisted(() => ({ count: 0 }));
vi.mock("../../../entities/notification-inbox/api/inboxApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/notification-inbox/api/inboxApi")>()),
  getInboxUnreadCount: vi.fn(async () => unread.count),
}));

describe("MobileMenu keyboard access", () => {
  it("is a modal dialog and takes focus when it opens", () => {
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("calls onClose on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderMenu(<MobileMenu isOpen onClose={onClose} />);

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps Tab inside the menu", async () => {
    const user = userEvent.setup();
    renderMenu(
      <>
        <button type="button">fon</button>
        <MobileMenu isOpen onClose={vi.fn()} />
      </>,
    );
    const dialog = screen.getByRole("dialog");

    for (let i = 0; i < 10; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});

describe("MobileMenu notifications", () => {
  afterEach(() => {
    unread.count = 0;
  });

  it("opens the personal inbox, not the Telegram group settings", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderMenu(<MobileMenu isOpen onClose={onClose} />, "courier");

    await user.click(screen.getByRole("button", { name: "Bildirishnomalar" }));

    expect(screen.getByTestId("path")).toHaveTextContent("/inbox");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows no badge or dot when nothing is unread", async () => {
    unread.count = 0;
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Bildirishnomalar" })).toBeInTheDocument());
    expect(screen.queryByTestId("menu-unread-badge")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bildirishnomalar" }).querySelector(".bg-red-500, .bg-red-600")).toBeNull();
  });

  it("shows the real unread count from the API and follows it when it changes", async () => {
    unread.count = 3;
    const { queryClient } = renderMenu(<MobileMenu isOpen onClose={vi.fn()} />);

    expect(await screen.findByTestId("menu-unread-badge")).toHaveTextContent(/^3$/);
    expect(screen.getByRole("button", { name: "Bildirishnomalar (3)" })).toBeInTheDocument();

    unread.count = 7;
    await queryClient.invalidateQueries();
    await waitFor(() => expect(screen.getByTestId("menu-unread-badge")).toHaveTextContent(/^7$/));
  });

  it("caps a large unread count at 99+", async () => {
    unread.count = 150;
    renderMenu(<MobileMenu isOpen onClose={vi.fn()} />);

    expect(await screen.findByTestId("menu-unread-badge")).toHaveTextContent("99+");
  });

  it("keeps the Telegram group settings entry for the superadmin only", async () => {
    const user = userEvent.setup();
    const { unmount } = renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, "superadmin");

    await user.click(screen.getByRole("button", { name: /Telegram guruhlari/ }));
    expect(screen.getByTestId("path")).toHaveTextContent("/notifications");
    unmount();

    for (const role of ["admin", "market", "courier", "registrator"]) {
      const view = renderMenu(<MobileMenu isOpen onClose={vi.fn()} />, role);
      expect(screen.queryByRole("button", { name: /Telegram guruhlari/ })).not.toBeInTheDocument();
      view.unmount();
    }
  });
});

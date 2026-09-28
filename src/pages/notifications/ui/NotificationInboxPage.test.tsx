import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import NotificationInboxPage from "./NotificationInboxPage";

vi.mock("../../../widgets/notification-inbox", () => ({ NotificationInboxList: () => null }));

const roleState = (role: string) => ({ role: { id: `${role}-1`, role, region: null, name: role } }) as never;

describe("NotificationInboxPage send link", () => {
  it.each(["superadmin", "admin"])("offers the send-message screen to %s", (role) => {
    renderWithProviders(<NotificationInboxPage />, { preloadedState: roleState(role) });

    expect(screen.getByRole("link", { name: "Xabar yuborish" })).toHaveAttribute("href", "/notifications/send");
  });

  it.each(["market", "courier", "registrator", "manager"])("does not offer it to %s", (role) => {
    renderWithProviders(<NotificationInboxPage />, { preloadedState: roleState(role) });

    expect(screen.queryByRole("link", { name: "Xabar yuborish" })).not.toBeInTheDocument();
  });
});

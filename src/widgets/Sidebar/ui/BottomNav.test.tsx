import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import BottomNav from "./BottomNav";

const roleState = (role: string) =>
  ({ role: { id: `${role}-1`, role, region: null, name: role } }) as never;

describe("BottomNav", () => {
  it("shows the admin shortcuts to an admin", () => {
    renderWithProviders(<BottomNav />, { preloadedState: roleState("admin") });

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toContain("/all-users");
  });

  it("does not hand admin-only links to a role without its own menu (operator)", () => {
    renderWithProviders(<BottomNav />, { preloadedState: roleState("operator") });

    // Avval operator admin menyusini olardi — /all-users, /payments, ... hammasi 403.
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

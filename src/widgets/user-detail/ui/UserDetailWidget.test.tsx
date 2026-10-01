import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { User, UserRole } from "../../../entities/user/types/user";
import { UserDetailWidget } from "./UserDetailWidget";

vi.mock("../../../features/courier-transfer-branch", () => ({
  TransferCourierButton: ({
    courierId,
    courierName,
    variant,
  }: {
    courierId: string;
    courierName?: string;
    variant: string;
  }) => (
    <button type="button" data-testid={`transfer-${courierId}`} data-variant={variant}>
      {courierName}
    </button>
  ),
}));

// Tahrirlash oynasi viloyatlarni so'raydi — bu testga aloqasi yo'q.
vi.mock("../../../features/user/update-user/ui/UpdateUserModal", () => ({
  UpdateUserModal: () => null,
}));

const makeUser = (role: UserRole, overrides: Partial<User> = {}): User => ({
  id: "263",
  name: "E2E Kuryer",
  phone_number: "+998901112233",
  username: "e2e_kuryer",
  role,
  status: "active",
  salary: 0,
  payment_day: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-30T09:00:00.000Z",
  is_deleted: false,
  tariff_home: null,
  tariff_center: null,
  default_tariff: "home",
  ...overrides,
});

const roleState = (role: string) =>
  ({ role: { id: `${role}-1`, role, region: null, name: role } }) as never;

const renderWidget = (user: User, viewerRole: string) =>
  renderWithProviders(<UserDetailWidget user={user} isLoading={false} isError={false} />, {
    preloadedState: roleState(viewerRole),
  });

describe("UserDetailWidget — kuryerni boshqa filialga o'tkazish tugmasi", () => {
  it.each(["superadmin", "admin"])("%s kuryer sahifasida tugmani ko'radi", (viewerRole) => {
    renderWidget(makeUser("courier"), viewerRole);

    const transfer = screen.getByTestId("transfer-263");
    expect(transfer).toHaveAttribute("data-variant", "header");
    expect(transfer).toHaveTextContent("E2E Kuryer");
    expect(screen.getByRole("button", { name: "Tahrirlash" })).toBeInTheDocument();
  });

  it.each(["manager", "registrator", "courier"])(
    "%s kuryer sahifasida tugmani ko'rmaydi",
    (viewerRole) => {
      renderWidget(makeUser("courier"), viewerRole);

      expect(screen.queryByTestId("transfer-263")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Tahrirlash" })).toBeInTheDocument();
    },
  );

  it.each<UserRole>(["manager", "market", "registrator", "admin"])(
    "kuryer bo'lmagan foydalanuvchida (%s) superadmin ham tugmani ko'rmaydi",
    (userRole) => {
      renderWidget(makeUser(userRole, { name: "Boshqa xodim" }), "superadmin");

      expect(screen.queryByTestId("transfer-263")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Tahrirlash" })).toBeInTheDocument();
    },
  );
});

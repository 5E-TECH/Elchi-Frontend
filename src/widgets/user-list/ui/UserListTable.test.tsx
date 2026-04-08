import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { UserListTable } from "./UserListTable";
import { renderWithProviders } from "../../../test/test-utils";

const navigateMock = vi.fn();
const updateUserStatusMutateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../../entities/user/api/userApi", () => ({
  useUser: () => ({
    updateUserStatus: {
      mutate: updateUserStatusMutateMock,
    },
  }),
}));

const users = [
  {
    id: "1",
    name: "Ali",
    phone_number: "+998901234567",
    role: "admin",
    status: "active",
  },
  {
    id: "2",
    name: "Vali",
    phone_number: "+998909876543",
    role: "courier",
    status: "inactive",
  },
];

describe("UserListTable", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    updateUserStatusMutateMock.mockReset();
  });

  it("renders table rows and pagination summary", () => {
    renderWithProviders(
      <UserListTable
        users={users as never}
        currentPage={1}
        onPageChange={vi.fn()}
        pagination={{ page: 1, limit: 10, total: 25, totalPages: 3 }}
      />,
    );

    expect(screen.getByText("Ali")).toBeInTheDocument();
    expect(screen.getByText("Vali")).toBeInTheDocument();
    expect(screen.getByText("1-10 dan 25 tasi ko'rsatilmoqda")).toBeInTheDocument();
  });

  it("renders loading state", () => {
    renderWithProviders(
      <UserListTable users={[]} isLoading currentPage={1} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText("Yuklanmoqda...")).toBeInTheDocument();
  });

  it("renders error state", () => {
    renderWithProviders(
      <UserListTable users={[]} isError currentPage={1} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText("Xatolik yuz berdi")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    renderWithProviders(<UserListTable users={[]} currentPage={1} onPageChange={vi.fn()} />);

    expect(screen.getByText("Foydalanuvchilar topilmadi")).toBeInTheDocument();
  });

  it("calls pagination change handlers", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    renderWithProviders(
      <UserListTable
        users={users as never}
        currentPage={1}
        onPageChange={onPageChange}
        pagination={{ page: 1, limit: 10, total: 25, totalPages: 3 }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Keyingi" }));

    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(screen.getByRole("button", { name: "Oldingi" })).toBeDisabled();
  });

  it("navigates to user detail when row is clicked", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <UserListTable users={users as never} currentPage={1} onPageChange={vi.fn()} />,
    );

    await user.click(screen.getByText("Ali"));

    expect(navigateMock).toHaveBeenCalledWith("/all-users/1");
  });

  it("toggles user status from active to inactive", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <UserListTable users={users as never} currentPage={1} onPageChange={vi.fn()} />,
    );

    await user.click(screen.getAllByRole("switch")[0]);

    expect(updateUserStatusMutateMock).toHaveBeenCalledWith(
      { id: "1", status: "inactive" },
      expect.any(Object),
    );
  });
});

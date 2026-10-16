import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { UserListTable } from "./UserListTable";
import { renderWithProviders } from "../../../test/test-utils";

const navigateMock = vi.fn();
const updateUserStatusMutateMock = vi.fn();
const deleteUserMutateMock = vi.fn();

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
    deleteUser: {
      mutate: deleteUserMutateMock,
      isPending: false,
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
    deleteUserMutateMock.mockReset();
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
      <UserListTable users={users as never} currentPage={1} onPageChange={vi.fn()} canManage />,
    );

    await user.click(screen.getAllByRole("switch")[0]);

    // Nofaol qilish — avval tasdiqlash oynasi (DESIGN_SYSTEM §8); tasdiqsiz so'rov ketmaydi.
    const dialog = await screen.findByRole("alertdialog", { name: "Nofaol qilishni tasdiqlang" });
    expect(dialog).toHaveTextContent("Ali hisobi nofaol holatga o'tadi.");
    expect(updateUserStatusMutateMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Nofaol qilish" }));

    expect(updateUserStatusMutateMock).toHaveBeenCalledWith(
      { id: "1", status: "inactive" },
      expect.any(Object),
    );
  });

  it("does not deactivate when the confirmation is cancelled", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <UserListTable users={users as never} currentPage={1} onPageChange={vi.fn()} canManage />,
    );

    await user.click(screen.getAllByRole("switch")[0]);
    await user.click(await screen.findByRole("button", { name: "Bekor qilish" }));

    expect(updateUserStatusMutateMock).not.toHaveBeenCalled();
  });

  it("activates an inactive user without a confirmation", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <UserListTable users={users as never} currentPage={1} onPageChange={vi.fn()} canManage />,
    );

    await user.click(screen.getAllByRole("switch")[1]);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(updateUserStatusMutateMock).toHaveBeenCalledWith(
      { id: "2", status: "active" },
      expect.any(Object),
    );
  });

  it("hides the status switch and delete button when the viewer cannot manage users (fix3 RBAC-16)", () => {
    renderWithProviders(
      <UserListTable users={users as never} currentPage={1} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText("Ali")).toBeInTheDocument();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: "O'chirish" })).toHaveLength(0);
    expect(updateUserStatusMutateMock).not.toHaveBeenCalled();
  });
});

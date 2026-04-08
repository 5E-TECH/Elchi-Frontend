import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import LoginForm from "./LoginForm";
import { renderWithProviders } from "../../../test/test-utils";

const navigateMock = vi.fn();
const mutateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../api/login", () => ({
  useLogin: () => ({
    signinUser: {
      mutate: mutateMock,
    },
  }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    mutateMock.mockReset();
  });

  it("renders login form fields and submit button", () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByPlaceholderText("+998 90 123 45 67")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tizimga kirish" })).toBeInTheDocument();
  });

  it("shows validation errors for empty submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Tizimga kirish" }));

    expect(await screen.findByText("Format: +998 90 123 45 67")).toBeInTheDocument();
    expect(await screen.findByText("Parol shart")).toBeInTheDocument();
  });

  it("shows phone format validation for incomplete phone number", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.clear(screen.getByPlaceholderText("+998 90 123 45 67"));
    await user.type(screen.getByPlaceholderText("+998 90 123 45 67"), "90123");
    await user.type(screen.getByPlaceholderText("••••••••"), "1234");
    await user.click(screen.getByRole("button", { name: "Tizimga kirish" }));

    expect(await screen.findByText("Format: +998 90 123 45 67")).toBeInTheDocument();
  });

  it("submits successful login and navigates to dashboard", async () => {
    const user = userEvent.setup();
    mutateMock.mockImplementation((_payload, handlers) => {
      handlers.onSuccess?.({
        user: { id: "1", role: "admin", name: "Admin" },
        accessToken: "token",
        refreshToken: "refresh",
      });
    });

    renderWithProviders(<LoginForm />);

    await user.clear(screen.getByPlaceholderText("+998 90 123 45 67"));
    await user.type(screen.getByPlaceholderText("+998 90 123 45 67"), "90 123 45 67");
    await user.type(screen.getByPlaceholderText("••••••••"), "1234");
    await user.click(screen.getByRole("button", { name: "Tizimga kirish" }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        {
          phone_number: "+998901234567",
          password: "1234",
        },
        expect.any(Object),
      );
    });
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("shows invalid credentials error for 401 response", async () => {
    const user = userEvent.setup();
    mutateMock.mockImplementation((_payload, handlers) => {
      handlers.onError?.({
        response: {
          status: 401,
        },
      });
    });

    renderWithProviders(<LoginForm />);

    await user.clear(screen.getByPlaceholderText("+998 90 123 45 67"));
    await user.type(screen.getByPlaceholderText("+998 90 123 45 67"), "90 123 45 67");
    await user.type(screen.getByPlaceholderText("••••••••"), "1234");
    await user.click(screen.getByRole("button", { name: "Tizimga kirish" }));

    expect(await screen.findByText("Parol noto'g'ri yoki foydalanuvchi topilmadi")).toBeInTheDocument();
  });
});

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import IdentityOpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiGetMock = vi.fn();
const apiPatchMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGetMock(...a),
    patch: (...a: unknown[]) => apiPatchMock(...a),
    post: (...a: unknown[]) => vi.fn()(...a),
  },
}));

describe("IdentityOps page", () => {
  beforeEach(() => {
    apiGetMock.mockResolvedValue({ data: [] });
    apiPatchMock.mockResolvedValue({ data: {} });
  });

  it('renders header "Xodimlar — ro\'yxatlar"', () => {
    renderWithProviders(<IdentityOpsPage />);
    expect(
      screen.getByText("Xodimlar — ro'yxatlar"),
    ).toBeInTheDocument();
  });

  it('calls api.get with "admins" on mount', async () => {
    renderWithProviders(<IdentityOpsPage />);
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("admins", expect.anything()),
    );
  });

  it('typing market-id and clicking toggle calls api.patch with "markets/m1/add-order"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<IdentityOpsPage />);

    await user.type(screen.getByLabelText("market-id"), "m1");
    await user.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(apiPatchMock.mock.calls[0][0]).toBe("markets/m1/add-order");
    });
  });
});

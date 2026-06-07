import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import IntegrationsOpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const apiPostMock = vi.fn();
const apiGetMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

describe("IntegrationsOps page", () => {
  beforeEach(() => {
    apiGetMock.mockResolvedValue({ data: [] });
    apiPostMock.mockResolvedValue({ data: {} });
  });

  it("renders the header 'Integratsiyalar'", () => {
    renderWithProviders(<IntegrationsOpsPage />);
    expect(screen.getByText("Integratsiyalar")).toBeInTheDocument();
  });

  it("calls GET receivables on mount", async () => {
    renderWithProviders(<IntegrationsOpsPage />);
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith(
        "integrations/receivables",
        expect.anything(),
      ),
    );
  });

  it("calls POST sync with correct endpoint when Sync is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<IntegrationsOpsPage />);

    await user.type(screen.getByLabelText("integration-id"), "i1");
    await user.click(screen.getByRole("button", { name: "Sync" }));

    await waitFor(() =>
      expect(apiPostMock.mock.calls[0][0]).toBe("integrations/i1/sync"),
    );
  });
});

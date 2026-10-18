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

  it("renders the page title 'Integratsiyalar' with the back link and the intro card", () => {
    renderWithProviders(<IntegrationsOpsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Integratsiyalar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ops vositalari/ })).toHaveAttribute("href", "/ops?tab=integrations");
    expect(screen.getByRole("heading", { name: "Integratsiyalar — operatsiyalar" })).toBeInTheDocument();
  });

  it("inside the hub (`embedded`) renders the panel without the page header", () => {
    renderWithProviders(<IntegrationsOpsPage embedded />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("heading", { name: "Integratsiyalar — operatsiyalar" })).toBeInTheDocument();
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

  it("renders receivables from the backend's { data: { items } } envelope without crashing", async () => {
    apiGetMock.mockResolvedValue({
      data: {
        statusCode: 200,
        message: "Provider receivables",
        data: {
          items: [{ id: "rcv-1", amount: "15000.00", status: "pending" }],
          pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
        },
      },
    });

    renderWithProviders(<IntegrationsOpsPage />);

    expect(await screen.findByText("rcv-1")).toBeInTheDocument();
    expect(screen.getByText("15 000 so'm")).toBeInTheDocument();
    expect(screen.getByText("Kutilmoqda")).toBeInTheDocument();
    expect(screen.getByText("1 ta")).toBeInTheDocument();
  });

  it("shows an error Alert (not an empty table) when the receivables request fails", async () => {
    apiGetMock.mockRejectedValue({
      response: { status: 500, data: { message: "Integratsiya xizmati javob bermadi" } },
    });

    renderWithProviders(<IntegrationsOpsPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Debitorlik qarzlarini yuklab bo'lmadi");
    expect(alert).toHaveTextContent("Integratsiya xizmati javob bermadi");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("refetches receivables when 'Qayta urinish' is clicked", async () => {
    const user = userEvent.setup();
    apiGetMock.mockRejectedValue({ response: { status: 500, data: { message: "down" } } });

    renderWithProviders(<IntegrationsOpsPage />);
    await screen.findByRole("alert");
    const callsBefore = apiGetMock.mock.calls.length;

    await user.click(screen.getByRole("button", { name: /Qayta urinish/ }));

    await waitFor(() => expect(apiGetMock.mock.calls.length).toBe(callsBefore + 1));
  });

  it("shows the empty state only when the request succeeded with zero rows", async () => {
    apiGetMock.mockResolvedValue({
      data: { statusCode: 200, data: { items: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } } },
    });

    renderWithProviders(<IntegrationsOpsPage />);

    expect(await screen.findByText("Debitorlik qarzlari yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error Alert when Sync fails", async () => {
    const user = userEvent.setup();
    apiPostMock.mockRejectedValue({ response: { status: 404, data: { message: "Integratsiya topilmadi" } } });

    renderWithProviders(<IntegrationsOpsPage />);
    await user.type(screen.getByRole("textbox", { name: /Integratsiya ID/ }), "missing");
    await user.click(screen.getByRole("button", { name: "Sinxronlash" }));

    const alert = await screen.findByText("Sinxronizatsiya bajarilmadi");
    expect(alert.closest("[role='alert']")).toHaveTextContent("Integratsiya topilmadi");
  });

  it("keeps Sync disabled until an integration id is entered", () => {
    renderWithProviders(<IntegrationsOpsPage />);

    expect(screen.getByRole("button", { name: "Sinxronlash" })).toBeDisabled();
  });

  it("calls POST sync with correct endpoint when Sync is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<IntegrationsOpsPage />);

    await user.type(screen.getByRole("textbox", { name: /Integratsiya ID/ }), "i1");
    await user.click(screen.getByRole("button", { name: "Sinxronlash" }));

    await waitFor(() =>
      expect(apiPostMock.mock.calls[0][0]).toBe("integrations/i1/sync"),
    );
    expect(await screen.findByText("Sinxronizatsiya muvaffaqiyatli bajarildi")).toBeInTheDocument();
    expect(screen.getByText(/^Integratsiya i1 · /)).toBeInTheDocument();
  });
});

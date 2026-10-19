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

  it('typing Market ID and clicking «Ruxsat berish» calls api.patch with "markets/m1/add-order" and shows the result', async () => {
    const user = userEvent.setup();
    renderWithProviders(<IdentityOpsPage />);

    expect(screen.getByRole("button", { name: "Ruxsat berish" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: /Market ID/ }), "m1");
    await user.click(screen.getByRole("button", { name: "Ruxsat berish" }));

    await waitFor(() => {
      expect(apiPatchMock.mock.calls[0][0]).toBe("markets/m1/add-order");
    });
    // Backend DTO `add_order: boolean` majburiy — bo'sh tana 400 qaytarardi (hxOGVwMt, NJJ2qc72).
    expect(apiPatchMock.mock.calls[0][1]).toEqual({ add_order: true });
    expect(await screen.findByText("Ruxsat berildi")).toBeInTheDocument();
    expect(screen.getByText("Market m1 endi o'zi buyurtma qo'sha oladi")).toBeInTheDocument();
  });

  it("backend xatosida «Ruxsat berildi» chiqmaydi, tugma yana bosiladigan bo'ladi", async () => {
    apiPatchMock.mockRejectedValueOnce(Object.assign(new Error("400"), { response: { status: 400, data: { message: "add_order must be a boolean value" } } }));
    const user = userEvent.setup();
    renderWithProviders(<IdentityOpsPage />);

    await user.type(screen.getByRole("textbox", { name: /Market ID/ }), "m2");
    await user.click(screen.getByRole("button", { name: "Ruxsat berish" }));

    await waitFor(() => expect(apiPatchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Ruxsat berish" })).toBeEnabled());
    expect(screen.queryByText("Ruxsat berildi")).toBeNull();
  });

  it("direct route — «← Ops vositalari»; `embedded` — no page header", () => {
    const { unmount } = renderWithProviders(<IdentityOpsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Xodimlar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ops vositalari/ })).toHaveAttribute("href", "/ops?tab=identity");
    unmount();
    renderWithProviders(<IdentityOpsPage embedded />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("fills all three tables from the backend envelope { data: { items } } without crashing", async () => {
    const envelope = (name: string) => ({
      data: { statusCode: 200, message: "success", data: { items: [{ id: `id-${name}`, name }] } },
    });
    apiGetMock.mockImplementation((url: string) => {
      if (url === "admins") return Promise.resolve(envelope("Admin A"));
      if (url === "managers") return Promise.resolve(envelope("Menejer M"));
      if (url === "registrators") return Promise.resolve(envelope("Registrator R"));
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<IdentityOpsPage />);

    expect(await screen.findByText("Admin A")).toBeInTheDocument();
    expect(await screen.findByText("Menejer M")).toBeInTheDocument();
    expect(await screen.findByText("Registrator R")).toBeInTheDocument();
  });
});

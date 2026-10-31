import { screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import IdentityOpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { expectNoRawBackendText, mockEnvelope, mockRejection } from "../../test/mockEnvelope";

const apiGetMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGetMock(...a),
    post: (...a: unknown[]) => vi.fn()(...a),
  },
}));

describe("IdentityOps page", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    // Haqiqiy konvert: `GET admins|managers|registrators` → `{ statusCode, message, data: { items } }`.
    apiGetMock.mockResolvedValue(mockEnvelope({ items: [] }));
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

  it("market ruxsati bu yerda yo'q: u market profilida, bitta joyda (941rmIn5)", () => {
    renderWithProviders(<IdentityOpsPage />);
    expect(screen.queryByText("Market: buyurtma qo'shish ruxsati")).toBeNull();
    expect(screen.queryByRole("textbox", { name: /Market ID/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ruxsat berish" })).toBeNull();
  });

  it("so'rov rad etildi (ro'yxatlar 403/400) — i18n matn, xom backend matni yo'q", async () => {
    apiGetMock.mockImplementation((url: string) =>
      Promise.reject(url === "admins" ? mockRejection(403) : mockRejection(400)),
    );
    renderWithProviders(<IdentityOpsPage />);

    expect(await screen.findByText("Bu blok sizning rolingiz uchun ochilmagan. Sahifaning qolgan qismidan bemalol foydalanishingiz mumkin.")).toBeInTheDocument();
    expect(await screen.findAllByText("So'rov bajarilmadi (400).")).toHaveLength(2);
    expectNoRawBackendText();
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
    const envelope = (name: string) => mockEnvelope({ items: [{ id: `id-${name}`, name }] }, { message: "success" });
    apiGetMock.mockImplementation((url: string) => {
      if (url === "admins") return Promise.resolve(envelope("Admin A"));
      if (url === "managers") return Promise.resolve(envelope("Menejer M"));
      if (url === "registrators") return Promise.resolve(envelope("Registrator R"));
      return Promise.resolve(mockEnvelope({ items: [] }));
    });

    renderWithProviders(<IdentityOpsPage />);

    expect(await screen.findByText("Admin A")).toBeInTheDocument();
    expect(await screen.findByText("Menejer M")).toBeInTheDocument();
    expect(await screen.findByText("Registrator R")).toBeInTheDocument();
  });
});

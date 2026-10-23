import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import IdentityOpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { expectNoRawBackendText, expectRequestBody, mockEnvelope, mockRejection } from "../../test/mockEnvelope";

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
    apiGetMock.mockReset();
    apiPatchMock.mockReset();
    // Haqiqiy konvert: `GET admins|managers|registrators` → `{ statusCode, message, data: { items } }`.
    apiGetMock.mockResolvedValue(mockEnvelope({ items: [] }));
    apiPatchMock.mockResolvedValue(mockEnvelope({ id: "m1", add_order: true }, { message: "Market updated" }));
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

    await waitFor(() => expect(apiPatchMock).toHaveBeenCalledTimes(1));
    // Backend DTO `add_order: boolean` majburiy — bo'sh tana 400 qaytarardi (hxOGVwMt, NJJ2qc72).
    expectRequestBody(apiPatchMock, "markets/m1/add-order", { add_order: true });
    expect(await screen.findByText("Ruxsat berildi")).toBeInTheDocument();
    expect(screen.getByText("Market m1 endi o'zi buyurtma qo'sha oladi")).toBeInTheDocument();
  });

  it("so'rov rad etildi (400): «Ruxsat berildi» chiqmaydi, i18n matn, xom backend matni yo'q, tugma yana bosiladi", async () => {
    apiPatchMock.mockRejectedValueOnce(mockRejection(400));
    const user = userEvent.setup();
    renderWithProviders(<IdentityOpsPage />);

    await user.type(screen.getByRole("textbox", { name: /Market ID/ }), "m2");
    await user.click(screen.getByRole("button", { name: "Ruxsat berish" }));

    await waitFor(() => expect(apiPatchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Ruxsat berish" })).toBeEnabled());
    expect(screen.queryByText("Ruxsat berildi")).toBeNull();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Ma'lumot qabul qilinmadi (400). Kiritilganini tekshirib, qayta urinib ko'ring.");
    expectNoRawBackendText();
  });

  it("so'rov rad etildi (ro'yxatlar 403/400) — i18n matn, xom backend matni yo'q", async () => {
    apiGetMock.mockImplementation((url: string) =>
      Promise.reject(mockRejection(url === "admins" ? 403 : 400)),
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

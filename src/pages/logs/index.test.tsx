import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import AuthDiagnosticsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

const refreshMock = vi.fn();

vi.mock("../../auth/authService", () => ({
  refreshAccessToken: () => refreshMock(),
}));

describe("Kirish diagnostikasi (/logs)", () => {
  beforeEach(() => {
    refreshMock.mockReset();
  });

  it("sarlavha, «← Ops vositalari», jurnalga havola va so'rov manzili", () => {
    renderWithProviders(<AuthDiagnosticsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Kirish diagnostikasi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ops vositalari/ })).toHaveAttribute("href", "/ops?tab=auth");
    expect(screen.getByRole("link", { name: "Tizim → Faoliyat jurnali" })).toHaveAttribute("href", "/activity-logs");
    expect(screen.getByText("/auth/refresh")).toBeInTheDocument();
    expect(screen.queryByText("Natija")).toBeNull();
  });

  it("muvaffaqiyat — token boshi ko'rsatiladi; `refreshAccessToken` bir marta chaqiriladi", async () => {
    const user = userEvent.setup();
    refreshMock.mockResolvedValue("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload");
    renderWithProviders(<AuthDiagnosticsPage />);

    await user.click(screen.getByRole("button", { name: "Sinov so'rovini yuborish" }));

    expect(await screen.findByText("Token muvaffaqiyatli yangilandi")).toBeInTheDocument();
    expect(screen.getByText("Yangi token olindi: eyJhbGciOiJIUzI1…")).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("xato — xavf ogohlantirishi", async () => {
    const user = userEvent.setup();
    refreshMock.mockRejectedValue(new Error("401"));
    renderWithProviders(<AuthDiagnosticsPage embedded />);

    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Sinov so'rovini yuborish" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Token yangilanmadi");
  });
});

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import BranchOpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { expectNoRawBackendText, mockEnvelope, mockRejection } from "../../test/mockEnvelope";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGetMock(...a),
    post: (...a: unknown[]) => apiPostMock(...a),
  },
}));

const bodyRows = () => within(screen.getByRole("table", { name: "Yangi buyurtmali filiallar" })).getAllByRole("row").slice(1);

/** Filial sahifasi o'rniga — joriy manzilni ko'rsatadi (qator havolasi tekshiruvi). */
const BranchPageProbe = () => <p data-testid="branch-page">{useLocation().pathname}</p>;

const renderInRoutes = () =>
  renderWithProviders(
    <Routes>
      <Route path="/batches" element={<BranchOpsPage />} />
      <Route path="/branches/:id" element={<BranchPageProbe />} />
    </Routes>,
    { route: "/batches" },
  );

describe("BranchOps page", () => {
  beforeEach(() => {
    // Haqiqiy javob konverti: axios `res.data` = { statusCode, message, data: [...] }.
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiGetMock.mockResolvedValue(mockEnvelope([], { message: "Branches with NEW orders" }));
    apiPostMock.mockResolvedValue(mockEnvelope({ id: "b1", status: "CANCELLED" }, { message: "Batch cancelled" }));
  });

  it("renders the intro \"Filiallar — operatsiyalar\" without its own page header: it lives inside /batches", () => {
    renderWithProviders(<BranchOpsPage />);
    expect(screen.getByRole("heading", { name: "Filiallar — operatsiyalar" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByRole("link", { name: /Ops vositalari/ })).toBeNull();
  });

  it("calls api.get with \"branches/new-orders\" on mount", async () => {
    renderWithProviders(<BranchOpsPage />);
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("branches/new-orders", expect.anything()),
    );
  });

  it("⭐ jadval konvert ichidagi `data` massivini ko'rsatadi (bo'sh holat emas)", async () => {
    apiGetMock.mockResolvedValue(
      mockEnvelope(
        [
          { id: "12", name: "Urganch filiali", type: "REGIONAL", new_orders_count: 7 },
          { id: "15", name: "Xiva filiali", type: "PICKUP", new_orders_count: 2 },
        ],
        { message: "Branches with NEW orders" },
      ),
    );
    renderWithProviders(<BranchOpsPage />);

    expect(await screen.findByText("Urganch filiali")).toBeInTheDocument();
    expect(screen.getByText("Xiva filiali")).toBeInTheDocument();
    expect(screen.getByText("7 ta")).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(2);
    expect(screen.queryByText("Yangi buyurtmali filial yo'q")).not.toBeInTheDocument();
  });

  it("bo'sh konvert — bo'sh holat, xato emas", async () => {
    renderWithProviders(<BranchOpsPage />);
    expect(await screen.findByText("Yangi buyurtmali filial yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("oP02jE2P: qo'lda paket raqami bilan bekor qilish formasi yo'q — bekor qilish faqat paket sahifasida", async () => {
    renderWithProviders(<BranchOpsPage />);
    await screen.findByText("Yangi buyurtmali filial yo'q");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Paketni bekor qilish" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Paketni bekor qilish" })).toBeNull();
    expect(screen.getByText(/Paketni bekor qilish — paket sahifasida/)).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("oP02jE2P: filial nomi — filial sahifasiga havola; qatorni bosish ham o'sha sahifani ochadi", async () => {
    apiGetMock.mockResolvedValue(
      mockEnvelope(
        [
          { id: "12", name: "Urganch filiali", new_orders_count: 7 },
          { id: "15", name: "Xiva filiali", new_orders_count: 2 },
        ],
        { message: "Branches with NEW orders" },
      ),
    );
    const user = userEvent.setup();
    renderInRoutes();

    const link = await screen.findByRole("link", { name: "Urganch filiali" });
    expect(link).toHaveAttribute("href", "/branches/12");

    await user.click(within(bodyRows()[1]).getByText("2 ta"));
    expect(await screen.findByTestId("branch-page")).toHaveTextContent("/branches/15");
  });

  it("so'rov rad etildi (ro'yxat 403) — i18n matn, xom backend matni yo'q", async () => {
    apiGetMock.mockRejectedValue(mockRejection(403));
    renderWithProviders(<BranchOpsPage />);

    // 403 — tizim xatosi emas: `ErrorState` neytral (`role="status"`), matn o'zimizniki.
    const state = (await screen.findByText("Filiallar ro'yxatini olib bo'lmadi")).closest("[role=status]");
    expect(state).toHaveTextContent("Bu blok sizning rolingiz uchun ochilmagan.");
    expectNoRawBackendText();
  });

  it("so'rov rad etildi (ro'yxat 500) — xato holati i18n matni bilan, xom backend matni yo'q", async () => {
    apiGetMock.mockRejectedValue(mockRejection(500));
    renderWithProviders(<BranchOpsPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Filiallar ro'yxatini olib bo'lmadi");
    expect(alert).toHaveTextContent("Server xatosi (500). Birozdan keyin qayta urinib ko'ring.");
    expectNoRawBackendText();
  });

  describe("qabul mezonlari", () => {
    it("⭐ integratsiya: {statusCode,message,data:[{id,name,new_orders_count}]} — jadvalda 1 qator", async () => {
      apiGetMock.mockResolvedValue(
        mockEnvelope([{ id: "12", name: "Urganch filiali", new_orders_count: 7 }], { message: "Branches with NEW orders" }),
      );
      renderWithProviders(<BranchOpsPage />);

      await screen.findByText("Urganch filiali");
      const rows = bodyRows();
      expect(rows).toHaveLength(1);
      expect(within(rows[0]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["12", "Urganch filiali", "7 ta"]);
    });
  });
});

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BatchesPage from "../batches";
import ReturnsPage from "../returns";
import { renderWithProviders } from "../../test/test-utils";

vi.mock("../../shared/api/api", () => ({
  api: { get: vi.fn(() => Promise.resolve({ data: { statusCode: 200, data: [] } })) },
}));
vi.mock("../logistics-ops", () => ({ default: () => <p>Logistika vositasi</p> }));
vi.mock("../branch-ops", () => ({ default: () => <p>Filiallar vositasi</p> }));

/**
 * F2NzXpMv: «Logistika» — `/returns`, «Filiallar» — `/batches` ichida. Sahifalarni admin va menejer ham ochadi,
 * vositalar esa ilgari faqat superadmin'ga edi: ko'chirish ruxsatni kengaytirmasligi kerak.
 */
const asRole = (role: string) => ({ role: { id: "1", role, region: null, name: null } }) as never;

describe("hub'dan ko'chgan vositalar", () => {
  it("superadmin: /returns ostida «Logistika»", async () => {
    renderWithProviders(<ReturnsPage />, { route: "/returns", preloadedState: asRole("superadmin") });
    expect(await screen.findByText("Logistika vositasi")).toBeInTheDocument();
  });

  it("superadmin: /batches ostida «Filiallar»", async () => {
    renderWithProviders(<BatchesPage />, { route: "/batches", preloadedState: asRole("superadmin") });
    expect(await screen.findByText("Filiallar vositasi")).toBeInTheDocument();
  });

  it.each(["admin", "manager"])("%s: vositalar ko'rinmaydi", async (role) => {
    const { unmount } = renderWithProviders(<ReturnsPage />, { route: "/returns", preloadedState: asRole(role) });
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument());
    expect(screen.queryByText(/Logistika vositasi/)).toBeNull();
    unmount();

    renderWithProviders(<BatchesPage />, { route: "/batches", preloadedState: asRole(role) });
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument());
    expect(screen.queryByText(/Filiallar vositasi/)).toBeNull();
  });
});

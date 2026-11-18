import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BatchesPage from "../batches";
import ReturnsPage from "../returns";
import { api } from "../../shared/api/api";
import { renderWithProviders } from "../../test/test-utils";

vi.mock("../../shared/api/api", () => ({
  api: { get: vi.fn(() => Promise.resolve({ data: { statusCode: 200, data: [] } })) },
}));
vi.mock("../branch-ops", () => ({ default: () => <p>Filiallar vositasi</p> }));

/**
 * F2NzXpMv: «Filiallar» — `/batches` ichida. Sahifani admin va menejer ham ochadi, vosita esa ilgari faqat
 * superadmin'ga edi: ko'chirish ruxsatni kengaytirmasligi kerak.
 *
 * u5HTJtqK: «Logistika» (qaytarish so'rovlari) `/returns` dan olib tashlandi — bir ish bitta joyda, «Pochta →
 * Qaytarish» da (tasdiq oynasi bilan); `/returns` endi so'rovlar ro'yxatini so'ramaydi.
 */
const asRole = (role: string) => ({ role: { id: "1", role, region: null, name: null } }) as never;

describe("hub'dan ko'chgan vositalar", () => {
  it("superadmin: /returns ostida qaytarish so'rovlari nusxasi yo'q (u5HTJtqK)", async () => {
    renderWithProviders(<ReturnsPage />, { route: "/returns", preloadedState: asRole("superadmin") });
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument());
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: /qaytarish so'rovlari/i })).toBeNull();
    expect(vi.mocked(api.get).mock.calls.map(([url]) => url)).not.toContain("post/return-requests/list");
  });

  it("superadmin: /batches ostida «Filiallar»", async () => {
    renderWithProviders(<BatchesPage />, { route: "/batches", preloadedState: asRole("superadmin") });
    expect(await screen.findByText("Filiallar vositasi")).toBeInTheDocument();
  });

  it.each(["admin", "manager"])("%s: vosita ko'rinmaydi", async (role) => {
    renderWithProviders(<BatchesPage />, { route: "/batches", preloadedState: asRole(role) });
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument());
    expect(screen.queryByText(/Filiallar vositasi/)).toBeNull();
  });
});

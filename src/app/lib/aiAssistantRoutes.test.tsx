import { Suspense } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import type { RootState } from "../config/store";
import AppRouter from "./routes";

/**
 * F7PWp6cK (ega 2026-11-23, T2 «ega qarori 1» ni almashtiradi): `/ai-assistant` — superadmin va admin
 * (`canViewAiAdvisor`). Adminning o'z ruxsati serverda (`access/me`): ruxsatsiz admin sahifada «ruxsat berilmagan»
 * holatini ko'radi (`AiAssistantPage.test.tsx`). Qolgan rollar — shell ichida 403.
 */

vi.mock("../../widgets/layout/dashboardLayout", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    default: () => (
      <div data-testid="shell">
        <main>
          <Outlet />
        </main>
      </div>
    ),
  };
});

vi.mock("../../pages/ai-assistant", () => ({ default: () => <p>AI yordamchi sahifasi</p> }));

const signedInAs = (role: string, branchType?: string): Partial<RootState> => ({
  user: {
    user: (branchType ? { id: "1", role, branch: { id: "1", type: branchType } } : null) as never,
    isAuthenticated: true,
    accessToken: "test.token",
    loading: false,
    isAppInitializing: false,
    error: null,
  },
  role: { id: "1", role, region: null, name: null },
});

const renderAt = (route: string, role: string, branchType?: string) =>
  renderWithProviders(
    <Suspense fallback={null}>
      <AppRouter />
    </Suspense>,
    { route, preloadedState: signedInAs(role, branchType) },
  );

describe("/ai-assistant — route guard (F7PWp6cK, ega 2026-11-23)", () => {
  it.each(["superadmin", "admin"])("%s: sahifa ochiladi (`?conversation=` bilan ham)", async (role) => {
    renderAt("/ai-assistant?conversation=41", role);
    expect(await screen.findByText("AI yordamchi sahifasi", undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it.each([
    ["manager", "HQ"],
    ["registrator", "HQ"],
    ["market", undefined],
    ["courier", "REGIONAL"],
    ["investor", undefined],
  ])("%s %s: shell ichida 403", async (role, branchType) => {
    renderAt("/ai-assistant", role, branchType);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Bu sahifaga ruxsatingiz yo'q" }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText("AI yordamchi sahifasi")).not.toBeInTheDocument();
  });
});

import { screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/test-utils";
import i18n from "../../i18n";
import { GlobalLoader } from "./provider";
import type { UserState } from "../../entities/user/model/types";

/**
 * `GlobalLoader` (sekin internet, 2026-11-07): ilova ochilayotganda — yuklanish ekrani; sessiyani tiklash sekin yoki
 * vaqtincha yiqilgan bo'lsa — «Internet sekin — qayta urinilmoqda» ekrani.
 */
const userState = (patch: Partial<UserState>): UserState => ({
  user: null,
  isAuthenticated: false,
  accessToken: null,
  loading: false,
  isAppInitializing: true,
  error: null,
  sessionRestore: null,
  ...patch,
});

const renderLoader = (patch: Partial<UserState>) =>
  renderWithProviders(
    <GlobalLoader>
      <p>Ilova</p>
    </GlobalLoader>,
    { preloadedState: { user: userState(patch) } },
  );

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

describe("GlobalLoader", () => {
  it("ochilmoqda, tiklash muammosiz — yuklanish ekrani", () => {
    renderLoader({});
    expect(screen.getByRole("status", { name: "Ilova yuklanmoqda" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Internet sekin/ })).toBeNull();
  });

  it("tiklash sekin / yiqildi — yuklanish ekrani o'rnida «Internet sekin» ekrani", () => {
    renderLoader({ sessionRestore: { phase: "waiting", reason: "network" } });
    expect(screen.getByRole("heading", { level: 1, name: "Internet sekin — qayta urinilmoqda" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Ilova yuklanmoqda" })).toBeNull();
  });

  it("ochilib bo'lgan — ikkalasi ham yo'q, ilova ko'rinadi", () => {
    renderLoader({ isAppInitializing: false, sessionRestore: { phase: "waiting", reason: "network" } });
    expect(screen.queryByRole("status", { name: "Ilova yuklanmoqda" })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Internet sekin/ })).toBeNull();
    expect(screen.getByText("Ilova")).toBeVisible();
  });
});

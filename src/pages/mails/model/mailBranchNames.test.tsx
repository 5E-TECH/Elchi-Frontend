import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { api } from "../../../shared/api/api";
import { renderWithProviders } from "../../../test/test-utils";
import {
  hasMailBranch,
  readMailBranchId,
  selectMailsBranchColumn,
  useMailBranchName,
} from "./mailBranchNames";

/**
 * «Filial» ustuni (Bahodir, 2026-11-04): pochta `branch_id` → nom. Manba rolga qarab — superadmin/admin `GET branches`,
 * HQ registratori `GET branches/dispatch-destinations`, hammada o'z filiali (profil); topilmasa «Filial #id».
 */
const IDS = ["1", "16", "40", null, "0"];

const Probe = ({ enabled = true }: { enabled?: boolean }) => {
  const name = useMailBranchName(enabled);
  return <output data-testid="names">{IDS.map((id) => name(id) ?? "∅").join(" | ")}</output>;
};

const userState = (role: string, branch?: Record<string, unknown>) => ({
  role: { id: "1", role, region: null, name: role },
  user: {
    user: { id: "u-1", role, ...(branch ? { branch } : {}) },
    isAuthenticated: true,
    accessToken: null,
    loading: false,
    isAppInitializing: false,
    error: null,
  },
});

const ALL_BRANCHES = {
  statusCode: 200,
  data: {
    items: [
      { id: "1", name: "HQ Toshkent", type: "HQ" },
      { id: "16", name: "Urgut filiali", type: "REGIONAL" },
    ],
    total: 2,
  },
};
const DESTINATIONS = {
  statusCode: 200,
  data: { items: [{ id: "16", name: "Urgut filiali", type: "REGIONAL" }], total: 1 },
};

const mockGet = () =>
  vi.spyOn(api, "get").mockImplementation((url: string) => {
    if (url === "branches") return Promise.resolve({ data: ALL_BRANCHES });
    if (url === "branches/dispatch-destinations") return Promise.resolve({ data: DESTINATIONS });
    return Promise.reject(new Error(`kutilmagan so'rov: ${url}`));
  });

const names = () => screen.getByTestId("names").textContent;

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useMailBranchName", () => {
  it.each(["superadmin", "admin"])(
    "%s: barcha filiallar `GET branches` dan (HQ ham), qolgani «Filial #id»",
    async (role) => {
      const get = mockGet();
      renderWithProviders(<Probe />, { preloadedState: userState(role) as never });

      await waitFor(() => expect(names()).toBe("HQ Toshkent | Urgut filiali | Filial #40 | ∅ | ∅"));
      expect(get.mock.calls.map(([url]) => url)).toEqual(["branches"]);
    },
  );

  it("HQ registratori: `dispatch-destinations` + o'z filiali (HQ)", async () => {
    const get = mockGet();
    renderWithProviders(<Probe />, {
      preloadedState: userState("registrator", {
        id: "1",
        name: "HQ Toshkent",
        type: "HQ",
      }) as never,
    });

    await waitFor(() => expect(names()).toBe("HQ Toshkent | Urgut filiali | Filial #40 | ∅ | ∅"));
    expect(get.mock.calls.map(([url]) => url)).toEqual(["branches/dispatch-destinations"]);
  });

  it("menejer va filial registratori: so'rovsiz — faqat o'z filiali", () => {
    const get = mockGet();
    const { unmount } = renderWithProviders(<Probe />, {
      preloadedState: userState("manager", {
        id: "16",
        name: "Urgut filiali",
        type: "REGIONAL",
      }) as never,
    });
    expect(names()).toBe("Filial #1 | Urgut filiali | Filial #40 | ∅ | ∅");
    unmount();

    renderWithProviders(<Probe />, {
      preloadedState: userState("registrator", {
        id: "16",
        name: "Urgut filiali",
        type: "REGIONAL",
      }) as never,
    });
    expect(names()).toBe("Filial #1 | Urgut filiali | Filial #40 | ∅ | ∅");
    expect(get).not.toHaveBeenCalled();
  });

  it("`enabled: false` — so'rov ketmaydi", () => {
    const get = mockGet();
    renderWithProviders(<Probe enabled={false} />, {
      preloadedState: userState("superadmin") as never,
    });
    expect(names()).toBe("Filial #1 | Filial #16 | Filial #40 | ∅ | ∅");
    expect(get).not.toHaveBeenCalled();
  });
});

describe("mailBranchNames — sof yordamchilar", () => {
  it("«Filial» ustuni faqat superadmin, admin va registratorda", () => {
    const column = (role: string) => selectMailsBranchColumn({ role: { role } } as never);
    expect(["superadmin", "admin", "registrator"].map(column)).toEqual([true, true, true]);
    expect(["manager", "courier", "market"].map(column)).toEqual([false, false, false]);
  });

  it("filial id: son va matn; `null`, bo'sh va '0' — filial yo'q", () => {
    expect([readMailBranchId("16"), readMailBranchId(16), readMailBranchId(" 7 ")]).toEqual([
      "16",
      "16",
      "7",
    ]);
    expect([
      readMailBranchId(null),
      readMailBranchId(""),
      readMailBranchId("0"),
      readMailBranchId({}),
    ]).toEqual(["", "", "", ""]);
    expect(hasMailBranch([{ branch_id: null }, { branch_id: "0" }])).toBe(false);
    expect(hasMailBranch([{ branch_id: null }, { branch_id: "9" }])).toBe(true);
  });
});

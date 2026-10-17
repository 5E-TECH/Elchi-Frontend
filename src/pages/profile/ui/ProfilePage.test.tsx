import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), logout: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, patch: mocks.patch, post: vi.fn(), delete: vi.fn() },
}));
vi.mock("../../../shared/lib/useLogout", () => ({ useLogout: () => ({ logout: mocks.logout }) }));

import ProfilePage from "./ProfilePage";

/**
 * `/profile` (dizayn v2, maketlar `common-profile`, `common-profile-password-dialog`): ma'lumot kartasi, maosh
 * (faqat maoshli xodimda), parol oynasi (≥ 4 belgi, takror mos, saqlangach chiqish) va tahrirlash oynasi
 * (faqat o'zgargan maydonlar).
 */

const baseProfile = {
  id: "1",
  name: "Shodiyor Ergashev",
  username: "shodiyor",
  phone_number: "+998907001234",
  role: "superadmin",
  status: "active",
  salary: 6_000_000,
  payment_day: 25,
  createdAt: "2026-01-14T09:00:00+05:00",
  updatedAt: "2026-10-02T09:00:00+05:00",
  branch: { id: "b1", branch_id: "7", branch: { id: "7", name: "Toshkent HQ" } },
};

let profile: Record<string, unknown> = baseProfile;

const patchCalls = () =>
  mocks.patch.mock.calls
    .filter(([url]) => url === "auth/my-profile")
    .map(([, body]) => body as Record<string, unknown>);

beforeEach(() => {
  profile = { ...baseProfile };
  window.sessionStorage.clear();
  mocks.logout.mockReset().mockResolvedValue(undefined);
  mocks.get
    .mockReset()
    .mockImplementation((url: string) =>
      url === "auth/my-profile"
        ? Promise.resolve({ data: { statusCode: 200, data: profile } })
        : Promise.resolve({ data: { data: {} } }),
    );
  mocks.patch.mockReset().mockResolvedValue({ data: { statusCode: 200, data: profile } });
});

const open = async () => {
  const view = renderWithProviders(<ProfilePage />, { route: "/profile" });
  await screen.findByRole("heading", { name: "Shodiyor Ergashev" });
  return view;
};

describe("Profil — ma'lumot kartasi", () => {
  it("ism, login, rol va holat badge'lari, telefon, filial va sanalar", async () => {
    await open();
    expect(screen.getByRole("heading", { level: 1, name: "Profil" })).toBeInTheDocument();
    expect(screen.getByText("Login: shodiyor")).toBeInTheDocument();
    expect(screen.getByText("Superadmin")).toBeInTheDocument();
    expect(screen.getByText("Faol")).toBeInTheDocument();
    expect(screen.getByText("+998 90 700 12 34")).toBeInTheDocument();
    expect(screen.getByText("Toshkent HQ")).toBeInTheDocument();
    expect(screen.getByText("14.01.2026")).toBeInTheDocument();
    expect(screen.getByText("02.10.2026")).toBeInTheDocument();
  });

  it("login va filial bo'lmasa — o'sha qatorlar chizilmaydi", async () => {
    profile = { ...baseProfile, username: null, branch: null };
    await open();
    expect(screen.queryByText(/^Login:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Filial")).not.toBeInTheDocument();
  });
});

describe("Profil — oylik maosh", () => {
  it("maoshli xodimda karta bor: to'plangan / maosh, foiz va progress", async () => {
    await open();
    const card = screen.getByRole("region", { name: "Oylik maosh" });
    expect(within(card).getByText("Shu davrda to'plangan")).toBeInTheDocument();
    expect(within(card).getByText(/6 000 000 so'm/)).toBeInTheDocument();
    expect(within(card).getByRole("progressbar", { name: "Maosh davri" })).toHaveAttribute(
      "aria-valuemax",
      "100",
    );
  });

  it.each([
    ["maosh 0", { salary: 0 }],
    ["kuryer (maoshli rol emas)", { role: "courier", salary: 3_000_000 }],
  ])("%s — karta yo'q", async (_label, over) => {
    profile = { ...baseProfile, ...over };
    await open();
    expect(screen.queryByRole("region", { name: "Oylik maosh" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Xavfsizlik" })).toBeInTheDocument();
  });
});

describe("Profil — parolni o'zgartirish", () => {
  const openDialog = async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Parolni o'zgartirish" }));
    return screen.findByRole("dialog", { name: "Parolni o'zgartirish" });
  };

  it("bo'sh, qisqa va mos kelmagan parol yuborilmaydi", async () => {
    const dialog = await openDialog();
    expect(within(dialog).getByText("Shodiyor Ergashev ·", { exact: false })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));
    expect(within(dialog).getByText("Yangi parolni kiriting")).toBeInTheDocument();

    const [first, second] = within(dialog).getAllByPlaceholderText(/parol/i);
    await userEvent.type(first, "abc");
    await userEvent.type(second, "abc");
    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));
    expect(
      within(dialog).getByText("Parol kamida 4 ta belgidan iborat bo'lsin"),
    ).toBeInTheDocument();

    await userEvent.clear(first);
    await userEvent.type(first, "namuna12");
    await userEvent.clear(second);
    await userEvent.type(second, "namuna13");
    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));
    expect(within(dialog).getByText("Parollar mos kelmadi")).toBeInTheDocument();

    // Faqat bo'shliqdan iborat parol — bo'sh (eski modal `trim()` qoidasi).
    await userEvent.clear(first);
    await userEvent.type(first, "    ");
    await userEvent.clear(second);
    await userEvent.type(second, "    ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));
    expect(within(dialog).getByText("Yangi parolni kiriting")).toBeInTheDocument();
    expect(patchCalls()).toEqual([]);
  });

  it("mos kelsa yashil izoh; saqlansa faqat `{ password }` ketadi, xabar, login sababi va chiqish", async () => {
    const dialog = await openDialog();
    const [first, second] = within(dialog).getAllByPlaceholderText(/parol/i);
    expect(first).toHaveAttribute("type", "password");
    await userEvent.click(within(dialog).getAllByRole("button", { name: "Parolni ko'rsatish" })[0]);
    expect(first).toHaveAttribute("type", "text");

    await userEvent.type(first, "namuna12");
    await userEvent.type(second, "namuna12");
    expect(within(dialog).getByText("Parollar mos keladi")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));
    await waitFor(() => expect(patchCalls()).toEqual([{ password: "namuna12" }]));
    expect(await screen.findByText("Parol o'zgardi — qayta kiring")).toBeInTheDocument();
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
    expect(window.sessionStorage.getItem("elchi_login_notice")).toBe("passwordChanged");
  });

  it("backend rad etsa — chiqilmaydi, oyna ochiq qoladi, xato ko'rinadi", async () => {
    mocks.patch.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { message: "Parol juda oddiy", errors: { password: ["Parol juda oddiy"] } },
      },
    });
    const dialog = await openDialog();
    const [first, second] = within(dialog).getAllByPlaceholderText(/parol/i);
    await userEvent.type(first, "1111");
    await userEvent.type(second, "1111");
    await userEvent.click(within(dialog).getByRole("button", { name: "Parolni saqlash" }));

    expect(await within(dialog).findByText("Parol juda oddiy")).toBeInTheDocument();
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("elchi_login_notice")).toBeNull();
  });
});

describe("Profil — tahrirlash", () => {
  const openDialog = async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Tahrirlash" }));
    return screen.findByRole("dialog", { name: "Profilni tahrirlash" });
  };

  it("faqat o'zgargan maydon yuboriladi (ism)", async () => {
    const dialog = await openDialog();
    const name = within(dialog).getByRole("textbox", { name: /Ism/ });
    await userEvent.clear(name);
    await userEvent.type(name, "  Shodiyor Ergash  ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(patchCalls()).toEqual([{ name: "Shodiyor Ergash" }]));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Profilni tahrirlash" })).not.toBeInTheDocument(),
    );
  });

  it("telefon o'zgarsa `+998…` ko'rinishida", async () => {
    const dialog = await openDialog();
    const phone = within(dialog).getByRole("textbox", { name: /Telefon/ });
    await userEvent.clear(phone);
    await userEvent.type(phone, "901112233");
    await userEvent.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(patchCalls()).toEqual([{ phone_number: "+998901112233" }]));
  });

  it("o'zgarish yo'q — so'rov ketmaydi, oyna yopiladi; noto'liq telefon — xato", async () => {
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Profilni tahrirlash" })).not.toBeInTheDocument(),
    );
    expect(patchCalls()).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Tahrirlash" }));
    const again = await screen.findByRole("dialog", { name: "Profilni tahrirlash" });
    const phone = within(again).getByRole("textbox", { name: /Telefon/ });
    await userEvent.clear(phone);
    await userEvent.type(phone, "9011");
    await userEvent.click(within(again).getByRole("button", { name: "Saqlash" }));
    expect(within(again).getByText("9 ta raqam kiriting")).toBeInTheDocument();
    expect(patchCalls()).toEqual([]);
  });

  it("1 belgili ism — yuborilmaydi (backend `@MinLength(2)`)", async () => {
    const dialog = await openDialog();
    const name = within(dialog).getByRole("textbox", { name: /Ism/ });
    await userEvent.clear(name);
    await userEvent.type(name, "S");
    await userEvent.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    expect(
      within(dialog).getByText("Ism kamida 2 ta belgidan iborat bo'lsin"),
    ).toBeInTheDocument();
    expect(patchCalls()).toEqual([]);
  });
});

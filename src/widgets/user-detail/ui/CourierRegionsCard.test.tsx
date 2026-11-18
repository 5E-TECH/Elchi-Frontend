import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCourierRegionsPayload,
  readCourierRegions,
  type CourierRegionsView,
} from "../../../entities/user/api/courierRegions";
import type { User } from "../../../entities/user/types/user";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * «Xizmat viloyatlari» (ega qarori 2026-11-15; maket yo'q — eng yaqini `superadmin-users-detail`):
 * `GET / PUT couriers/:id/regions`, viloyatlar katalogi — `GET region`. `notify` mock qilinmaydi.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock("../../../shared/api/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../shared/api/api")>();
  return { ...original, api: { ...original.api, get: mocks.get, put: mocks.put } };
});

import { CourierRegionsCard } from "./CourierRegionsCard";

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const REGIONS = [
  { id: "5", name: "Qashqadaryo" },
  { id: "6", name: "Samarqand" },
  { id: "7", name: "Surxondaryo" },
  { id: "8", name: "Navoiy" },
];

const regionsView = (patch: Partial<CourierRegionsView> = {}) => ({
  courier_id: "77",
  home_region_id: "11",
  is_super_courier: true,
  serves_all_regions: false,
  flat_tariff_home: 30000,
  flat_tariff_center: 25000,
  regions: [
    { region_id: "5", tariff_home: 15000, tariff_center: 12000 },
    { region_id: "6", tariff_home: null, tariff_center: null },
  ],
  ...patch,
});

let current = regionsView();

const courier = { id: "77", name: "Ali Valiyev", role: "courier", status: "active" } as unknown as User;

const SUPERADMIN = { role: { id: "1", role: "superadmin", region: null, name: "SA" } } as never;

const httpError = (status: number, message: string) => {
  const error = new AxiosError("Request failed");
  error.response = {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { statusCode: status, message },
  };
  return error;
};

const render = () => renderWithProviders(<CourierRegionsCard user={courier} />, { preloadedState: SUPERADMIN });

describe("CourierRegionsCard", () => {
  beforeEach(() => {
    current = regionsView();
    mocks.get.mockReset().mockImplementation((url: string) => {
      if (url === "couriers/77/regions") return Promise.resolve({ data: { statusCode: 200, data: current } });
      if (url === "region") return Promise.resolve({ data: { statusCode: 200, data: REGIONS } });
      return Promise.reject(httpError(404, "topilmadi"));
    });
    mocks.put.mockReset().mockImplementation((_url: string, dto: Record<string, unknown>) => {
      current = { ...current, ...(dto as Partial<CourierRegionsView>) };
      return Promise.resolve({ data: { statusCode: 200, data: current } });
    });
  });

  it("viloyatlar katalog nomlari bilan, izoh; «O'zgartirish»", async () => {
    render();
    const card = await screen.findByRole("region", { name: "Xizmat viloyatlari" });
    const list = await within(card).findByRole("list", { name: "Xizmat viloyatlari" });
    expect(await within(list).findByText("Qashqadaryo")).toBeInTheDocument();
    expect(within(list).getByText("Samarqand")).toBeInTheDocument();
    expect(
      within(card).getByText("HQ kuryeri shu viloyatlar pochtasida «HQ kuryeriga» ro'yxatida chiqadi"),
    ).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "O'zgartirish" })).toBeEnabled();
    expect(mocks.get).toHaveBeenCalledWith("couriers/77/regions");
  });

  it("ro'yxat bo'sh — «Faqat o'z viloyati»; «Barcha viloyatlar» bo'lsa — belgi va izoh", async () => {
    current = regionsView({ regions: [], is_super_courier: false });
    const { unmount } = render();
    expect(await screen.findByText("Faqat o'z viloyati")).toBeInTheDocument();
    unmount();

    current = regionsView({ regions: [], serves_all_regions: true });
    render();
    expect(await screen.findByText("Barcha viloyatlar")).toBeInTheDocument();
    expect(screen.getByText("Kuryer har viloyat pochtasida chiqadi — ro'yxatdan qat'i nazar.")).toBeInTheDocument();
    expect(screen.queryByText("Faqat o'z viloyati")).not.toBeInTheDocument();
  });

  it("⭐ oyna: belgilangan viloyatlar oldindan; saqlash — PUT tariflarni saqlaydi, yangisiga null, bayroqlar", async () => {
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole("button", { name: "O'zgartirish" }));
    const dialog = await screen.findByRole("dialog", { name: "Xizmat viloyatlari" });
    expect(within(dialog).getByText("Ali Valiyev")).toBeInTheDocument();
    const group = await within(dialog).findByRole("group", { name: "Viloyatlar" });
    expect(within(group).getByRole("checkbox", { name: "Qashqadaryo" })).toBeChecked();
    expect(within(group).getByRole("checkbox", { name: "Samarqand" })).toBeChecked();
    expect(within(group).getByRole("checkbox", { name: "Navoiy" })).not.toBeChecked();
    // O'zgarishsiz saqlab bo'lmaydi.
    expect(within(dialog).getByRole("button", { name: "Saqlash" })).toBeDisabled();

    await user.click(within(group).getByRole("checkbox", { name: "Samarqand" }));
    await user.click(within(group).getByRole("checkbox", { name: "Navoiy" }));
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));

    await waitFor(() =>
      expect(mocks.put).toHaveBeenCalledWith("couriers/77/regions", {
        is_super_courier: true,
        serves_all_regions: false,
        regions: [
          { region_id: "8", tariff_home: null, tariff_center: null },
          { region_id: "5", tariff_home: 15000, tariff_center: 12000 },
        ],
      }),
    );
    expect(await screen.findByText("Viloyatlar saqlandi")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Xizmat viloyatlari" })).not.toBeInTheDocument(),
    );
    const list = screen.getByRole("list", { name: "Xizmat viloyatlari" });
    expect(within(list).getByText("Navoiy")).toBeInTheDocument();
    expect(within(list).queryByText("Samarqand")).not.toBeInTheDocument();
  });

  it("hammasi olib tashlansa — is_super_courier: false, ro'yxat bo'sh", async () => {
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole("button", { name: "O'zgartirish" }));
    const dialog = await screen.findByRole("dialog", { name: "Xizmat viloyatlari" });
    const group = await within(dialog).findByRole("group", { name: "Viloyatlar" });
    await user.click(within(group).getByRole("checkbox", { name: "Qashqadaryo" }));
    await user.click(within(group).getByRole("checkbox", { name: "Samarqand" }));
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    await waitFor(() =>
      expect(mocks.put).toHaveBeenCalledWith("couriers/77/regions", {
        is_super_courier: false,
        serves_all_regions: false,
        regions: [],
      }),
    );
  });

  it("server rad etsa — backend xabari, oyna ochiq qoladi", async () => {
    const user = userEvent.setup();
    mocks.put.mockReset().mockRejectedValue(httpError(400, "Viloyat takrorlangan: 5"));
    render();
    await user.click(await screen.findByRole("button", { name: "O'zgartirish" }));
    const dialog = await screen.findByRole("dialog", { name: "Xizmat viloyatlari" });
    const group = await within(dialog).findByRole("group", { name: "Viloyatlar" });
    await user.click(within(group).getByRole("checkbox", { name: "Navoiy" }));
    await user.click(within(dialog).getByRole("button", { name: "Saqlash" }));
    expect(await screen.findByText("Viloyat takrorlangan: 5")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Xizmat viloyatlari" })).toBeInTheDocument();
  });

  it("yuklab bo'lmasa — xato holati va «Qayta urinish»; «O'zgartirish» o'chiq", async () => {
    const user = userEvent.setup();
    let fail = true;
    mocks.get.mockImplementation((url: string) => {
      if (url === "couriers/77/regions") {
        return fail
          ? Promise.reject(httpError(500, "Server xatosi"))
          : Promise.resolve({ data: { statusCode: 200, data: current } });
      }
      if (url === "region") return Promise.resolve({ data: { statusCode: 200, data: REGIONS } });
      return Promise.reject(httpError(404, "topilmadi"));
    });
    render();
    expect(await screen.findByText("Xizmat viloyatlarini yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "O'zgartirish" })).toBeDisabled();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByText("Qashqadaryo")).toBeInTheDocument();
  });
});

describe("buildCourierRegionsPayload / readCourierRegions", () => {
  it("«Barcha viloyatlar» yoqiq va ro'yxat bo'sh — super-kuryer qoladi (backend serves_all faqat super-kuryerga)", () => {
    const view = readCourierRegions({ data: regionsView({ serves_all_regions: true }) }, "77");
    expect(buildCourierRegionsPayload(view, [])).toEqual({
      is_super_courier: true,
      serves_all_regions: true,
      regions: [],
    });
  });

  it("takrorlar va bo'sh id olib tashlanadi; tariflar saqlanadi", () => {
    const view = readCourierRegions({ data: regionsView() }, "77");
    expect(buildCourierRegionsPayload(view, ["5", "5", " ", "7"])).toEqual({
      is_super_courier: true,
      serves_all_regions: false,
      regions: [
        { region_id: "5", tariff_home: 15000, tariff_center: 12000 },
        { region_id: "7", tariff_home: null, tariff_center: null },
      ],
    });
  });

  it("o'ramsiz va kutilmagan javob — xavfsiz sukut", () => {
    expect(readCourierRegions(null, "77")).toEqual({
      courier_id: "77",
      home_region_id: null,
      is_super_courier: false,
      serves_all_regions: false,
      flat_tariff_home: null,
      flat_tariff_center: null,
      regions: [],
    });
    expect(readCourierRegions(regionsView({ regions: [{ region_id: 9 as never, tariff_home: "100" as never, tariff_center: null }] }), "77").regions).toEqual([
      { region_id: "9", tariff_home: 100, tariff_center: null },
    ]);
  });
});

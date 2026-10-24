import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { Notification, NotificationParams } from "../../../entities/notification";
import type { User } from "../../../entities/user/types/user";
import type { GroupLinkCodeRequest } from "../../../features/telegram-link";
import { MarketTelegramGroupsCard } from "./MarketTelegramGroupsCard";

/**
 * TG-B — «Telegram guruhi» kartasi (maketlar `{superadmin,admin}-users-detail-telegram`, `market-profile`):
 * har tur holati (`GET /notifications?market_id`), ulanmagan turda «Ulash» → bir martalik havola oynasi
 * (`POST /telegram/link-code`), ulanish kuzatuvi va «Guruh ulandi», «Barcha guruhlar …» havolasi, PII kaliti
 * (S3), market o'z profilida — holatsiz. Xato matnlari faqat i18n. Tarmoqqa chiqilmaydi (API funksiyalari mock).
 */

const mocks = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  requestGroupLinkCode: vi.fn(),
  updatePii: vi.fn(),
}));

vi.mock("../../../entities/notification/api/notificationApi", () => ({
  getNotifications: (params: NotificationParams) => mocks.getNotifications(params),
  getNotificationById: vi.fn(),
}));

vi.mock("../../../features/telegram-link/api/telegramLinkApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../features/telegram-link/api/telegramLinkApi")>()),
  requestGroupLinkCode: (payload: GroupLinkCodeRequest) => mocks.requestGroupLinkCode(payload),
}));

vi.mock("../../../entities/user/api/userApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/user/api/userApi")>()),
  useUser: () => ({ updateMarketTelegramGroupPii: { mutateAsync: mocks.updatePii, isPending: false } }),
}));

const DEEP_LINK = "https://t.me/elchi_bot?startgroup=c0de42";

const MARKET: User = {
  id: "201",
  name: "Baraka Shop",
  phone_number: "+998903152241",
  username: "baraka_shop",
  role: "market",
  status: "active",
  salary: 0,
  payment_day: null,
  createdAt: "2026-09-29T09:00:00.000Z",
  updatedAt: "2026-10-05T09:00:00.000Z",
  is_deleted: false,
  tariff_home: 35000,
  tariff_center: 25000,
  default_tariff: "home",
};

const row = (overrides: Partial<Notification> = {}): Notification => ({
  id: "n1",
  market_id: "201",
  market_name: null,
  group_id: "-100123",
  group_type: "create",
  is_active: true,
  inactive_reason: null,
  inactive_at: null,
  created_at: "2026-10-06T09:00:00.000Z",
  ...overrides,
});

const page = (data: Notification[]) => ({ data, total: data.length, page: 1, limit: 10 });

const linkCode = (groupType: "create" | "cancel", deepLink: string | null = DEEP_LINK) => ({
  token: `c0de-${Math.random()}`,
  purpose: "market_group" as const,
  group_type: groupType,
  expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  deep_link: deepLink,
  command: "/start c0de42",
});

const stateFor = (role: string, id = `${role}-1`) =>
  ({ role: { id, role, region: null, name: role } }) as never;

const renderCard = (mode: "staff" | "self", viewerRole: string, viewerId?: string) =>
  renderWithProviders(<MarketTelegramGroupsCard user={MARKET} mode={mode} />, {
    preloadedState: stateFor(viewerRole, viewerId),
  });

beforeEach(() => {
  mocks.getNotifications.mockReset();
  mocks.requestGroupLinkCode.mockReset();
  mocks.updatePii.mockReset();
});

describe("MarketTelegramGroupsCard — `staff` (superadmin/admin, `*-users-detail-telegram`)", () => {
  it("holatlar: ulangan — «Ulangan» + sana, ulanmagan — «Ulanmagan» + izoh va «Ulash»; «Barcha guruhlar» havolasi", async () => {
    mocks.getNotifications.mockResolvedValue(page([row()]));
    renderCard("staff", "superadmin");

    const card = screen.getByRole("region", { name: "Telegram guruhi" });
    expect(card).toHaveTextContent("Market buyurtma xabarlari shu guruhlarga keladi.");
    expect(await within(card).findByText("06.10.2026 dan")).toBeInTheDocument();
    expect(within(card).getByText("Ulangan")).toBeInTheDocument();
    expect(within(card).getByText("Ulanmagan")).toBeInTheDocument();
    expect(within(card).getByText("Bekor qilingan buyurtmalar xabari kelmaydi")).toBeInTheDocument();

    // Bot mavjud ulanishni almashtirmaydi — ulangan turda «Ulash» yo'q.
    expect(within(card).queryByRole("button", { name: "Yangi buyurtmalar guruhini ulash" })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Bekor qilinganlar guruhini ulash" })).toBeEnabled();
    expect(within(card).getByRole("link", { name: /Barcha guruhlar «Bildirishnomalar» bo'limida/ })).toHaveAttribute(
      "href",
      "/notifications",
    );
    expect(mocks.getNotifications).toHaveBeenCalledWith({ market_id: "201", page: 1, limit: 10 });
  });

  it("admin ham ko'radi va ulaydi (ega javobi S2); «Barcha guruhlar» havolasi adminda ham", async () => {
    mocks.getNotifications.mockResolvedValue(page([]));
    renderCard("staff", "admin");

    expect(await screen.findByRole("button", { name: "Yangi buyurtmalar guruhini ulash" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekor qilinganlar guruhini ulash" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Barcha guruhlar/ })).toBeInTheDocument();
  });

  it("nofaol ulanish — «Nofaol» + umumiy izoh (sababsiz), «Ulash» yo'q; sana kelmasa — sanasiz «Ulangan»", async () => {
    mocks.getNotifications.mockResolvedValue(
      page([row({ is_active: false }), row({ id: "n2", group_type: "cancel", created_at: null })]),
    );
    renderCard("staff", "superadmin");

    expect(await screen.findByText("Nofaol")).toBeInTheDocument();
    expect(screen.getByText("Xabarlar bu guruhga yuborilmayapti")).toBeInTheDocument();
    expect(screen.getByText("Ulangan")).toBeInTheDocument();
    expect(screen.queryByText(/ dan$/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /guruhini ulash/ })).not.toBeInTheDocument();
  });

  it("NG-C: nofaol sababi — «Nofaol» (bot chiqarilgan — qizil) + `/notifications` dagi matn va sana; qo'lda — neytral", async () => {
    mocks.getNotifications.mockResolvedValue(
      page([
        row({ is_active: false, inactive_reason: "kicked", inactive_at: "2026-10-21T08:00:00.000Z" }),
        row({ id: "n2", group_type: "cancel", is_active: false, inactive_reason: "manual" }),
      ]),
    );
    renderCard("staff", "admin");

    const create = await screen.findByRole("group", { name: "Yangi buyurtmalar guruhi" });
    expect(
      await within(create).findByText("Bot guruhdan chiqarilgan — qayta qo'shing va faollashtiring"),
    ).toBeInTheDocument();
    expect(within(create).getByText("Nofaol bo'lgan: 21.10.2026, 13:00")).toBeInTheDocument();
    expect(within(create).getByText("Nofaol").closest(".bg-danger-soft")).not.toBeNull();

    const cancel = screen.getByRole("group", { name: "Bekor qilinganlar guruhi" });
    expect(within(cancel).getByText("Qo'lda nofaol qilingan")).toBeInTheDocument();
    expect(within(cancel).getByText("Nofaol").closest(".bg-sunken")).not.toBeNull();
    expect(screen.queryByText("Xabarlar bu guruhga yuborilmayapti")).not.toBeInTheDocument();
    // Faollashtirish — «Bildirishnomalar» bo'limida.
    expect(screen.getByRole("link", { name: /Barcha guruhlar/ })).toHaveAttribute("href", "/notifications");
  });

  it("holat yuklanmasa — xato holati va «Qayta urinish» (backend matnisiz), PII kaliti ishlayveradi", async () => {
    mocks.getNotifications.mockRejectedValueOnce(
      new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
        status: 500,
        data: { message: "internal db error" },
      } as AxiosResponse),
    );
    const user = userEvent.setup();
    renderCard("staff", "superadmin");

    expect(await screen.findByText("Guruhlar holatini yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByText("internal db error")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /guruhini ulash/ })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Guruhda mijoz ismi va telefoni" })).toBeEnabled();

    mocks.getNotifications.mockResolvedValue(page([]));
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(await screen.findByRole("button", { name: "Yangi buyurtmalar guruhini ulash" })).toBeInTheDocument();
  });

  it("«Ulash» → havola (shu market, tur) → oyna: sarlavha, QR, «Telegram'da ochish», kutish; guruh paydo bo'lsa — yopiladi va «Guruh ulandi»", async () => {
    // Karta ro'yxati — bo'sh; oynaning kuzatuvi (`group_type` bilan) — 2-so'rovda qator paydo bo'ladi.
    let watchCalls = 0;
    mocks.getNotifications.mockImplementation(async (params: NotificationParams) => {
      if (!params.group_type) return page([]);
      watchCalls += 1;
      return page(watchCalls > 1 ? [row({ group_type: "cancel" })] : []);
    });
    mocks.requestGroupLinkCode.mockResolvedValue(linkCode("cancel"));
    const user = userEvent.setup();
    renderCard("staff", "superadmin");

    await user.click(await screen.findByRole("button", { name: "Bekor qilinganlar guruhini ulash" }));

    expect(mocks.requestGroupLinkCode).toHaveBeenCalledWith({
      purpose: "market_group",
      group_type: "cancel",
      market_id: "201",
    });
    const dialog = await screen.findByRole("dialog", { name: "Telegram guruhini ulash" });
    expect(dialog).toHaveAccessibleDescription("Baraka Shop · Bekor qilinganlar guruhi");
    expect(within(dialog).getByRole("region", { name: "Bir martalik havola tayyor" })).toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: "Telegram guruhini ulash havolasining QR kodi" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Telegram'da ochish" })).toHaveAttribute("href", DEEP_LINK);
    expect(within(dialog).getByRole("timer")).toBeInTheDocument();
    expect(within(dialog).getByText("Bot guruhni o'zi ulaydi, holat shu yerda yangilanadi")).toBeInTheDocument();
    expect(within(dialog).getByText("Guruh ulanishi kutilmoqda…")).toBeInTheDocument();
    expect(mocks.getNotifications).toHaveBeenCalledWith({ market_id: "201", group_type: "cancel", page: 1, limit: 1 });

    // Har 4 s qayta so'rash — 2-javobda qator bor.
    expect(await screen.findByText("Guruh ulandi", undefined, { timeout: 8_000 })).toBeInTheDocument();
    expect(
      screen.getByText("Baraka Shop · Bekor qilinganlar guruhi: buyurtma xabarlari endi shu guruhga keladi."),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Telegram guruhini ulash" })).not.toBeInTheDocument());
  }, 15_000);

  it("keshdagi eski qator (oldingi sessiya / «Bildirishnomalar» oynasi — xuddi shu kalit) «Guruh ulandi» demaydi", async () => {
    mocks.getNotifications.mockResolvedValue(page([]));
    mocks.requestGroupLinkCode.mockResolvedValue(linkCode("create"));
    const user = userEvent.setup();
    const { queryClient } = renderCard("staff", "superadmin");
    const watchParams = { market_id: "201", group_type: "create", page: 1, limit: 1 };
    // Guruh avval ulangan edi, keyin o'chirildi — kesh `invalidate` dan keyin ham eski qatorni saqlaydi.
    queryClient.setQueryData(["notifications", "list", watchParams], page([row()]));

    await user.click(await screen.findByRole("button", { name: "Yangi buyurtmalar guruhini ulash" }));

    const dialog = await screen.findByRole("dialog", { name: "Telegram guruhini ulash" });
    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalledWith(watchParams));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Guruh ulanishi kutilmoqda…")).toBeInTheDocument();
    expect(screen.queryByText("Guruh ulandi")).not.toBeInTheDocument();
  });

  it("guruh ulangach oyna o'zi yopilsa — fokus `<body>` ga emas, o'sha tur qatoriga («Ulash» yo'qoladi)", async () => {
    let watchCalls = 0;
    mocks.getNotifications.mockImplementation(async (params: NotificationParams) => {
      if (!params.group_type) return page(watchCalls > 1 ? [row({ group_type: "cancel" })] : []);
      watchCalls += 1;
      return page(watchCalls > 1 ? [row({ group_type: "cancel" })] : []);
    });
    mocks.requestGroupLinkCode.mockResolvedValue(linkCode("cancel"));
    const user = userEvent.setup();
    renderCard("staff", "superadmin");

    const trigger = await screen.findByRole("button", { name: "Bekor qilinganlar guruhini ulash" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Telegram guruhini ulash" });

    expect(await screen.findByText("Guruh ulandi", undefined, { timeout: 8_000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Telegram guruhini ulash" })).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Bekor qilinganlar guruhini ulash" })).not.toBeInTheDocument(),
    );
    const cancelRow = screen.getByRole("group", { name: "Bekor qilinganlar guruhi" });
    expect(within(cancelRow).getByText("Ulangan")).toBeInTheDocument();
    expect(document.activeElement).toBe(cancelRow);
  }, 15_000);

  it("havola olinmasa — i18n xabar (403 — «ulab bo'lmaydi»), backend matni ko'rsatilmaydi, oyna ochilmaydi", async () => {
    mocks.getNotifications.mockResolvedValue(page([]));
    mocks.requestGroupLinkCode.mockRejectedValue(
      new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 403,
        data: { message: "Guruhni faqat market, uning operatori yoki admin ulay oladi" },
      } as AxiosResponse),
    );
    const user = userEvent.setup();
    renderCard("staff", "admin");

    await user.click(await screen.findByRole("button", { name: "Yangi buyurtmalar guruhini ulash" }));

    expect(await screen.findByText("Havolani olib bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Bu hisob uchun Telegram'ni ulab bo'lmaydi.")).toBeInTheDocument();
    expect(screen.queryByText(/faqat market, uning operatori/)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Telegram guruhini ulash" })).not.toBeInTheDocument();
  });
});

describe("MarketTelegramGroupsCard — `self` (market o'z profilida, `market-profile`)", () => {
  it("holatsiz qatorlar, ikkala turda «Ulash», holat so'ralmaydi, «Barcha guruhlar» havolasi yo'q", () => {
    renderCard("self", "market", "201");

    const card = screen.getByRole("region", { name: "Telegram guruhi" });
    expect(card).toHaveTextContent("Buyurtma xabarlari do'koningizning Telegram guruhiga keladi.");
    expect(within(card).getByRole("heading", { name: "Yangi buyurtmalar guruhi" })).toBeInTheDocument();
    expect(within(card).getByRole("heading", { name: "Bekor qilinganlar guruhi" })).toBeInTheDocument();
    expect(within(card).queryByText("Ulanmagan")).not.toBeInTheDocument();
    expect(within(card).getAllByRole("button", { name: /guruhini ulash/ })).toHaveLength(2);
    expect(within(card).queryByRole("link", { name: /Barcha guruhlar/ })).not.toBeInTheDocument();
    expect(mocks.getNotifications).not.toHaveBeenCalled();
  });

  it("«Ulash» — `market_id` siz (server o'z marketini oladi); oynada kutish qatori yo'q, 3-qadam — bildirishnoma", async () => {
    mocks.requestGroupLinkCode.mockResolvedValue(linkCode("create"));
    const user = userEvent.setup();
    renderCard("self", "market", "201");

    await user.click(screen.getByRole("button", { name: "Yangi buyurtmalar guruhini ulash" }));

    expect(mocks.requestGroupLinkCode).toHaveBeenCalledWith({ purpose: "market_group", group_type: "create" });
    const dialog = await screen.findByRole("dialog", { name: "Telegram guruhini ulash" });
    expect(dialog).toHaveAccessibleDescription("Baraka Shop · Yangi buyurtmalar guruhi");
    expect(within(dialog).getByText("Bot guruhni o'zi ulaydi — ulanganda sizga bildirishnoma keladi")).toBeInTheDocument();
    expect(within(dialog).queryByText("Guruh ulanishi kutilmoqda…")).not.toBeInTheDocument();
    expect(mocks.getNotifications).not.toHaveBeenCalled();

    // Footerdagi «Yopish» (sarlavhadagi «×» ham shu nomda).
    await user.click(within(dialog).getAllByRole("button", { name: "Yopish" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Telegram guruhini ulash" })).not.toBeInTheDocument());
  });
});

describe("MarketTelegramGroupsCard — «Guruhda mijoz ismi va telefoni» (S3)", () => {
  const piiName = { name: "Guruhda mijoz ismi va telefoni" };

  it("kartaning oxirgi qatori, izohi maketdagidek; maydon kelmasa — yoqiq; bosilsa — tasdiqsiz PATCH va «Saqlandi»", async () => {
    mocks.getNotifications.mockResolvedValue(page([]));
    mocks.updatePii.mockResolvedValue({});
    const user = userEvent.setup();
    renderCard("staff", "admin");

    const control = screen.getByRole("switch", piiName);
    expect(control).toHaveAttribute("aria-checked", "true");
    expect(control).toHaveAccessibleDescription(
      "O'chirilsa, guruhdagi buyurtma kartalarida mijoz ismi va telefoni yashiriladi. O'zgarish darhol saqlanadi.",
    );

    await user.click(control);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.updatePii).toHaveBeenCalledWith({ id: "201", tg_group_show_customer_pii: false }));
    expect(await screen.findByText("Saqlandi")).toBeInTheDocument();
    expect(control).toHaveAttribute("aria-checked", "false");
  });

  it("PATCH yiqilsa — kalit qaytadi, faqat i18n matn (backend matni chiqmaydi)", async () => {
    mocks.updatePii.mockRejectedValue(
      new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 403,
        data: { message: "Forbidden resource" },
      } as AxiosResponse),
    );
    const user = userEvent.setup();
    renderCard("self", "market", "201");

    const control = screen.getByRole("switch", piiName);
    await user.click(control);

    expect(await screen.findByText("Saqlanmadi")).toBeInTheDocument();
    expect(screen.getByText("Sozlamani saqlab bo'lmadi. Qayta urinib ko'ring.")).toBeInTheDocument();
    expect(screen.queryByText("Forbidden resource")).not.toBeInTheDocument();
    expect(control).toHaveAttribute("aria-checked", "true");
  });
});

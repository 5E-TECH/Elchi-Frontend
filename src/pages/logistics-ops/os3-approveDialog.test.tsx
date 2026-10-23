import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LogisticsOpsPage from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { mockEnvelope } from "../../test/mockEnvelope";
import i18n from "../../i18n";

/**
 * OS-3 — /logistics-ops: qaytarish so'rovlarini tasdiqlash oynasi (maket
 * `superadmin-ops-logistics-approve-dialog`) va natija xabari (ega S5,
 * `superadmin-ops-logistics-approve-result`). Oyna va xabar haqiqiy UI orqali (mock emas).
 */

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGetMock(...a),
    post: (...a: unknown[]) => apiPostMock(...a),
  },
}));

const listResponse = (scopeType: "HQ" | "BRANCH" | null = "HQ") =>
  mockEnvelope({
    total: 7,
    ...(scopeType ? { scope: { type: scopeType, branch_id: "1" } } : {}),
    groups: [
      {
        courier_id: "56",
        courier: { id: "56", name: "Jasur Tursunov" },
        orders: [
          { id: "9001", status: "waiting" },
          { id: "9002", status: "on the road" },
          { id: "9003", status: "waiting" },
          { id: "9004", status: "on the road" },
          { id: "9005", status: "waiting" },
        ],
      },
      { courier_id: null, courier: null, orders: [{ id: "9007", status: "waiting" }] },
      { courier_id: "57", courier: { id: "57", name: "Sherzod Komilov" }, orders: [{ id: "9006", status: "waiting" }] },
    ],
  });

const DIALOG = { name: "Qaytarish so'rovlarini tasdiqlang" };

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByText("Sherzod Komilov");
  await user.click(screen.getByRole("checkbox", { name: "Barcha so'rovlarni tanlash" }));
  await user.click(screen.getByRole("button", { name: "Tasdiqlash — 7 ta" }));
  return screen.findByRole("alertdialog", DIALOG);
};

describe("LogisticsOps — tasdiq oynasi va natija (OS-3)", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiGetMock.mockResolvedValue(listResponse());
    apiPostMock.mockResolvedValue(
      mockEnvelope({
        approved: 7,
        order_ids: ["9001", "9002", "9003", "9004", "9005", "9007", "9006"],
        skipped_order_ids: [],
      }),
    );
  });

  afterEach(async () => {
    await i18n.changeLanguage("uz");
  });

  it("oyna: HQ ombori, buyurtma va kuryer soni, kuryersiz qator, guruhlar, eslatma; «Bekor qilish» — so'rovsiz", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LogisticsOpsPage />);
    const dialog = await openDialog(user);

    expect(dialog).toHaveTextContent(
      "7 ta buyurtma kuryerlardan olinadi va HQ omboriga qaytariladi. Holati «Kutilmoqda» bo'ladi, kuryer va pochtadan ajratiladi.",
    );
    expect(within(dialog).getByText("Buyurtmalar").nextSibling).toHaveTextContent("7 ta");
    expect(within(dialog).getByText("Kuryerlar").nextSibling).toHaveTextContent("2 ta");
    expect(within(dialog).getByText("+ 1 ta buyurtma kuryersiz")).toBeInTheDocument();

    const groups = within(dialog).getByRole("list", { name: "Kuryerlar bo'yicha" });
    const items = within(groups)
      .getAllByRole("listitem")
      .filter((item) => item.parentElement === groups);
    // Ro'yxat tartibida, kuryersiz guruh — oxirida.
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Jasur Tursunov5 ta"),
      expect.stringContaining("Sherzod Komilov1 ta"),
      expect.stringContaining("Kuryer biriktirilmagan1 ta"),
    ]);
    // Har kuryerda birinchi 3 buyurtma, qolgani «+ yana N ta».
    expect(within(items[0]).getByText("№9001")).toBeInTheDocument();
    expect(within(items[0]).queryByText("№9004")).not.toBeInTheDocument();
    expect(within(items[0]).getByText("+ yana 2 ta")).toBeInTheDocument();
    // Backend `Order_status.ON_THE_ROAD = 'on the road'` (bo'shliq bilan) — tarjima, xom qiymat emas.
    expect(within(items[0]).getByText("Kuryer qo'lida")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("on the road");
    // Telefonda guruhlar ro'yxati 30dvh bilan cheklanadi — xato bloki pastki tugmalar ortida qolmaydi.
    expect(groups.className).toContain("max-md:max-h-[min(340px,30dvh)]");
    expect(within(items[0]).getByText("JT")).toBeInTheDocument();

    expect(
      within(dialog).getByText(
        "Bu amalni bekor qilib bo'lmaydi. Shu orada boshqa xodim ko'rib chiqqan yoki holati o'zgargan buyurtma o'tkazib yuboriladi va natijada ko'rsatiladi.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog", DIALOG)).not.toBeInTheDocument());
    expect(apiPostMock).not.toHaveBeenCalled();
    // Tanlov saqlanadi.
    expect(screen.getByRole("button", { name: "Tasdiqlash — 7 ta" })).toBeEnabled();
  });

  it("filial doirasida — «filial omboriga qaytariladi»", async () => {
    const user = userEvent.setup();
    apiGetMock.mockResolvedValue(listResponse("BRANCH"));
    renderWithProviders(<LogisticsOpsPage />);
    const dialog = await openDialog(user);

    expect(dialog).toHaveTextContent("7 ta buyurtma kuryerlardan olinadi va filial omboriga qaytariladi.");
  });

  it("doira noma'lum bo'lsa — «omborga qaytariladi» (HQ/filial yozilmaydi)", async () => {
    const user = userEvent.setup();
    apiGetMock.mockResolvedValue(listResponse(null));
    renderWithProviders(<LogisticsOpsPage />);
    const dialog = await openDialog(user);

    expect(dialog).toHaveTextContent("7 ta buyurtma kuryerlardan olinadi va omborga qaytariladi.");
  });

  it("ro'yxatda ham «on the road» holati tarjima bilan ko'rinadi", async () => {
    renderWithProviders(<LogisticsOpsPage />);
    await screen.findByText("Sherzod Komilov");
    expect(screen.getAllByText("Kuryer qo'lida").length).toBeGreaterThan(0);
    expect(screen.queryByText("on the road")).not.toBeInTheDocument();
  });

  it("hammasi tasdiqlansa — muvaffaqiyat xabari, tanlov tozalanadi, ro'yxat yangilanadi", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<LogisticsOpsPage />);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const dialog = await openDialog(user);
    const getCalls = apiGetMock.mock.calls.length;

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));

    expect(apiPostMock).toHaveBeenCalledWith("post/return-requests/approve", {
      order_ids: ["9001", "9002", "9003", "9004", "9005", "9007", "9006"],
    });
    expect(await screen.findByText("7 ta tasdiqlandi")).toBeInTheDocument();
    expect(screen.getByText("7 ta buyurtma omborga qaytarildi.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog", DIALOG)).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Tasdiqlash — 0 ta" })).toBeDisabled();
    await waitFor(() => expect(apiGetMock.mock.calls.length).toBeGreaterThan(getCalls));
    // Pochta (qaytarish, eski, yangi) va buyurtmalar ham yangilanadi.
    for (const queryKey of [["mails", "return"], ["mails", "old"], ["mails", "new"], ["orders"]]) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
    }
  });

  it("qisman: «N ta tasdiqlandi, M tasi o'tkazib yuborildi» ogohlantirishi va o'tkazilgan buyurtma raqami", async () => {
    const user = userEvent.setup();
    apiPostMock.mockResolvedValue(mockEnvelope({ approved: 6, order_ids: [], skipped_order_ids: ["9004"] }));
    renderWithProviders(<LogisticsOpsPage />);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));

    expect(await screen.findByText("6 ta tasdiqlandi, 1 tasi o'tkazib yuborildi")).toBeInTheDocument();
    expect(
      screen.getByText(
        "6 ta buyurtma omborga qaytarildi. №9004 ni shu orada boshqa xodim ko'rib chiqqan yoki holati o'zgargan.",
      ),
    ).toBeInTheDocument();
  });

  it("ko'p o'tkazib yuborilsa — 3 tasi nomi bilan, qolgani «va yana N ta»", async () => {
    const user = userEvent.setup();
    apiPostMock.mockResolvedValue(mockEnvelope({ approved: 2, skipped_order_ids: ["9001", "9002", "9003", "9004", "9005"] }));
    renderWithProviders(<LogisticsOpsPage />);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));

    expect(await screen.findByText("2 ta tasdiqlandi, 5 tasi o'tkazib yuborildi")).toBeInTheDocument();
    expect(
      screen.getByText(
        "2 ta buyurtma omborga qaytarildi. №9001, №9002, №9003 va yana 2 tasini shu orada boshqa xodim ko'rib chiqqan yoki holati o'zgargan.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ta ni /)).not.toBeInTheDocument();
  });

  it("en: bir nechta o'tkazilgan — ko'plikda («them»), 3 tadan ko'p — «and N more»", async () => {
    await i18n.changeLanguage("en");
    const user = userEvent.setup();
    apiPostMock.mockResolvedValueOnce(mockEnvelope({ approved: 5, skipped_order_ids: ["9001", "9002"] }));
    apiPostMock.mockResolvedValueOnce(mockEnvelope({ approved: 2, skipped_order_ids: ["9001", "9002", "9003", "9004", "9005"] }));
    renderWithProviders(<LogisticsOpsPage />);
    await screen.findByText("Sherzod Komilov");
    const approveAll = async () => {
      await user.click(screen.getByRole("checkbox", { name: "Select all requests" }));
      await user.click(screen.getByRole("button", { name: "Approve — 7" }));
      const dialog = await screen.findByRole("alertdialog", { name: "Confirm return requests" });
      await user.click(within(dialog).getByRole("button", { name: "Approve 7" }));
    };

    await approveAll();
    expect(
      await screen.findByText(
        "Returned to the warehouse: 5. №9001, №9002: another employee reviewed them meanwhile or their status changed.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    await approveAll();
    expect(
      await screen.findByText(
        "Returned to the warehouse: 2. №9001, №9002, №9003 and 2 more: another employee reviewed them meanwhile or their status changed.",
      ),
    ).toBeInTheDocument();
  });

  it("hech biri tasdiqlanmasa — «0 ta buyurtma omborga qaytarildi» yozilmaydi", async () => {
    const user = userEvent.setup();
    apiPostMock.mockResolvedValue(mockEnvelope({ approved: 0, skipped_order_ids: ["9004"] }));
    renderWithProviders(<LogisticsOpsPage />);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));

    expect(await screen.findByText("0 ta tasdiqlandi, 1 tasi o'tkazib yuborildi")).toBeInTheDocument();
    expect(
      screen.getByText("№9004 ni shu orada boshqa xodim ko'rib chiqqan yoki holati o'zgargan."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/omborga qaytarildi/)).not.toBeInTheDocument();
  });

  it("404 (shu orada ko'rib chiqilgan) — oyna ochiq, i18n matn; ro'yxat baribir yangilanadi (onSettled)", async () => {
    const user = userEvent.setup();
    apiPostMock.mockRejectedValue({
      response: { status: 404, data: { message: "Tanlangan buyurtmalarda ko'rib chiqilmagan qaytarish so'rovi topilmadi" } },
    });
    renderWithProviders(<LogisticsOpsPage />);
    const dialog = await openDialog(user);
    const getCalls = apiGetMock.mock.calls.length;

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Tanlangan so'rovlar shu orada ko'rib chiqilgan yoki holati o'zgargan. Ro'yxat yangilandi — oynani yoping va qayta tanlang.",
    );
    expect(screen.queryByText(/ko'rib chiqilmagan qaytarish so'rovi topilmadi/)).not.toBeInTheDocument();
    await waitFor(() => expect(apiGetMock.mock.calls.length).toBeGreaterThan(getCalls));
    expect(screen.getByRole("alertdialog", DIALOG)).toBeInTheDocument();
  });

  it("5xx — «ayrimlari qaytgan bo'lishi mumkin» matni, qayta urinish oynaning o'zidan", async () => {
    const user = userEvent.setup();
    apiPostMock.mockRejectedValueOnce({ response: { status: 500, data: { message: "Order #9001 update failed" } } });
    renderWithProviders(<LogisticsOpsPage />);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Tasdiqlashda xato yuz berdi. Ayrim buyurtmalar omborga qaytgan bo'lishi mumkin — ro'yxat yangilandi, tekshirib qayta urinib ko'ring.",
    );

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));
    expect(await screen.findByText("7 ta tasdiqlandi")).toBeInTheDocument();
    expect(apiPostMock).toHaveBeenCalledTimes(2);
  });

  it("xato chiqqanda oyna tanasi xato blokiga suriladi (telefonda pastda qolmasin)", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      apiPostMock.mockRejectedValueOnce({ response: { status: 403 } });
      renderWithProviders(<LogisticsOpsPage />);
      const dialog = await openDialog(user);
      await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));

      const alert = await within(dialog).findByRole("alert");
      await waitFor(() => expect(scrollIntoView.mock.contexts).toContain(alert));
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("vaqt chegarasi (timeout) — 5xx kabi «ayrimlari qaytgan bo'lishi mumkin» matni", async () => {
    const user = userEvent.setup();
    apiPostMock.mockRejectedValueOnce({ isAxiosError: true, code: "ECONNABORTED", message: "timeout of 20000ms exceeded" });
    renderWithProviders(<LogisticsOpsPage />);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Tasdiqlashda xato yuz berdi. Ayrim buyurtmalar omborga qaytgan bo'lishi mumkin — ro'yxat yangilandi, tekshirib qayta urinib ko'ring.",
    );
    expect(screen.queryByText(/timeout of/)).not.toBeInTheDocument();
  });

  it("bo'sh ro'yxat — EmptyState sarlavha va izoh bilan", async () => {
    apiGetMock.mockResolvedValue(mockEnvelope({ total: 0, scope: { type: "HQ" }, groups: [] }));
    renderWithProviders(<LogisticsOpsPage />);

    expect(await screen.findByText("Qaytarish so'rovlari yo'q")).toBeInTheDocument();
    expect(screen.getByText("Yangi so'rov kelganda shu yerda ko'rinadi.")).toBeInTheDocument();
    expect(screen.getByText("0 ta")).toBeInTheDocument();
  });

  it("ru: oyna sarlavhasi va tugma tanlangan tilda", async () => {
    await i18n.changeLanguage("ru");
    const user = userEvent.setup();
    renderWithProviders(<LogisticsOpsPage />);
    await screen.findByText("Sherzod Komilov");
    await user.click(screen.getByRole("checkbox", { name: "Выбрать все запросы" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить — 7" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Подтвердите запросы на возврат" });
    expect(dialog).toHaveTextContent("Заказы (7) будут изъяты у курьеров и возвращены на склад HQ.");
    expect(within(dialog).getByText("+ без курьера: 1")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Подтвердить 7" })).toBeInTheDocument();
  });
});
